// calendar.js — full month calendar overlay; tap a day → day view.
import * as M from '../model.js';
import { ICONS } from './ring.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function calendarCells(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMo = M.daysInMonth(monthKey);
  const startOffset = (first.getDay() + 6) % 7; // Monday-start
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMo; d++) {
    cells.push(`${y}-${M.pad2(m)}-${M.pad2(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function openMonthCalendar(monthKey, { onSelectDay, onMonthChange } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'calendar-scrim';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', `Calendar for ${M.monthLabel(monthKey)}`);

  let current = monthKey;

  function render() {
    const today = M.todayKey();
    const cells = calendarCells(current);
    overlay.innerHTML = `
      <div class="calendar-panel">
        <div class="calendar-header">
          <button type="button" class="cal-nav" data-cal-prev aria-label="Previous month">${ICONS.chevronLeft}</button>
          <div class="cal-title-wrap"><span class="cal-month-title">${M.monthLabel(current)}</span></div>
          <button type="button" class="cal-nav" data-cal-next aria-label="Next month">${ICONS.chevronRight}</button>
          <button type="button" class="cal-close" data-cal-close aria-label="Close">${ICONS.x}</button>
        </div>
        <div class="calendar-weekdays">
          ${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}
        </div>
        <div class="calendar-grid">
          ${cells.map((dk) => {
            if (!dk) return '<span class="cal-cell empty"></span>';
            const day = Number(dk.split('-')[2]);
            const isToday = dk === today;
            const isWeekend = M.isWeekend(dk);
            return `<button type="button" class="cal-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}"
              data-day="${dk}">${day}</button>`;
          }).join('')}
        </div>
        <div class="calendar-footer">
          <p class="calendar-hint">Choose a day to open its focused view</p>
          <button type="button" class="calendar-today" data-cal-today>Today</button>
        </div>
      </div>
    `;

    overlay.querySelector('[data-cal-prev]').addEventListener('click', () => {
      current = M.shiftMonth(current, -1);
      render();
    });
    overlay.querySelector('[data-cal-next]').addEventListener('click', () => {
      current = M.shiftMonth(current, 1);
      render();
    });
    overlay.querySelector('[data-cal-today]').addEventListener('click', () => {
      current = M.currentMonthKey();
      render();
    });
    overlay.querySelector('[data-cal-close]').addEventListener('click', close);
    overlay.querySelectorAll('[data-day]').forEach((btn) => {
      btn.addEventListener('click', () => {
        close();
        onMonthChange && onMonthChange(current);
        onSelectDay && onSelectDay(btn.dataset.day, current);
      });
    });
  }

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  render();
  return { close, getMonth: () => current };
}
