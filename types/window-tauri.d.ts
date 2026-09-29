declare global {
  interface Window {
    __TAURI_IPC__?: unknown
  }
}
export {}
