# Markview

An offline Markdown editor and reader for macOS and Windows, with live preview, Mermaid diagrams, math rendering, and high-resolution image export.

**[English user guide](docs/README.md)** · **[中文使用文档](docs/README.zh-CN.md)**

## Download

Download an installer from the [latest release](https://github.com/rockywu/RW-Markdown-Reading/releases/latest):

| Platform | Installer |
| --- | --- |
| Windows 10 / 11 x64 | `Markview-<version>-windows-x64-setup.exe` |
| macOS 13+, Intel | `Markview-<version>-mac-x64.dmg` |
| macOS 13+, Apple Silicon | `Markview-<version>-mac-arm64.dmg` |

On macOS, open the DMG and drag Markview into Applications. On Windows, run the installer. No Node.js installation or account is required.

The installers are currently unsigned and are not Apple notarized, so your operating system may display a security prompt. Each release includes `SHA256SUMS.txt` for verifying downloads.

## Features

- Edit local Markdown files with live preview, adjustable split panes, and a hideable preview.
- Read common Markdown and GFM extensions, Mermaid diagrams, math, footnotes, YAML frontmatter, and GitHub alerts.
- View diagrams fullscreen and export complete, high-resolution PNGs with the current theme and custom colors.
- Switch between English and Chinese, light and dark themes, and adjustable text sizes.
- Navigate with an outline and search, copy code blocks, and keep drafts safe with unsaved-change prompts and external-edit conflict checks.
- Work locally with bundled rendering resources, no backend, and no telemetry.

## Documentation

Documentation is maintained in [`docs/`](docs/README.md):

- [English user guide](docs/README.md): installation, editing, diagrams, supported syntax, and development.
- [中文使用文档](docs/README.zh-CN.md)：安装、编辑、图表、兼容范围与开发说明。
- [Release notes](docs/RELEASE_NOTES.md).

For development, see [Build from source](docs/README.md#build-from-source). For publishing, see [GitHub releases](docs/README.md#github-releases).
