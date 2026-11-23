import { MemoBamStorage } from './storage.js';

const LIGHT_PASTEL = [
  { bg: '#EEF2FF', border: '#C7D2FE' },
  { bg: '#ECFDF5', border: '#A7F3D0' },
  { bg: '#F5F3FF', border: '#DDD6FE' },
  { bg: '#FFF1F2', border: '#FECDD3' },
  { bg: '#F0F9FF', border: '#BAE6FD' }
];

const DARK_PASTEL = [
  { bg: '#1E1B4B', border: '#3730A3' },
  { bg: '#064E3B', border: '#047857' },
  { bg: '#2E1065', border: '#6D28D9' },
  { bg: '#4C0519', border: '#BE123C' },
  { bg: '#0C4A6E', border: '#0369A1' }
];

const storage = new MemoBamStorage();

function getTodayDateStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const state = {
  archive: [],
  diary: [],
  activeSection: 'archive',
  search: '',
  dateFilter: '',
  excludeDiaryAttachments: localStorage.getItem('memobam_exclude_diary_att') !== 'false',
  diaryDateFilter: getTodayDateStr(),
  diarySearch: '',
  pendingExpanded: false,
  draftAttachments: [], // File[]
  editingArchiveId: null,
  detailDiaryId: null,
  pendingAttachEntryId: null,
  deferredInstallPrompt: null
};

const els = {
  storageBadge: document.getElementById('storageBadge'),
  totalCountBadge: document.getElementById('totalCountBadge'),
  connectFolderBtn: document.getElementById('connectFolderBtn'),
  connectFolderLabel: document.getElementById('connectFolderLabel'),
  installBtn: document.getElementById('installBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  settingsOpenBtn: document.getElementById('settingsOpenBtn'),

  pendingBanner: document.getElementById('pendingBanner'),
  pendingSummaryText: document.getElementById('pendingSummaryText'),
  pendingToggleBtn: document.getElementById('pendingToggleBtn'),
  pendingToggleLabel: document.getElementById('pendingToggleLabel'),
  pendingList: document.getElementById('pendingList'),
  navPendingBadge: document.getElementById('navPendingBadge'),

  dropPane: document.getElementById('dropPane'),
  customTitleInput: document.getElementById('customTitleInput'),
  customNotesInput: document.getElementById('customNotesInput'),
  dropZone: document.getElementById('dropZone'),
  dropZoneTitle: document.getElementById('dropZoneTitle'),
  browseFilesBtn: document.getElementById('browseFilesBtn'),
  fileInput: document.getElementById('fileInput'),
  fixedPathText: document.getElementById('fixedPathText'),
  changePathBtn: document.getElementById('changePathBtn'),
  statusBanner: document.getElementById('statusBanner'),

  archiveTabBtn: document.getElementById('archiveTabBtn'),
  diaryTabBtn: document.getElementById('diaryTabBtn'),
  diaryTodayCount: document.getElementById('diaryTodayCount'),
  archiveTabContent: document.getElementById('archiveTabContent'),
  diaryTabContent: document.getElementById('diaryTabContent'),
  settingsPane: document.getElementById('settingsPane'),

  searchInput: document.getElementById('searchInput'),
  dateFilterInput: document.getElementById('dateFilterInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  excludeDiaryAttachmentsChk: document.getElementById('excludeDiaryAttachmentsChk'),
  archiveSummaryText: document.getElementById('archiveSummaryText'),
  archiveList: document.getElementById('archiveList'),

  diaryDateInput: document.getElementById('diaryDateInput'),
  diaryTodayBtn: document.getElementById('diaryTodayBtn'),
  diaryAllDaysBtn: document.getElementById('diaryAllDaysBtn'),
  diarySearchInput: document.getElementById('diarySearchInput'),
  fmtBoldBtn: document.getElementById('fmtBoldBtn'),
  fmtItalicBtn: document.getElementById('fmtItalicBtn'),
  fmtBulletBtn: document.getElementById('fmtBulletBtn'),
  fmtCheckBtn: document.getElementById('fmtCheckBtn'),
  draftAttachBtn: document.getElementById('draftAttachBtn'),
  draftAttachInput: document.getElementById('draftAttachInput'),
  diaryEditor: document.getElementById('diaryEditor'),
  saveDiaryBtn: document.getElementById('saveDiaryBtn'),
  draftAttachmentsPanel: document.getElementById('draftAttachmentsPanel'),
  draftAttachmentsList: document.getElementById('draftAttachmentsList'),
  diarySummaryText: document.getElementById('diarySummaryText'),
  diaryList: document.getElementById('diaryList'),

  editItemModal: document.getElementById('editItemModal'),
  closeEditItemModalBtn: document.getElementById('closeEditItemModalBtn'),
  editItemTitleInput: document.getElementById('editItemTitleInput'),
  editItemNotesInput: document.getElementById('editItemNotesInput'),
  cancelEditItemBtn: document.getElementById('cancelEditItemBtn'),
  saveEditItemBtn: document.getElementById('saveEditItemBtn'),

  diaryDetailModal: document.getElementById('diaryDetailModal'),
  closeDiaryDetailModalBtn: document.getElementById('closeDiaryDetailModalBtn'),
  detailTimestampText: document.getElementById('detailTimestampText'),
  detailDoneChk: document.getElementById('detailDoneChk'),
  detailBoldBtn: document.getElementById('detailBoldBtn'),
  detailItalicBtn: document.getElementById('detailItalicBtn'),
  detailBulletBtn: document.getElementById('detailBulletBtn'),
  detailCheckBtn: document.getElementById('detailCheckBtn'),
  detailAttachBtn: document.getElementById('detailAttachBtn'),
  detailAttachInput: document.getElementById('detailAttachInput'),
  detailEditor: document.getElementById('detailEditor'),
  detailAttachmentsSection: document.getElementById('detailAttachmentsSection'),
  detailAttachmentsList: document.getElementById('detailAttachmentsList'),
  cancelDiaryDetailBtn: document.getElementById('cancelDiaryDetailBtn'),
  saveDiaryDetailBtn: document.getElementById('saveDiaryDetailBtn'),

  settingsModal: document.getElementById('settingsModal'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
  settingsContentModal: document.getElementById('settingsContentModal'),
  settingsContentMobile: document.getElementById('settingsContentMobile'),

  entryAttachInput: document.getElementById('entryAttachInput'),
  toast: document.getElementById('toast')
};

// ===== HELPERS =====

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2800);
}

function showStatus(msg, isError = false) {
  els.statusBanner.textContent = msg;
  els.statusBanner.classList.toggle('error', isError);
  els.statusBanner.classList.remove('hidden');
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatDateIt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateInputToIt(yyyyMmDd) {
  if (!yyyyMmDd) return '';
  const [y, m, d] = yyyyMmDd.split('-');
  return `${d}/${m}/${y}`;
}

function formatTimeIt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 19);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatShortTimeIt(iso) {
  return formatTimeIt(iso).slice(0, 5);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return i === 0 ? `${Math.round(val)} ${units[i]}` : `${val.toFixed(1)} ${units[i]}`;
}

function getFileBadge(fileName, isDir = false) {
  if (isDir) return 'DIR';
  const idx = (fileName || '').lastIndexOf('.');
  if (idx < 0) return 'FILE';
  const ext = fileName.slice(idx + 1).toUpperCase();
  return ext.length > 5 ? ext.slice(0, 5) : (ext || 'FILE');
}

// ===== RICH EDITOR HELPERS =====

function execEditorCmd(editor, cmd) {
  editor.focus();
  document.execCommand(cmd, false, null);
}

function insertSecondaryCheckBox(editor) {
  editor.focus();
  const sel = window.getSelection();
  let lineText = '';
  if (sel && sel.rangeCount > 0) {
    let node = sel.anchorNode;
    while (node && node !== editor && node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }
    if (node && node !== editor) {
      lineText = node.textContent || '';
    } else {
      lineText = editor.textContent || '';
    }
  }
  // Prevent repeating secondary checkbox on the same line (matching DiaryRichTextHelper)
  if (lineText.includes('[ ]') || lineText.includes('[x]')) {
    return;
  }
  document.execCommand('insertText', false, '[ ] ');
}

function extractEditorPlainText(editor) {
  const clone = editor.cloneNode(true);
  clone.querySelectorAll('li').forEach((li) => {
    li.prepend(document.createTextNode('• '));
  });
  return (clone.innerText || clone.textContent || '').trim();
}

function renderDiaryBodyHtml(entry) {
  if (entry.RichContentHtml) {
    return entry.RichContentHtml;
  }
  const escaped = escapeHtml(entry.Text || '');
  return escaped.replace(/\[( |x)\]/g, (_, ch) => {
    const checked = ch === 'x' ? 'checked' : '';
    return `<input type="checkbox" class="diary-inline-check" data-entry-id="${entry.Id}" ${checked}>`;
  });
}

// ===== THEME =====

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('memobam_theme', theme);
  els.themeToggleBtn.textContent = theme === 'dark' ? '☀️ Chiaro' : '🌙 Scuro';
  renderDiary();
}

function initTheme() {
  const saved = localStorage.getItem('memobam_theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

// ===== DATA LOADING & STORAGE STATUS =====

async function reloadData() {
  const [archive, diary] = await Promise.all([
    storage.getArchiveItems(),
    storage.getDiaryEntries()
  ]);
  state.archive = archive;
  state.diary = diary;
  updateStorageBadge();
  renderAll();
}

function updateStorageBadge() {
  if (storage.isFolderConnected()) {
    const modeLabel = storage.isReadOnlyFolder() ? 'Sola lettura' : 'Lettura/Scrittura';
    els.storageBadge.textContent = `📁 ${storage.folderName} (${modeLabel})`;
    els.storageBadge.classList.add('folder-active');
    els.connectFolderLabel.textContent = storage.folderName;
    els.fixedPathText.textContent = `Percorso: 📁 ${storage.folderName}`;
    els.fixedPathText.title = `${storage.folderName} (${modeLabel})`;
  } else {
    els.storageBadge.textContent = 'Cache Locale (Offline)';
    els.storageBadge.classList.remove('folder-active');
    els.connectFolderLabel.textContent = 'Cartella';
    els.fixedPathText.textContent = 'Percorso: Cache Locale (Offline)';
    els.fixedPathText.title = 'Dati salvati localmente in IndexedDB';
  }
}

// ===== FILTERING & RENDERING =====

function getUnifiedArchive() {
  const items = state.archive.map((item) => ({
    ...item,
    _isDiaryAttachment: false,
    _diarySourceLabel: '',
    _linkedEntry: null,
    _linkedAttachment: null
  }));

  if (!state.excludeDiaryAttachments) {
    for (const entry of state.diary) {
      for (const att of entry.Attachments || []) {
        items.push({
          Id: `att_${att.Id}`,
          Title: att.FileName,
          OriginalFileName: att.FileName,
          StoredRelativePath: att.StoredRelativePath,
          ArchivedAt: att.AddedAt || entry.Timestamp,
          Notes: '',
          FileSizeBytes: 0,
          IsDirectory: Boolean(att.IsDirectory),
          IsDone: entry.IsDone,
          _isDiaryAttachment: true,
          _diarySourceLabel: `Allegato Diario (${formatDateIt(entry.Timestamp)} ${formatShortTimeIt(entry.Timestamp)}): ${entry.Text}`,
          _linkedEntry: entry,
          _linkedAttachment: att
        });
      }
    }
  }

  return items.sort((a, b) => new Date(b.ArchivedAt) - new Date(a.ArchivedAt));
}

function matchesTerms(textFields, isoDate, query) {
  if (!query) return true;
  const terms = query.split(/\s+/).filter(Boolean);
  const dateIt = formatDateIt(isoDate).toLowerCase();
  const dateIso = (isoDate || '').slice(0, 10).toLowerCase();
  const timeIt = formatTimeIt(isoDate).toLowerCase();
  const haystack = [...textFields, dateIt, dateIso, timeIt].map((v) => String(v || '').toLowerCase());

  return terms.every((term) => {
    const t = term.toLowerCase();
    return haystack.some((field) => field.includes(t));
  });
}

function renderAll() {
  renderPending();
  renderArchive();
  renderDiary();
}

function renderPending() {
  const pendingArchive = state.archive.filter((i) => !i.IsDone);
  const pendingDiary = state.diary.filter((e) => !e.IsDone);
  const total = pendingArchive.length + pendingDiary.length;

  els.navPendingBadge.textContent = total;
  els.navPendingBadge.classList.toggle('hidden', total === 0);
  els.pendingBanner.classList.toggle('hidden', total === 0);

  if (total === 0) {
    state.pendingExpanded = false;
    els.pendingList.classList.add('collapsed');
    els.pendingList.innerHTML = '';
    return;
  }

  els.pendingSummaryText.textContent = total === 1
    ? '⚠️ Hai 1 elemento non spuntato da terminare'
    : `⚠️ Hai ${total} elementi non spuntati da terminare`;

  els.pendingToggleLabel.textContent = state.pendingExpanded ? 'Nascondi elenco ▴' : 'Visualizza elenco ▾';
  els.pendingList.classList.toggle('collapsed', !state.pendingExpanded);

  const rows = [
    ...pendingArchive.map((i) => ({
      type: 'archive',
      id: i.Id,
      badge: '📁 Archivio',
      summary: i.Title || i.OriginalFileName,
      stamp: `${formatDateIt(i.ArchivedAt)} ${formatTimeIt(i.ArchivedAt)}`
    })),
    ...pendingDiary.map((e) => ({
      type: 'diary',
      id: e.Id,
      badge: '📓 Diario',
      summary: e.Text,
      stamp: `${formatDateIt(e.Timestamp)} ${formatTimeIt(e.Timestamp)}`
    }))
  ];

  els.pendingList.innerHTML = rows
    .map(
      (r) => `
      <div class="pending-row">
        <div class="pending-row-left">
          <span class="pending-source-badge">${r.badge}</span>
          <div class="pending-row-info">
            <div class="pending-row-title">${escapeHtml(r.summary)}</div>
            <div class="pending-row-date">${r.stamp}</div>
          </div>
        </div>
        <div class="pending-row-actions">
          <button class="btn btn-xs btn-primary js-pending-open" data-type="${r.type}" data-id="${r.id}" type="button">Apri</button>
          <button class="btn btn-xs btn-success js-pending-done" data-type="${r.type}" data-id="${r.id}" type="button">✓ Fatto</button>
        </div>
      </div>`
    )
    .join('');
}

function renderArchive() {
  const all = getUnifiedArchive().filter((i) => {
    if (state.dateFilter && (i.ArchivedAt || '').slice(0, 10) !== state.dateFilter) return false;
    return matchesTerms([i.Title, i.OriginalFileName, i.Notes, i._diarySourceLabel], i.ArchivedAt, state.search);
  });

  const totalCount = state.archive.length;
  els.totalCountBadge.textContent = totalCount === 1 ? '1 scheda' : `${totalCount} schede`;
  els.archiveSummaryText.textContent = all.length === 1 ? '1 scheda trovata' : `${all.length} schede trovate`;

  if (all.length === 0) {
    els.archiveList.innerHTML = `<div class="empty-state">Nessuna scheda trovata.<br>Trascina un documento nella zona di archiviazione per creare la prima scheda.</div>`;
    return;
  }

  els.archiveList.innerHTML = all
    .map((item) => {
      const badge = getFileBadge(item.OriginalFileName, item.IsDirectory);
      const pendingClass = item.IsDone ? '' : 'pending-highlight';
      const sizeText = item._isDiaryAttachment
        ? 'Allegato diario'
        : (item.IsDirectory ? 'Cartella' : formatBytes(item.FileSizeBytes));

      return `
      <article class="item-card ${pendingClass}" data-id="${item.Id}">
        <input type="checkbox" class="done-checkbox js-archive-done" data-id="${item.Id}"
          ${item.IsDone ? 'checked' : ''} title="Fatto (togli la spunta per ricordarti di terminarlo)">
        <div class="file-badge-box">${escapeHtml(badge)}</div>
        <div class="card-main">
          <div class="card-title-row">
            ${item._isDiaryAttachment ? `<span class="diary-source-pill">📓 Diario</span>` : ''}
            <span class="card-title">${escapeHtml(item.Title || item.OriginalFileName)}</span>
          </div>
          ${item._isDiaryAttachment ? `<div class="diary-source-label">${escapeHtml(item._diarySourceLabel)}</div>` : ''}
          <div class="card-meta">
            <span class="date-pill">📅 ${formatDateIt(item.ArchivedAt)} &nbsp;🕒 ${formatTimeIt(item.ArchivedAt)}</span>
            <span>${escapeHtml(item.OriginalFileName)}</span>
            <span>• ${sizeText}</span>
          </div>
          ${item.Notes ? `<div class="card-notes">${escapeHtml(item.Notes)}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-xs btn-primary js-archive-open" data-id="${item.Id}" type="button">Apri</button>
          <button class="btn btn-xs btn-neutral js-archive-edit" data-id="${item.Id}" type="button">Modifica</button>
          <button class="btn btn-xs btn-danger-soft js-archive-delete" data-id="${item.Id}" type="button">Elimina</button>
        </div>
      </article>`;
    })
    .join('');
}

function renderDiary() {
  const todayKey = getTodayDateStr();
  const todayCount = state.diary.filter((e) => (e.Timestamp || '').slice(0, 10) === todayKey).length;
  els.diaryTodayCount.textContent = todayCount;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark ? DARK_PASTEL : LIGHT_PASTEL;

  const filtered = state.diary.filter((e) => {
    if (state.diaryDateFilter && (e.Timestamp || '').slice(0, 10) !== state.diaryDateFilter) return false;
    return matchesTerms(
      [e.Text, ...(e.Attachments || []).map((a) => a.FileName)],
      e.Timestamp,
      state.diarySearch
    );
  });

  const dayLabel = state.diaryDateFilter
    ? `del ${formatDateInputToIt(state.diaryDateFilter)}`
    : 'in tutti i giorni';
  els.diarySummaryText.textContent = filtered.length === 1
    ? `1 attività registrata ${dayLabel}`
    : `${filtered.length} attività registrate ${dayLabel}`;

  if (filtered.length === 0) {
    els.diaryList.innerHTML = `<div class="empty-state">Nessuna attività registrata per questo filtro.<br>Scrivi qui sopra e clicca 💾 Salva per iniziare.</div>`;
    return;
  }

  els.diaryList.innerHTML = filtered
    .map((entry, idx) => {
      const color = palette[idx % palette.length];
      const pendingClass = entry.IsDone ? '' : 'pending-highlight';
      const attachmentsHtml = (entry.Attachments || [])
        .map((att) => {
          const icon = att.IsDirectory ? '📁' : '📎';
          return `
          <span class="attach-chip">
            <button class="attach-open-btn js-diary-att-open" data-entry-id="${entry.Id}" data-att-id="${att.Id}" type="button" title="Apri allegato">
              ${icon} ${escapeHtml(att.FileName)}
            </button>
            <button class="attach-remove-btn js-diary-att-remove" data-entry-id="${entry.Id}" data-att-id="${att.Id}" type="button" title="Rimuovi allegato">✕</button>
          </span>`;
        })
        .join('');

      return `
      <article class="item-card js-diary-row ${pendingClass}" style="background:${color.bg};border-color:${entry.IsDone ? color.border : '#F59E0B'}" data-id="${entry.Id}">
        <input type="checkbox" class="done-checkbox js-diary-done" data-id="${entry.Id}"
          ${entry.IsDone ? 'checked' : ''} title="Fatto (togli la spunta per ricordarti di terminarlo)">
        <span class="diary-date-pill">📅 ${formatDateIt(entry.Timestamp)} &nbsp;🕒 ${formatTimeIt(entry.Timestamp)}</span>
        <div class="card-main">
          <div class="diary-text">${renderDiaryBodyHtml(entry)}</div>
          ${attachmentsHtml ? `<div class="attach-chips">${attachmentsHtml}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-xs btn-primary js-diary-open" data-id="${entry.Id}" type="button" title="Apri nota completa">Apri</button>
          <button class="btn btn-xs btn-neutral js-diary-attach" data-id="${entry.Id}" type="button" title="Allega file a questa riga">📎 Allega</button>
          <button class="btn btn-xs btn-danger-soft js-diary-delete" data-id="${entry.Id}" type="button">Elimina</button>
        </div>
      </article>`;
    })
    .join('');
}

function renderDraftAttachments() {
  if (state.draftAttachments.length === 0) {
    els.draftAttachmentsPanel.classList.add('hidden');
    els.draftAttachmentsList.innerHTML = '';
    return;
  }
  els.draftAttachmentsPanel.classList.remove('hidden');
  els.draftAttachmentsList.innerHTML = state.draftAttachments
    .map((file, idx) => `
      <span class="attach-chip">
        <span>📎 ${escapeHtml(file.name)}</span>
        <button class="attach-remove-btn js-remove-draft-att" data-idx="${idx}" type="button" title="Rimuovi allegato dalla bozza">✕</button>
      </span>`)
    .join('');
}

// ===== ACTIONS =====

async function handleDroppedOrSelectedFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  if (state.activeSection === 'diary') {
    for (const file of files) {
      if (!state.draftAttachments.some((f) => f.name === file.name && f.size === file.size)) {
        state.draftAttachments.push(file);
      }
    }
    renderDraftAttachments();
    showStatus(
      files.length === 1
        ? `Allegato pronto per la nota: "${files[0].name}" (clicca 💾 Salva)`
        : `${files.length} allegati pronti per la nota (clicca 💾 Salva)`
    );
    return;
  }

  try {
    const added = await storage.addArchiveFiles(
      files,
      els.customTitleInput.value,
      els.customNotesInput.value
    );
    if (added.length === 0) return;

    els.customTitleInput.value = '';
    els.customNotesInput.value = '';
    await reloadData();

    if (added.length === 1) {
      const item = added[0];
      showStatus(`Archiviato: "${item.Title}" (${formatDateIt(item.ArchivedAt)} ${formatTimeIt(item.ArchivedAt)})`);
    } else {
      showStatus(`Archiviati ${added.length} elementi`);
    }
  } catch (err) {
    showStatus(err?.message || 'Errore durante l\'archiviazione', true);
  }
}

async function openStoredFile(storedRelativePath, fileName, isDiaryAttachment = false) {
  const blob = await storage.getStoredFileBlob(storedRelativePath, isDiaryAttachment);
  if (!blob) {
    showToast(`File non disponibile localmente (${storedRelativePath || fileName})`);
    return;
  }
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'documento';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function openEditArchiveModal(item) {
  state.editingArchiveId = item.Id;
  els.editItemTitleInput.value = item.Title || '';
  els.editItemNotesInput.value = item.Notes || '';
  els.editItemModal.classList.remove('hidden');
  els.editItemTitleInput.focus();
}

function openDiaryDetailModal(entry) {
  state.detailDiaryId = entry.Id;
  els.detailTimestampText.textContent = `📅 ${formatDateIt(entry.Timestamp)}   🕒 ${formatTimeIt(entry.Timestamp)}`;
  els.detailDoneChk.checked = Boolean(entry.IsDone);
  els.detailEditor.innerHTML = entry.RichContentHtml || escapeHtml(entry.Text || '').replaceAll('\n', '<br>');
  renderDetailAttachments(entry);
  els.diaryDetailModal.classList.remove('hidden');
  els.detailEditor.focus();
}

function renderDetailAttachments(entry) {
  const atts = entry.Attachments || [];
  if (atts.length === 0) {
    els.detailAttachmentsSection.classList.add('hidden');
    els.detailAttachmentsList.innerHTML = '';
    return;
  }
  els.detailAttachmentsSection.classList.remove('hidden');
  els.detailAttachmentsList.innerHTML = atts
    .map((att) => `
      <span class="attach-chip">
        <button class="attach-open-btn js-diary-att-open" data-entry-id="${entry.Id}" data-att-id="${att.Id}" type="button">
          ${att.IsDirectory ? '📁' : '📎'} ${escapeHtml(att.FileName)}
        </button>
        <button class="attach-remove-btn js-detail-att-remove" data-entry-id="${entry.Id}" data-att-id="${att.Id}" type="button" title="Rimuovi allegato">✕</button>
      </span>`)
    .join('');
}

async function renderSettingsPanels() {
  const folderSupported = storage.isFolderApiSupported();
  const hasSaved = await storage.hasSavedFolderHandle();
  const connected = storage.isFolderConnected();

  const html = `
    <div class="settings-group">
      <h4>📁 Cartella MemoBam (ChromeOS / Desktop)</h4>
      <p>${folderSupported
      ? connected
        ? `Collegata a <strong>${escapeHtml(storage.folderName)}</strong> (${storage.isReadOnlyFolder() ? 'Sola lettura' : 'Lettura e Scrittura'}): le modifiche e i file vengono salvati direttamente nella cartella compatibile con MemoBam PC.`
        : 'Collega la tua cartella MemoBam (es. OneDrive / Google Drive) per leggere e scrivere direttamente schede, diario, allegati e file Markdown.'
      : 'Su questo browser mobile i dati e i file sono salvati offline nella memoria locale (IndexedDB). Usa Importa/Esporta JSON qui sotto per sincronizzare.'
    }</p>
      <div class="settings-actions">
        ${folderSupported
      ? `<button class="btn btn-primary btn-sm js-connect-folder" type="button">📁 ${connected ? 'Cambia Cartella' : 'Collega Cartella'}</button>`
      : ''
    }
        ${folderSupported && !connected && hasSaved
      ? `<button class="btn btn-neutral btn-sm js-reconnect-folder" type="button">🔄 Riconnetti ultima cartella</button>`
      : ''
    }
        ${connected
      ? `<button class="btn btn-danger btn-sm js-disconnect-folder" type="button">Scollega</button>`
      : ''
    }
      </div>
    </div>

    <div class="settings-group">
      <h4>⬆️ Importa / ⬇️ Esporta Indici JSON</h4>
      <p>Importa <code>archivio_memobam.json</code> / <code>diario_index.json</code> oppure esporta i tuoi dati per il PC.</p>
      <div class="settings-actions">
        <label class="btn btn-primary btn-sm">
          📥 Importa JSON
          <input type="file" accept=".json,application/json" multiple class="hidden js-import-json">
        </label>
        <button class="btn btn-neutral btn-sm js-export-archive" type="button">📤 archivio_memobam.json</button>
        <button class="btn btn-neutral btn-sm js-export-diary" type="button">📤 diario_index.json</button>
        <button class="btn btn-neutral btn-sm js-export-all" type="button">💾 Backup Completo</button>
      </div>
    </div>

    <div class="settings-group">
      <h4>🧹 Manutenzione Cache Locale</h4>
      <p>Svuota i dati salvati in IndexedDB su questo dispositivo (non tocca eventuali cartelle collegate).</p>
      <div class="settings-actions">
        <button class="btn btn-danger-soft btn-sm js-clear-cache" type="button">Svuota cache locale</button>
      </div>
    </div>
  `;

  els.settingsContentMobile.innerHTML = html;
  els.settingsContentModal.innerHTML = html;
}

// ===== NAVIGATION =====

function switchSection(section) {
  state.activeSection = section;

  // Desktop tabs
  els.archiveTabBtn.classList.toggle('active', section === 'archive');
  els.diaryTabBtn.classList.toggle('active', section === 'diary');
  els.archiveTabContent.classList.toggle('active', section === 'archive');
  els.diaryTabContent.classList.toggle('active', section === 'diary');

  // Mobile bottom nav & panes
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === section));
  els.dropPane.classList.toggle('mobile-active', section === 'drop');
  els.archiveTabContent.classList.toggle('mobile-active', section === 'archive' || section === 'pending');
  els.diaryTabContent.classList.toggle('mobile-active', section === 'diary');
  els.settingsPane.classList.toggle('mobile-active', section === 'settings');

  if (section === 'pending') {
    state.pendingExpanded = true;
    renderPending();
    els.pendingBanner.scrollIntoView({ behavior: 'smooth' });
  } else if (section === 'settings') {
    renderSettingsPanels();
  }
}

// ===== EVENT BINDINGS =====

function bindEvents() {
  // Desktop section tabs
  els.archiveTabBtn.addEventListener('click', () => switchSection('archive'));
  els.diaryTabBtn.addEventListener('click', () => switchSection('diary'));

  // Mobile bottom nav
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchSection(btn.dataset.tab));
  });

  // Theme toggle
  els.themeToggleBtn.addEventListener('click', () => {
    const curr = document.documentElement.getAttribute('data-theme');
    applyTheme(curr === 'dark' ? 'light' : 'dark');
  });

  // Drop zone
  els.browseFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    els.fileInput.click();
  });
  els.dropZone.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', async () => {
    await handleDroppedOrSelectedFiles(els.fileInput.files);
    els.fileInput.value = '';
  });

  els.dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('drag-over');
    els.dropZoneTitle.textContent = 'Rilascia per archiviare';
  });
  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('drag-over');
  });
  els.dropZone.addEventListener('dragleave', () => {
    els.dropZone.classList.remove('drag-over');
    els.dropZoneTitle.textContent = 'Trascina qui i documenti';
  });
  els.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('drag-over');
    els.dropZoneTitle.textContent = 'Trascina qui i documenti';
    await handleDroppedOrSelectedFiles(e.dataTransfer?.files);
  });

  // Archive search & filters
  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value.trim();
    renderArchive();
  });
  els.dateFilterInput.addEventListener('change', () => {
    state.dateFilter = els.dateFilterInput.value;
    renderArchive();
  });
  els.clearSearchBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    els.dateFilterInput.value = '';
    state.search = '';
    state.dateFilter = '';
    renderArchive();
  });

  els.excludeDiaryAttachmentsChk.checked = state.excludeDiaryAttachments;
  els.excludeDiaryAttachmentsChk.addEventListener('change', () => {
    state.excludeDiaryAttachments = els.excludeDiaryAttachmentsChk.checked;
    localStorage.setItem('memobam_exclude_diary_att', String(state.excludeDiaryAttachments));
    renderArchive();
  });

  // Diary filters & composer
  els.diaryDateInput.value = state.diaryDateFilter;
  els.diaryDateInput.addEventListener('change', () => {
    state.diaryDateFilter = els.diaryDateInput.value;
    renderDiary();
  });
  els.diaryTodayBtn.addEventListener('click', () => {
    state.diaryDateFilter = getTodayDateStr();
    state.diarySearch = '';
    els.diaryDateInput.value = state.diaryDateFilter;
    els.diarySearchInput.value = '';
    renderDiary();
  });
  els.diaryAllDaysBtn.addEventListener('click', () => {
    state.diaryDateFilter = '';
    els.diaryDateInput.value = '';
    renderDiary();
  });
  els.diarySearchInput.addEventListener('input', () => {
    state.diarySearch = els.diarySearchInput.value.trim();
    renderDiary();
  });

  els.fmtBoldBtn.addEventListener('click', () => execEditorCmd(els.diaryEditor, 'bold'));
  els.fmtItalicBtn.addEventListener('click', () => execEditorCmd(els.diaryEditor, 'italic'));
  els.fmtBulletBtn.addEventListener('click', () => execEditorCmd(els.diaryEditor, 'insertUnorderedList'));
  els.fmtCheckBtn.addEventListener('click', () => insertSecondaryCheckBox(els.diaryEditor));

  els.draftAttachBtn.addEventListener('click', () => els.draftAttachInput.click());
  els.draftAttachInput.addEventListener('change', () => {
    for (const file of Array.from(els.draftAttachInput.files || [])) {
      if (!state.draftAttachments.some((f) => f.name === file.name && f.size === file.size)) {
        state.draftAttachments.push(file);
      }
    }
    els.draftAttachInput.value = '';
    renderDraftAttachments();
  });

  els.saveDiaryBtn.addEventListener('click', async () => {
    let text = extractEditorPlainText(els.diaryEditor);
    if (!text && state.draftAttachments.length === 0) return;

    if (!text && state.draftAttachments.length > 0) {
      text = `Allegati (${state.draftAttachments.map((f) => f.name).join(', ')})`;
    }

    const richHtml = els.diaryEditor.innerHTML.trim();
    try {
      const entry = await storage.addDiaryEntry(
        text,
        state.diaryDateFilter || getTodayDateStr(),
        richHtml || null
      );
      if (state.draftAttachments.length > 0) {
        await storage.addDiaryAttachments(entry.Id, state.draftAttachments);
        state.draftAttachments = [];
        renderDraftAttachments();
      }
      els.diaryEditor.innerHTML = '';
      await reloadData();
      showStatus(`Diario registrato (${formatDateIt(entry.Timestamp)} ${formatTimeIt(entry.Timestamp)})`);
    } catch (err) {
      showStatus(err?.message || 'Errore salvataggio diario', true);
    }
  });

  // Pending alerts toggle
  els.pendingToggleBtn.addEventListener('click', () => {
    state.pendingExpanded = !state.pendingExpanded;
    renderPending();
  });

  // Folder & Settings modals
  const connectFolderAction = async () => {
    try {
      const res = await storage.connectFolder();
      await reloadData();
      await renderSettingsPanels();
      showToast(`Cartella collegata (${res.writable ? 'Lettura/Scrittura' : 'Sola lettura'}): ${res.name}`);
    } catch (err) {
      if (err?.name !== 'AbortError') showToast(err?.message || 'Errore connessione cartella');
    }
  };
  els.connectFolderBtn.addEventListener('click', connectFolderAction);
  els.changePathBtn.addEventListener('click', async () => {
    await renderSettingsPanels();
    els.settingsModal.classList.remove('hidden');
  });
  els.settingsOpenBtn.addEventListener('click', async () => {
    await renderSettingsPanels();
    els.settingsModal.classList.remove('hidden');
  });
  els.closeSettingsModalBtn.addEventListener('click', () => els.settingsModal.classList.add('hidden'));

  // Edit Archive Item Modal
  els.closeEditItemModalBtn.addEventListener('click', () => els.editItemModal.classList.add('hidden'));
  els.cancelEditItemBtn.addEventListener('click', () => els.editItemModal.classList.add('hidden'));
  els.saveEditItemBtn.addEventListener('click', async () => {
    const title = els.editItemTitleInput.value.trim();
    if (!title) {
      showToast('Il titolo non può essere vuoto.');
      els.editItemTitleInput.focus();
      return;
    }
    const existing = state.archive.find((i) => i.Id === state.editingArchiveId);
    if (!existing) return;
    await storage.updateArchiveItem({
      ...existing,
      Title: title,
      Notes: els.editItemNotesInput.value.trim()
    });
    els.editItemModal.classList.add('hidden');
    await reloadData();
    showToast('Scheda aggiornata');
  });

  // Diary Detail Modal
  els.closeDiaryDetailModalBtn.addEventListener('click', () => els.diaryDetailModal.classList.add('hidden'));
  els.cancelDiaryDetailBtn.addEventListener('click', () => els.diaryDetailModal.classList.add('hidden'));
  els.detailBoldBtn.addEventListener('click', () => execEditorCmd(els.detailEditor, 'bold'));
  els.detailItalicBtn.addEventListener('click', () => execEditorCmd(els.detailEditor, 'italic'));
  els.detailBulletBtn.addEventListener('click', () => execEditorCmd(els.detailEditor, 'insertUnorderedList'));
  els.detailCheckBtn.addEventListener('click', () => insertSecondaryCheckBox(els.detailEditor));
  els.detailAttachBtn.addEventListener('click', () => els.detailAttachInput.click());
  els.detailAttachInput.addEventListener('change', async () => {
    const files = Array.from(els.detailAttachInput.files || []);
    els.detailAttachInput.value = '';
    if (!files.length || !state.detailDiaryId) return;
    await storage.addDiaryAttachments(state.detailDiaryId, files);
    await reloadData();
    const updated = state.diary.find((e) => e.Id === state.detailDiaryId);
    if (updated) renderDetailAttachments(updated);
    showToast(`Collegati ${files.length} allegati`);
  });
  els.saveDiaryDetailBtn.addEventListener('click', async () => {
    const text = extractEditorPlainText(els.detailEditor);
    if (!text) {
      showToast('Il testo della nota non può essere vuoto.');
      els.detailEditor.focus();
      return;
    }
    const existing = state.diary.find((e) => e.Id === state.detailDiaryId);
    if (!existing) return;
    await storage.updateDiaryEntry({
      ...existing,
      Text: text,
      RichContentHtml: els.detailEditor.innerHTML.trim(),
      IsDone: els.detailDoneChk.checked
    });
    els.diaryDetailModal.classList.add('hidden');
    await reloadData();
    showToast('Nota del diario aggiornata');
  });

  // Hidden file input for attaching to an existing diary row
  els.entryAttachInput.addEventListener('change', async () => {
    const files = Array.from(els.entryAttachInput.files || []);
    els.entryAttachInput.value = '';
    if (!files.length || !state.pendingAttachEntryId) return;
    try {
      await storage.addDiaryAttachments(state.pendingAttachEntryId, files);
      await reloadData();
      showStatus(files.length === 1 ? `Allegato "${files[0].name}" collegato.` : `Collegati ${files.length} allegati.`);
    } catch (err) {
      showStatus(err?.message || 'Errore allegato diario', true);
    }
    state.pendingAttachEntryId = null;
  });

  // Drag & Drop directly on diary rows
  els.diaryList.addEventListener('dragover', (e) => {
    const row = e.target.closest('.js-diary-row');
    if (!row) return;
    e.preventDefault();
    row.classList.add('drag-over');
  });
  els.diaryList.addEventListener('dragleave', (e) => {
    const row = e.target.closest('.js-diary-row');
    if (row) row.classList.remove('drag-over');
  });
  els.diaryList.addEventListener('drop', async (e) => {
    const row = e.target.closest('.js-diary-row');
    if (!row) return;
    e.preventDefault();
    row.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;
    try {
      await storage.addDiaryAttachments(row.dataset.id, files);
      await reloadData();
      showStatus(files.length === 1 ? `Allegato "${files[0].name}" collegato.` : `Collegati ${files.length} allegati.`);
    } catch (err) {
      showStatus(err?.message || 'Errore allegato diario', true);
    }
  });

  // Delegated click & change events across cards, pending banner, and settings
  document.body.addEventListener('click', async (e) => {
    const target = e.target;

    // Pending actions
    if (target.closest('.js-pending-open')) {
      const btn = target.closest('.js-pending-open');
      const { type, id } = btn.dataset;
      if (type === 'archive') {
        switchSection('archive');
        const card = els.archiveList.querySelector(`.item-card[data-id="${id}"]`);
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const entry = state.diary.find((d) => d.Id === id);
        if (entry) {
          state.diaryDateFilter = (entry.Timestamp || '').slice(0, 10);
          els.diaryDateInput.value = state.diaryDateFilter;
          switchSection('diary');
          renderDiary();
          const card = els.diaryList.querySelector(`.item-card[data-id="${id}"]`);
          card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }
    if (target.closest('.js-pending-done')) {
      const btn = target.closest('.js-pending-done');
      const { type, id } = btn.dataset;
      if (type === 'archive') await storage.setArchiveDone(id, true);
      else await storage.setDiaryDone(id, true);
      await reloadData();
      return;
    }

    // Archive card actions
    if (target.closest('.js-archive-open')) {
      const id = target.closest('.js-archive-open').dataset.id;
      const item = getUnifiedArchive().find((i) => i.Id === id);
      if (item) await openStoredFile(item.StoredRelativePath, item.OriginalFileName, item._isDiaryAttachment);
      return;
    }
    if (target.closest('.js-archive-edit')) {
      const id = target.closest('.js-archive-edit').dataset.id;
      const item = getUnifiedArchive().find((i) => i.Id === id);
      if (!item) return;
      if (item._isDiaryAttachment && item._linkedEntry) {
        openDiaryDetailModal(item._linkedEntry);
      } else {
        openEditArchiveModal(item);
      }
      return;
    }
    if (target.closest('.js-archive-delete')) {
      const id = target.closest('.js-archive-delete').dataset.id;
      const item = getUnifiedArchive().find((i) => i.Id === id);
      if (!item) return;
      if (item._isDiaryAttachment && item._linkedEntry && item._linkedAttachment) {
        if (confirm(`Vuoi eliminare l'allegato "${item._linkedAttachment.FileName}" dalla riga del diario?`)) {
          await storage.removeDiaryAttachment(item._linkedEntry.Id, item._linkedAttachment.Id);
          await reloadData();
          showStatus(`Allegato "${item._linkedAttachment.FileName}" eliminato.`);
        }
      } else if (confirm(`Vuoi eliminare la scheda "${item.Title}"?`)) {
        await storage.deleteArchiveItem(item);
        await reloadData();
        showStatus(`Scheda "${item.Title}" eliminata.`);
      }
      return;
    }

    // Draft attachment remove
    if (target.closest('.js-remove-draft-att')) {
      const idx = Number(target.closest('.js-remove-draft-att').dataset.idx);
      state.draftAttachments.splice(idx, 1);
      renderDraftAttachments();
      return;
    }

    // Diary card actions
    if (target.closest('.js-diary-open')) {
      const id = target.closest('.js-diary-open').dataset.id;
      const entry = state.diary.find((d) => d.Id === id);
      if (entry) openDiaryDetailModal(entry);
      return;
    }
    if (target.closest('.js-diary-attach')) {
      state.pendingAttachEntryId = target.closest('.js-diary-attach').dataset.id;
      els.entryAttachInput.click();
      return;
    }
    if (target.closest('.js-diary-delete')) {
      const id = target.closest('.js-diary-delete').dataset.id;
      const entry = state.diary.find((d) => d.Id === id);
      if (!entry) return;
      const extra = (entry.Attachments || []).length > 0
        ? `\n\nVerranno eliminati anche i ${entry.Attachments.length} allegati collegati.`
        : '';
      if (confirm(`Vuoi eliminare questa registrazione dal diario?\n\n"${entry.Text}"${extra}`)) {
        await storage.deleteDiaryEntry(id);
        await reloadData();
      }
      return;
    }
    if (target.closest('.js-diary-att-open')) {
      const btn = target.closest('.js-diary-att-open');
      const entry = state.diary.find((d) => d.Id === btn.dataset.entryId);
      const att = entry?.Attachments?.find((a) => a.Id === btn.dataset.attId);
      if (att) await openStoredFile(att.StoredRelativePath, att.FileName, true);
      return;
    }
    if (target.closest('.js-diary-att-remove')) {
      const btn = target.closest('.js-diary-att-remove');
      const entry = state.diary.find((d) => d.Id === btn.dataset.entryId);
      const att = entry?.Attachments?.find((a) => a.Id === btn.dataset.attId);
      if (att && confirm(`Vuoi eliminare l'allegato "${att.FileName}" da questa riga del diario?`)) {
        await storage.removeDiaryAttachment(entry.Id, att.Id);
        await reloadData();
      }
      return;
    }
    if (target.closest('.js-detail-att-remove')) {
      const btn = target.closest('.js-detail-att-remove');
      const entry = state.diary.find((d) => d.Id === btn.dataset.entryId);
      const att = entry?.Attachments?.find((a) => a.Id === btn.dataset.attId);
      if (att && confirm(`Vuoi eliminare l'allegato "${att.FileName}"?`)) {
        await storage.removeDiaryAttachment(entry.Id, att.Id);
        await reloadData();
        const updated = state.diary.find((d) => d.Id === entry.Id);
        if (updated) renderDetailAttachments(updated);
      }
      return;
    }

    // Settings actions
    if (target.closest('.js-connect-folder')) {
      await connectFolderAction();
    } else if (target.closest('.js-reconnect-folder')) {
      if (await storage.reconnectSavedFolder()) {
        await reloadData();
        await renderSettingsPanels();
        showToast('Cartella riconnessa!');
      }
    } else if (target.closest('.js-disconnect-folder')) {
      await storage.disconnectFolder();
      await reloadData();
      await renderSettingsPanels();
      showToast('Cartella scollegata');
    } else if (target.closest('.js-export-archive')) {
      downloadJsonFile('archivio_memobam.json', state.archive);
    } else if (target.closest('.js-export-diary')) {
      downloadJsonFile('diario_index.json', state.diary);
    } else if (target.closest('.js-export-all')) {
      downloadJsonFile(`memobam_backup_${getTodayDateStr()}.json`, {
        archive: state.archive,
        diary: state.diary
      });
    } else if (target.closest('.js-clear-cache')) {
      if (confirm('Svuotare i dati e i file salvati in cache su questo dispositivo?')) {
        await storage.clearLocalCache();
        await reloadData();
        showToast('Cache locale svuotata');
      }
    }
  });

  // Checkbox changes (Done & Import JSON)
  document.body.addEventListener('change', async (e) => {
    const target = e.target;
    if (target.classList.contains('js-archive-done')) {
      const id = target.dataset.id;
      const item = getUnifiedArchive().find((i) => i.Id === id);
      if (!item) return;
      if (item._isDiaryAttachment && item._linkedEntry) {
        await storage.setDiaryDone(item._linkedEntry.Id, target.checked);
      } else {
        await storage.setArchiveDone(id, target.checked);
      }
      await reloadData();
    } else if (target.classList.contains('js-diary-done')) {
      await storage.setDiaryDone(target.dataset.id, target.checked);
      await reloadData();
    } else if (target.classList.contains('js-import-json')) {
      const files = Array.from(target.files || []);
      if (!files.length) return;
      let totalArc = 0;
      let totalDia = 0;
      try {
        for (const file of files) {
          const res = await storage.importJsonText(await file.text(), true);
          totalArc += res.importedArchive;
          totalDia += res.importedDiary;
        }
        await reloadData();
        els.settingsModal.classList.add('hidden');
        showToast(`Importati ${totalArc} documenti e ${totalDia} voci diario`);
      } catch {
        showToast('Errore: file JSON non valido');
      }
      target.value = '';
    }
  });

  // PWA Install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

// ===== BOOTSTRAP =====

async function bootstrap() {
  initTheme();
  await storage.init();
  bindEvents();

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  switchSection(tab === 'diary' ? 'diary' : 'archive');

  await reloadData();
  await renderSettingsPanels();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }
}

bootstrap();
