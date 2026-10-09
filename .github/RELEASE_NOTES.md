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

当前安装包尚未购买开发者证书，没有 Apple 公证或 Windows 发行者签名。macOS Gatekeeper / Windows SmartScreen 可能显示安全提示；请确认下载来源是此仓库的 Release。无需关闭系统安全功能。

These builds are not Developer ID signed, Apple notarized, or Windows publisher signed. Your operating system may display a security prompt. Only download from this repository's Releases.

自动构建在 macOS Intel、macOS Apple Silicon 和 Windows x64 的 GitHub 托管环境中执行，并在发布前启动打包后的应用完成自动化验收；这不等同于所有系统版本的人工安装测试。
