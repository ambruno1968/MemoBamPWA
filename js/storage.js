// Full Read-Write Storage Layer for MemoBam PWA
// 1. File System Access API in READ-WRITE mode (ChromeOS / Desktop Chrome / Edge)
//    Compatible with MemoBam Desktop folder structure:
//    - archivio_memobam.json + YYYY-MM/<file>
//    - Diario/diario_index.json + Diario/Allegati/YYYY-MM-DD/<file> + Diario/Diario_YYYY-MM-DD.md
// 2. IndexedDB local storage (offline-first on Mobile & all browsers, including stored file Blobs)
// 3. JSON Import & Export (archivio_memobam.json, diario_index.json, or combined backup)

const DB_NAME = 'memobam_pwa_db';
const DB_VERSION = 3;
const LEGACY_RO_DB_NAME = 'memobam_pwa_readonly_db';
const ARCHIVE_INDEX_FILE = 'archivio_memobam.json';
const DIARY_DIR = 'Diario';
const ATTACHMENTS_DIR = 'Allegati';
const DIARY_INDEX_FILE = 'diario_index.json';
const QUICK_NOTES_FILE = 'note_pronte.json';

function generateId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID().replaceAll('-', '');
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function toLocalIsoString(date = new Date()) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOff = Math.abs(offsetMin);
  const oh = pad(Math.floor(absOff / 60));
  const om = pad(absOff % 60);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}${sign}${oh}:${om}`;
}

function formatDateIt(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTimeIt(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatCompactStamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function splitFileName(fileName) {
  const idx = fileName.lastIndexOf('.');
  if (idx <= 0) return { base: fileName, ext: '' };
  return { base: fileName.slice(0, idx), ext: fileName.slice(idx) };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('archive')) db.createObjectStore('archive', { keyPath: 'Id' });
      if (!db.objectStoreNames.contains('diary')) db.createObjectStore('diary', { keyPath: 'Id' });
      if (!db.objectStoreNames.contains('quickNotes')) db.createObjectStore('quickNotes', { keyPath: 'Id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'path' });
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

async function migrateLegacyReadOnlyDb(targetDb) {
  try {
    const existingArc = await idbTx(targetDb, 'archive', 'readonly', (s) => s.getAll());
    const existingDia = await idbTx(targetDb, 'diary', 'readonly', (s) => s.getAll());
    if ((existingArc && existingArc.length > 0) || (existingDia && existingDia.length > 0)) return;

    const legacyReq = indexedDB.open(LEGACY_RO_DB_NAME, 1);
    await new Promise((resolve) => {
      legacyReq.onupgradeneeded = () => {
        // Legacy DB didn't exist; close and abort migration cleanly
        legacyReq.transaction.abort();
        resolve();
      };
      legacyReq.onsuccess = async () => {
        const legacyDb = legacyReq.result;
        try {
          if (legacyDb.objectStoreNames.contains('archive')) {
            const items = await idbTx(legacyDb, 'archive', 'readonly', (s) => s.getAll());
            for (const item of items || []) {
              await idbTx(targetDb, 'archive', 'readwrite', (s) => s.put(item));
            }
          }
          if (legacyDb.objectStoreNames.contains('diary')) {
            const entries = await idbTx(legacyDb, 'diary', 'readonly', (s) => s.getAll());
            for (const entry of entries || []) {
              await idbTx(targetDb, 'diary', 'readwrite', (s) => s.put(entry));
            }
          }
        } catch {
          // Ignore migration errors
        } finally {
          legacyDb.close();
          resolve();
        }
      };
      legacyReq.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

export class MemoBamStorage {
  constructor() {
    this.db = null;
    this.dirHandle = null;
    this.folderName = null;
    this.folderWritable = false;
  }

  async init() {
    this.db = await openDb();
    await migrateLegacyReadOnlyDb(this.db);

    const saved = await idbTx(this.db, 'settings', 'readonly', (s) => s.get('dirHandle'));
    if (saved?.value) {
      try {
        const rwPerm = await saved.value.queryPermission({ mode: 'readwrite' });
        if (rwPerm === 'granted') {
          this.dirHandle = saved.value;
          this.folderName = saved.value.name;
          this.folderWritable = true;
          return;
        }
        const roPerm = await saved.value.queryPermission({ mode: 'read' });
        if (roPerm === 'granted') {
          this.dirHandle = saved.value;
          this.folderName = saved.value.name;
          this.folderWritable = false;
        }
      } catch {
        this.dirHandle = null;
        this.folderWritable = false;
      }
    }
  }

  isFolderApiSupported() {
    return typeof window.showDirectoryPicker === 'function';
  }

  isFolderConnected() {
    return Boolean(this.dirHandle);
  }

  isReadOnlyFolder() {
    return Boolean(this.dirHandle) && !this.folderWritable;
  }

  async hasSavedFolderHandle() {
    const saved = await idbTx(this.db, 'settings', 'readonly', (s) => s.get('dirHandle'));
    return Boolean(saved?.value);
  }

  async reconnectSavedFolder() {
    const saved = await idbTx(this.db, 'settings', 'readonly', (s) => s.get('dirHandle'));
    if (!saved?.value) return false;
    try {
      const rwPerm = await saved.value.requestPermission({ mode: 'readwrite' });
      if (rwPerm === 'granted') {
        this.dirHandle = saved.value;
        this.folderName = saved.value.name;
        this.folderWritable = true;
        return true;
      }
    } catch {
      // Fallback to read-only check
    }
    const roPerm = await saved.value.requestPermission({ mode: 'read' });
    if (roPerm === 'granted') {
      this.dirHandle = saved.value;
      this.folderName = saved.value.name;
      this.folderWritable = false;
      return true;
    }
    return false;
  }

  async connectFolder() {
    if (!this.isFolderApiSupported()) {
      throw new Error('Connessione cartella non supportata su questo browser.');
    }
    let handle;
    let writable = true;
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      handle = await window.showDirectoryPicker({ mode: 'read' });
      writable = false;
    }
    this.dirHandle = handle;
    this.folderName = handle.name;
    this.folderWritable = writable;
    await idbTx(this.db, 'settings', 'readwrite', (s) => s.put({ key: 'dirHandle', value: handle }));
    return { name: handle.name, writable };
  }

  async disconnectFolder() {
    this.dirHandle = null;
    this.folderName = null;
    this.folderWritable = false;
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

  async _writeTextFile(dirHandle, fileName, text) {
    const fh = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fh.createWritable();
    await writable.write(text);
    await writable.close();
  }

  async _getOrCreateSubDir(rootHandle, segments) {
    let curr = rootHandle;
    for (const seg of segments) {
      if (!seg) continue;
      curr = await curr.getDirectoryHandle(seg, { create: true });
    }
    return curr;
  }

  async _getUniqueFileNameInDir(dirHandle, originalName, date) {
    const exists = async (name) => {
      try {
        await dirHandle.getFileHandle(name);
        return true;
      } catch {
        return false;
      }
    };
    if (!(await exists(originalName))) return originalName;

    const { base, ext } = splitFileName(originalName);
    const stamp = formatCompactStamp(date);
    let candidate = `${base}_${stamp}${ext}`;
    let counter = 1;
    while (await exists(candidate)) {
      candidate = `${base}_${stamp}_${counter}${ext}`;
      counter++;
    }
    return candidate;
  }

  async _getUniquePathInIdb(folderPrefix, originalName, date) {
    const exists = async (p) => Boolean(await idbTx(this.db, 'files', 'readonly', (s) => s.get(p)));
    const first = `${folderPrefix}\\${originalName}`;
    if (!(await exists(first))) return first;

    const { base, ext } = splitFileName(originalName);
    const stamp = formatCompactStamp(date);
    let candidate = `${folderPrefix}\\${base}_${stamp}${ext}`;
    let counter = 1;
    while (await exists(candidate)) {
      candidate = `${folderPrefix}\\${base}_${stamp}_${counter}${ext}`;
      counter++;
    }
    return candidate;
  }

  async _deleteFileByRelativePath(baseDirHandle, relPath) {
    if (!relPath) return;
    const parts = relPath.split(/[\\/]+/).filter(Boolean);
    if (parts.length === 0) return;
    const fileName = parts.pop();
    let curr = baseDirHandle;
    for (const seg of parts) {
      curr = await curr.getDirectoryHandle(seg);
    }
    await curr.removeEntry(fileName, { recursive: true });
  }

  // ===== ARCHIVE CRUD =====

  async getArchiveItems() {
    if (this.dirHandle) {
      const items = await this._readJsonFile(this.dirHandle, ARCHIVE_INDEX_FILE, []);
      return items.sort((a, b) => new Date(b.ArchivedAt) - new Date(a.ArchivedAt));
    }
    const items = await idbTx(this.db, 'archive', 'readonly', (s) => s.getAll());
    return (items || []).sort((a, b) => new Date(b.ArchivedAt) - new Date(a.ArchivedAt));
  }

  async _saveArchiveList(items) {
    if (this.dirHandle) {
      if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
      await this._writeTextFile(this.dirHandle, ARCHIVE_INDEX_FILE, JSON.stringify(items, null, 2));
    }
  }

  async addArchiveFiles(files, customTitle = '', notes = '') {
    const validFiles = Array.from(files || []).filter(Boolean);
    if (validFiles.length === 0) return [];

    const existingItems = await this.getArchiveItems();
    const added = [];

    for (const file of validFiles) {
      const now = new Date();
      const monthFolder = formatMonthKey(now);
      const originalName = file.name;
      let storedRelativePath = '';

      if (this.dirHandle) {
        if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
        const targetDir = await this._getOrCreateSubDir(this.dirHandle, [monthFolder]);
        const uniqueName = await this._getUniqueFileNameInDir(targetDir, originalName, now);
        const fh = await targetDir.getFileHandle(uniqueName, { create: true });
        const writable = await fh.createWritable();
        await writable.write(file);
        await writable.close();
        storedRelativePath = `${monthFolder}\\${uniqueName}`;
      } else {
        storedRelativePath = await this._getUniquePathInIdb(monthFolder, originalName, now);
        await idbTx(this.db, 'files', 'readwrite', (s) =>
          s.put({
            path: storedRelativePath,
            blob: file,
            name: originalName,
            type: file.type || 'application/octet-stream',
            size: file.size
          })
        );
      }

      const { base } = splitFileName(originalName);
      const title = validFiles.length === 1 && customTitle.trim()
        ? customTitle.trim()
        : (base || originalName);

      const item = {
        Id: generateId(),
        Title: title,
        OriginalFileName: originalName,
        StoredRelativePath: storedRelativePath,
        ArchivedAt: toLocalIsoString(now),
        Notes: (notes || '').trim(),
        FileSizeBytes: file.size || 0,
        IsDirectory: false,
        IsDone: true
      };

      existingItems.push(item);
      if (!this.dirHandle) {
        await idbTx(this.db, 'archive', 'readwrite', (s) => s.put(item));
      }
      added.push(item);
    }

    if (this.dirHandle && added.length > 0) {
      await this._saveArchiveList(existingItems);
    }

    return added;
  }

  async updateArchiveItem(updated) {
    if (this.dirHandle) {
      const items = await this.getArchiveItems();
      const target = items.find((i) => i.Id === updated.Id);
      if (!target) return;
      target.Title = (updated.Title || '').trim();
      target.Notes = (updated.Notes || '').trim();
      target.IsDone = Boolean(updated.IsDone);
      await this._saveArchiveList(items);
    } else {
      const target = await idbTx(this.db, 'archive', 'readonly', (s) => s.get(updated.Id));
      if (!target) return;
      target.Title = (updated.Title || '').trim();
      target.Notes = (updated.Notes || '').trim();
      target.IsDone = Boolean(updated.IsDone);
      await idbTx(this.db, 'archive', 'readwrite', (s) => s.put(target));
    }
  }

  async setArchiveDone(id, isDone) {
    if (this.dirHandle) {
      const items = await this.getArchiveItems();
      const target = items.find((i) => i.Id === id);
      if (!target) return;
      target.IsDone = Boolean(isDone);
      await this._saveArchiveList(items);
    } else {
      const target = await idbTx(this.db, 'archive', 'readonly', (s) => s.get(id));
      if (!target) return;
      target.IsDone = Boolean(isDone);
      await idbTx(this.db, 'archive', 'readwrite', (s) => s.put(target));
    }
  }

  async deleteArchiveItem(item) {
    if (this.dirHandle) {
      if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
      try {
        await this._deleteFileByRelativePath(this.dirHandle, item.StoredRelativePath);
      } catch {
        // File might already be missing on disk
      }
      const items = (await this.getArchiveItems()).filter((i) => i.Id !== item.Id);
      await this._saveArchiveList(items);
    } else {
      if (item.StoredRelativePath) {
        await idbTx(this.db, 'files', 'readwrite', (s) => s.delete(item.StoredRelativePath));
      }
      await idbTx(this.db, 'archive', 'readwrite', (s) => s.delete(item.Id));
    }
  }

  // ===== DIARY CRUD =====

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

  async _saveDiaryListAndMarkdown(entries, affectedDate) {
    if (!this.dirHandle) return;
    if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
    const diaryDir = await this._getOrCreateSubDir(this.dirHandle, [DIARY_DIR]);
    await this._writeTextFile(diaryDir, DIARY_INDEX_FILE, JSON.stringify(entries, null, 2));

    if (affectedDate) {
      await this._syncDailyMarkdownFile(diaryDir, entries, affectedDate);
    }
  }

  async _syncDailyMarkdownFile(diaryDir, entries, dateObj) {
    const dateKey = formatDateKey(dateObj);
    const mdFileName = `Diario_${dateKey}.md`;

    const dayEntries = entries
      .filter((e) => (e.Timestamp || '').slice(0, 10) === dateKey)
      .sort((a, b) => new Date(a.Timestamp) - new Date(b.Timestamp));

    if (dayEntries.length === 0) {
      try {
        await diaryDir.removeEntry(mdFileName);
      } catch {
        // File didn't exist
      }
      return;
    }

    const lines = [`# Diario del ${formatDateIt(dateObj)}`, ''];
    for (const entry of dayEntries) {
      const check = entry.IsDone ? '[x]' : '[ ]';
      const d = new Date(entry.Timestamp);
      const timeStr = Number.isNaN(d.getTime()) ? (entry.Timestamp || '').slice(11, 19) : formatTimeIt(d);
      lines.push(`- ${check} **[${timeStr}]** ${entry.Text}`);
      for (const att of entry.Attachments || []) {
        lines.push(`  - Allegato: \`${att.FileName}\` (${att.StoredRelativePath})`);
      }
    }

    await this._writeTextFile(diaryDir, mdFileName, lines.join('\n') + '\n');
  }

  async addDiaryEntry(text, targetDateStr = null, richContentHtml = null) {
    const now = new Date();
    let stamp = now;
    if (targetDateStr) {
      const [y, m, d] = targetDateStr.split('-').map(Number);
      if (y && m && d) {
        const todayKey = formatDateKey(now);
        if (targetDateStr !== todayKey) {
          stamp = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        }
      }
    }

    const entry = {
      Id: generateId(),
      Timestamp: toLocalIsoString(stamp),
      Text: (text || '').trim(),
      RichContentXaml: null,
      RichContentHtml: richContentHtml || null,
      IsDone: true,
      Attachments: []
    };

    if (this.dirHandle) {
      const entries = await this.getDiaryEntries();
      entries.push(entry);
      await this._saveDiaryListAndMarkdown(entries, stamp);
    } else {
      await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(entry));
    }

    return entry;
  }

  async updateDiaryEntry(updated) {
    if (this.dirHandle) {
      const entries = await this.getDiaryEntries();
      const target = entries.find((e) => e.Id === updated.Id);
      if (!target) return;
      target.Text = (updated.Text || '').trim();
      if ('RichContentHtml' in updated) target.RichContentHtml = updated.RichContentHtml;
      target.IsDone = Boolean(updated.IsDone);
      await this._saveDiaryListAndMarkdown(entries, new Date(target.Timestamp));
    } else {
      const target = await idbTx(this.db, 'diary', 'readonly', (s) => s.get(updated.Id));
      if (!target) return;
      target.Text = (updated.Text || '').trim();
      if ('RichContentHtml' in updated) target.RichContentHtml = updated.RichContentHtml;
      target.IsDone = Boolean(updated.IsDone);
      await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(target));
    }
  }

  async setDiaryDone(id, isDone) {
    if (this.dirHandle) {
      const entries = await this.getDiaryEntries();
      const target = entries.find((e) => e.Id === id);
      if (!target) return;
      target.IsDone = Boolean(isDone);
      await this._saveDiaryListAndMarkdown(entries, new Date(target.Timestamp));
    } else {
      const target = await idbTx(this.db, 'diary', 'readonly', (s) => s.get(id));
      if (!target) return;
      target.IsDone = Boolean(isDone);
      await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(target));
    }
  }

  async addDiaryAttachments(entryId, files) {
    const validFiles = Array.from(files || []).filter(Boolean);
    if (validFiles.length === 0) return [];

    const entries = await this.getDiaryEntries();
    const target = entries.find((e) => e.Id === entryId);
    if (!target) return [];

    const entryDate = new Date(target.Timestamp);
    const dayKey = formatDateKey(entryDate);
    const added = [];

    for (const file of validFiles) {
      const now = new Date();
      const originalName = file.name;
      let storedRelativePath = '';

      if (this.dirHandle) {
        if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
        const attDir = await this._getOrCreateSubDir(this.dirHandle, [DIARY_DIR, ATTACHMENTS_DIR, dayKey]);
        const uniqueName = await this._getUniqueFileNameInDir(attDir, originalName, now);
        const fh = await attDir.getFileHandle(uniqueName, { create: true });
        const writable = await fh.createWritable();
        await writable.write(file);
        await writable.close();
        storedRelativePath = `${ATTACHMENTS_DIR}\\${dayKey}\\${uniqueName}`;
      } else {
        const prefix = `${DIARY_DIR}\\${ATTACHMENTS_DIR}\\${dayKey}`;
        storedRelativePath = await this._getUniquePathInIdb(prefix, originalName, now);
        await idbTx(this.db, 'files', 'readwrite', (s) =>
          s.put({
            path: storedRelativePath,
            blob: file,
            name: originalName,
            type: file.type || 'application/octet-stream',
            size: file.size
          })
        );
      }

      const attachment = {
        Id: generateId(),
        FileName: originalName,
        StoredRelativePath: storedRelativePath,
        AddedAt: toLocalIsoString(now),
        IsDirectory: false
      };

      target.Attachments = target.Attachments || [];
      target.Attachments.push(attachment);
      added.push(attachment);
    }

    if (this.dirHandle) {
      await this._saveDiaryListAndMarkdown(entries, entryDate);
    } else {
      await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(target));
    }

    return added;
  }

  async removeDiaryAttachment(entryId, attachmentId) {
    const entries = await this.getDiaryEntries();
    const target = entries.find((e) => e.Id === entryId);
    if (!target) return;

    const att = (target.Attachments || []).find((a) => a.Id === attachmentId);
    if (!att) return;

    if (this.dirHandle) {
      if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
      try {
        const diaryDir = await this.dirHandle.getDirectoryHandle(DIARY_DIR);
        await this._deleteFileByRelativePath(diaryDir, att.StoredRelativePath);
      } catch {
        // Ignore if already removed
      }
      target.Attachments = target.Attachments.filter((a) => a.Id !== attachmentId);
      await this._saveDiaryListAndMarkdown(entries, new Date(target.Timestamp));
    } else {
      const idbKey = att.StoredRelativePath?.startsWith(`${DIARY_DIR}\\`)
        ? att.StoredRelativePath
        : `${DIARY_DIR}\\${att.StoredRelativePath}`;
      await idbTx(this.db, 'files', 'readwrite', (s) => s.delete(idbKey));
      target.Attachments = target.Attachments.filter((a) => a.Id !== attachmentId);
      await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(target));
    }
  }

  async deleteDiaryEntry(entryId) {
    const entries = await this.getDiaryEntries();
    const target = entries.find((e) => e.Id === entryId);
    if (!target) return;

    const entryDate = new Date(target.Timestamp);

    if (this.dirHandle) {
      if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
      try {
        const diaryDir = await this.dirHandle.getDirectoryHandle(DIARY_DIR);
        for (const att of target.Attachments || []) {
          try {
            await this._deleteFileByRelativePath(diaryDir, att.StoredRelativePath);
          } catch {
            // Ignore missing attachment
          }
        }
      } catch {
        // Ignore
      }
      const remaining = entries.filter((e) => e.Id !== entryId);
      await this._saveDiaryListAndMarkdown(remaining, entryDate);
    } else {
      for (const att of target.Attachments || []) {
        const idbKey = att.StoredRelativePath?.startsWith(`${DIARY_DIR}\\`)
          ? att.StoredRelativePath
          : `${DIARY_DIR}\\${att.StoredRelativePath}`;
        await idbTx(this.db, 'files', 'readwrite', (s) => s.delete(idbKey));
      }
      await idbTx(this.db, 'diary', 'readwrite', (s) => s.delete(entryId));
    }
  }

  // ===== QUICK NOTES ("Note Pronte") =====

  async getQuickNotes() {
    if (this.dirHandle) {
      try {
        const diaryDir = await this.dirHandle.getDirectoryHandle(DIARY_DIR, { create: this.folderWritable });
        const notes = await this._readJsonFile(diaryDir, QUICK_NOTES_FILE, null);
        if (Array.isArray(notes)) {
          return notes.sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt));
        }
        if (this.folderWritable) {
          const seeded = [{ Id: generateId(), Text: 'Listino cavi aggiornato', CreatedAt: toLocalIsoString(new Date()) }];
          await this._writeTextFile(diaryDir, QUICK_NOTES_FILE, JSON.stringify(seeded, null, 2));
          return seeded;
        }
        return [];
      } catch {
        return [];
      }
    }

    const seededFlag = await idbTx(this.db, 'settings', 'readonly', (s) => s.get('quickNotesSeeded'));
    const notes = await idbTx(this.db, 'quickNotes', 'readonly', (s) => s.getAll());
    if ((!notes || notes.length === 0) && !seededFlag?.value) {
      const seed = { Id: generateId(), Text: 'Listino cavi aggiornato', CreatedAt: toLocalIsoString(new Date()) };
      await idbTx(this.db, 'quickNotes', 'readwrite', (s) => s.put(seed));
      await idbTx(this.db, 'settings', 'readwrite', (s) => s.put({ key: 'quickNotesSeeded', value: true }));
      return [seed];
    }
    return (notes || []).sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt));
  }

  async addQuickNote(text) {
    const note = {
      Id: generateId(),
      Text: (text || '').trim(),
      CreatedAt: toLocalIsoString(new Date())
    };
    if (this.dirHandle) {
      if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
      const diaryDir = await this._getOrCreateSubDir(this.dirHandle, [DIARY_DIR]);
      const notes = await this.getQuickNotes();
      notes.push(note);
      await this._writeTextFile(diaryDir, QUICK_NOTES_FILE, JSON.stringify(notes, null, 2));
    } else {
      await idbTx(this.db, 'quickNotes', 'readwrite', (s) => s.put(note));
      await idbTx(this.db, 'settings', 'readwrite', (s) => s.put({ key: 'quickNotesSeeded', value: true }));
    }
    return note;
  }

  async updateQuickNote(id, text) {
    if (this.dirHandle) {
      if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
      const diaryDir = await this._getOrCreateSubDir(this.dirHandle, [DIARY_DIR]);
      const notes = await this.getQuickNotes();
      const target = notes.find((n) => n.Id === id);
      if (!target) return;
      target.Text = (text || '').trim();
      await this._writeTextFile(diaryDir, QUICK_NOTES_FILE, JSON.stringify(notes, null, 2));
    } else {
      const target = await idbTx(this.db, 'quickNotes', 'readonly', (s) => s.get(id));
      if (!target) return;
      target.Text = (text || '').trim();
      await idbTx(this.db, 'quickNotes', 'readwrite', (s) => s.put(target));
    }
  }

  async deleteQuickNote(id) {
    if (this.dirHandle) {
      if (!this.folderWritable) throw new Error('Cartella collegata in sola lettura.');
      const diaryDir = await this._getOrCreateSubDir(this.dirHandle, [DIARY_DIR]);
      const notes = (await this.getQuickNotes()).filter((n) => n.Id !== id);
      await this._writeTextFile(diaryDir, QUICK_NOTES_FILE, JSON.stringify(notes, null, 2));
    } else {
      await idbTx(this.db, 'quickNotes', 'readwrite', (s) => s.delete(id));
    }
  }

  // ===== OPEN / RETRIEVE PHYSICAL FILE =====

  async getStoredFileBlob(storedRelativePath, isDiaryAttachment = false) {
    if (!storedRelativePath) return null;

    if (this.dirHandle) {
      try {
        let base = this.dirHandle;
        if (isDiaryAttachment) {
          base = await this.dirHandle.getDirectoryHandle(DIARY_DIR);
        }
        const parts = storedRelativePath.split(/[\\/]+/).filter(Boolean);
        const fileName = parts.pop();
        let curr = base;
        for (const seg of parts) {
          curr = await curr.getDirectoryHandle(seg);
        }
        const fh = await curr.getFileHandle(fileName);
        return await fh.getFile();
      } catch {
        return null;
      }
    }

    const candidates = [storedRelativePath];
    if (isDiaryAttachment && !storedRelativePath.startsWith(`${DIARY_DIR}\\`)) {
      candidates.unshift(`${DIARY_DIR}\\${storedRelativePath}`);
    }
    for (const key of candidates) {
      const rec = await idbTx(this.db, 'files', 'readonly', (s) => s.get(key));
      if (rec?.blob) return rec.blob;
    }
    return null;
  }

  // ===== IMPORT / EXPORT =====

  async importJsonText(jsonText, replaceExisting = true) {
    const data = JSON.parse(jsonText);
    let importedArchive = 0;
    let importedDiary = 0;

    if (Array.isArray(data)) {
      if (data.length > 0 && 'ArchivedAt' in data[0]) {
        if (this.dirHandle) {
          const base = replaceExisting ? [] : await this.getArchiveItems();
          const map = new Map(base.map((i) => [i.Id, i]));
          for (const item of data) {
            map.set(item.Id, item);
            importedArchive++;
          }
          await this._saveArchiveList(Array.from(map.values()));
        } else {
          if (replaceExisting) await idbTx(this.db, 'archive', 'readwrite', (s) => s.clear());
          for (const item of data) {
            await idbTx(this.db, 'archive', 'readwrite', (s) => s.put(item));
            importedArchive++;
          }
        }
      } else if (data.length > 0 && 'Timestamp' in data[0]) {
        if (this.dirHandle) {
          const base = replaceExisting ? [] : await this.getDiaryEntries();
          const map = new Map(base.map((e) => [e.Id, e]));
          for (const entry of data) {
            map.set(entry.Id, entry);
            importedDiary++;
          }
          const diaryDir = await this._getOrCreateSubDir(this.dirHandle, [DIARY_DIR]);
          await this._writeTextFile(diaryDir, DIARY_INDEX_FILE, JSON.stringify(Array.from(map.values()), null, 2));
        } else {
          if (replaceExisting) await idbTx(this.db, 'diary', 'readwrite', (s) => s.clear());
          for (const entry of data) {
            await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(entry));
            importedDiary++;
          }
        }
      }
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.archive)) {
        if (this.dirHandle) {
          const base = replaceExisting ? [] : await this.getArchiveItems();
          const map = new Map(base.map((i) => [i.Id, i]));
          for (const item of data.archive) {
            map.set(item.Id, item);
            importedArchive++;
          }
          await this._saveArchiveList(Array.from(map.values()));
        } else {
          if (replaceExisting) await idbTx(this.db, 'archive', 'readwrite', (s) => s.clear());
          for (const item of data.archive) {
            await idbTx(this.db, 'archive', 'readwrite', (s) => s.put(item));
            importedArchive++;
          }
        }
      }
      if (Array.isArray(data.diary)) {
        if (this.dirHandle) {
          const base = replaceExisting ? [] : await this.getDiaryEntries();
          const map = new Map(base.map((e) => [e.Id, e]));
          for (const entry of data.diary) {
            map.set(entry.Id, entry);
            importedDiary++;
          }
          const diaryDir = await this._getOrCreateSubDir(this.dirHandle, [DIARY_DIR]);
          await this._writeTextFile(diaryDir, DIARY_INDEX_FILE, JSON.stringify(Array.from(map.values()), null, 2));
        } else {
          if (replaceExisting) await idbTx(this.db, 'diary', 'readwrite', (s) => s.clear());
          for (const entry of data.diary) {
            await idbTx(this.db, 'diary', 'readwrite', (s) => s.put(entry));
            importedDiary++;
          }
        }
      }
    }

    return { importedArchive, importedDiary };
  }

  async clearLocalCache() {
    await idbTx(this.db, 'archive', 'readwrite', (s) => s.clear());
    await idbTx(this.db, 'diary', 'readwrite', (s) => s.clear());
    await idbTx(this.db, 'files', 'readwrite', (s) => s.clear());
  }
}
