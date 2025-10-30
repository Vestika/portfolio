/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Chrome extension API types (optional, may not be present)
interface Window {
  chrome?: {
    runtime?: {
      sendMessage?: (message: any) => Promise<any>;
    };
  };
}

declare const chrome: {
  runtime?: {
    sendMessage?: (message: any) => Promise<any>;
  };
} | undefined;
