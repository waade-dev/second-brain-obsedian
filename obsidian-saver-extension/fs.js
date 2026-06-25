// Shared helpers for talking to the vault folder on disk via the
// File System Access API. The directory handle is persisted in IndexedDB so it
// survives browser restarts (chrome.storage can't store handles — they aren't
// JSON-serializable). Used by both popup.js and options.js.

const FS = (() => {
  const DB_NAME = "obsidian-saver";
  const STORE = "handles";
  const HANDLE_KEY = "vaultDir";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }

  // Prompt the user to pick their vault folder. Must run from a user gesture.
  async function pickVaultFolder() {
    const handle = await window.showDirectoryPicker({
      id: "obsidian-vault",
      mode: "readwrite",
      startIn: "documents"
    });
    await idbSet(HANDLE_KEY, handle);
    return handle;
  }

  async function getVaultHandle() {
    return (await idbGet(HANDLE_KEY)) || null;
  }

  // Returns true if we have read/write access. requestPermission needs a user
  // gesture, so call this from a click handler.
  async function ensurePermission(handle, mode = "readwrite") {
    const opts = { mode };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
    return false;
  }

  // Append text to a file inside the vault, creating folders/file as needed.
  async function appendToFile(dirHandle, notePath, text) {
    const parts = notePath.split("/").filter(Boolean);
    const fileName = parts.pop();
    let dir = dirHandle;
    for (const segment of parts) {
      dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const file = await fileHandle.getFile();
    const writable = await fileHandle.createWritable({ keepExistingData: true });
    await writable.seek(file.size); // jump to end -> append without re-reading
    await writable.write(text);
    await writable.close();
  }

  return { pickVaultFolder, getVaultHandle, ensurePermission, appendToFile };
})();
