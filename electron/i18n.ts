export type Locale = "zh" | "en";

export function systemLocale(language: string): Locale {
  return /^zh(?:[-_]|$)/i.test(language) ? "zh" : "en";
}

const messages = {
  brand: { zh: "墨阅", en: "Markview" },
  documentCaption: {
    zh: "让文档清晰呈现。",
    en: "YOUR DOCUMENT, BEAUTIFULLY READ.",
  },
  welcomeCaption: {
    zh: "安静记录你的每个想法。",
    en: "A QUIET SPACE FOR YOUR IDEAS.",
  },
  appTitle: { zh: "墨阅 · Markview", en: "Markview" },
  appIcon: { zh: "墨阅图标", en: "Markview icon" },
  welcome: { zh: "欢迎使用墨阅", en: "Welcome to Markview" },
  offline: { zh: "离线阅读，专注内容", en: "Read offline. Stay focused." },
  nestedMetadata: { zh: "嵌套文档信息", en: "Nested metadata" },
  inputTooLarge: {
    zh: "文档超过 10 MB，未接受这次输入。",
    en: "This edit exceeds the 10 MB document limit and was not applied.",
  },
  open: { zh: "打开文档", en: "Open document" },
  new: { zh: "新建", en: "New" },
  mode: { zh: "工作模式", en: "Workspace mode" },
  read: { zh: "阅读", en: "Read" },
  edit: { zh: "编辑", en: "Edit" },
  save: { zh: "保存", en: "Save" },
  saveAs: { zh: "另存为", en: "Save as" },
  toggleOutline: { zh: "显示或隐藏目录", en: "Show or hide outline" },
  outline: { zh: "文档目录", en: "Document outline" },
  findDocument: { zh: "查找文档", en: "Search document" },
  find: { zh: "查找", en: "Find" },
  smallerText: { zh: "缩小文字", en: "Decrease text size" },
  largerText: { zh: "放大文字", en: "Increase text size" },
  lightTheme: { zh: "切换浅色主题", en: "Switch to light theme" },
  darkTheme: { zh: "切换深色主题", en: "Switch to dark theme" },
  closeError: { zh: "关闭错误提示", en: "Dismiss error" },
  externalChange: {
    zh: "文件已在外部修改。当前编辑内容已保留。",
    en: "This file changed outside Markview. Your edits have been kept.",
  },
  saveCopy: { zh: "另存为副本", en: "Save a copy" },
  reloadDisk: { zh: "重新加载磁盘版本", en: "Reload from disk" },
  reading: { zh: "正在阅读", en: "NOW READING" },
  localDocument: { zh: "本地 Markdown 文档", en: "Local Markdown document" },
  startReading: { zh: "开始你的阅读", en: "Start reading" },
  noHeadings: { zh: "这篇文档没有标题", en: "This document has no headings" },
  localRendering: {
    zh: "本地渲染 · 无需登录",
    en: "Local rendering · No sign-in",
  },
  document: { zh: "文档", en: "Document" },
  unsaved: { zh: "未保存", en: "Unsaved" },
  saved: { zh: "已保存", en: "Saved" },
  searchContent: { zh: "搜索内容", en: "Search text" },
  searchPlaceholder: { zh: "在文档中查找…", en: "Find in document…" },
  previousMatch: { zh: "上一个匹配", en: "Previous match" },
  nextMatch: { zh: "下一个匹配", en: "Next match" },
  closeSearch: { zh: "关闭查找", en: "Close search" },
  editorRegion: { zh: "Markdown 编辑区", en: "Markdown editor" },
  source: { zh: "Markdown 源码", en: "Markdown source" },
  lineCount: { zh: "{count} 行", en: "{count} lines" },
  editorPlaceholder: {
    zh: "从一个标题开始，写下你的想法…",
    en: "Start with a heading and write down your ideas…",
  },
  preview: { zh: "文档预览", en: "Document preview" },
  livePreview: { zh: "实时预览", en: "Live preview" },
  rendering: { zh: "正在渲染…", en: "Rendering…" },
  updatesAsYouType: { zh: "随输入更新", en: "Updates as you type" },
  hidePreview: { zh: "隐藏预览", en: "Hide preview" },
  showPreview: { zh: "显示预览", en: "Show preview" },
  resizePanes: {
    zh: "调整编辑区与预览区宽度",
    en: "Resize editor and preview",
  },
  resizeHint: {
    zh: "拖动调整宽度，双击恢复；也可使用左右方向键",
    en: "Drag to resize, double-click to reset, or use the arrow keys",
  },
  metadata: { zh: "文档信息", en: "Document metadata" },
  itemCount: { zh: "{count} 项", en: "{count} items" },
  endDocument: { zh: "阅读至此", en: "End of document" },
  untitledHint: {
    zh: "未命名文档 · 保存后可加载相对路径图片",
    en: "Untitled document · Save to load relative images",
  },
  supportedContent: {
    zh: "Markdown · Mermaid · 数学公式",
    en: "Markdown · Mermaid · Math",
  },
  processingFile: { zh: "正在处理文件…", en: "Processing file…" },
  unsavedChanges: { zh: "有未保存的修改", en: "Unsaved changes" },
  savedAt: { zh: "已保存 {time}", en: "Saved at {time}" },
  newUnsaved: { zh: "新文档尚未保存", en: "New document has not been saved" },
  dropDocument: {
    zh: "放下你的 Markdown 文档",
    en: "Drop your Markdown document",
  },
  dropFormats: {
    zh: "支持 .md 和 .markdown",
    en: "Supports .md and .markdown",
  },
  diagramPreview: { zh: "图表预览", en: "Diagram preview" },
  smallerDiagram: { zh: "缩小图表", en: "Zoom out diagram" },
  largerDiagram: { zh: "放大图表", en: "Zoom in diagram" },
  closeDiagram: { zh: "关闭图表", en: "Close diagram" },
  expand: { zh: "放大", en: "Expand" },
  mathError: {
    zh: "公式解析失败，已保留源码",
    en: "Could not render this formula. Source preserved.",
  },
  diagramError: {
    zh: "图表暂时无法渲染，原文已保留。",
    en: "Could not render this diagram. Source preserved.",
  },
  errorDetails: { zh: "查看错误和源码", en: "View error and source" },
  info: { zh: "信息", en: "Info" },
  tip: { zh: "提示", en: "Tip" },
  warning: { zh: "注意", en: "Warning" },
  danger: { zh: "警告", en: "Danger" },
  details: { zh: "展开详情", en: "Show details" },
  note: { zh: "备注", en: "Note" },
  yamlError: {
    zh: "YAML 文档信息格式有误，已保留原文。",
    en: "Invalid YAML metadata. Original content preserved.",
  },
  scriptsWarning: {
    zh: "此文档包含组件或脚本。仅预览静态 Markdown，不运行项目代码。",
    en: "This document contains components or scripts. Only static Markdown is shown; project code is not executed.",
  },
  obsidianWarning: {
    zh: "Obsidian 双向链接与笔记嵌入尚未解析，已保留原文。",
    en: "Obsidian wiki links and note embeds are not supported. Original content preserved.",
  },
  saveDialog: { zh: "保存 Markdown 文档", en: "Save Markdown document" },
  openDialog: { zh: "打开 Markdown 文档", en: "Open Markdown document" },
  untitledFile: { zh: "未命名.md", en: "Untitled.md" },
  replaceQuestion: { zh: "替换“{name}”？", en: "Replace “{name}”?" },
  replaceDetail: {
    zh: "目标文件已存在，替换后将写入当前编辑内容。",
    en: "This file already exists. Replacing it will write your current edits to it.",
  },
  cancel: { zh: "取消", en: "Cancel" },
  replace: { zh: "替换", en: "Replace" },
  saveQuestion: {
    zh: "保存对“{name}”的修改？",
    en: "Save changes to “{name}”?",
  },
  discardDetail: {
    zh: "未保存的修改会丢失。",
    en: "Your unsaved changes will be lost.",
  },
  dontSave: { zh: "不保存", en: "Don’t save" },
  fileMenu: { zh: "文件", en: "File" },
  newDocument: { zh: "新建文档", en: "New document" },
  reload: { zh: "重新加载", en: "Reload" },
  undo: { zh: "撤销", en: "Undo" },
  redo: { zh: "重做", en: "Redo" },
  cut: { zh: "剪切", en: "Cut" },
  copy: { zh: "拷贝", en: "Copy" },
  paste: { zh: "粘贴", en: "Paste" },
  selectAll: { zh: "全选", en: "Select all" },
  findPreview: { zh: "查找预览内容", en: "Find in preview" },
  viewMenu: { zh: "视图", en: "View" },
  toggleEdit: { zh: "编辑 / 阅读", en: "Edit / Read" },
  fullscreen: { zh: "切换全屏", en: "Toggle full screen" },
  devTools: { zh: "开发者工具", en: "Developer tools" },
  closeWindow: { zh: "关闭窗口", en: "Close window" },
  quit: { zh: "退出 Markview", en: "Quit Markview" },
  about: { zh: "关于 Markview", en: "About Markview" },
  services: { zh: "服务", en: "Services" },
  hideApp: { zh: "隐藏 Markview", en: "Hide Markview" },
  hideOthers: { zh: "隐藏其他应用", en: "Hide others" },
  showAll: { zh: "全部显示", en: "Show all" },
  untrusted: { zh: "不允许的调用来源。", en: "This request is not allowed." },
  invalidContent: { zh: "文档内容无效。", en: "Invalid document content." },
  invalidDrop: {
    zh: "请从文件管理器拖入文档。",
    en: "Drag a document from your file manager.",
  },
  invalidLink: { zh: "无效链接。", en: "Invalid link." },
  saveBeforeLink: {
    zh: "请先保存文档，或使用“打开文档”选择文件。",
    en: "Save this document first, or use Open document to select a file.",
  },
  cannotOpen: { zh: "无法打开文档", en: "Cannot open document" },
  invalidLocale: {
    zh: "不支持的界面语言。",
    en: "Unsupported interface language.",
  },
  chooseMarkdown: {
    zh: "请选择 .md 或 .markdown 文档。",
    en: "Select a .md or .markdown document.",
  },
  notFile: { zh: "所选路径不是文件。", en: "The selected path is not a file." },
  largeDocument: {
    zh: "文档超过 10 MB，请先拆分后再打开。",
    en: "This document exceeds 10 MB. Split it into smaller files before opening.",
  },
  invalidEncoding: {
    zh: "文档不是 UTF-8 编码，请先转换为 UTF-8。",
    en: "This document is not UTF-8 encoded. Convert it to UTF-8 first.",
  },
  markdownExtension: {
    zh: "请使用 .md 或 .markdown 文件扩展名。",
    en: "Use the .md or .markdown file extension.",
  },
  largeSave: {
    zh: "文档超过 10 MB，未保存。",
    en: "This document exceeds 10 MB and was not saved.",
  },
  saveConflict: {
    zh: "文件已在外部修改或删除，未覆盖。请另存为，或重新加载磁盘版本。",
    en: "This file was changed or deleted outside Markview and was not overwritten. Save a copy or reload from disk.",
  },
  outsideDirectory: {
    zh: "此链接超出当前文档目录，请使用“打开文档”选择该文件。",
    en: "This link points outside the document folder. Use Open document to select the file.",
  },
} as const;

export type MessageKey = keyof typeof messages;
export type MessageParams = Record<string, string | number>;

export function translate(
  locale: Locale,
  key: MessageKey,
  params: MessageParams = {},
): string {
  return messages[key][locale].replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name]),
  );
}
