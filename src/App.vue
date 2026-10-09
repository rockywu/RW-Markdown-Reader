<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { renderMarkdown } from "./markdown";
import { sanitizeMarkdown } from "./sanitize";
import { enhanceDocument } from "./enhance";
import type { DocumentData } from "../electron/shared";
import welcomeZh from "../examples/welcome.md?raw";
import welcomeEn from "../examples/welcome.en.md?raw";
import {
  translate,
  type Locale,
  type MessageKey,
  type MessageParams,
} from "../electron/i18n";
import appIcon from "../build/icon.svg";

const props = defineProps<{ initialLocale: Locale }>();
const locale = ref(props.initialLocale);
const changingLocale = ref(false);
const t = (key: MessageKey, params?: MessageParams) =>
  translate(locale.value, key, params);
const welcome = computed(() => (locale.value === "zh" ? welcomeZh : welcomeEn));
const doc = ref<DocumentData | null>(null);
const draft = ref("");
const editing = ref(false);
const saving = ref(false);
const externalChange = ref(false);
const sourceEditor = ref<HTMLTextAreaElement>();
const previewSource = ref(welcome.value);
const previewVisible = ref(
  localStorage.getItem("markview-preview") !== "hidden",
);
const contentPanes = ref<HTMLElement>();
const storedRatio = Number(localStorage.getItem("markview-editor-width") ?? 45);
const editorRatio = ref(
  Number.isFinite(storedRatio) ? Math.max(20, Math.min(80, storedRatio)) : 45,
);
const resizing = ref(false);
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
const rendered = computed(() =>
  renderMarkdown(previewSource.value, locale.value),
);
const title = computed(() =>
  doc.value
    ? doc.value.path
      ? doc.value.name
      : t("untitledFile")
    : t("welcome"),
);
const isDark = computed(() => theme.value === "dark");
const modified = computed(() =>
  doc.value
    ? new Date(doc.value.modifiedAt).toLocaleTimeString(
        locale.value === "zh" ? "zh-CN" : "en-US",
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        },
      )
    : t("offline"),
);
let revision = 0;
let pendingAnchor: string | null = null;
let searchTimer: ReturnType<typeof setTimeout>;
let previewTimer: ReturnType<typeof setTimeout>;
const unsubscribers: (() => void)[] = [];

async function changeLocale(event: Event) {
  const select = event.target as HTMLSelectElement;
  changingLocale.value = true;
  try {
    locale.value = await window.reader.setLocale(select.value as Locale);
    if (!doc.value) previewSource.value = welcome.value;
  } catch (value) {
    select.value = locale.value;
    showError(value);
  } finally {
    changingLocale.value = false;
  }
}
watch(
  locale,
  (value) => {
    document.documentElement.lang = value === "zh" ? "zh-CN" : "en";
  },
  { immediate: true },
);
watch(previewVisible, (visible) => {
  localStorage.setItem("markview-preview", visible ? "visible" : "hidden");
});
function saveRatio() {
  localStorage.setItem("markview-editor-width", String(editorRatio.value));
}
function resizePanes(event: PointerEvent) {
  if (!resizing.value || !contentPanes.value) return;
  const bounds = contentPanes.value.getBoundingClientRect();
  editorRatio.value = Math.max(
    20,
    Math.min(
      80,
      ((event.clientX - bounds.left - 4) / (bounds.width - 8)) * 100,
    ),
  );
}
function startResize(event: PointerEvent) {
  if (event.button !== 0) return;
  const separator = event.currentTarget as HTMLElement;
  separator.focus({ preventScroll: true });
  separator.setPointerCapture(event.pointerId);
  resizing.value = true;
}
function finishResize() {
  resizing.value = false;
  saveRatio();
}
function resizeKeyboard(event: KeyboardEvent) {
  const values: Record<string, number> = {
    ArrowLeft: editorRatio.value - 2,
    ArrowRight: editorRatio.value + 2,
    Home: 20,
    End: 80,
  };
  if (!(event.key in values)) return;
  event.preventDefault();
  editorRatio.value = Math.max(20, Math.min(80, values[event.key]));
  saveRatio();
}
function resetRatio() {
  editorRatio.value = 45;
  saveRatio();
}
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
    ? t("nestedMetadata")
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
    error.value = t("inputTooLarge");
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
    await newFile(welcome.value);
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
      locale.value,
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
async function jump(id: string) {
  if (editing.value) previewVisible.value = true;
  await nextTick();
  const element = Array.from(
    article.value?.querySelectorAll("[id]") ?? [],
  ).find((item) => item.id === id);
  element?.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function openSearch() {
  if (editing.value) previewVisible.value = true;
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
        <img class="brand-logo" :src="appIcon" :alt="t('appIcon')" />
        <div>
          <strong>{{ t("brand") }}</strong
          ><small>MARKVIEW</small>
        </div>
      </div>
      <div class="toolbar-divider"></div>
      <button class="open-button" :disabled="saving" @click="opening">
        <span aria-hidden="true">＋</span> {{ t("open") }}
        <kbd>{{ platform === "darwin" ? "⌘ O" : "Ctrl O" }}</kbd>
      </button>
      <button
        class="text-button new-button"
        :disabled="saving"
        @click="newFile()"
      >
        {{ t("new") }}
      </button>
      <span class="toolbar-spacer"></span>
      <div class="mode-switch" :aria-label="t('mode')">
        <button
          :aria-pressed="!editing"
          :disabled="saving"
          @click="editing && toggleEditor()"
        >
          {{ t("read") }}
        </button>
        <button
          :aria-pressed="editing"
          :disabled="saving"
          @click="!editing && toggleEditor()"
        >
          {{ t("edit") }}
        </button>
      </div>
      <button
        class="save-button"
        :disabled="saving || !doc"
        @click="saveFile()"
      >
        {{ t("save") }}<span v-if="dirty" class="dirty-dot"></span>
      </button>
      <button
        class="text-button save-as-button"
        :disabled="saving || !doc"
        @click="saveFile(true)"
      >
        {{ t("saveAs") }}
      </button>
      <button
        class="icon-button"
        :aria-pressed="outline"
        :aria-label="t('toggleOutline')"
        :title="t('outline')"
        @click="outline = !outline"
      >
        ☷
      </button>
      <button
        class="icon-button"
        :aria-label="t('findDocument')"
        :title="t('find')"
        @click="openSearch"
      >
        ⌕
      </button>
      <div class="font-control">
        <button
          :aria-label="t('smallerText')"
          :disabled="fontSize <= 12"
          @click="fontSize--"
        >
          A−</button
        ><span>{{ fontSize }}</span
        ><button
          :aria-label="t('largerText')"
          :disabled="fontSize >= 24"
          @click="fontSize++"
        >
          A＋
        </button>
      </div>
      <button
        class="icon-button theme-toggle"
        :aria-label="t(isDark ? 'lightTheme' : 'darkTheme')"
        @click="theme = isDark ? 'light' : 'dark'"
      >
        {{ isDark ? "☀" : "☾" }}
      </button>
      <select
        class="language-select"
        aria-label="界面语言 / Interface language"
        :value="locale"
        :disabled="changingLocale"
        @change="changeLocale"
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>
    </header>

    <div v-if="error" class="error-banner" role="alert">
      <span>{{ error }}</span
      ><button :aria-label="t('closeError')" @click="error = ''">×</button>
    </div>
    <div v-if="externalChange" class="conflict-banner" role="status">
      <span>{{ t("externalChange") }}</span
      ><button :disabled="saving" @click="saveFile(true)">
        {{ t("saveCopy") }}</button
      ><button :disabled="saving" @click="reloadFile">
        {{ t("reloadDisk") }}
      </button>
    </div>
    <div class="workspace">
      <aside v-if="outline" class="sidebar">
        <div class="sidebar-label">{{ t("reading") }}</div>
        <div class="document-card">
          <span class="file-symbol">M↓</span>
          <div>
            <strong :title="title">{{ title }}</strong
            ><small>{{ t(doc ? "localDocument" : "startReading") }}</small>
          </div>
        </div>
        <div class="outline-title">
          <span>{{ t("outline") }}</span
          ><small>{{ rendered.headings.length }}</small>
        </div>
        <nav :aria-label="t('outline')">
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
            {{ t("noHeadings") }}
          </p>
        </nav>
        <div class="sidebar-bottom">
          <span class="status-dot"></span> {{ t("localRendering") }}
        </div>
      </aside>

      <main class="main-pane">
        <div class="document-bar">
          <div class="breadcrumb">
            <span>{{ t("document") }}</span
            ><span class="slash">/</span><strong>{{ title }}</strong
            ><span v-if="dirty" class="unsaved-label">{{ t("unsaved") }}</span>
          </div>
          <span class="format-badge">MARKDOWN</span>
        </div>
        <div v-if="searchOpen" class="search-bar">
          <input
            ref="searchInput"
            v-model="query"
            :aria-label="t('searchContent')"
            :placeholder="t('searchPlaceholder')"
            maxlength="500"
            @keydown.enter="nextMatch(!$event.shiftKey)"
          /><span>{{ matches.activeMatchOrdinal }} / {{ matches.matches }}</span
          ><button :aria-label="t('previousMatch')" @click="nextMatch(false)">
            ↑</button
          ><button :aria-label="t('nextMatch')" @click="nextMatch(true)">
            ↓</button
          ><button :aria-label="t('closeSearch')" @click="closeSearch">
            ×
          </button>
        </div>
        <div ref="contentPanes" class="content-panes" :class="{ resizing }">
          <section
            v-show="editing"
            id="markdown-editor-pane"
            class="editor-pane"
            :style="{
              width: previewVisible
                ? `calc((100% - 8px) * ${editorRatio / 100})`
                : '100%',
            }"
            :aria-label="t('editorRegion')"
          >
            <div class="pane-label">
              <span>{{ t("source") }}</span
              ><small
                >{{ t("lineCount", { count: lines }) }} ·
                {{ t(dirty || !doc?.path ? "unsaved" : "saved") }}</small
              >
              <button
                class="pane-action"
                :aria-expanded="previewVisible"
                aria-controls="markdown-preview-pane"
                @click="previewVisible = !previewVisible"
              >
                {{ t(previewVisible ? "hidePreview" : "showPreview") }}
              </button>
            </div>
            <textarea
              ref="sourceEditor"
              class="source-editor"
              :value="draft"
              :readonly="saving"
              :style="{ fontSize: `${fontSize - 2}px` }"
              :aria-label="t('source')"
              :placeholder="t('editorPlaceholder')"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              @input="inputDraft"
            ></textarea>
          </section>
          <div
            v-if="editing && previewVisible"
            class="pane-divider"
            role="separator"
            tabindex="0"
            aria-orientation="vertical"
            aria-controls="markdown-editor-pane"
            :aria-label="t('resizePanes')"
            :title="t('resizeHint')"
            :aria-valuenow="Math.round(editorRatio)"
            :aria-valuemin="20"
            :aria-valuemax="80"
            @pointerdown.prevent="startResize"
            @pointermove="resizePanes"
            @pointerup="finishResize"
            @pointercancel="finishResize"
            @lostpointercapture="finishResize"
            @keydown="resizeKeyboard"
            @dblclick="resetRatio"
          ></div>
          <section
            v-show="!editing || previewVisible"
            id="markdown-preview-pane"
            class="preview-pane"
            :aria-label="t('preview')"
          >
            <div v-if="editing" class="pane-label">
              <span>{{ t("livePreview") }}</span
              ><small>{{ t(busy ? "rendering" : "updatesAsYouType") }}</small>
            </div>
            <div ref="scroller" class="reading-scroll">
              <div class="reading-page">
                <div class="reading-eyebrow">
                  {{ t(doc ? "documentCaption" : "welcomeCaption") }}
                </div>
                <details
                  v-if="Object.keys(rendered.metadata).length"
                  class="metadata"
                >
                  <summary>
                    {{ t("metadata") }}
                    <span>{{
                      t("itemCount", {
                        count: Object.keys(rendered.metadata).length,
                      })
                    }}</span>
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
                  <span></span><small>{{ t("endDocument") }}</small
                  ><span></span>
                </div>
              </div>
            </div>
          </section>
        </div>
        <footer class="statusbar">
          <span :title="doc?.path">{{
            doc?.path || (doc ? t("untitledHint") : t("supportedContent"))
          }}</span
          ><span>{{
            saving
              ? t("processingFile")
              : dirty
                ? t("unsavedChanges")
                : busy
                  ? t("rendering")
                  : doc?.path
                    ? t("savedAt", { time: modified })
                    : doc
                      ? t("newUnsaved")
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
        <span>↓</span><strong>{{ t("dropDocument") }}</strong>
        <p>{{ t("dropFormats") }}</p>
      </div>
    </div>
    <dialog
      ref="zoomDialog"
      class="diagram-dialog"
      @click="$event.target === zoomDialog && zoomDialog?.close()"
    >
      <div class="dialog-toolbar">
        <strong>{{ t("diagramPreview") }}</strong>
        <div>
          <button
            :aria-label="t('smallerDiagram')"
            @click="diagramZoom = Math.max(0.5, diagramZoom - 0.25)"
          >
            −</button
          ><span>{{ Math.round(diagramZoom * 100) }}%</span
          ><button
            :aria-label="t('largerDiagram')"
            @click="diagramZoom = Math.min(4, diagramZoom + 0.25)"
          >
            ＋</button
          ><button :aria-label="t('closeDiagram')" @click="zoomDialog?.close()">
            ×
          </button>
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
