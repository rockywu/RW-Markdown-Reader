import type { ReaderAPI } from "../electron/shared";
declare global {
  interface Window {
    reader: ReaderAPI;
  }
}
export {};
