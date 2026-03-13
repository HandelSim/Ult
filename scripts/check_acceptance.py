#!/usr/bin/env python3
"""
check_acceptance.py - Verify acceptance criteria for a completed node.

This script reads the acceptance criteria from CLAUDE.md and performs
automated checks where possible. It's called by the verification roll-up service.

Usage:
    python3 check_acceptance.py [workspace_path]

Exits:
    0 - All automated checks passed
    1 - One or more checks failed
    2 - Could not determine pass/fail (needs human review)
"""
import os
import sys
import json
import re
from pathlib import Path

def load_acceptance_criteria(workspace_path: str) -> list:
    """Parse acceptance criteria from CLAUDE.md."""
    claude_md = Path(workspace_path) / 'CLAUDE.md'
    if not claude_md.exists():
        return []

    content = claude_md.read_text(encoding='utf-8')
    criteria = []
    in_criteria = False

    for line in content.split('\n'):
        if 'Acceptance Criteria' in line:
            in_criteria = True
            continue
        if in_criteria:
            if line.startswith('#'):
                break
            stripped = line.strip()
            if stripped.startswith('- ') or stripped.startswith('* '):
                criteria.append(stripped[2:])

    return criteria

def check_files_exist(workspace_path: str, criteria: list) -> list:
    """Check criteria that reference specific files."""
    results = []
    for criterion in criteria:
        # Look for patterns like "file X exists" or "creates X.ts"
        file_refs = re.findall(r'[`\'"]([^`\'"]+\.[a-zA-Z]{1,5})[`\'"]', criterion)
        for file_ref in file_refs:
            full_path = Path(workspace_path) / file_ref
            if full_path.exists():
                results.append({'criterion': criterion, 'status': 'pass', 'detail': f'{file_ref} exists'})
            else:
                # Try to find it anywhere in workspace
                matches = list(Path(workspace_path).rglob(Path(file_ref).name))
                if matches:
                    results.append({'criterion': criterion, 'status': 'pass', 'detail': f'{file_ref} found at {matches[0]}'})
                else:
                    results.append({'criterion': criterion, 'status': 'unknown', 'detail': f'{file_ref} not found'})

    return results

def main():
    workspace_path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('CLAUDE_PROJECT_DIR', '.')

    criteria = load_acceptance_criteria(workspace_path)

    if not criteria:
        print(json.dumps({
            'status': 'unknown',
            'message': 'No acceptance criteria found in CLAUDE.md',
            'results': []
        }))
        sys.exit(2)

    results = check_files_exist(workspace_path, criteria)

    passed = sum(1 for r in results if r['status'] == 'pass')
    failed = sum(1 for r in results if r['status'] == 'fail')
    unknown = sum(1 for r in results if r['status'] == 'unknown')

    output = {
        'status': 'pass' if failed == 0 else 'fail',
        'criteria_count': len(criteria),
        'automated_checks': len(results),
        'passed': passed,
        'failed': failed,
        'unknown': unknown,
        'results': results
    }

    print(json.dumps(output, indent=2))

    if failed > 0:
        sys.exit(1)
    elif unknown > 0:
        sys.exit(2)
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()
