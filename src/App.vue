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
import Icon from "./Icon.vue";
import { icons, type IconName } from "./icons";

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
const outline = ref(localStorage.getItem("markview-outline") !== "hidden");
// Editing hides the outline by default without forgetting the reading preference.
const editOutline = ref(false);
const outlineVisible = computed(() =>
  editing.value ? editOutline.value : outline.value,
);
const theme = ref(localStorage.getItem("markview-theme") || "light");
const storedFontSize = Number(localStorage.getItem("markview-font-size") ?? 16);
const fontSize = ref(
  Number.isFinite(storedFontSize)
    ? Math.max(12, Math.min(24, Math.round(storedFontSize)))
    : 16,
);
const error = ref("");
const busy = ref(false);
const dragging = ref(false);
let dragDepth = 0;
const article = ref<HTMLElement>();
const scroller = ref<HTMLElement>();
const searchInput = ref<HTMLInputElement>();
const searchOpen = ref(false);
const query = ref("");
const matches = ref({ matches: 0, activeMatchOrdinal: 0 });
const searched = ref(false);
const zoomDialog = ref<HTMLDialogElement>();
const diagramViewport = ref<HTMLElement>();
const diagramZoom = ref(1);
const panning = ref(false);
let panStart = { x: 0, y: 0, left: 0, top: 0 };
const progress = ref(0);
const showTop = ref(false);
const notice = ref("");
const activeHeading = ref("");
const outlineNav = ref<HTMLElement>();
const modifierKey = platform === "darwin" ? "⌘" : "Ctrl";
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
    ? new Date(doc.value.modifiedAt).toLocaleString(
        locale.value === "zh" ? "zh-CN" : "en-US",
        {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      )
    : t("offline"),
);
// Roughly 400 CJK characters or 220 words per minute.
const readingMinutes = computed(() => {
  const text = previewSource.value;
  const cjk = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
  const words =
    text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, " ").match(/[\p{L}\p{N}]+/gu)
      ?.length ?? 0;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
});
// The file name stays visible while a long folder path is truncated.
const pathParts = computed(() => {
  const path = doc.value?.path ?? "";
  const split = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1;
  return { folder: path.slice(0, split), name: path.slice(split) };
});
const matchLabel = computed(() =>
  !query.value
    ? ""
    : searched.value && !matches.value.matches
      ? t("noMatches")
      : `${matches.value.activeMatchOrdinal} / ${matches.value.matches}`,
);
let revision = 0;
let pendingAnchor: string | null = null;
let searchTimer: ReturnType<typeof setTimeout>;
let previewTimer: ReturnType<typeof setTimeout>;
let noticeTimer: ReturnType<typeof setTimeout>;
const copyTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
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
function notify(message: string) {
  notice.value = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = "";
  }, 1800);
}
const iconMarkup = (name: IconName) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
// Added after sanitizing: document HTML can never contribute its own buttons.
function addCopyButtons(root: HTMLElement) {
  for (const block of root.querySelectorAll(".code-block")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.title = t("copyCode");
    button.setAttribute("aria-label", t("copyCode"));
    button.innerHTML = iconMarkup("copy");
    block.append(button);
  }
}
async function copyCode(button: HTMLElement) {
  const code = button.closest(".code-block")?.querySelector("pre")?.textContent;
  if (code === undefined || code === null) return;
  const text = code.replace(/\n$/, "");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // The async clipboard requires a focused document; fall back to a selection copy.
    const scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.cssText = "position:fixed;opacity:0";
    document.body.append(scratch);
    scratch.select();
    const copied = document.execCommand("copy");
    scratch.remove();
    button.focus();
    if (!copied) return;
  }
  button.classList.add("is-copied");
  button.setAttribute("aria-label", t("copied"));
  button.innerHTML = `${iconMarkup("check")}<span>${t("copied")}</span>`;
  clearTimeout(copyTimers.get(button));
  copyTimers.set(
    button,
    setTimeout(() => {
      button.classList.remove("is-copied");
      button.setAttribute("aria-label", t("copyCode"));
      button.innerHTML = iconMarkup("copy");
    }, 1600),
  );
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
    addCopyButtons(article.value);
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
      // Restarting a find session while typing would steal the editor selection.
      if (searchOpen.value && query.value && !editing.value)
        await window.reader.find(query.value);
      trackScroll();
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
  searched.value = false;
  searchTimer = setTimeout(() => {
    void window.reader.find(query.value).catch(showError);
  }, 150);
});
watch(outline, (visible) => {
  localStorage.setItem("markview-outline", visible ? "visible" : "hidden");
});
watch(fontSize, (size) => {
  localStorage.setItem("markview-font-size", String(size));
});
watch(activeHeading, async (id) => {
  await nextTick();
  outlineNav.value
    ?.querySelector<HTMLElement>(`[data-heading="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "nearest" });
});
function toggleOutline() {
  if (editing.value) editOutline.value = !editOutline.value;
  else outline.value = !outline.value;
}
function changeFontSize(step: number) {
  fontSize.value = Math.max(12, Math.min(24, fontSize.value + step));
}
let scrollFrame = 0;
function trackScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const element = scroller.value;
    if (!element) return;
    const range = element.scrollHeight - element.clientHeight;
    progress.value = range > 0 ? Math.min(1, element.scrollTop / range) : 0;
    showTop.value = element.scrollTop > element.clientHeight;
    const top = element.getBoundingClientRect().top + 96;
    let current = rendered.value.headings[0]?.id ?? "";
    for (const heading of rendered.value.headings) {
      const target = document.getElementById(heading.id);
      if (!target || !article.value?.contains(target)) continue;
      if (target.getBoundingClientRect().top > top) break;
      current = heading.id;
    }
    activeHeading.value = current;
  });
}
const smoothScroll = (): ScrollBehavior =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
function scrollToTop() {
  scroller.value?.scrollTo({ top: 0, behavior: smoothScroll() });
}
// While editing, the preview follows the editor proportionally; the reverse stays free.
let syncFrame = 0;
function followEditor(event: Event) {
  if (!previewVisible.value) return;
  const editor = event.target as HTMLTextAreaElement;
  cancelAnimationFrame(syncFrame);
  syncFrame = requestAnimationFrame(() => {
    const preview = scroller.value;
    if (!preview) return;
    const range = editor.scrollHeight - editor.clientHeight;
    preview.scrollTop =
      (range > 0 ? editor.scrollTop / range : 0) *
      (preview.scrollHeight - preview.clientHeight);
  });
}
async function jump(id: string) {
  if (editing.value) previewVisible.value = true;
  await nextTick();
  const element = Array.from(
    article.value?.querySelectorAll("[id]") ?? [],
  ).find((item) => item.id === id);
  element?.scrollIntoView({ behavior: smoothScroll(), block: "start" });
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
// Only file drags show the overlay; text dragged inside the editor keeps its native behavior.
const carriesFiles = (event: DragEvent) =>
  !!event.dataTransfer?.types.includes("Files");
function dragEnter(event: DragEvent) {
  if (!carriesFiles(event)) return;
  dragDepth++;
  dragging.value = true;
}
function dragOver(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
}
function dragLeave(event: DragEvent) {
  if (!carriesFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dragging.value = false;
}
async function onDrop(event: DragEvent) {
  dragDepth = 0;
  dragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  event.preventDefault();
  try {
    const next = await window.reader.openDropped(file);
    if (next) receive(next);
  } catch (value) {
    showError(value);
  }
}
async function articleClick(event: MouseEvent) {
  const target = event.target as Element;
  const copyButton = target.closest<HTMLElement>(".code-copy");
  if (copyButton) {
    await copyCode(copyButton);
    return;
  }
  const button = target.closest(".diagram-expand");
  if (button) {
    const svg = button.closest(".diagram")?.querySelector("svg");
    if (svg) {
      enlargedDiagram.value = svg.outerHTML;
      diagramZoom.value = 1;
      await nextTick();
      zoomDialog.value?.showModal();
      diagramViewport.value?.scrollTo(0, 0);
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
function zoomDiagram(factor: number) {
  diagramZoom.value = Math.max(0.25, Math.min(4, diagramZoom.value * factor));
}
function fitDiagram() {
  const viewport = diagramViewport.value;
  const svg = viewport?.querySelector("svg");
  if (!viewport || !svg) return;
  // The diagram width follows the zoom, so its aspect ratio gives the zoom that fits both axes.
  const { width, height } = svg.getBoundingClientRect();
  const style = getComputedStyle(viewport);
  const room = (axis: "Left" | "Top", end: "Right" | "Bottom", size: number) =>
    size - parseFloat(style[`padding${axis}`]) - parseFloat(style[`padding${end}`]);
  const fitWidth = room("Left", "Right", viewport.clientWidth);
  const fitHeight = room("Top", "Bottom", viewport.clientHeight);
  const zoom = width && height ? (fitHeight * width) / (height * fitWidth) : 1;
  diagramZoom.value = Math.max(0.25, Math.min(1, zoom));
  viewport.scrollTo(0, 0);
}
function wheelDiagram(event: WheelEvent) {
  // Trackpad pinch arrives as a wheel event with ctrlKey set.
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  zoomDiagram(Math.exp(-event.deltaY * 0.01));
}
function startPan(event: PointerEvent) {
  const viewport = diagramViewport.value;
  if (event.button !== 0 || !viewport) return;
  viewport.setPointerCapture(event.pointerId);
  panning.value = true;
  panStart = {
    x: event.clientX,
    y: event.clientY,
    left: viewport.scrollLeft,
    top: viewport.scrollTop,
  };
}
function pan(event: PointerEvent) {
  const viewport = diagramViewport.value;
  if (!panning.value || !viewport) return;
  viewport.scrollLeft = panStart.left - (event.clientX - panStart.x);
  viewport.scrollTop = panStart.top - (event.clientY - panStart.y);
}
let releaseTab = false;
function editorKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    // Escape hands Tab back to focus navigation for keyboard users.
    releaseTab = true;
    return;
  }
  if (event.key !== "Tab" || releaseTab || event.altKey || event.ctrlKey || event.metaKey) {
    releaseTab = false;
    return;
  }
  const editor = event.target as HTMLTextAreaElement;
  if (editor.readOnly) return;
  event.preventDefault();
  const { selectionStart: start, selectionEnd: end, value } = editor;
  const indent = "  ";
  if (!event.shiftKey && !value.slice(start, end).includes("\n")) {
    // execCommand keeps the edit on the native undo stack and fires input.
    document.execCommand("insertText", false, indent);
    return;
  }
  // Work on whole lines; a selection ending at a line start leaves that line alone.
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lastChar = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nextBreak = value.indexOf("\n", lastChar);
  const lineEnd = nextBreak < 0 ? value.length : nextBreak;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const changed = lines.map((line) =>
    event.shiftKey ? line.replace(/^( {1,2}|\t)/, "") : indent + line,
  );
  const firstDelta = changed[0].length - lines[0].length;
  const replacement = changed.join("\n");
  if (replacement === block) return;
  editor.setSelectionRange(lineStart, lineEnd);
  document.execCommand("insertText", false, replacement);
  const newStart = Math.max(lineStart, start + firstDelta);
  editor.setSelectionRange(
    newStart,
    Math.max(newStart, end + replacement.length - block.length),
  );
}
function keyboard(event: KeyboardEvent) {
  // The diagram dialog handles its own Escape; keep search and errors as they are.
  if (zoomDialog.value?.open) return;
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
      searched.value = true;
    }),
    window.reader.onSaved((name) => notify(t("savedTo", { name }))),
    window.reader.onMenu((action) => {
      if (action === "find") void openSearch();
      else if (action === "outline") toggleOutline();
      else if (action === "text-larger") changeFontSize(1);
      else if (action === "text-smaller") changeFontSize(-1);
      else if (action === "text-reset") fontSize.value = 16;
      else if (action === "toggle-edit") void toggleEditor();
      else if (action === "edit") {
        editing.value = true;
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
  cancelAnimationFrame(scrollFrame);
  cancelAnimationFrame(syncFrame);
  unsubscribers.forEach((stop) => stop());
  clearTimeout(searchTimer);
  clearTimeout(previewTimer);
  clearTimeout(noticeTimer);
  document.removeEventListener("keydown", keyboard);
});
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'is-editing': editing }"
    @dragenter="dragEnter"
    @dragover="dragOver"
    @dragleave="dragLeave"
    @drop="onDrop"
  >
    <header class="toolbar">
      <div class="brand">
        <img class="brand-logo" :src="appIcon" :alt="t('appIcon')" />
        <strong>{{ t("brand") }}</strong>
      </div>
      <div class="toolbar-divider"></div>
      <button class="open-button" :disabled="saving" @click="opening">
        <Icon name="open" />
        <span>{{ t("open") }}</span>
        <kbd>{{ modifierKey }} O</kbd>
      </button>
      <button
        class="text-button new-button"
        :disabled="saving"
        @click="newFile()"
      >
        {{ t("new") }}
      </button>
      <span class="toolbar-spacer"></span>
      <div class="mode-switch" role="group" :aria-label="t('mode')">
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
        :class="{ 'is-dirty': dirty }"
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
      <div class="toolbar-divider"></div>
      <div class="tool-cluster">
        <button
          class="icon-button"
          :aria-pressed="outlineVisible"
          :aria-label="t('toggleOutline')"
          :title="t('toggleOutline')"
          @click="toggleOutline"
        >
          <Icon name="outline" />
        </button>
        <button
          class="icon-button"
          :aria-label="t('findDocument')"
          :title="`${t('find')} (${modifierKey} F)`"
          @click="openSearch"
        >
          <Icon name="search" />
        </button>
        <div
          class="font-control"
          role="group"
          :aria-label="t('textSize', { size: fontSize })"
        >
          <button
            class="font-smaller"
            :aria-label="t('smallerText')"
            :title="`${t('smallerText')} (${modifierKey} −)`"
            :disabled="fontSize <= 12"
            @click="changeFontSize(-1)"
          >
            A
          </button>
          <span aria-hidden="true">{{ fontSize }}</span>
          <button
            class="font-larger"
            :aria-label="t('largerText')"
            :title="`${t('largerText')} (${modifierKey} +)`"
            :disabled="fontSize >= 24"
            @click="changeFontSize(1)"
          >
            A
          </button>
        </div>
        <button
          class="icon-button theme-toggle"
          :aria-label="t(isDark ? 'lightTheme' : 'darkTheme')"
          :title="t(isDark ? 'lightTheme' : 'darkTheme')"
          @click="theme = isDark ? 'light' : 'dark'"
        >
          <Icon :name="isDark ? 'sun' : 'moon'" />
        </button>
      </div>
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
    <div
      class="signal-rail"
      :class="{ 'is-busy': busy || saving }"
      aria-hidden="true"
    >
      <span :style="{ transform: `scaleX(${progress})` }"></span>
    </div>

    <div v-if="error" class="error-banner" role="alert">
      <span>{{ error }}</span
      ><button :aria-label="t('closeError')" :title="t('closeError')" @click="error = ''">
        <Icon name="close" />
      </button>
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
      <aside v-if="outlineVisible" class="sidebar">
        <div class="document-card">
          <span class="file-symbol"><Icon name="file" /></span>
          <div>
            <strong :title="title">{{ title }}</strong
            ><small>{{ t(doc ? "localDocument" : "startReading") }}</small>
          </div>
        </div>
        <div class="outline-title">
          <span>{{ t("outline") }}</span
          ><small>{{ rendered.headings.length }}</small>
        </div>
        <nav ref="outlineNav" :aria-label="t('outline')">
          <button
            v-for="heading in rendered.headings"
            :key="heading.id"
            :data-heading="heading.id"
            :title="heading.text"
            :style="{
              paddingLeft: `${12 + Math.min(heading.level - 1, 3) * 12}px`,
            }"
            :class="{
              'top-heading': heading.level === 1,
              active: heading.id === activeHeading,
            }"
            :aria-current="heading.id === activeHeading ? 'location' : undefined"
            @click="jump(heading.id)"
          >
            {{ heading.text }}
          </button>
          <p v-if="!rendered.headings.length" class="empty-outline">
            {{ t("noHeadings") }}
          </p>
        </nav>
        <div class="sidebar-bottom">
          <span
            class="progress-ring"
            :style="{ '--progress': `${progress * 100}%` }"
            aria-hidden="true"
          ></span
          >{{ t("readProgress", { percent: Math.round(progress * 100) }) }}
        </div>
      </aside>

      <main class="main-pane">
        <div class="document-bar">
          <div class="breadcrumb">
            <span>{{ t("document") }}</span
            ><span class="slash">/</span><strong>{{ title }}</strong
            ><span v-if="dirty" class="unsaved-label">{{ t("unsaved") }}</span>
          </div>
          <span class="reading-time">{{
            t("readingTime", { count: readingMinutes })
          }}</span>
        </div>
        <div v-if="searchOpen" class="search-bar">
          <div class="search-field">
            <Icon name="search" />
            <input
              ref="searchInput"
              v-model="query"
              :aria-label="t('searchContent')"
              :placeholder="t('searchPlaceholder')"
              maxlength="500"
              @keydown.enter="nextMatch(!$event.shiftKey)"
            /><span
              class="match-count"
              :class="{ 'is-empty': matchLabel === t('noMatches') }"
              aria-live="polite"
              >{{ matchLabel }}</span
            >
          </div>
          <button
            :aria-label="t('previousMatch')"
            :title="t('previousMatch')"
            :disabled="!matches.matches"
            @click="nextMatch(false)"
          >
            <Icon name="up" /></button
          ><button
            :aria-label="t('nextMatch')"
            :title="t('nextMatch')"
            :disabled="!matches.matches"
            @click="nextMatch(true)"
          >
            <Icon name="down" /></button
          ><button
            :aria-label="t('closeSearch')"
            :title="t('closeSearch')"
            @click="closeSearch"
          >
            <Icon name="close" />
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
              @keydown="editorKeydown"
              @scroll.passive="followEditor"
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
            <div ref="scroller" class="reading-scroll" @scroll.passive="trackScroll">
              <div class="reading-page">
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
            <Transition name="float">
              <button
                v-if="showTop"
                class="back-to-top"
                :aria-label="t('backToTop')"
                :title="t('backToTop')"
                @click="scrollToTop"
              >
                <Icon name="top" />
              </button>
            </Transition>
          </section>
        </div>
        <footer class="statusbar">
          <span class="status-path" :title="doc?.path"
            ><span class="path-folder">{{
              doc?.path
                ? pathParts.folder
                : t(doc ? "untitledHint" : "supportedContent")
            }}</span
            ><span v-if="doc?.path" class="path-name">{{
              pathParts.name
            }}</span></span
          ><span :class="{ 'is-attention': dirty }">{{
            saving
              ? t("processingFile")
              : dirty
                ? t("unsavedChanges")
                : busy
                  ? t("rendering")
                  : doc?.path
                    ? t("modifiedAt", { time: modified })
                    : doc
                      ? t("newUnsaved")
                      : modified
          }}</span>
        </footer>
      </main>
    </div>
    <div class="toast-region" role="status" aria-live="polite">
      <Transition name="float">
        <div v-if="notice" class="toast">
          <Icon name="check" /><span>{{ notice }}</span>
        </div>
      </Transition>
    </div>
    <div v-if="dragging" class="drop-overlay">
      <div>
        <Icon name="drop" />
        <strong>{{ t("dropDocument") }}</strong>
        <p>{{ t("dropFormats") }}</p>
      </div>
    </div>
    <dialog
      ref="zoomDialog"
      class="diagram-dialog"
      aria-labelledby="diagram-dialog-title"
      @click="$event.target === zoomDialog && zoomDialog?.close()"
    >
      <div class="dialog-toolbar">
        <div class="dialog-title">
          <strong id="diagram-dialog-title">{{ t("diagramPreview") }}</strong>
          <small>{{ t("diagramHint", { key: modifierKey }) }}</small>
        </div>
        <div class="dialog-actions">
          <button
            :aria-label="t('smallerDiagram')"
            :title="t('smallerDiagram')"
            :disabled="diagramZoom <= 0.25"
            @click="zoomDiagram(1 / 1.25)"
          >
            <Icon name="minus" /></button
          ><span>{{ Math.round(diagramZoom * 100) }}%</span
          ><button
            :aria-label="t('largerDiagram')"
            :title="t('largerDiagram')"
            :disabled="diagramZoom >= 4"
            @click="zoomDiagram(1.25)"
          >
            <Icon name="plus" /></button
          ><button
            :aria-label="t('fitDiagram')"
            :title="t('fitDiagram')"
            @click="fitDiagram"
          >
            <Icon name="fit" /></button
          ><span class="dialog-divider"></span
          ><button
            :aria-label="t('closeDiagram')"
            :title="t('closeDiagram')"
            @click="zoomDialog?.close()"
          >
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div
        ref="diagramViewport"
        class="diagram-viewport"
        :class="{ panning }"
        @wheel="wheelDiagram"
        @pointerdown="startPan"
        @pointermove="pan"
        @pointerup="panning = false"
        @pointercancel="panning = false"
      >
        <div
          class="enlarged-diagram"
          :style="{ width: `${diagramZoom * 100}%` }"
          v-html="enlargedDiagram"
        ></div>
      </div>
    </dialog>
  </div>
</template>

