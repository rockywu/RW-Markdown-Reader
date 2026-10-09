import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
void window.reader.getLocale().then((initialLocale) => {
  createApp(App, { initialLocale }).mount("#app");
});
