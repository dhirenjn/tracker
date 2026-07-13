// datePicker.js — infinite-scroll date strip. One continuous timeline, no month picker.
import * as M from '../model.js';
import { openSheet } from './ui.js';
import { ICONS } from './ring.js';

const ITEM_H = 52;
const BUFFER = 40;

function formatDayLabel(dateKey) {
  const d = M.parseKey(dateKey);
  const today = M.todayKey();
  if (dateKey === today) return 'Today';
  const diff = M.daysBetweenToday(dateKey);
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMonthDivider(dateKey) {
  return M.monthLabel(M.monthKeyOf(dateKey));
}

function addDays(dateKey, delta) {
  const d = M.parseKey(dateKey);
  d.setDate(d.getDate() + delta);
  return M.dateKey(d);
}

function buildDayItem(dateKey, selected) {
  const isToday = dateKey === M.todayKey();
  const dayNum = M.parseKey(dateKey).getDate();
  const isWeekend = M.isWeekend(dateKey);
  return `<button type="button" class="scroll-day ${selected ? 'selected' : ''} ${isToday ? 'is-today' : ''} ${isWeekend ? 'weekend' : ''}"
    data-date="${dateKey}" role="option" aria-selected="${selected}">
    <span class="scroll-day-label">${formatDayLabel(dateKey)}</span>
    <span class="scroll-day-num">${dayNum}</span>
  </button>`;
}

function isFirstOfMonth(dateKey) {
  return dateKey.endsWith('-01');
}

/** Opens infinite-scroll date picker; returns selected ISO date string or null. */
export function pickDate({ value = M.todayKey(), title = 'Pick a date' } = {}) {
  return new Promise((resolve) => {
    let selected = value;
    let settled = false;

    const { close, sheetEl } = openSheet(`
      <div class="sheet-header">
        <h3 class="sheet-title">${title}</h3>
        <button type="button" class="close-x" data-close-sheet aria-label="Close">${ICONS.x}</button>
      </div>
      <div class="scroll-picker-wrap">
        <p class="date-picker-note">Scroll continuously to find a day. This does not move your month grid.</p>
        <div class="scroll-picker-window" aria-label="Scroll to choose date">
          <div class="scroll-picker-highlight"></div>
          <div class="scroll-picker-list" tabindex="0"></div>
        </div>
        <div class="scroll-picker-footer">
          <span class="scroll-picker-selected" id="picker-preview" aria-live="polite"></span>
          <button type="button" class="tap-confirm" id="picker-confirm">Set date</button>
        </div>
      </div>
    `, {
      onClose: () => { if (!settled) resolve(null); },
    });

    const list = sheetEl.querySelector('.scroll-picker-list');
    const preview = sheetEl.querySelector('#picker-preview');
    const confirmBtn = sheetEl.querySelector('#picker-confirm');
    const windowEl = sheetEl.querySelector('.scroll-picker-window');

    let anchor = selected;
    let topIndex = -BUFFER;
    let bottomIndex = BUFFER;
    let scrollRaf = null;

    function updatePreview() {
      preview.textContent = M.parseKey(selected).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      });
    }

    function dateAtIndex(i) {
      return addDays(anchor, i);
    }

    function renderRange(from, to, prepend = false) {
      const frag = document.createDocumentFragment();
      for (let i = from; i <= to; i++) {
        const dk = dateAtIndex(i);
        if (isFirstOfMonth(dk)) {
          const div = document.createElement('div');
          div.className = 'scroll-month-divider';
          div.textContent = formatMonthDivider(dk);
          div.dataset.index = String(i);
          frag.appendChild(div);
        }
        const btn = document.createElement('div');
        btn.innerHTML = buildDayItem(dk, dk === selected);
        const el = btn.firstElementChild;
        el.dataset.index = String(i);
        el.addEventListener('click', () => snapToIndex(i));
        frag.appendChild(el);
      }
      if (prepend) {
        const h = list.scrollHeight;
        list.insertBefore(frag, list.firstChild);
        list.scrollTop += list.scrollHeight - h;
      } else {
        list.appendChild(frag);
      }
    }

    function indexOfSelected() {
      const diff = Math.round((M.parseKey(selected) - M.parseKey(anchor)) / 86400000);
      return diff;
    }

    function highlightSelected() {
      list.querySelectorAll('.scroll-day').forEach((el) => {
        const on = el.dataset.date === selected;
        el.classList.toggle('selected', on);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    function snapToIndex(i) {
      const center = windowEl.clientHeight / 2;
      const el = list.querySelector(`[data-index="${i}"]`);
      if (!el) return;
      list.scrollTop = el.offsetTop - center + ITEM_H / 2;
      selected = dateAtIndex(i);
      highlightSelected();
      updatePreview();
    }

    function onScroll() {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        const center = list.scrollTop + windowEl.clientHeight / 2;
        const items = [...list.querySelectorAll('.scroll-day')];
        let closest = items[0];
        let minDist = Infinity;
        items.forEach((el) => {
          const mid = el.offsetTop + el.offsetHeight / 2;
          const dist = Math.abs(mid - center);
          if (dist < minDist) { minDist = dist; closest = el; }
        });
        if (closest) {
          selected = closest.dataset.date;
          highlightSelected();
          updatePreview();
        }

        if (list.scrollTop < ITEM_H * 8) {
          const oldTop = topIndex;
          topIndex -= BUFFER;
          renderRange(oldTop - BUFFER, oldTop - 1, true);
        }
        if (list.scrollHeight - list.scrollTop - windowEl.clientHeight < ITEM_H * 8) {
          const oldBottom = bottomIndex;
          bottomIndex += BUFFER;
          renderRange(oldBottom + 1, oldBottom + BUFFER, false);
        }
      });
    }

    renderRange(topIndex, bottomIndex, false);
    updatePreview();
    requestAnimationFrame(() => snapToIndex(indexOfSelected()));

    list.addEventListener('scroll', onScroll, { passive: true });

    confirmBtn.addEventListener('click', () => {
      settled = true;
      close();
      resolve(selected);
    });
  });
}

/** Inline trigger — tap field opens scroll picker, not native date input. */
export function bindDateField(container, inputId, { title } = {}) {
  const hidden = container.querySelector(`#${inputId}`);
  if (!hidden) return;
  const wrap = document.createElement('div');
  wrap.className = 'date-field-tap';
  wrap.innerHTML = `
    <button type="button" class="date-field-display" id="${inputId}-display" aria-haspopup="dialog">
      <span class="date-field-icon">📅</span>
      <span class="date-field-text"></span>
      <span class="date-field-chevron">${ICONS.chevronRight}</span>
    </button>
  `;
  hidden.type = 'hidden';
  hidden.parentNode.insertBefore(wrap, hidden);
  wrap.appendChild(hidden);

  const display = wrap.querySelector('.date-field-text');
  const btn = wrap.querySelector('.date-field-display');

  function refresh() {
    const v = hidden.value || M.todayKey();
    display.textContent = M.parseKey(v).toLocaleDateString(undefined, {
      weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    });
  }
  refresh();

  btn.addEventListener('click', async () => {
    const picked = await pickDate({ value: hidden.value || M.todayKey(), title });
    if (picked) {
      hidden.value = picked;
      refresh();
    }
  });
}
