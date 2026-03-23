---
title: "Building from Source"
description: "Build the desktop app for Windows, macOS, and Linux"
icon: "hammer"
---

Claude Board uses [Tauri v2](https://v2.tauri.app/) to produce native desktop applications. The frontend is built with React + Vite, and the backend is written in Rust.

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org) 18+
- npm or yarn
- Platform-specific Tauri dependencies — see the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)

## Build Commands

<Tabs>
  <Tab title="Windows">
    ```bash
    npx tauri build
    ```
    Produces `.exe` and `.msi` installers in `src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`.
  </Tab>
  <Tab title="macOS">
    ```bash
    npx tauri build
    ```
    Produces a `.dmg` installer and `.app` bundle in `src-tauri/target/release/bundle/dmg/`. Requires macOS for signing.
  </Tab>
  <Tab title="Linux">
    ```bash
    npx tauri build
    ```
    Produces `.AppImage` and `.deb` packages in `src-tauri/target/release/bundle/`.
  </Tab>
</Tabs>

## Icons

Application icons are configured in `src-tauri/tauri.conf.json` and located in `src-tauri/icons/`:

| Platform | File | Format |
|----------|------|--------|
| Windows | `icon.ico` | ICO (256x256) |
| macOS | `icon.icns` | ICNS |
| Linux | `icon.png` | PNG (512x512) |

To update icons, replace these files and rebuild, or use the `npx tauri icon` command to generate all formats from a single source image.

## CI/CD Workflow

Claude Board includes a GitHub Actions workflow for automated builds:

```yaml
# .github/workflows/build.yml
# Triggers on version tags (v*)
# Builds for all three platforms
# Uploads artifacts to GitHub Releases
```

The workflow:

1. Checks out the repository
2. Installs Rust toolchain and Node.js dependencies
3. Builds the React frontend with Vite
4. Compiles the Rust backend and bundles with Tauri
5. Uploads installers as release assets

<Tip>Tag a commit with `v*` (e.g., `v5.0.0`) to trigger an automatic release build.</Tip>

## Development Mode

For local development without building an installer:

```bash
npx tauri dev
```

This compiles the Rust backend, starts the Vite dev server for the React frontend, and opens the app window with hot-reload enabled for frontend changes.

<Note>Cross-compilation is not natively supported by Tauri. Use the CI/CD workflow or a matching build machine for each target platform.</Note>
