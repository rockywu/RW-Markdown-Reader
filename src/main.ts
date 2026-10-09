import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
// Apply the stored theme before the first paint so dark mode never flashes light.
document.documentElement.dataset.theme =
  localStorage.getItem("markview-theme") || "light";
void window.reader.getLocale().then((initialLocale) => {
  createApp(App, { initialLocale }).mount("#app");
});
