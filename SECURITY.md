# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 5.x     | :white_check_mark: |
| < 5.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email your report to **bahri.hirfanoglu@hotmail.com** with the subject line `[SECURITY] Claude Board`.
3. Include a detailed description of the vulnerability, steps to reproduce, and potential impact.
4. Allow up to 72 hours for an initial response.

## Security Considerations

Claude Board spawns Claude CLI processes with configurable permission modes. Please be aware:

- **`auto-accept` mode** uses `--dangerously-skip-permissions`, which allows Claude to execute any tool without confirmation. Only use this in trusted, isolated environments.
- **`allow-tools` mode** restricts Claude to a specific set of tools defined per project.
- **`default` mode** uses Claude CLI's default permission system.

### Recommendations

- Run Claude Board in an isolated environment (VM or sandboxed environment) when using `auto-accept` mode.
- Use `allow-tools` mode in production and restrict to only necessary tools.
- Keep your Tauri and Rust dependencies up to date.
- Regularly update dependencies to patch known vulnerabilities.

## Scope

The following are in scope for security reports:

- Authentication bypass
- Command injection
- Unauthorized access to files or data
- Cross-site scripting (XSS)
- SQL injection
- Privilege escalation

Thank you for helping keep Claude Board secure.
