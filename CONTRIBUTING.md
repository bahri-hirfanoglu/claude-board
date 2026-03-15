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
4. Test locally with `npm run dev`
5. Build to verify: `npm run build`
6. Commit with clear messages
7. Push and open a Pull Request

## Code Style

- Use ES modules (`import`/`export`)
- React functional components with hooks
- Tailwind CSS for styling (use existing `surface-*` and `claude` color tokens)
- Keep components focused &mdash; extract hooks for business logic
- Feature-based file organization under `features/`

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include browser/Node.js version
- Include relevant error logs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
