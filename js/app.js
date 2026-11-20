import { MemoBamReadOnlyStorage } from './storage.js';

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

const storage = new MemoBamReadOnlyStorage();

const state = {
  archive: [],
  diary: [],
  search: '',
  dateFilter: '',
  onlyPending: false,
  excludeDiaryAttachments: localStorage.getItem('memobam_ro_exclude_diary_att') === 'true',
  pendingCollapsed: false,
  deferredInstallPrompt: null,
  activeMobileTab: 'archive'
};

const els = {
  storageBadge: document.getElementById('storageBadge'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  dateFilterInput: document.getElementById('dateFilterInput'),
  clearDateBtn: document.getElementById('clearDateBtn'),
  onlyPendingChk: document.getElementById('onlyPendingChk'),
  onlyPendingMobileChk: document.getElementById('onlyPendingMobileChk'),
  connectFolderBtn: document.getElementById('connectFolderBtn'),
  connectFolderLabel: document.getElementById('connectFolderLabel'),
  installBtn: document.getElementById('installBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  settingsOpenBtn: document.getElementById('settingsOpenBtn'),

  pendingBanner: document.getElementById('pendingBanner'),
  pendingToggleBtn: document.getElementById('pendingToggleBtn'),
  pendingCount: document.getElementById('pendingCount'),
  pendingChevron: document.getElementById('pendingChevron'),
  pendingList: document.getElementById('pendingList'),
  navPendingBadge: document.getElementById('navPendingBadge'),

  archivePane: document.getElementById('archivePane'),
  diaryPane: document.getElementById('diaryPane'),
  settingsPane: document.getElementById('settingsPane'),

  archiveCountBadge: document.getElementById('archiveCountBadge'),
  excludeDiaryAttachmentsChk: document.getElementById('excludeDiaryAttachmentsChk'),
  archiveList: document.getElementById('archiveList'),

  diaryCountBadge: document.getElementById('diaryCountBadge'),
  diaryList: document.getElementById('diaryList'),

  settingsContentMobile: document.getElementById('settingsContentMobile'),
  settingsModal: document.getElementById('settingsModal'),
  settingsContentModal: document.getElementById('settingsContentModal'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),

  toast: document.getElementById('toast')
};

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2800);
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

function formatTimeIt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 19);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('memobam_ro_theme', theme);
  els.themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  renderDiary();
}

function initTheme() {
  const saved = localStorage.getItem('memobam_ro_theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

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
    els.storageBadge.textContent = `📁 ${storage.folderName} (Sola lettura)`;
    els.storageBadge.classList.add('folder-active');
    els.connectFolderLabel.textContent = 'Cartella Attiva';
  } else {
    els.storageBadge.textContent = 'Cache Locale (Offline)';
    els.storageBadge.classList.remove('folder-active');
    els.connectFolderLabel.textContent = 'Collega Cartella';
  }
}

function getUnifiedArchive() {
  const items = state.archive.map((item) => ({
    ...item,
    _isDiaryAttachment: false
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
          Notes: `Allegato Diario: ${entry.Text}`,
          FileSizeBytes: 0,
          IsDirectory: Boolean(att.IsDirectory),
          IsDone: entry.IsDone,
          _isDiaryAttachment: true
        });
      }
    }
  }

  return items.sort((a, b) => new Date(b.ArchivedAt) - new Date(a.ArchivedAt));
}

function matchesFilter(textFields, isoDate, isDone) {
  if (state.onlyPending && isDone) return false;
  if (state.dateFilter && (isoDate || '').slice(0, 10) !== state.dateFilter) {
    return false;
  }
  if (!state.search) return true;
  const q = state.search.toLowerCase();
  const dateStr = formatDateIt(isoDate).toLowerCase();
  const timeStr = formatTimeIt(isoDate).toLowerCase();
  return [...textFields, dateStr, timeStr].some((f) => String(f || '').toLowerCase().includes(q));
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

  els.pendingCount.textContent = total;
  els.navPendingBadge.textContent = total;
  els.navPendingBadge.classList.toggle('hidden', total === 0);
  els.pendingBanner.classList.toggle('hidden', total === 0);

  if (total === 0) {
    els.pendingList.innerHTML = '';
    return;
  }

  const chips = [
    ...pendingArchive.map((i) => ({
      type: 'archive',
      id: i.Id,
      badge: '📦',
      label: i.Title || i.OriginalFileName,
      stamp: formatDateIt(i.ArchivedAt)
    })),
    ...pendingDiary.map((e) => ({
      type: 'diary',
      id: e.Id,
      badge: '📓',
      label: e.Text.slice(0, 42) + (e.Text.length > 42 ? '…' : ''),
      stamp: formatDateIt(e.Timestamp)
    }))
  ];

  els.pendingList.innerHTML = chips
    .map(
      (c) => `
      <button class="pending-chip" data-pending-type="${c.type}" data-pending-id="${c.id}" type="button">
        <span>${c.badge}</span>
        <span>${escapeHtml(c.label)}</span>
        <small style="opacity:.7">${c.stamp}</small>
      </button>`
    )
    .join('');
}

function renderArchive() {
  const all = getUnifiedArchive().filter((i) =>
    matchesFilter([i.Title, i.OriginalFileName, i.Notes, i.StoredRelativePath], i.ArchivedAt, i.IsDone)
  );
  els.archiveCountBadge.textContent = all.length;

  if (all.length === 0) {
    els.archiveList.innerHTML = `<div class="empty-state">Nessun documento caricato.<br>Apri <strong>⚙️ Dati</strong> per importare <code>archivio_memobam.json</code> o collegare la cartella su ChromeOS.</div>`;
    return;
  }

  els.archiveList.innerHTML = all
    .map((item) => {
      const badge = getFileBadge(item.OriginalFileName, item.IsDirectory);
      const pendingClass = item.IsDone ? '' : 'pending-highlight';
      const statusHtml = item.IsDone
        ? `<span class="status-pill done">✓ Completato</span>`
        : `<span class="status-pill pending">⏳ Da terminare</span>`;
      const sizeText = item._isDiaryAttachment ? 'Allegato diario' : formatBytes(item.FileSizeBytes);
      const pathHint = item.StoredRelativePath
        ? `<div class="pc-path-hint" title="Percorso archivio su PC (solo indicativo)">📎 File su PC: ${escapeHtml(item.StoredRelativePath)}</div>`
        : '';

      return `
      <article class="item-card ${pendingClass}" data-id="${item.Id}">
        <div class="card-top">
          <div class="card-title-row">
            <span class="file-badge ${item._isDiaryAttachment ? 'diary-badge' : ''}">${escapeHtml(badge)}</span>
            <span class="card-title">${escapeHtml(item.Title || item.OriginalFileName)}</span>
          </div>
          ${statusHtml}
        </div>
        <div class="card-meta">
          <span>📄 ${escapeHtml(item.OriginalFileName)}</span>
          <span>📅 ${formatDateIt(item.ArchivedAt)} ${formatTimeIt(item.ArchivedAt)}</span>
          <span>💾 ${sizeText}</span>
        </div>
        ${item.Notes ? `<div class="card-notes">${escapeHtml(item.Notes)}</div>` : ''}
        ${pathHint}
      </article>`;
    })
    .join('');
}

function renderDiary() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark ? DARK_PASTEL : LIGHT_PASTEL;

  const filtered = state.diary.filter((e) =>
    matchesFilter(
      [e.Text, ...(e.Attachments || []).map((a) => `${a.FileName} ${a.StoredRelativePath || ''}`)],
      e.Timestamp,
      e.IsDone
    )
  );
  els.diaryCountBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    els.diaryList.innerHTML = `<div class="empty-state">Nessuna voce nel diario.<br>Apri <strong>⚙️ Dati</strong> per importare <code>diario_index.json</code>.</div>`;
    return;
  }

  els.diaryList.innerHTML = filtered
    .map((entry, idx) => {
      const color = palette[idx % palette.length];
      const pendingClass = entry.IsDone ? '' : 'pending-highlight';
      const statusHtml = entry.IsDone
        ? `<span class="status-pill done">✓ Completato</span>`
        : `<span class="status-pill pending">⏳ Da terminare</span>`;

      // Attachments are ONLY indicated (non-clickable, since files live on PC)
      const attachmentsHtml = (entry.Attachments || [])
        .map((att) => {
          const icon = att.IsDirectory ? '📁' : '📎';
          const titleAttr = att.StoredRelativePath
            ? `title="Percorso su PC: ${escapeHtml(att.StoredRelativePath)}"`
            : '';
          return `<span class="attach-indicator" ${titleAttr}>${icon} ${escapeHtml(att.FileName)}</span>`;
        })
        .join('');

      return `
      <article class="item-card ${pendingClass}" style="background:${color.bg};border-color:${color.border}" data-id="${entry.Id}">
        <div class="card-top">
          <div class="card-meta">
            <span><strong>📅 ${formatDateIt(entry.Timestamp)}</strong></span>
            <span>🕒 ${formatTimeIt(entry.Timestamp)}</span>
          </div>
          ${statusHtml}
        </div>
        <div class="diary-text">${escapeHtml(entry.Text)}</div>
        ${attachmentsHtml ? `<div class="attach-chips">${attachmentsHtml}</div>` : ''}
      </article>`;
    })
    .join('');
}

async function renderSettingsPanels() {
  const folderSupported = storage.isFolderApiSupported();
  const hasSaved = await storage.hasSavedFolderHandle();
  const connected = storage.isFolderConnected();

  const html = `
    <div class="settings-group">
      <h4>📖 Modalità Sola Lettura</h4>
      <p>Questa app è dedicata alla consultazione da <strong>Smartphone</strong> e <strong>ChromeOS</strong>. Gli allegati sono solo indicati (i file fisici restano sul PC).</p>
    </div>

    <div class="settings-group">
      <h4>📁 Cartella MemoBam (ChromeOS / Desktop)</h4>
      <p>${folderSupported
      ? connected
        ? `Collegata in sola lettura a <strong>${escapeHtml(storage.folderName)}</strong>.`
        : 'Collega in sola lettura la cartella MemoBam (es. Google Drive / OneDrive su ChromeOS) per leggere <code>archivio_memobam.json</code> e <code>Diario/diario_index.json</code>.'
      : 'Su questo browser mobile usa l\'importazione dei file JSON qui sotto.'
    }</p>
      <div class="settings-actions">
        ${folderSupported
      ? `<button class="btn btn-primary js-connect-folder" type="button">📁 ${connected ? 'Cambia Cartella' : 'Collega Cartella'}</button>`
      : ''
    }
        ${folderSupported && !connected && hasSaved
      ? `<button class="btn btn-secondary js-reconnect-folder" type="button">🔄 Riconnetti ultima cartella</button>`
      : ''
    }
        ${connected
      ? `<button class="btn btn-danger js-disconnect-folder" type="button">Scollega</button>`
      : ''
    }
      </div>
    </div>

    <div class="settings-group">
      <h4>⬆️ Importa Indici JSON da MemoBam</h4>
      <p>Seleziona uno o entrambi i file <code>archivio_memobam.json</code> e <code>diario_index.json</code> dal telefono o da Drive.</p>
      <div class="settings-actions">
        <label class="btn btn-primary">
          📥 Importa JSON (anche multipli)
          <input type="file" accept=".json,application/json" multiple class="hidden js-import-json">
        </label>
        <button class="btn btn-secondary js-clear-cache" type="button">🧹 Svuota cache locale</button>
      </div>
    </div>
  `;

  els.settingsContentMobile.innerHTML = html;
  els.settingsContentModal.innerHTML = html;
}

function bindEvents() {
  els.searchInput.addEventListener('input', () => {
    state.search = els.searchInput.value.trim();
    els.clearSearchBtn.classList.toggle('hidden', !state.search);
    renderArchive();
    renderDiary();
  });
  els.clearSearchBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    state.search = '';
    els.clearSearchBtn.classList.add('hidden');
    renderArchive();
    renderDiary();
  });

  els.dateFilterInput.addEventListener('change', () => {
    state.dateFilter = els.dateFilterInput.value;
    els.clearDateBtn.classList.toggle('hidden', !state.dateFilter);
    renderArchive();
    renderDiary();
  });
  els.clearDateBtn.addEventListener('click', () => {
    els.dateFilterInput.value = '';
    state.dateFilter = '';
    els.clearDateBtn.classList.add('hidden');
    renderArchive();
    renderDiary();
  });

  const syncPendingToggle = (checked) => {
    state.onlyPending = checked;
    els.onlyPendingChk.checked = checked;
    els.onlyPendingMobileChk.checked = checked;
    renderArchive();
    renderDiary();
  };
  els.onlyPendingChk.addEventListener('change', () => syncPendingToggle(els.onlyPendingChk.checked));
  els.onlyPendingMobileChk.addEventListener('change', () => syncPendingToggle(els.onlyPendingMobileChk.checked));

  els.themeToggleBtn.addEventListener('click', () => {
    const curr = document.documentElement.getAttribute('data-theme');
    applyTheme(curr === 'dark' ? 'light' : 'dark');
  });

  els.excludeDiaryAttachmentsChk.checked = state.excludeDiaryAttachments;
  els.excludeDiaryAttachmentsChk.addEventListener('change', () => {
    state.excludeDiaryAttachments = els.excludeDiaryAttachmentsChk.checked;
    localStorage.setItem('memobam_ro_exclude_diary_att', String(state.excludeDiaryAttachments));
    renderArchive();
  });

  els.pendingToggleBtn.addEventListener('click', () => {
    state.pendingCollapsed = !state.pendingCollapsed;
    els.pendingList.classList.toggle('collapsed', state.pendingCollapsed);
    els.pendingChevron.textContent = state.pendingCollapsed ? '▸' : '▾';
  });

  els.pendingList.addEventListener('click', (e) => {
    const chip = e.target.closest('.pending-chip');
    if (!chip) return;
    const type = chip.dataset.pendingType;
    const id = chip.dataset.pendingId;
    if (window.innerWidth <= 820) {
      switchMobileTab(type === 'archive' ? 'archive' : 'diary');
    }
    const card = document.querySelector(`.item-card[data-id="${id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  els.connectFolderBtn.addEventListener('click', async () => {
    try {
      const name = await storage.connectFolderReadOnly();
      await reloadData();
      await renderSettingsPanels();
      showToast(`Cartella collegata (sola lettura): ${name}`);
    } catch (err) {
      if (err?.name !== 'AbortError') showToast(err?.message || 'Errore connessione cartella');
    }
  });

  els.settingsOpenBtn.addEventListener('click', async () => {
    await renderSettingsPanels();
    els.settingsModal.classList.remove('hidden');
  });
  els.closeSettingsModalBtn.addEventListener('click', () => els.settingsModal.classList.add('hidden'));

  document.body.addEventListener('click', async (e) => {
    if (e.target.closest('.js-connect-folder')) {
      try {
        const name = await storage.connectFolderReadOnly();
        await reloadData();
        await renderSettingsPanels();
        showToast(`Cartella collegata: ${name}`);
      } catch (err) {
        if (err?.name !== 'AbortError') showToast(err?.message || 'Errore');
      }
    } else if (e.target.closest('.js-reconnect-folder')) {
      const ok = await storage.reconnectSavedFolder();
      if (ok) {
        await reloadData();
        await renderSettingsPanels();
        showToast('Cartella riconnessa!');
      }
    } else if (e.target.closest('.js-disconnect-folder')) {
      await storage.disconnectFolder();
      await reloadData();
      await renderSettingsPanels();
      showToast('Cartella scollegata');
    } else if (e.target.closest('.js-clear-cache')) {
      if (confirm('Svuotare i dati in cache su questo dispositivo?')) {
        await storage.clearLocalCache();
        await reloadData();
        showToast('Cache locale svuotata');
      }
    }
  });

  document.body.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('js-import-json')) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    let totalArc = 0;
    let totalDia = 0;
    try {
      for (const file of files) {
        const text = await file.text();
        const res = await storage.importJsonText(text, true);
        totalArc += res.importedArchive;
        totalDia += res.importedDiary;
      }
      await reloadData();
      els.settingsModal.classList.add('hidden');
      showToast(`Caricati ${totalArc} documenti e ${totalDia} voci diario`);
    } catch {
      showToast('Errore: file JSON non valido');
    }
    e.target.value = '';
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchMobileTab(btn.dataset.tab));
  });

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

function switchMobileTab(tab) {
  state.activeMobileTab = tab;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'pending') {
    state.pendingCollapsed = false;
    els.pendingList.classList.remove('collapsed');
    els.pendingBanner.scrollIntoView({ behavior: 'smooth' });
    els.archivePane.classList.add('active');
    els.diaryPane.classList.remove('active');
    els.settingsPane.classList.remove('active');
    return;
  }

  els.archivePane.classList.toggle('active', tab === 'archive');
  els.diaryPane.classList.toggle('active', tab === 'diary');
  els.settingsPane.classList.toggle('active', tab === 'settings');
  if (tab === 'settings') renderSettingsPanels();
}

async function bootstrap() {
  initTheme();
  await storage.init();
  bindEvents();

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab && window.innerWidth <= 820) switchMobileTab(tab);

  await reloadData();
  await renderSettingsPanels();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }
}

bootstrap();
