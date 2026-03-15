# Contributing to Claude Board

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/bahri-hirfanoglu/claude-board.git
cd claude-board

# Install all dependencies
npm run setup

# Start development servers (backend + frontend with hot reload)
npm run dev
```

The backend runs on `http://localhost:4000` and the Vite dev server on `http://localhost:5173` with API proxy.

## Project Structure

- **`src/`** &mdash; Backend (Express, SQLite, Claude runner)
- **`client/src/`** &mdash; Frontend (React, Tailwind)
- **`client/src/features/`** &mdash; Feature-based component modules
- **`client/src/hooks/`** &mdash; Custom React hooks
- **`client/src/lib/`** &mdash; Shared utilities and constants

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run lint: `npm run lint`
5. Test locally with `npm run dev`
6. Build to verify: `npm run build`
7. Commit with clear messages (pre-commit hooks will run automatically)
8. Push and open a Pull Request

## Code Quality

This project uses **ESLint** for linting and **Prettier** for code formatting. Pre-commit hooks via **Husky** and **lint-staged** enforce these automatically.

```bash
# Run linting
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format code
npm run format

# Check formatting without writing
npm run format:check
```

## Code Style

- Use ES modules (`import`/`export`)
- React functional components with hooks
- Tailwind CSS for styling (use existing `surface-*` and `claude` color tokens)
- Keep components focused &mdash; extract hooks for business logic
- Feature-based file organization under `features/`
- Follow the existing Prettier configuration (single quotes, trailing commas, 120 char width)

## Reporting Issues

- Use [GitHub Issues](https://github.com/bahri-hirfanoglu/claude-board/issues)
- Choose the appropriate template (Bug Report or Feature Request)
- Include steps to reproduce
- Include browser/Node.js version
- Include relevant error logs

## Security

If you discover a security vulnerability, please read our [Security Policy](SECURITY.md) for responsible disclosure instructions. **Do not** open a public issue for security vulnerabilities.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
