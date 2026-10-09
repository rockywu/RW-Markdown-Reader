## v0.4.1 更新 / What's new

- Mermaid 图表和放大预览窗口新增高清图片下载，通过系统保存窗口选择文件夹和文件名，保存完整 PNG。
- 默认按图形原始尺寸的 3 倍生成，小图长边至少 2400 像素；超大图等比例限制为最长边 8192 像素、总计 1600 万像素。
- 图片保留中文、当前浅色／深色主题和自定义配色，不受预览缩放或拖动位置影响。取消下载和保存失败均保留原文档及草稿。
- 图表查看改用放大镜图标。预览窗口的四角按钮现在可以真正进入／退出全屏，Esc 退出全屏；“适应窗口”独立显示，关闭图表会自动退出全屏。
- 新增按钮、保存提示和错误信息均支持中文 / English。
- 修正 Windows 高清导出窗口可能受屏幕尺寸限制的问题；等待完整尺寸的图像帧后保存，不通过放大低分辨率截图生成图片。

- Download complete, high-resolution Mermaid PNGs from the document or expanded viewer, preserving labels, themes, and custom colors independently of zoom and pan.
- The viewer now supports real fullscreen, Escape to exit, and a separate Fit to window control.
- Export is rendered offline in an isolated sandbox. External images and network fonts are not fetched; use embedded resources for those diagrams.

## 下载 / Downloads

请在下方 **Assets** 中选择对应的安装包。`Source code` 是源码压缩包，不是应用安装包。

| 系统 / Platform | 安装包 / Installer |
| --- | --- |
| Windows 10 / 11，Intel 或 AMD 64 位 | `Markview-*-windows-x64-setup.exe` |
| macOS 13+，Intel 芯片 | `Markview-*-mac-x64.dmg` |
| macOS 13+，Apple Silicon（M 系列芯片） | `Markview-*-mac-arm64.dmg` |

`SHA256SUMS.txt` 提供安装包 SHA-256 校验值。无需安装 Node.js。

## 功能 / Features

- 本地 Markdown 编辑和实时预览，支持 Mermaid、数学公式、表格、任务列表及常见文档扩展。
- 中文 / English 界面，首次启动跟随系统语言，其他语言默认 English。
- 可拖动编辑分隔线，支持隐藏预览，记住布局设置。
- 保存／另存为、未保存提醒和外部文件修改冲突保护。
- 明亮与深色主题、图表放大、目录、搜索和代码复制。
- Offline Markdown editing and live preview with Mermaid and math, adjustable panes, Chinese/English UI, and safe file saving.

## 安装说明 / Installation notes

macOS：打开 DMG，将 Markview 拖入 Applications。
Windows：运行 EXE 安装向导。

当前安装包没有配置开发者证书签名、Apple 公证或 Windows 发行者签名。macOS Gatekeeper / Windows SmartScreen 可能显示安全提示；请确认下载来源是此仓库的 Release。无需关闭系统安全功能。

These builds are not Developer ID signed, Apple notarized, or Windows publisher signed. Your operating system may display a security prompt. Only download from this repository's Releases.

自动构建在 macOS Intel、macOS Apple Silicon 和 Windows x64 的 GitHub 托管环境中执行，并在发布前启动打包后的应用完成自动化验收；这不等同于所有系统版本的人工安装测试。
