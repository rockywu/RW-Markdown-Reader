# 墨阅 · Markview

[English](README.md) · **中文** · [项目首页](../README.md)

基于 Electron + Vue 3 的本地 Markdown 编辑与预览软件，面向 macOS 和 Windows。渲染资源随应用打包，无账号、无后端、无遥测。

## 下载安装

进入 [最新版本下载页](https://github.com/rockywu/RW-Markdown-Reading/releases/latest)，展开 **Assets**：

| 你的电脑 | 应下载的文件 |
| --- | --- |
| Windows 10 / 11 x64 | `Markview-版本号-windows-x64-setup.exe` |
| Mac Intel，macOS 13+ | `Markview-版本号-mac-x64.dmg` |
| Mac Apple Silicon，macOS 13+ | `Markview-版本号-mac-arm64.dmg` |

Windows 运行安装向导；macOS 打开 DMG 后把 Markview 拖入 Applications。安装版不需要 Node.js。`Source code (zip)` / `Source code (tar.gz)` 是源码，不是安装包。

安装包目前未签名、未进行 Apple 公证，系统可能显示安全提示。请核对本仓库的发布地址。每次发布附带 `SHA256SUMS.txt`，可用于核验下载文件。

## 开始使用

开发环境需要 Node.js 22.12+ 或 24.x，以及 npm。安装后的桌面软件不需要 Node.js。

```bash
git clone https://github.com/rockywu/RW-Markdown-Reading.git
cd RW-Markdown-Reading
npm ci
npm run dev
```

开发命令同时启动 Vite 与 Electron；退出 Electron 或按 Ctrl+C 会停止开发服务器。主进程和 preload 的改动需要重新启动开发命令，界面支持热更新。

构建后运行：

```bash
npm run build
npm start
```

打开文件支持按钮、系统菜单、`⌘O` / `Ctrl+O`、拖放，以及安装后的系统文件关联。应用不会自动更改系统默认 Markdown 打开方式。也可以将文件路径作为启动参数传入。

左侧显示标题目录；`⌘F` / `Ctrl+F` 查找预览内容；Enter / Shift+Enter 跳转搜索结果；Escape 退出查找。支持字号调整、深浅主题、图表放大。阅读状态下文件被外部编辑器保存后自动刷新，支持原地写入和原子替换保存。

## 编辑与实时预览

- 点击“编辑”（`⌘E` / `Ctrl+E`），左侧修改 Markdown 源码，右侧在输入停顿约 180 ms 后更新文字、Mermaid、公式和目录。
- 切换回“阅读”不会丢失草稿。新建文档使用 `⌘N` / `Ctrl+N`，或窗口较宽时的“新建”按钮。
- `⌘S` / `Ctrl+S` 保存；`⌘⇧S` / `Ctrl+Shift+S` 另存为。支持系统撤销、重做、剪切和粘贴。
- 修改不会自动写入磁盘。打开另一文档、重新加载、关闭窗口、退出应用时提示保存／不保存／取消。取消文件选择或保存对话框会保留草稿。
- 编辑期间发现外部文件变化，会保留当前内容，提示另存副本或重新加载。保存前校验磁盘内容版本，发生冲突时拒绝覆盖。
- 保存保留原文件的 UTF-8 BOM 和 LF／CRLF 换行风格，使用同目录临时文件写入、同步后替换。新文件默认为 UTF-8、LF。

## 语言与编辑布局

- 右上角可切换 **中文 / English**，立即更新界面、菜单和应用提示。文档正文、文件名和用户草稿不做翻译。
- 尚未手动选择语言时，使用系统首选语言：`zh`（含地区／繁体语言标记）显示中文，英文及其他语言显示 English。手动选择保存在应用用户目录的 `language.json`，下次启动继续使用。系统文件选择器的系统控件仍跟随操作系统语言。
- 编辑模式下拖动中间分隔线即可调整左右宽度（20%–80%）。双击恢复默认 45%；分隔线获得焦点后，可用左右方向键调整，Home / End 移动到两端。
- 编辑区顶部的“隐藏预览 / 显示预览”切换预览可见性。隐藏时编辑区占满内容区域；返回阅读模式会显示文档，重新进入编辑模式会保留之前的选择。
- 分栏宽度与预览可见性会记住。切换语言、拖动、隐藏预览均不改动文档，不会丢失尚未保存的编辑。查找预览内容或点击目录时会自动显示预览。

## 全局应用图标

墨绿色底、米白书页与书写笔，使用同一份矢量母版 `build/icon.svg`，不依赖系统字体。

| 位置                                     | 资源／接入方式                                          |
| ---------------------------------------- | ------------------------------------------------------- |
| 窗口标题栏、任务栏、启动窗口、macOS Dock | `icon.png`，主进程显式设置图标及 Windows AppUserModelId |
| macOS 应用、Finder、Launchpad、DMG       | `icon.icns`，16–1024 px 多尺寸                          |
| Windows EXE、安装器、卸载器              | `icon.ico`，16–256 px 共 9 个尺寸                       |
| Windows 桌面／开始菜单快捷方式           | 安装器创建，继承 EXE 图标                               |
| Markdown 文件关联与“打开方式”            | 相同图标，文件角色设置为 Editor                         |
| 应用内左上角标志                         | 同一 SVG 母版                                           |

运行 `npm run icons` 重新生成 PNG／ICO／ICNS（需要 Electron 可启动的图形会话）。生成资源已随源码保存，普通构建不需要重新生成。macOS 没有单独的卸载 EXE，卸载时移除的是带相同图标的 `.app`；不会修改系统废纸篓图标。

## 兼容范围

| 语法          | 首版支持                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| 常见 Markdown | 标题、段落、列表、引用、链接、图片、分隔线、代码块                                                        |
| GFM 常见扩展  | 表格及对齐、任务列表、删除线、自动链接                                                                    |
| Mermaid       | 捆绑 Mermaid 12.1.0；已在样本中验收流程图和时序图，其他图种以该版本能力为准                               |
| 数学          | `$...$`、GitHub 的 ``$`...`$``、`$$...$$`、`math` / `latex` 代码块；MathJax 的 base、ams、newcommand 语法 |
| 文档扩展      | 脚注、中文标题锚点、重复标题锚点、YAML frontmatter                                                        |
| 提示块        | GitHub NOTE / TIP / IMPORTANT / WARNING / CAUTION                                                         |
| 提示容器      | VitePress 风格 info / tip / warning / danger / details / note                                             |
| HTML 排版     | 经过过滤的普通 HTML、`<details>` / `<summary>`、`<br>`                                                    |

[兼容性样本](../examples/compatibility.md)包含最初的 gateway 架构图、公式、图片、链接与故意写错的图表，可作为人工验收文件。

### Mermaid 配色

流程图默认采用浅蓝节点（`#e5f2ff`）、蓝色文字（`#339cff`）、灰色连线、圆角边框和白底蓝边的连线标签，子图为白底。深色模式使用对应的深蓝配色。无需修改已有 Markdown，编辑预览和放大查看会使用相同样式。

支持 Mermaid 自定义颜色：用 `classDef`／`class` 为一组节点设置样式，`style` 修改单个节点，`linkStyle` 修改连线；也可以在 Mermaid 代码块内部使用 YAML `config` 和 `themeVariables` 设置整张图。文档设置会覆盖相应默认值，仅影响当前图表。完整可运行例子见 [配色示例](../examples/mermaid-styles.md)。

### Mermaid 高清图片下载

- 每张已渲染图表右上角依次提供“下载高清图片”和放大镜图标；放大预览窗口的工具栏也可以下载。
- 点击下载后，通过系统保存窗口选择文件夹和文件名，保存为 **PNG**。取消不会创建文件，导出失败会显示原因，可以再次尝试。
- 图片包含完整图表，保留中文标签、当前浅色／深色配色及自定义样式，不受预览缩放、拖动或窗口尺寸影响，也不改变 Markdown 或未保存的草稿。
- 从 SVG 按原始尺寸的 3 倍渲染；小图的长边至少为 2400 像素。超大图等比例限制在最长边 8192 像素、总计 1600 万像素内。
- 导出在独立沙箱中离线生成，不请求外部资源；依赖外部图片或网络字体的图表，请先改用内嵌资源。保存完成后显示文件位置。

### 图表全屏预览

放大预览工具栏的四角图标用于进入／退出真正的屏幕全屏；全屏时图标和提示会切换为“退出全屏”。按 Esc 先退出全屏，回到图表预览；点击关闭图表则退出全屏并返回文档。独立的“适应窗口”按钮仅调整图表缩放，让完整图表适合当前预览区域。

这不是所有 Markdown 方言的完整实现。MDX / Vue 自定义组件与脚本、Obsidian 双向链接和笔记嵌入、站点构建指令、PlantUML、完整 LaTeX 文档不在首版范围内。未识别的代码块保留为源码；图表错误只影响对应图表。

## 文件与安全边界

- UTF-8 的 `.md` / `.markdown` 文档，单文件上限 10 MB。
- 本地图片和关联 Markdown 链接从当前文档所在目录解析，只允许该目录及子目录。指向父目录或通过符号链接越界的文件需单独打开，首版没有项目目录授权功能。
- 本地图片单张上限 20 MB；支持 PNG、JPEG、GIF、WebP、SVG、AVIF、ICO。HTTPS 网络图片需要网络，可能向对应图片服务发出请求。
- Electron 启用 sandbox 和 contextIsolation，禁用 nodeIntegration。preload 只暴露固定编辑与阅读接口，IPC 校验窗口和主 frame；保存目标由主进程当前文件或系统保存对话框决定。
- 文档 HTML 经 DOMPurify 过滤；禁止脚本、嵌入网页、样式注入和可编辑表单。Mermaid 使用 strict 模式；CSP 限制加载来源。
- 相对路径图片使用按文档授权的自定义协议，真实路径检查阻止目录穿越和符号链接越界。外部 HTTP(S) 链接只有点击后才交给系统浏览器。

## 验证

开发按任务阶段集中验收：先完成该阶段实现，再统一运行检查；出现失败时，只对修复项进行必要复验。

```bash
npm test            # 语法兼容、HTML 清理、文件路径边界
npm run test:e2e    # 构建并启动真实 Electron 窗口验收
npm run typecheck
npm run test:packaged # 打包后，验收当前系统的 release 应用
```

端到端测试在浏览器断网状态下覆盖：原始中文 Mermaid 图、默认蓝色主题、标签不重叠、自定义节点／连线颜色、图表间配置隔离、公式、相对路径图片、错误隔离、图表放大、深色主题、搜索、原子保存刷新及滚动位置、关联文档和跨文件锚点、中文路径拖放、沙箱和恶意 HTML，以及实时编辑、保存、新建、另存为、外部修改冲突、取消打开／关闭／退出、离开前保存、窄窗口布局和应用图标。测试截图保存在 `test-results/`。

## 打包

```bash
npm run pack       # 当前系统可直接启动的应用目录
npm run dist:mac   # macOS Intel / Apple Silicon DMG
npm run dist:win   # Windows x64 NSIS 安装包
```

产物在 `release/`。发布前应分别在目标系统验收：macOS 13+ 的 Intel / Apple Silicon，Windows 10 / 11 x64。配置目标不代表已经覆盖所有平台实测。

### GitHub 自动发布

[构建状态](https://github.com/rockywu/RW-Markdown-Reading/actions/workflows/build.yml) · [所有发布](https://github.com/rockywu/RW-Markdown-Reading/releases)

`.github/workflows/build.yml` 在 macOS Intel、macOS Apple Silicon、Windows x64 三个独立环境构建，各自运行阶段测试、构建及打包后应用验收。全部成功后，自动创建 GitHub Release，上传三个安装包和 SHA-256 校验文件；完整上传后才公开。发布使用仓库自动提供的 `GITHUB_TOKEN`，无需另建 PAT。

后续发布步骤：

1. 完成该阶段的开发，更新 [发布说明](RELEASE_NOTES.md)（`docs/RELEASE_NOTES.md`）。
2. 执行 `npm version patch`（修复）或 `npm version minor`（功能）更新版本并生成标签。先提交其他改动，保持工作区干净。
3. 执行 `git push origin main --follow-tags`。
4. 等待 Actions 成功，在 Releases 页面下载。版本标签必须与 `package.json` 一致，例如 `v0.4.1`。

在 Actions 点击 **Run workflow**、选择 `main`，只构建并保留 14 天的测试安装包；选择已有版本标签则会尝试发布该版本。失败时可在 Actions 重跑失败任务；已公开的版本不会被覆盖，应发布新版本。不要修改已发布的标签。

当前发布的安装包没有开发者证书签名或 Apple 公证，系统可能显示安全提示。平台签名、公证及不同系统版本的人工安装验收仍待完成。

### 本次验证（2026-10-09）

- [v0.4.1 发布](https://github.com/rockywu/RW-Markdown-Reading/releases/tag/v0.4.1)：包含 Mermaid 高清 PNG 下载与真实全屏预览。Windows x64、Mac Intel、Mac Apple Silicon 均通过 GitHub 原生环境的单元测试、构建及打包后应用验收，安装包和 `SHA256SUMS.txt` 已公开。发布验证期间修正了 Windows 导出窗口尺寸限制，保留完整图像尺寸检查；v0.4.0 未公开安装包。下列“未发布／未验收”是各功能开发阶段的历史记录。
- 图表全屏修复：四角按钮改为真实全屏切换，适应窗口使用独立文字按钮。构建和 macOS Electron 阶段验收通过，检查了系统窗口全屏状态、预览铺满屏幕、按钮／Esc 退出、全屏中关闭图表及重新打开；原有下载和编辑验收也通过。本次没有重新发布安装包或在 Windows 验收。
- Mermaid 高清下载：41 项单元测试、类型检查与构建通过；macOS Electron 阶段验收覆盖页面／放大窗口导出一致、深色与自定义颜色、取消／保存失败和草稿保留。已检查中文流程图（2853 × 2994）和时序图（2400 × 1690）的实际 PNG。此改动尚未发布新安装包，Windows／Apple Silicon 本次未重验。
- [v0.3.1 首次公开发布](https://github.com/rockywu/RW-Markdown-Reading/releases/tag/v0.3.1)：Windows x64、Mac Intel、Mac Apple Silicon 在 GitHub 托管环境中全部通过阶段测试、构建和打包后应用验收，三个安装包及 `SHA256SUMS.txt` 已公开。修正了验收脚本对 Windows 剪贴板换行和构建机窄屏菜单的假设；没有跳过功能断言。下文的“尚未实机验收”是此前本地版本的记录，不代表本次 CI 未执行。安装向导、其他系统版本仍需人工验收。
- 0.3.0 增加中文／English 界面、系统首选语言识别、手动语言记忆、可拖动分隔线和隐藏预览；27 项自动化测试、类型检查与构建通过，开发构建通过真实 Electron 断网验收，包括语言切换后的菜单与保存提示、草稿保留、分隔线鼠标／键盘操作，以及重启后的语言、宽度和预览可见性记忆。macOS Intel／Apple Silicon 和 Windows x64 安装包已生成，本阶段没有重复运行打包版全套验收。
- 0.2.1 增加参考图的默认蓝色流程图样式、深色适配和配色示例；14 项自动化测试、类型检查与构建通过，开发构建及 Mac Intel 打包版通过真实 Electron 断网验收，覆盖默认颜色、圆角、标签尺寸与布局、自定义颜色优先级、图表间配置隔离及放大预览。macOS Intel／Apple Silicon 和 Windows x64 安装包已生成。
- 0.2.0 增加全局图标、源码编辑、实时预览和保存保护；14 项自动化测试通过（含 BOM／CRLF 保存、外部修改和删除冲突），类型检查与构建通过。
- 0.2.0 Mac 打包版通过断网端到端测试，包括编辑、保存、另存为、外部冲突，以及取消打开／关闭／退出。已核对 macOS 应用及文件关联的 ICNS、Windows 主 EXE／安装器／卸载器中的 9 个图标尺寸和文件关联 ICO 均与设计资源一致。
- macOS 15.8.1 Intel：开发构建和打包后的 `.app` 均通过真实 Electron 端到端验收；断网状态下图表、公式和本地图片正常。
- macOS Intel / Apple Silicon DMG、Windows x64 NSIS 安装包均可构建；Apple Silicon 和 Windows 尚未实机运行验收，Windows 安装向导尚未实测。
- `npm run dev` 启动验证通过，开发服务器退出后已停止。AAAS 仓库没有为此项目增加改动。

## 代码结构

```text
electron/    窗口、菜单、文件访问、自动刷新、IPC
src/         Vue 界面、Markdown 解析、清理与图表公式渲染
examples/    欢迎文档与兼容性样本
tests/       语法与安全测试、真实 Electron 验收
scripts/     开发启动命令
docs/        中英文使用文档与发布说明
```

本项目独立于 AAAS，不依赖其 workspace、服务或数据库。所有网页依赖在构建时打包，因此安装包不重复携带它们的源代码依赖树。
