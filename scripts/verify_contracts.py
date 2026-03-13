#!/usr/bin/env python3
"""
verify_contracts.py - Post-tool-use hook to verify that TypeScript interfaces
in contracts are still syntactically valid after code changes.

This is a lightweight check - for deep semantic verification, use the
verification roll-up endpoint which calls Claude Haiku.
"""
import os
import sys
import re
import json
from pathlib import Path

def find_contracts(project_dir: str) -> list:
    """Find contract files in the workspace."""
    contracts = []
    contract_patterns = ['*.contract.ts', 'contracts/*.ts', 'interfaces/*.ts']

    for pattern in contract_patterns:
        contracts.extend(Path(project_dir).glob(pattern))

    return contracts

def check_typescript_syntax(content: str) -> list:
    """
    Basic TypeScript syntax checks for interface/type definitions.
    Not a full parser - catches obvious issues.
    """
    issues = []

    # Check balanced braces
    opens = content.count('{')
    closes = content.count('}')
    if opens != closes:
        issues.append(f"Unbalanced braces: {opens} open, {closes} close")

    # Check for common syntax errors in interfaces
    # Missing semicolons after properties
    interface_blocks = re.findall(r'interface\s+\w+\s*\{([^}]+)\}', content, re.DOTALL)
    for block in interface_blocks:
        lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
        for line in lines:
            if line and not line.startswith('//') and not line.startswith('*'):
                if not line.endswith(';') and not line.endswith(',') and not line.endswith('{') and not line.endswith('}'):
                    issues.append(f"Missing semicolon in interface property: {line[:50]}")

    return issues

def main():
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')
    contracts = find_contracts(project_dir)

    all_issues = []
    for contract_path in contracts:
        try:
            content = contract_path.read_text(encoding='utf-8')
            issues = check_typescript_syntax(content)
            for issue in issues:
                all_issues.append(f"{contract_path.name}: {issue}")
        except (IOError, OSError) as e:
            all_issues.append(f"Could not read {contract_path.name}: {e}")

    if all_issues:
        print("Contract verification warnings (non-blocking):", file=sys.stderr)
        for issue in all_issues[:10]:
            print(f"  ⚠ {issue}", file=sys.stderr)
    else:
        if contracts:
            print(f"✓ {len(contracts)} contract(s) verified", file=sys.stderr)

    # Non-blocking: always exit 0 (warnings only, not errors)
    sys.exit(0)

if __name__ == '__main__':
    main()
