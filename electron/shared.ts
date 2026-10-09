export interface DocumentData {
  path: string;
  name: string;
  content: string;
  modifiedAt: number;
  assetBase: string;
  version: string | null;
  lineEnding: "\n" | "\r\n";
  bom: boolean;
}

export interface ReaderAPI {
  platform: string;
  open: () => Promise<DocumentData | null>;
  current: () => Promise<DocumentData | null>;
  openDropped: (file: File) => Promise<DocumentData | null>;
  newDocument: (content?: string) => Promise<DocumentData | null>;
  updateDraft: (id: string, content: string, editing: boolean) => void;
  save: (saveAs?: boolean) => Promise<DocumentData | null>;
  followLink: (href: string) => Promise<void>;
  reload: () => Promise<DocumentData | null>;
  find: (text: string, forward?: boolean) => Promise<void>;
  stopFind: () => Promise<void>;
  onDocument: (callback: (doc: DocumentData) => void) => () => void;
  onError: (callback: (message: string) => void) => () => void;
  onMenu: (callback: (action: string) => void) => () => void;
  onBusy: (callback: (busy: boolean) => void) => () => void;
  onFind: (
    callback: (result: { matches: number; activeMatchOrdinal: number }) => void,
  ) => () => void;
}
