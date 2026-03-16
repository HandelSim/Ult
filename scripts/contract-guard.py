#!/usr/bin/env python3
"""
Improvement 4: Contract Guard — PreToolUse hook
Intercepts Write/Edit tool calls on contract files and classifies the change.

Usage: Configured as a PreToolUse hook in Claude Code settings.json:
  {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{"type": "command", "command": "python3 /workspace/scripts/contract-guard.py"}]
      }
    ]
  }

The hook receives tool call data via stdin as JSON.
It outputs a proposal file to .contract-proposals/ for the file watcher to process.
"""

import json
import sys
import os
import re
from pathlib import Path
from datetime import datetime

CONTRACT_PATTERNS = [
    r"\.contract\.ts$",
    r"contracts/.*\.ts$",
    r"contracts/.*\.json$",
    r"contracts/.*\.md$",
]

PROPOSAL_DIR = Path(os.environ.get("CONTRACT_PROPOSALS_DIR", ".contract-proposals"))


def is_contract_file(file_path: str) -> bool:
    """Check if the file path matches a contract file pattern."""
    for pattern in CONTRACT_PATTERNS:
        if re.search(pattern, file_path):
            return True
    return False


def classify_change(old_content: str, new_content: str) -> tuple[str, str]:
    """
    Classify whether a change is backward-compatible or breaking.
    Returns (change_type, analysis).
    """
    if not old_content:
        return "backward_compatible", "New contract file — no existing interface to break."

    # Heuristic analysis
    old_lines = set(old_content.splitlines())
    new_lines = set(new_content.splitlines())

    removed = old_lines - new_lines
    added = new_lines - old_lines

    # Check for removed interface members (breaking)
    removed_fields = [l for l in removed if re.search(r"^\s+\w+[?]?\s*:", l)]
    # Check for removed exports (breaking)
    removed_exports = [l for l in removed if re.search(r"^export\s+(interface|type|const|function)", l)]

    if removed_exports or removed_fields:
        analysis = (
            f"BREAKING CHANGE detected:\n"
            f"  Removed exports: {removed_exports[:3]}\n"
            f"  Removed fields: {removed_fields[:3]}\n"
            f"  Consumers may break if they depend on removed items."
        )
        return "breaking", analysis
    elif added:
        analysis = (
            f"Backward-compatible change:\n"
            f"  Added {len(added)} lines, removed 0 required members.\n"
            f"  Consumers should not be affected."
        )
        return "backward_compatible", analysis
    else:
        return "unknown", "Minor change — manual review recommended."


def main():
    try:
        hook_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        # Not valid JSON or empty — allow through
        sys.exit(0)

    tool_name = hook_data.get("tool_name", "")
    tool_input = hook_data.get("tool_input", {})

    # Determine file path from tool input
    file_path = tool_input.get("file_path") or tool_input.get("path", "")

    if not file_path or not is_contract_file(file_path):
        sys.exit(0)  # Not a contract file — allow through

    old_content = ""
    if Path(file_path).exists():
        try:
            old_content = Path(file_path).read_text()
        except Exception:
            pass

    new_content = tool_input.get("content") or tool_input.get("new_string", "")

    change_type, analysis = classify_change(old_content, new_content)

    # Write proposal to .contract-proposals/ directory
    PROPOSAL_DIR.mkdir(exist_ok=True)
    proposal_id = f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{os.urandom(4).hex()}"
    proposal_file = PROPOSAL_DIR / f"{proposal_id}.json"

    proposal = {
        "id": proposal_id,
        "file_path": file_path,
        "tool_name": tool_name,
        "change_type": change_type,
        "analysis": analysis,
        "old_content": old_content,
        "new_content": new_content,
        "created_at": datetime.now().isoformat(),
        "auto_approve": change_type == "backward_compatible",
    }

    proposal_file.write_text(json.dumps(proposal, indent=2))

    if change_type == "breaking":
        # Block the write — output error for Claude to see
        print(f"[contract-guard] BLOCKED: Breaking contract change detected in {file_path}")
        print(f"[contract-guard] Analysis: {analysis}")
        print(f"[contract-guard] Proposal saved: {proposal_file}")
        print(f"[contract-guard] Human review required. Check the Contract Changes panel in ATO.")
        sys.exit(1)  # Non-zero exit blocks the tool call
    else:
        print(f"[contract-guard] Auto-approving backward-compatible change to {file_path}")
        # Mark as auto-approved
        proposal["status"] = "approved"
        proposal["reviewed_by"] = "auto"
        proposal_file.write_text(json.dumps(proposal, indent=2))
        sys.exit(0)  # Allow through


if __name__ == "__main__":
    main()
