// gallery.js — reverse-chronological record of every completed month.
import * as S from '../state.js';
import * as M from '../model.js';
import { openSheet } from '../components/ui.js';
import { ICONS } from '../components/ring.js';

export function renderGallery(container, { onOpenMonth } = {}) {
  const records = S.state.monthRecords;
  if (!records.length) {
    container.innerHTML = `<div class="empty-state">
      <h2>Your growth gallery is empty — for now</h2>
      <p>After your first month wraps up, its photo and reflection will appear here, alongside how consistent you were.</p>
    </div>`;
    return;
  }
  container.innerHTML = `
    <h2 style="margin-bottom:16px;">Growth gallery</h2>
    <div class="gallery-grid">
      ${records.map((r) => card(r)).join('')}
    </div>`;

  container.querySelectorAll('[data-open-record]').forEach((el) => {
    el.addEventListener('click', () => {
      const rec = records.find((r) => r.id === el.dataset.openRecord);
      openDetail(rec, onOpenMonth);
    });
  });
}

function card(r) {
  if (r.away) {
    return `<div class="gallery-card"><div class="away-card">No entry — away this month<br><strong>${M.monthLabel(r.monthKey)}</strong></div></div>`;
  }
  return `<div class="gallery-card" data-open-record="${r.id}">
    ${r.photo ? `<img src="${r.photo}">` : `<div style="aspect-ratio:1; background:var(--paper-dim);"></div>`}
    <div class="info">
      <span class="badge">${r.completionPct ?? 0}%</span>
      <div class="m">${M.monthLabel(r.monthKey)}</div>
      <div class="r">${esc(r.reflection || '')}</div>
    </div>
  </div>`;
}

function openDetail(r, onOpenMonth) {
  const { close, sheetEl } = openSheet(`
    <div class="sheet-header"><h3 class="sheet-title">${M.monthLabel(r.monthKey)}</h3>
      <button class="close-x" data-close-sheet>${ICONS.x}</button></div>
    ${r.photo ? `<img src="${r.photo}" style="width:100%; border-radius: var(--radius-m); margin-bottom:14px;">` : ''}
    <p style="line-height:1.6; margin-bottom:10px;">${esc(r.reflection || '')}</p>
    <p style="font-family:var(--font-mono); font-size:12.5px; color:var(--ink-faint);">Completion: ${r.completionPct ?? 0}%</p>
    <button type="button" class="tap-confirm" id="open-grid-month" style="margin-top:18px; width:100%;">Open ${M.monthLabel(r.monthKey)} in grid</button>
    <p style="font-size:12px; color:var(--ink-faint); margin-top:14px;">This record is permanent — an honest snapshot of how that month actually went.</p>
  `);
  sheetEl.querySelector('#open-grid-month')?.addEventListener('click', () => {
    close();
    onOpenMonth && onOpenMonth(r.monthKey);
  });
}

function esc(s = '') { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
