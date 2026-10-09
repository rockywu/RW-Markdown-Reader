import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { ReaderAPI } from "./shared";

function listen(channel: string, callback: (...args: any[]) => void) {
  const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
    callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: ReaderAPI = {
  platform: process.platform,
  getLocale: () => ipcRenderer.invoke("reader:get-locale"),
  setLocale: (locale) => ipcRenderer.invoke("reader:set-locale", locale),
  open: () => ipcRenderer.invoke("reader:open"),
  current: () => ipcRenderer.invoke("reader:current"),
  openDropped: (file) =>
    ipcRenderer.invoke("reader:drop", webUtils.getPathForFile(file)),
  newDocument: (content = "") => ipcRenderer.invoke("reader:new", content),
  updateDraft: (id, content, editing) =>
    ipcRenderer.send("reader:draft", id, content, editing),
  save: (saveAs = false) => ipcRenderer.invoke("reader:save", saveAs),
  followLink: (href) => ipcRenderer.invoke("reader:link", href),
  reload: () => ipcRenderer.invoke("reader:reload"),
  find: (text, forward = true) =>
    ipcRenderer.invoke("reader:find", text, forward),
  stopFind: () => ipcRenderer.invoke("reader:stop-find"),
  onDocument: (callback) => listen("reader:document", callback),
  onError: (callback) => listen("reader:error", callback),
  onMenu: (callback) => listen("reader:menu", callback),
  onBusy: (callback) => listen("reader:busy", callback),
  onFind: (callback) => listen("reader:find-result", callback),
};
contextBridge.exposeInMainWorld("reader", api);
