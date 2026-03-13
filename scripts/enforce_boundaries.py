#!/usr/bin/env python3
"""
enforce_boundaries.py - Pre-tool-use hook to prevent agents from writing
outside their designated file paths.

Environment variables set by Claude Code hooks:
  CLAUDE_FILE_PATH      - The file being written/edited
  CLAUDE_PROJECT_DIR    - The Claude Code project root
  CLAUDE_ALLOWED_PATHS  - Colon-separated list of allowed paths (from settings)
"""
import os
import sys
import json

def get_allowed_paths():
    """Read allowed paths from CLAUDE.md or environment."""
    # Try environment variable first
    allowed_env = os.environ.get('CLAUDE_ALLOWED_PATHS', '')
    if allowed_env:
        return [p.strip() for p in allowed_env.split(':') if p.strip()]

    # Try reading from CLAUDE.md in project dir
    project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')
    claude_md_path = os.path.join(project_dir, 'CLAUDE.md')

    if os.path.exists(claude_md_path):
        with open(claude_md_path, 'r') as f:
            content = f.read()

        # Parse "File Boundaries" section
        paths = []
        in_boundaries = False
        for line in content.split('\n'):
            if 'File Boundaries' in line:
                in_boundaries = True
                continue
            if in_boundaries:
                if line.startswith('#'):
                    break
                # Extract paths from bullet points like "- `src/components/`"
                stripped = line.strip()
                if stripped.startswith('- `') and stripped.endswith('`'):
                    path = stripped[3:-1]
                    paths.append(path)
                elif stripped.startswith('- ') and not stripped.startswith('- ('):
                    paths.append(stripped[2:])

        return paths

    return []

def check_path_allowed(file_path: str, allowed_paths: list) -> bool:
    """Check if file_path is within any of the allowed paths."""
    if not allowed_paths:
        return True  # No restrictions if no allowed paths defined

    # Normalize paths for comparison
    file_path = os.path.normpath(file_path)

    for allowed in allowed_paths:
        # Handle both absolute and relative paths
        allowed_norm = os.path.normpath(allowed)
        if file_path.startswith(allowed_norm) or file_path.startswith(os.path.join(os.getcwd(), allowed_norm)):
            return True

    return False

def main():
    file_path = os.environ.get('CLAUDE_FILE_PATH', '')

    if not file_path:
        # No file path specified, allow
        sys.exit(0)

    allowed_paths = get_allowed_paths()

    if not allowed_paths:
        # No boundaries configured, allow all
        sys.exit(0)

    if check_path_allowed(file_path, allowed_paths):
        sys.exit(0)  # Allowed
    else:
        # Block the operation
        result = {
            "block": True,
            "message": f"BOUNDARY VIOLATION: Attempt to write to '{file_path}' which is outside allowed paths: {allowed_paths}"
        }
        print(json.dumps(result), file=sys.stderr)
        sys.exit(2)

if __name__ == '__main__':
    main()
