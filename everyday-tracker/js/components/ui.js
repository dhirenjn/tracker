// ui.js — toast + modal sheet helpers shared across views.
export function toast(msg, ms = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function openSheet(innerHTML, { onClose } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet">${innerHTML}</div>`;
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  document.body.appendChild(scrim);
  let closed = false;
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    scrim.remove();
    if (onClose) onClose();
  }
  const sheetEl = scrim.querySelector('.sheet');
  sheetEl.querySelectorAll('[data-close-sheet]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', onKey);
  return { close, sheetEl };
}

export function confirmDialog(title, body, confirmLabel = 'Confirm') {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value, close) => {
      if (settled) return;
      settled = true;
      close();
      resolve(value);
    };
    const { close, sheetEl } = openSheet(`
      <div class="sheet-header"><h3 class="sheet-title">${title}</h3>
        <button class="close-x" data-close-sheet>&times;</button></div>
      <p style="color:var(--ink-soft); font-size:14px; line-height:1.5; margin-bottom:18px;">${body}</p>
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button class="btn btn-ghost" id="cd-cancel">Cancel</button>
        <button class="btn btn-danger" id="cd-ok">${confirmLabel}</button>
      </div>
    `, { onClose: () => { if (!settled) { settled = true; resolve(false); } } });
    sheetEl.querySelector('#cd-cancel').addEventListener('click', () => settle(false, close));
    sheetEl.querySelector('#cd-ok').addEventListener('click', () => settle(true, close));
  });
}

export function escapeHTML(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
