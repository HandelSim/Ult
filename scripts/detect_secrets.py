#!/usr/bin/env python3
"""
detect_secrets.py - Pre-tool-use hook to detect potential secrets in files
being written by agents. Blocks writes that would commit credentials.

Checks for common patterns:
- API keys (sk-, pk-, AKIA, etc.)
- Connection strings with passwords
- Private keys (BEGIN RSA PRIVATE KEY, etc.)
- Hard-coded tokens
"""
import os
import sys
import re
import json

# Patterns that indicate secrets - each is (name, pattern)
SECRET_PATTERNS = [
    ('AWS Access Key', r'AKIA[0-9A-Z]{16}'),
    ('AWS Secret Key', r'(?i)aws_secret_access_key\s*=\s*[\'"][0-9a-zA-Z/+]{40}[\'"]'),
    ('Generic API Key', r'(?i)(api[_-]?key|apikey)\s*[=:]\s*[\'"][a-zA-Z0-9_\-]{20,}[\'"]'),
    ('Anthropic Key', r'sk-ant-[a-zA-Z0-9\-]{90,}'),
    ('OpenAI Key', r'sk-[a-zA-Z0-9]{48}'),
    ('Private Key Header', r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
    ('Generic Secret', r'(?i)(secret|password|passwd|pwd)\s*[=:]\s*[\'"][^\'"]{8,}[\'"]'),
    ('Database URL with Password', r'(?i)(postgres|mysql|mongodb):\/\/[^:]+:[^@]+@'),
    ('Bearer Token', r'(?i)bearer\s+[a-zA-Z0-9._\-]{20,}'),
    ('GitHub Token', r'ghp_[a-zA-Z0-9]{36}'),
]

# File extensions to check
CHECKABLE_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.py', '.env', '.json', '.yaml', '.yml', '.sh', '.toml'}

# Patterns to explicitly allow (test/example values)
ALLOWLIST_PATTERNS = [
    r'your_[a-z_]+_here',
    r'example[_\-]?key',
    r'test[_\-]?key',
    r'fake[_\-]?key',
    r'\$\{[A-Z_]+\}',  # Environment variable references
    r'process\.env\.',
    r'ANTHROPIC_API_KEY',  # Variable name references (not values)
]

def is_allowlisted(match_text: str) -> bool:
    """Check if the matched text is an allowlisted pattern (not a real secret)."""
    for pattern in ALLOWLIST_PATTERNS:
        if re.search(pattern, match_text, re.IGNORECASE):
            return True
    return False

def check_content(content: str) -> list:
    """Find secret patterns in content. Returns list of (name, snippet) tuples."""
    findings = []
    for name, pattern in SECRET_PATTERNS:
        matches = re.finditer(pattern, content)
        for match in matches:
            matched_text = match.group(0)
            if not is_allowlisted(matched_text):
                # Redact the middle portion for safe logging
                snippet = matched_text[:8] + '...' + matched_text[-4:] if len(matched_text) > 16 else matched_text[:4] + '...'
                findings.append((name, snippet))
    return findings

def main():
    file_path = os.environ.get('CLAUDE_FILE_PATH', '')

    if not file_path or not os.path.exists(file_path):
        sys.exit(0)

    # Only check certain file types
    ext = os.path.splitext(file_path)[1].lower()
    if ext not in CHECKABLE_EXTENSIONS and not file_path.endswith('.env'):
        sys.exit(0)

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except (IOError, OSError):
        sys.exit(0)

    findings = check_content(content)

    if findings:
        messages = [f"  - {name}: '{snippet}'" for name, snippet in findings[:5]]
        result = {
            "block": True,
            "message": (
                f"SECRET DETECTED in {file_path}:\n" +
                "\n".join(messages) +
                "\n\nUse environment variables instead. Reference them as process.env.VAR_NAME"
            )
        }
        print(json.dumps(result), file=sys.stderr)
        sys.exit(2)

    sys.exit(0)

if __name__ == '__main__':
    main()
