# Markview user guide

**English** · [中文](README.zh-CN.md) · [Project home](../README.md)

Markview is a local Markdown editor and reader for macOS and Windows, built with Electron and Vue 3. Rendering resources are bundled with the application. No account, backend, or telemetry is required.

## Download and install

Open the [latest release](https://github.com/rockywu/RW-Markdown-Reader/releases/latest) and expand **Assets**:

| Your computer | File to download |
| --- | --- |
| Windows 10 / 11 x64 | `Markview-<version>-windows-x64-setup.exe` |
| Mac with an Intel processor, macOS 13+ | `Markview-<version>-mac-x64.dmg` |
| Mac with Apple Silicon, macOS 13+ | `Markview-<version>-mac-arm64.dmg` |

On Windows, run the installation wizard. On macOS, open the DMG and drag Markview into Applications. Installed applications do not require Node.js. The **Source code (zip)** and **Source code (tar.gz)** files are source archives, not installers.

The installers are currently unsigned and are not Apple notarized. Your operating system may display a security prompt. Download from this repository's Releases page. Each release includes `SHA256SUMS.txt` to verify downloaded files.

## Open and read documents

Open a document using the toolbar, system menu, `⌘O` on macOS, or `Ctrl+O` on Windows. You can also drag a file into the application, use the installed file association, or pass a file path as a launch argument. Markview does not automatically change your system's default Markdown application.

The outline on the left lists document headings. Use `⌘F` / `Ctrl+F` to search the preview, Enter / Shift+Enter to move between results, and Escape to close search. Adjust the text size, switch themes, or expand diagrams from the toolbar and diagram controls.

In reading mode, the preview refreshes when an external editor saves the file. Both writes to the existing file and saves that replace the file are supported.

## Editing and live preview

- Select **Edit** (`⌘E` / `Ctrl+E`) to edit Markdown on the left. Text, Mermaid diagrams, formulas, and the outline update on the right about 180 ms after typing pauses.
- Switching back to **Read** preserves your draft. Create a document with `⌘N` / `Ctrl+N`, or the **New** toolbar button when the window is wide enough to show it.
- Use `⌘S` / `Ctrl+S` to save and `⌘⇧S` / `Ctrl+Shift+S` to save as. Native undo, redo, cut, copy, and paste are supported.
- Changes are not automatically written to disk. Before opening another file, reloading, closing the window, or quitting, Markview offers **Save**, **Don't save**, or **Cancel**. Canceling a file or save dialog preserves the draft.
- If a file changes externally while you are editing, Markview keeps your draft and offers to save a copy or reload from disk. Saving checks the file's disk version and refuses to overwrite conflicting changes.
- Saving preserves an existing file's UTF-8 BOM and LF / CRLF line endings. A temporary file is written and synced in the same directory before replacing the destination. New documents use UTF-8 and LF by default.

## Language and editor layout

- Switch between **中文 / English** in the upper-right corner. Interface labels, menus, and application messages update immediately. Document contents, filenames, and drafts are not translated.
- Before you choose a language manually, the application follows the system's preferred language: `zh`, including regional and Traditional Chinese language tags, selects Chinese; English and all other languages select English. Your manual choice is saved in `language.json` in the application's user data directory. Native file dialog controls follow the operating system's language.
- In editing mode, drag the divider to adjust the editor width from 20% to 80%. Double-click to restore 45%. When the divider has keyboard focus, use the left and right arrow keys to adjust it, or Home / End to move to either limit.
- Use **Hide preview / Show preview** above the editor to toggle the preview. Hiding it gives the editor the available width. Reading mode always shows the document; returning to editing restores your preview preference.
- Pane width and preview visibility are remembered. Language changes and layout changes preserve unsaved edits. Searching the preview or selecting an outline heading reveals a hidden preview automatically.

## Supported syntax

| Syntax | Support |
| --- | --- |
| Common Markdown | Headings, paragraphs, lists, blockquotes, links, images, horizontal rules, and code blocks |
| Common GFM extensions | Tables and alignment, task lists, strikethrough, and automatic links |
| Mermaid | Bundled Mermaid 12.1.0; flowcharts and sequence diagrams are covered by the sample checks; other diagram types follow the bundled version's capabilities |
| Math | `$...$`, GitHub-style ``$`...`$``, `$$...$$`, and `math` / `latex` code blocks; MathJax base, ams, and newcommand syntax |
| Document extensions | Footnotes, Chinese heading anchors, duplicate heading anchors, and YAML frontmatter |
| Alerts | GitHub NOTE / TIP / IMPORTANT / WARNING / CAUTION |
| Containers | VitePress-style info / tip / warning / danger / details / note |
| HTML layout | Sanitized HTML, `<details>` / `<summary>`, and `<br>` |

The [compatibility sample](../examples/compatibility.md) contains the original gateway architecture diagram, formulas, images, links, and an intentionally invalid diagram for manual checks.

This is not a complete implementation of every Markdown dialect. MDX / Vue components and scripts, Obsidian backlinks and note embeds, site build directives, PlantUML, and full LaTeX documents are outside the current scope. Unrecognized code blocks remain visible as source. A diagram error affects only that diagram.

### Mermaid colors

Flowcharts use pale blue nodes (`#e5f2ff`), blue text (`#339cff`), gray connectors, rounded borders, and white connector labels with blue outlines. Subgraphs use a white background. Dark mode uses a corresponding dark blue palette. Existing Markdown files need no changes; live preview and the expanded viewer share the same styles.

Custom Mermaid colors are supported. Use `classDef` / `class` for groups of nodes, `style` for individual nodes, and `linkStyle` for connectors. YAML `config` and `themeVariables` inside a Mermaid code block can configure the whole diagram. Document settings override the corresponding defaults and affect only that diagram. See the runnable [color examples](../examples/mermaid-styles.md).

### Download high-resolution diagram images

- Each rendered diagram has a **Download high-resolution image** icon followed by a magnifying glass in its upper-right corner. Download is also available in the expanded viewer's toolbar.
- Choose the destination folder and filename in the system save dialog to save a **PNG**. Canceling creates no file. If export fails, the application shows the reason and allows you to retry.
- The image includes the complete diagram, preserving Chinese labels, the current light or dark theme, and custom styles. Export does not depend on the viewer's zoom, pan, or window size, and does not change the Markdown file or unsaved draft.
- Markview renders the SVG at three times its original dimensions, with a minimum long edge of 2400 pixels for small diagrams. Large diagrams are scaled proportionally to stay within an 8192-pixel long edge and 16 million pixels in total.
- Export runs offline in a separate sandbox and does not request external resources. Use embedded resources for diagrams that depend on external images or network fonts. The saved file's location appears after export completes.

### Fullscreen diagram preview

The corner icon in the expanded viewer toggles actual screen fullscreen. While fullscreen, its icon and label change to **Exit fullscreen**. Press Escape to leave fullscreen and return to the diagram viewer. Closing the diagram also exits fullscreen and returns to the document.

The separate **Fit to window** button adjusts only the diagram's zoom so the complete diagram fits the current preview area. Hold `⌘` / `Ctrl` and scroll to zoom, or drag to pan.

## Files and security

- Documents must be UTF-8 `.md` / `.markdown` files, up to 10 MB each.
- Local images and linked Markdown files are resolved relative to the current document's directory. Access is limited to that directory and its subdirectories. Files outside that boundary, including parent-directory links and escaping symbolic links, must be opened separately. There is no project-wide directory authorization feature.
- Local images are limited to 20 MB each. Supported formats include PNG, JPEG, GIF, WebP, SVG, AVIF, and ICO. HTTPS images require a network connection and may send requests to their hosting service.
- Electron runs with sandboxing and context isolation enabled and Node integration disabled. The preload exposes a fixed editing and reading interface. IPC validates the window and main frame; save destinations come from the current file or the system save dialog.
- DOMPurify sanitizes document HTML. Scripts, embedded webpages, injected styles, and editable forms are blocked. Mermaid uses strict mode, and a content security policy limits resource loading.
- Relative images use a custom protocol scoped to the open document. Real-path checks prevent directory traversal and symbolic-link escapes. External HTTP(S) links open in the system browser only after a click.

## Build from source

Development requires Node.js 22.12+ within the 22.x line, or Node.js 24.x, and npm. Installed applications do not require Node.js.

```bash
git clone https://github.com/rockywu/RW-Markdown-Reader.git
cd RW-Markdown-Reader
npm ci
npm run dev
```

The development command starts Vite and Electron together. Quitting Electron or pressing Ctrl+C stops the development server. Changes to the main process or preload require restarting the development command; the interface supports hot reload.

To build and run:

```bash
npm run build
npm start
```

### Application icons

The application uses a dark green background, off-white pages, and a pen from a single vector source, `build/icon.svg`. The artwork does not depend on system fonts.

| Location | Asset and integration |
| --- | --- |
| Window, taskbar, startup window, and macOS Dock | `icon.png`; the main process sets the icon and Windows AppUserModelId |
| macOS application, Finder, Launchpad, and DMG | `icon.icns`, with sizes from 16 to 1024 px |
| Windows executable, installer, and uninstaller | `icon.ico`, with nine sizes from 16 to 256 px |
| Windows desktop and Start menu shortcuts | Created by the installer, using the executable's icon |
| Markdown file associations and Open With | The same icon, with the Editor file role |
| Application logo in the upper-left corner | The same SVG source |

Run `npm run icons` to regenerate PNG / ICO / ICNS assets in a graphical session where Electron can launch. Generated assets are committed, so normal builds do not need regeneration. macOS has no separate uninstaller executable: uninstalling removes the `.app` with its existing icon. The system Trash icon is not changed.

### Verification

Checks are grouped at the end of each task stage. Finish implementation, then run the relevant checks together. If a check fails, rerun the checks needed to verify the fix.

```bash
npm test             # Syntax, sanitization, file boundaries, and export dimensions
npm run test:e2e     # Build and test a real Electron window
npm run typecheck
npm run test:packaged # Test the packaged application for the current platform
```

End-to-end checks cover offline rendering, Chinese Mermaid diagrams, default and custom colors, label layout, isolated diagram configuration, math, relative images, invalid diagram handling, fullscreen, high-resolution PNG export, themes, search, file refresh, scroll position, linked documents and anchors, drag and drop, sandboxing, and hostile HTML. They also cover editing, saving, new documents, save as, external-edit conflicts, canceled file operations and quit requests, unsaved-change prompts, narrow windows, language and layout preferences, and application icons. Screenshots are saved in `test-results/`.

### Packaging

```bash
npm run pack       # An application directory for the current platform
npm run dist:mac   # macOS Intel and Apple Silicon DMGs
npm run dist:win   # Windows x64 NSIS installer
```

Outputs are written to `release/`. Before publishing, verify the target systems: macOS 13+ on Intel and Apple Silicon, and Windows 10 / 11 x64. A configured build target alone does not establish runtime compatibility on every supported OS version.

### GitHub releases

[Build status](https://github.com/rockywu/RW-Markdown-Reader/actions/workflows/build.yml) · [All releases](https://github.com/rockywu/RW-Markdown-Reader/releases)

The workflow in `.github/workflows/build.yml` builds on separate macOS Intel, macOS Apple Silicon, and Windows x64 runners. Each runs stage checks, builds an installer, and verifies the packaged application. After all three succeed, the workflow creates a GitHub Release with the installers and a SHA-256 checksum file, making it public only after all uploads complete. It uses the repository-provided `GITHUB_TOKEN`; a separate personal access token is not required.

To publish a version:

1. Complete the development stage and update [release notes](RELEASE_NOTES.md) in `docs/RELEASE_NOTES.md`.
2. Commit the changes and keep the working tree clean. Run `npm version patch` for fixes or `npm version minor` for features to update the version and create a tag.
3. Run `git push origin main --follow-tags`.
4. Wait for Actions to finish, then download from Releases. The tag must match `package.json`, for example `v0.4.1`.

Using **Run workflow** in Actions with `main` builds test installers retained for 14 days. Selecting a version tag attempts to publish that version. Failed jobs can be rerun. Published versions are not overwritten: use a new version and do not move published tags.

Published installers currently lack developer certificate signing and Apple notarization. Signing, notarization, and manual installation checks across different OS versions remain outstanding.

### Verification history — October 9, 2026

- [v0.4.1](https://github.com/rockywu/RW-Markdown-Reader/releases/tag/v0.4.1) includes high-resolution Mermaid PNG export and actual fullscreen preview. Windows x64, Mac Intel, and Mac Apple Silicon all passed unit tests, builds, and packaged application checks on native GitHub runners. Installers and `SHA256SUMS.txt` are public. Windows export window size constraints were fixed during release verification while retaining complete-image dimension checks. No v0.4.0 installers were published.
- Before that release, fullscreen was checked locally for native window state, a preview filling the screen, button and Escape exit, closing while fullscreen, and reopening. Export and editing checks also passed.
- The export stage passed 41 unit tests, type checks, builds, and local macOS Electron checks for identical inline and modal exports, dark and custom colors, canceled or failed saves, and preserved drafts. Actual PNGs were inspected for a Chinese flowchart at 2853 × 2994 and a sequence diagram at 2400 × 1690.
- [v0.3.1](https://github.com/rockywu/RW-Markdown-Reader/releases/tag/v0.3.1) was the first public release. All three platforms passed checks on GitHub runners. The test script was corrected for Windows clipboard line endings and narrow hosted desktops without removing functional assertions.
- v0.3.0 added Chinese / English interfaces, system language detection, saved language choices, a draggable divider, and preview visibility. It passed 27 unit tests, type checks, builds, and offline Electron checks, including persistence after restart. Installers were generated for all three targets; a full packaged test run was not repeated at that stage.
- v0.2.1 added the default blue flowchart style, dark-mode colors, and color examples. Fourteen unit tests, type checks, builds, and offline Electron checks passed for the development build and packaged Mac Intel application, including author styles and configuration isolation.
- v0.2.0 added application icons, source editing, live preview, and save protection. Fourteen unit tests passed, including BOM / CRLF preservation and external modification or deletion conflicts. Type checks, builds, and offline packaged Mac checks passed. Windows executable, installer, uninstaller, and association icons were inspected, along with macOS application and association icons.
- Local development and packaged checks ran on macOS 15.8.1 Intel. `npm run dev` startup and shutdown were also verified. Earlier local build stages did not include native Windows or Apple Silicon execution; the later GitHub release checks above cover those platforms. Manual installer-wizard checks and other OS versions remain unverified.

## Project structure

```text
electron/    Windows, menus, file access, automatic refresh, and IPC
src/         Vue interface, Markdown parsing, sanitization, diagrams, and math
examples/    Bundled welcome documents and compatibility samples
tests/       Syntax and security tests, and real Electron checks
scripts/     Development startup and icon generation
docs/        English and Chinese guides, and release notes
```

This is a standalone application. It does not depend on AAAS workspaces, services, or databases. Web dependencies are bundled at build time, so installers do not also carry their source dependency trees.
