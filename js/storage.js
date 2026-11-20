// Read-Only Storage Layer for MemoBam PWA
// 1. IndexedDB local cache (offline-first on Mobile & ChromeOS)
// 2. File System Access API in READ-ONLY mode (ChromeOS / Desktop Chrome)
// 3. JSON Import (archivio_memobam.json, diario_index.json, or combined backup)

const DB_NAME = 'memobam_pwa_readonly_db';
const DB_VERSION = 1;
const ARCHIVE_INDEX_FILE = 'archivio_memobam.json';
const DIARY_DIR = 'Diario';
const DIARY_INDEX_FILE = 'diario_index.json';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('archive')) db.createObjectStore('archive', { keyPath: 'Id' });
      if (!db.objectStoreNames.contains('diary')) db.createObjectStore('diary', { keyPath: 'Id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbTx(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error || req?.error);
  });
}

export class MemoBamReadOnlyStorage {
  constructor() {
    this.db = null;
    this.dirHandle = null;
    this.folderName = null;
  }

  async init() {
    this.db = await openDb();
    const saved = await idbTx(this.db, 'settings', 'readonly', (s) => s.get('dirHandle'));
    if (saved?.value) {
      this.dirHandle = saved.value;
      this.folderName = saved.value.name;
      try {
        const perm = await this.dirHandle.queryPermission({ mode: 'read' });
        if (perm !== 'granted') {
          this.dirHandle = null;
        }
      } catch {
        this.dirHandle = null;
      }
    }
  }

  isFolderApiSupported() {
    return typeof window.showDirectoryPicker === 'function';
  }

  isFolderConnected() {
    return Boolean(this.dirHandle);
  }

  async hasSavedFolderHandle() {
    const saved = await idbTx(this.db, 'settings', 'readonly', (s) => s.get('dirHandle'));
    return Boolean(saved?.value);
  }

  async reconnectSavedFolder() {
    const saved = await idbTx(this.db, 'settings', 'readonly', (s) => s.get('dirHandle'));
    if (!saved?.value) return false;
    const perm = await saved.value.requestPermission({ mode: 'read' });
    if (perm === 'granted') {
      this.dirHandle = saved.value;
      this.folderName = saved.value.name;
      return true;
    }
    return false;
  }

  async connectFolderReadOnly() {
    if (!this.isFolderApiSupported()) {
      throw new Error('Connessione cartella non supportata su questo browser.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    this.dirHandle = handle;
    this.folderName = handle.name;
    await idbTx(this.db, 'settings', 'readwrite', (s) => s.put({ key: 'dirHandle', value: handle }));
    return handle.name;
  }

  async disconnectFolder() {
    this.dirHandle = null;
    this.folderName = null;
    await idbTx(this.db, 'settings', 'readwrite', (s) => s.delete('dirHandle'));
  }

  async _readJsonFile(dirHandle, fileName, fallback = []) {
    try {
      const fh = await dirHandle.getFileHandle(fileName);
      const file = await fh.getFile();
      const text = await file.text();
      return text.trim() ? JSON.parse(text) : fallback;
    } catch {
      return fallback;
    }
  }

  async getArchiveItems() {
    if (this.dirHandle) {
      const items = await this._readJsonFile(this.dirHandle, ARCHIVE_INDEX_FILE, []);
      return items.sort((a, b) => new Date(b.ArchivedAt) - new Date(a.ArchivedAt));
    }
    const items = await idbTx(this.db, 'archive', 'readonly', (s) => s.getAll());
    return (items || []).sort((a, b) => new Date(b.ArchivedAt) - new Date(a.ArchivedAt));
  }

  async getDiaryEntries() {
    if (this.dirHandle) {
      try {
        const diaryDir = await this.dirHandle.getDirectoryHandle(DIARY_DIR);
        const entries = await this._readJsonFile(diaryDir, DIARY_INDEX_FILE, []);
        return entries.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
      } catch {
        return [];
      }
    }
    const entries = await idbTx(this.db, 'diary', 'readonly', (s) => s.getAll());
    return (entries || []).sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
  }

  async importJsonText(jsonText, replaceExisting = true) {
    const data = JSON.parse(jsonText);
    let importedArchive = 0;
    let importedDiary = 0;

    if (Array.isArray(data)) {
      if (data.length > 0 && 'ArchivedAt' in data[0]) {
        if (replaceExisting) await idbTx(this.db, 'archive', 'readwrite', (s) => s.clear());
        for (const item of data) {
          await idbTx(this.db, 'archive', 'readwrite', (s) => s.put(item));
          importedArchive++;
        }
      } else if (data.length > 0 && 'Timestamp' in data[0]) {
        if (replaceExisting) await idbTx(this.db, 'diary', 'readwrite', (s) => s.clear());
        for (const entry of data) {
          await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(entry));
          importedDiary++;
        }
      }
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.archive)) {
        if (replaceExisting) await idbTx(this.db, 'archive', 'readwrite', (s) => s.clear());
        for (const item of data.archive) {
          await idbTx(this.db, 'archive', 'readwrite', (s) => s.put(item));
          importedArchive++;
        }
      }
      if (Array.isArray(data.diary)) {
        if (replaceExisting) await idbTx(this.db, 'diary', 'readwrite', (s) => s.clear());
        for (const entry of data.diary) {
          await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(entry));
          importedDiary++;
        }
      }
    }

    return { importedArchive, importedDiary };
  }

  async clearLocalCache() {
    await idbTx(this.db, 'archive', 'readwrite', (s) => s.clear());
    await idbTx(this.db, 'diary', 'readwrite', (s) => s.clear());
  }
}
