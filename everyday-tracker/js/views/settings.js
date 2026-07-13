// settings.js — Sync, Notifications, Appearance, Data (export/import, archive).
import * as S from '../state.js';
import * as M from '../model.js';
import { exportAllData, importAllData } from '../db.js';
import { toast, confirmDialog, openSheet } from '../components/ui.js';

export function renderSettings(container) {
  const s = S.state.settings;
  const archived = S.state.rows.filter((r) => r.archived);

  container.innerHTML = `
    <div class="settings-hero">
      <p class="settings-kicker">Preferences</p>
      <h2>Settings</h2>
    </div>

    <div class="settings-section">
      <div class="section-title">Sync</div>
      <div class="card">
        <p style="font-size:13.5px; color:var(--ink-soft); line-height:1.5; margin:0 0 10px;">
          Not connected yet. Everything is stored only on this device right now — fully usable offline.
          Cross-device sync uses your own free self-hosted server; set it up any time from the guide, no rush.
        </p>
        <button class="btn btn-ghost btn-sm" disabled>Add a device (set up sync first)</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">Notifications</div>
      <div class="settings-row">
        <div><div class="l">Task due-date reminders</div><div class="d">Only tasks with a due date notify — habits and projects stay quiet.</div></div>
        <button class="switch ${s.notificationsEnabled ? 'on' : ''}" id="notif-toggle"></button>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">Appearance</div>
      <div class="settings-row">
        <div><div class="l">Dark mode</div></div>
        <button class="switch ${s.theme === 'dark' ? 'on' : ''}" id="theme-toggle"></button>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">Data</div>
      <div class="settings-row"><div class="l">Export your data</div>
        <button class="btn btn-ghost btn-sm" id="export-btn">Export</button></div>
      <div class="settings-row"><div class="l">Import from a backup</div>
        <button class="btn btn-ghost btn-sm" id="import-btn">Import</button>
        <input type="file" accept="application/json" id="import-file" style="display:none;"></div>
      <div class="settings-row"><div class="l">Archived rows (${archived.length})</div>
        <button class="btn btn-ghost btn-sm" id="archived-btn">${archived.length ? 'View' : 'None'}</button></div>
    </div>

    <div class="settings-section">
      <div class="section-title">About</div>
      <p style="font-size:12.5px; color:var(--ink-faint); line-height:1.6;">
        Everyday Tracker runs entirely in your browser. No account, no ads, no third party ever
        sees your data unless you turn on AI Insights or Sync yourself.
      </p>
    </div>
  `;

  container.querySelector('#notif-toggle').addEventListener('click', async () => {
    const on = !s.notificationsEnabled;
    if (on && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('Notifications blocked in the browser'); return; }
    }
    await S.saveSettings({ notificationsEnabled: on });
    renderSettings(container);
  });

  container.querySelector('#theme-toggle').addEventListener('click', async () => {
    const theme = s.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    await S.saveSettings({ theme });
    renderSettings(container);
  });

  container.querySelector('#export-btn').addEventListener('click', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `everyday-tracker-backup-${M.todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  });

  const fileInput = container.querySelector('#import-file');
  container.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const ok = await confirmDialog('Import backup?', 'This replaces everything currently stored on this device with the contents of the backup file.', 'Import');
    if (!ok) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await importAllData(data);
      await S.loadAll();
      toast('Backup imported');
      renderSettings(container);
    } catch (err) {
      toast('That file could not be read');
    }
  });

  container.querySelector('#archived-btn').addEventListener('click', () => {
    if (!archived.length) return;
    showArchived(archived, () => renderSettings(container));
  });
}

function showArchived(archived, onChange) {
  const { close, sheetEl } = openSheet(`
    <div class="sheet-header"><h3 class="sheet-title">Archived rows</h3><button class="close-x" data-close-sheet>&times;</button></div>
    ${archived.map((r) => `
      <div class="settings-row"><div class="l">${r.name}</div>
        <button class="btn btn-ghost btn-sm" data-restore="${r.id}">Restore</button></div>`).join('')}
  `);
  sheetEl.querySelectorAll('[data-restore]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await S.restoreRow(btn.dataset.restore);
      toast('Row restored');
      close();
      onChange();
    });
  });
}
