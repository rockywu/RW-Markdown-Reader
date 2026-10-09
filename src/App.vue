<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { renderMarkdown } from "./markdown";
import { sanitizeMarkdown } from "./sanitize";
import { enhanceDocument } from "./enhance";
import type { DocumentData } from "../electron/shared";
import welcome from "../examples/welcome.md?raw";
import appIcon from "../build/icon.svg";

const doc = ref<DocumentData | null>(null);
const draft = ref("");
const editing = ref(false);
const saving = ref(false);
const externalChange = ref(false);
const sourceEditor = ref<HTMLTextAreaElement>();
const previewSource = ref(welcome);
const dirty = computed(() => !!doc.value && draft.value !== doc.value.content);
const lines = computed(() => draft.value.split("\n").length);
const platform = window.reader.platform;
const outline = ref(true);
const theme = ref(localStorage.getItem("markview-theme") || "light");
const fontSize = ref(16);
const error = ref("");
const busy = ref(false);
const dragging = ref(false);
const article = ref<HTMLElement>();
const scroller = ref<HTMLElement>();
const searchInput = ref<HTMLInputElement>();
const searchOpen = ref(false);
const query = ref("");
const matches = ref({ matches: 0, activeMatchOrdinal: 0 });
const zoomDialog = ref<HTMLDialogElement>();
const diagramZoom = ref(1);
const enlargedDiagram = ref("");
const rendered = computed(() => renderMarkdown(previewSource.value));
const title = computed(() => doc.value?.name ?? "欢迎使用墨阅");
const isDark = computed(() => theme.value === "dark");
const modified = computed(() =>
  doc.value
    ? new Date(doc.value.modifiedAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "离线阅读，专注内容",
);
let revision = 0;
let pendingAnchor: string | null = null;
let searchTimer: ReturnType<typeof setTimeout>;
let previewTimer: ReturnType<typeof setTimeout>;
const unsubscribers: (() => void)[] = [];

function showError(value: unknown) {
  error.value =
    value instanceof Error
      ? value.message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          "",
        )
      : String(value);
}
function metadataValue(value: unknown): string {
  if (Array.isArray(value))
    return value
      .map((entry) =>
        entry && typeof entry === "object" ? "…" : String(entry),
      )
      .join(", ");
  return value && typeof value === "object"
    ? "嵌套文档信息"
    : String(value ?? "");
}
async function opening() {
  try {
    const opened = await window.reader.open();
    if (opened) receive(opened);
  } catch (value) {
    showError(value);
  }
}
function receive(next: DocumentData) {
  const changedFile = doc.value?.path !== next.path;
  if (
    doc.value?.assetBase === next.assetBase &&
    doc.value?.version === next.version
  )
    return;
  const preserveDraft = dirty.value && doc.value?.assetBase === next.assetBase;
  doc.value = next;
  if (!preserveDraft) draft.value = next.content;
  clearTimeout(previewTimer);
  previewSource.value = draft.value;
  externalChange.value = false;
  error.value = "";
  if (changedFile) {
    scroller.value?.scrollTo(0, 0);
    closeSearch();
  }
  syncDraft();
}
function syncDraft() {
  if (doc.value)
    window.reader.updateDraft(doc.value.assetBase, draft.value, editing.value);
}
function inputDraft(event: Event) {
  const input = event.target as HTMLTextAreaElement;
  if (new TextEncoder().encode(input.value).length > 10 * 1024 * 1024) {
    input.value = draft.value;
    error.value = "文档超过 10 MB，未接受这次输入。";
    return;
  }
  draft.value = input.value;
  syncDraft();
  revision++;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    previewSource.value = draft.value;
  }, 180);
}
async function newFile(initial = "") {
  try {
    const next = await window.reader.newDocument(initial);
    if (!next) return;
    receive(next);
    draft.value = initial;
    previewSource.value = initial;
    editing.value = true;
    outline.value = false;
    syncDraft();
    await nextTick();
    sourceEditor.value?.focus();
  } catch (value) {
    showError(value);
  }
}
async function toggleEditor() {
  if (saving.value) return;
  if (!doc.value) {
    await newFile(welcome);
    return;
  }
  editing.value = !editing.value;
  if (editing.value) outline.value = false;
  syncDraft();
  if (editing.value) {
    await nextTick();
    sourceEditor.value?.focus();
  }
}
async function saveFile(saveAs = false) {
  syncDraft();
  try {
    const saved = await window.reader.save(saveAs);
    if (saved) receive(saved);
  } catch (value) {
    showError(value);
  }
}
async function reloadFile() {
  try {
    const next = await window.reader.reload();
    if (next) receive(next);
  } catch (value) {
    showError(value);
  }
}
async function draw() {
  const currentRevision = ++revision;
  busy.value = true;
  const position = scroller.value?.scrollTop ?? 0;
  try {
    await nextTick();
    if (!article.value || currentRevision !== revision) return;
    article.value.innerHTML = sanitizeMarkdown(
      rendered.value.html,
      doc.value?.assetBase ?? "",
    );
    await enhanceDocument(
      article.value,
      isDark.value,
      () => revision === currentRevision,
    );
    if (revision === currentRevision) {
      if (pendingAnchor) {
        const id = pendingAnchor;
        pendingAnchor = null;
        jump(id);
      } else scroller.value?.scrollTo(0, position);
      if (searchOpen.value && query.value)
        await window.reader.find(query.value);
    }
  } catch (value) {
    showError(value);
  } finally {
    if (revision === currentRevision) busy.value = false;
  }
}
watch([rendered, isDark], draw);
watch(theme, (value) => {
  document.documentElement.dataset.theme = value;
  localStorage.setItem("markview-theme", value);
});
watch(query, () => {
  clearTimeout(searchTimer);
  matches.value = { matches: 0, activeMatchOrdinal: 0 };
  searchTimer = setTimeout(() => {
    void window.reader.find(query.value).catch(showError);
  }, 150);
});
function jump(id: string) {
  const element = Array.from(
    article.value?.querySelectorAll("[id]") ?? [],
  ).find((item) => item.id === id);
  element?.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function openSearch() {
  searchOpen.value = true;
  await nextTick();
  searchInput.value?.focus();
  searchInput.value?.select();
}
function closeSearch() {
  searchOpen.value = false;
  query.value = "";
  void window.reader.stopFind().catch(showError);
}
function nextMatch(forward = true) {
  void window.reader.find(query.value, forward).catch(showError);
}
async function onDrop(event: DragEvent) {
  dragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  try {
    const next = await window.reader.openDropped(file);
    if (next) receive(next);
  } catch (value) {
    showError(value);
  }
}
async function articleClick(event: MouseEvent) {
  const target = event.target as Element;
  const button = target.closest(".diagram-expand");
  if (button) {
    const svg = button.closest(".diagram")?.querySelector("svg");
    if (svg) {
      enlargedDiagram.value = svg.outerHTML;
      diagramZoom.value = 1;
      await nextTick();
      zoomDialog.value?.showModal();
    }
    return;
  }
  const anchor = target.closest("a");
  if (!anchor) return;
  event.preventDefault();
  const href = anchor.getAttribute("href") ?? "";
  try {
    if (href.startsWith("#")) jump(decodeURIComponent(href.slice(1)));
    else {
      const hash = href.split("#")[1];
      pendingAnchor =
        hash && !/^https?:/i.test(href) ? decodeURIComponent(hash) : null;
      await window.reader.followLink(href);
    }
  } catch (value) {
    pendingAnchor = null;
    showError(value);
  }
}
function keyboard(event: KeyboardEvent) {
  if (event.key === "Escape") {
    if (searchOpen.value) closeSearch();
    error.value = "";
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    void openSearch();
  }
}
onMounted(async () => {
  document.documentElement.dataset.theme = theme.value;
  document.addEventListener("keydown", keyboard);
  unsubscribers.push(
    window.reader.onDocument(receive),
    window.reader.onError(showError),
    window.reader.onBusy((value) => {
      saving.value = value;
    }),
    window.reader.onFind((value) => {
      matches.value = value;
    }),
    window.reader.onMenu((action) => {
      if (action === "find") void openSearch();
      else if (action === "outline") outline.value = !outline.value;
      else if (action === "toggle-edit") void toggleEditor();
      else if (action === "edit") {
        editing.value = true;
        outline.value = false;
        syncDraft();
      } else if (action === "external-change") externalChange.value = true;
    }),
  );
  try {
    const existing = await window.reader.current();
    if (existing) receive(existing);
  } catch (value) {
    showError(value);
  }
  await draw();
});
onUnmounted(() => {
  revision++;
  unsubscribers.forEach((stop) => stop());
  clearTimeout(searchTimer);
  clearTimeout(previewTimer);
  document.removeEventListener("keydown", keyboard);
});
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'is-editing': editing }"
    @dragover.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <header class="toolbar">
      <div class="brand">
        <img class="brand-logo" :src="appIcon" alt="墨阅图标" />
        <div><strong>墨阅</strong><small>MARKVIEW</small></div>
      </div>
      <div class="toolbar-divider"></div>
      <button class="open-button" :disabled="saving" @click="opening">
        <span aria-hidden="true">＋</span> 打开文档
        <kbd>{{ platform === "darwin" ? "⌘ O" : "Ctrl O" }}</kbd>
      </button>
      <button
        class="text-button new-button"
        :disabled="saving"
        @click="newFile()"
      >
        新建
      </button>
      <span class="toolbar-spacer"></span>
      <div class="mode-switch" aria-label="工作模式">
        <button
          :aria-pressed="!editing"
          :disabled="saving"
          @click="editing && toggleEditor()"
        >
          阅读
        </button>
        <button
          :aria-pressed="editing"
          :disabled="saving"
          @click="!editing && toggleEditor()"
        >
          编辑与预览
        </button>
      </div>
      <button
        class="save-button"
        :disabled="saving || !doc"
        @click="saveFile()"
      >
        保存<span v-if="dirty" class="dirty-dot"></span>
      </button>
      <button
        class="text-button save-as-button"
        :disabled="saving || !doc"
        @click="saveFile(true)"
      >
        另存为
      </button>
      <button
        class="icon-button"
        :aria-pressed="outline"
        aria-label="显示或隐藏目录"
        title="文档目录"
        @click="outline = !outline"
      >
        ☷
      </button>
      <button
        class="icon-button"
        aria-label="查找文档"
        title="查找"
        @click="openSearch"
      >
        ⌕
      </button>
      <div class="font-control">
        <button
          aria-label="缩小文字"
          :disabled="fontSize <= 12"
          @click="fontSize--"
        >
          A−</button
        ><span>{{ fontSize }}</span
        ><button
          aria-label="放大文字"
          :disabled="fontSize >= 24"
          @click="fontSize++"
        >
          A＋
        </button>
      </div>
      <button
        class="icon-button theme-toggle"
        :aria-label="isDark ? '切换浅色主题' : '切换深色主题'"
        @click="theme = isDark ? 'light' : 'dark'"
      >
        {{ isDark ? "☀" : "☾" }}
      </button>
    </header>

    <div v-if="error" class="error-banner" role="alert">
      <span>{{ error }}</span
      ><button aria-label="关闭错误提示" @click="error = ''">×</button>
    </div>
    <div v-if="externalChange" class="conflict-banner" role="status">
      <span>文件已在外部修改。当前编辑内容已保留。</span
      ><button :disabled="saving" @click="saveFile(true)">另存为副本</button
      ><button :disabled="saving" @click="reloadFile">重新加载磁盘版本</button>
    </div>
    <div class="workspace">
      <aside v-if="outline" class="sidebar">
        <div class="sidebar-label">正在阅读</div>
        <div class="document-card">
          <span class="file-symbol">M↓</span>
          <div>
            <strong :title="title">{{ title }}</strong
            ><small>{{ doc ? "本地 Markdown 文档" : "开始你的阅读" }}</small>
          </div>
        </div>
        <div class="outline-title">
          <span>文档目录</span><small>{{ rendered.headings.length }}</small>
        </div>
        <nav aria-label="文档目录">
          <button
            v-for="heading in rendered.headings"
            :key="heading.id"
            :style="{
              paddingLeft: `${14 + Math.min(heading.level - 1, 3) * 12}px`,
            }"
            :class="{ 'top-heading': heading.level === 1 }"
            @click="jump(heading.id)"
          >
            {{ heading.text }}
          </button>
          <p v-if="!rendered.headings.length" class="empty-outline">
            这篇文档没有标题
          </p>
        </nav>
        <div class="sidebar-bottom">
          <span class="status-dot"></span> 本地渲染 · 无需登录
        </div>
      </aside>

      <main class="main-pane">
        <div class="document-bar">
          <div class="breadcrumb">
            <span>文档</span><span class="slash">/</span
            ><strong>{{ title }}</strong
            ><span v-if="dirty" class="unsaved-label">未保存</span>
          </div>
          <span class="format-badge">MARKDOWN</span>
        </div>
        <div v-if="searchOpen" class="search-bar">
          <input
            ref="searchInput"
            v-model="query"
            aria-label="搜索内容"
            placeholder="在文档中查找…"
            maxlength="500"
            @keydown.enter="nextMatch(!$event.shiftKey)"
          /><span>{{ matches.activeMatchOrdinal }} / {{ matches.matches }}</span
          ><button aria-label="上一个匹配" @click="nextMatch(false)">↑</button
          ><button aria-label="下一个匹配" @click="nextMatch(true)">↓</button
          ><button aria-label="关闭查找" @click="closeSearch">×</button>
        </div>
        <div class="content-panes">
          <section
            v-show="editing"
            class="editor-pane"
            aria-label="Markdown 编辑区"
          >
            <div class="pane-label">
              <span>MARKDOWN 源码</span
              ><small
                >{{ lines }} 行 ·
                {{ dirty || !doc?.path ? "未保存" : "已保存" }}</small
              >
            </div>
            <textarea
              ref="sourceEditor"
              class="source-editor"
              :value="draft"
              :readonly="saving"
              :style="{ fontSize: `${fontSize - 2}px` }"
              aria-label="Markdown 源码"
              placeholder="从一个标题开始，写下你的想法…"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              @input="inputDraft"
            ></textarea>
          </section>
          <section class="preview-pane" aria-label="文档预览">
            <div v-if="editing" class="pane-label">
              <span>实时预览</span
              ><small>{{ busy ? "正在渲染…" : "随输入更新" }}</small>
            </div>
            <div ref="scroller" class="reading-scroll">
              <div class="reading-page">
                <div class="reading-eyebrow">
                  {{
                    doc
                      ? "YOUR DOCUMENT, BEAUTIFULLY READ."
                      : "A QUIET SPACE FOR YOUR IDEAS."
                  }}
                </div>
                <details
                  v-if="Object.keys(rendered.metadata).length"
                  class="metadata"
                >
                  <summary>
                    文档信息
                    <span>{{ Object.keys(rendered.metadata).length }} 项</span>
                  </summary>
                  <dl>
                    <template
                      v-for="(value, key) in rendered.metadata"
                      :key="key"
                      ><dt>{{ key }}</dt>
                      <dd>{{ metadataValue(value) }}</dd></template
                    >
                  </dl>
                </details>
                <p
                  v-for="warning in rendered.warnings"
                  :key="warning"
                  class="document-warning"
                >
                  {{ warning }}
                </p>
                <article
                  ref="article"
                  class="markdown-body"
                  :style="{ fontSize: `${fontSize}px` }"
                  @click="articleClick"
                ></article>
                <div class="document-end">
                  <span></span><small>阅读至此</small><span></span>
                </div>
              </div>
            </div>
          </section>
        </div>
        <footer class="statusbar">
          <span :title="doc?.path">{{
            doc?.path ||
            (doc
              ? "未命名文档 · 保存后可加载相对路径图片"
              : "Markdown · Mermaid · 数学公式")
          }}</span
          ><span>{{
            saving
              ? "正在处理文件…"
              : dirty
                ? "有未保存的修改"
                : busy
                  ? "正在渲染…"
                  : doc?.path
                    ? `已保存 ${modified}`
                    : doc
                      ? "新文档尚未保存"
                      : modified
          }}</span>
        </footer>
      </main>
    </div>
    <div
      v-if="dragging"
      class="drop-overlay"
      @dragleave.prevent="dragging = false"
    >
      <div>
        <span>↓</span><strong>放下你的 Markdown 文档</strong>
        <p>支持 .md 和 .markdown</p>
      </div>
    </div>
    <dialog
      ref="zoomDialog"
      class="diagram-dialog"
      @click="$event.target === zoomDialog && zoomDialog?.close()"
    >
      <div class="dialog-toolbar">
        <strong>图表预览</strong>
        <div>
          <button
            aria-label="缩小图表"
            @click="diagramZoom = Math.max(0.5, diagramZoom - 0.25)"
          >
            −</button
          ><span>{{ Math.round(diagramZoom * 100) }}%</span
          ><button
            aria-label="放大图表"
            @click="diagramZoom = Math.min(4, diagramZoom + 0.25)"
          >
            ＋</button
          ><button aria-label="关闭图表" @click="zoomDialog?.close()">×</button>
        </div>
      </div>
      <div class="diagram-viewport">
        <div
          class="enlarged-diagram"
          :style="{ width: `${diagramZoom * 100}%` }"
          v-html="enlargedDiagram"
        ></div>
      </div>
    </dialog>
  </div>
</template>
