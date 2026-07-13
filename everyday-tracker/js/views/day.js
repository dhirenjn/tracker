// day.js — focused single-day view (from calendar tap or deep link).
import * as S from '../state.js';
import * as M from '../model.js';
import { ICONS } from '../components/ring.js';
import { openAddEdit } from './addEdit.js';

export function renderDay(container, dateKey, { onRefresh } = {}) {
  const rows = S.activeRows();
  const d = M.parseKey(dateKey);
  const isToday = dateKey === M.todayKey();
  const isFuture = M.daysBetweenToday(dateKey) < 0;
  const isPastReadOnly = M.daysBetweenToday(dateKey) > M.BACKFILL_DAYS;

  const habits = rows.filter((r) => r.type === M.ROW_TYPES.HABIT);
  const weekly = rows.filter((r) => r.type === M.ROW_TYPES.WEEKLY);
  const tasks = rows.filter((r) =>
    r.type === M.ROW_TYPES.TASK && !r.parentProjectId &&
    !M.isTaskComplete(r) &&
    (r.dueDate === dateKey || (isToday && M.isTaskOverdue(r)))
  );
  const bounded = rows.filter((r) =>
    r.type === M.ROW_TYPES.BOUNDED &&
    dateKey >= r.startDate && dateKey <= r.endDate
  );
  const projects = rows.filter((r) => r.type === M.ROW_TYPES.PROJECT);

  const sections = [];
  if (habits.length) sections.push(section('Habits', habits.map((r) => rowItem(r, dateKey, isPastReadOnly))));
  if (tasks.length) sections.push(section('Tasks', tasks.map((r) => taskItem(r, dateKey, isPastReadOnly))));
  if (projects.length) {
    const pr = projects.map((p) => projectItem(p, rows, dateKey, isPastReadOnly)).filter(Boolean);
    if (pr.length) sections.push(section('Projects', pr));
  }
  if (bounded.length) sections.push(section('Bounded', bounded.map((r) => rowItem(r, dateKey, isPastReadOnly))));
  if (weekly.length) sections.push(section('Weekly slot', weekly.map((r) => rowItem(r, dateKey, isPastReadOnly))));

  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const longDate = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

  container.innerHTML = `
    <div class="day-hero">
      <div class="day-hero-date">
        <span class="day-hero-weekday">${weekday}</span>
        <span class="day-hero-full">${longDate}</span>
      </div>
      ${isToday ? '<span class="day-pill today">Today</span>' : ''}
      ${isFuture ? '<span class="day-pill future">Upcoming</span>' : ''}
      ${isPastReadOnly ? '<span class="day-pill memory">Memory only</span>' : ''}
    </div>
    ${sections.length ? sections.join('') : `<div class="day-empty">
      <p>Nothing scheduled for this day.</p>
      <p class="hint">Add a habit or task with this date to see it here.</p>
    </div>`}
  `;

  container.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      await S.toggleCompletion(el.dataset.toggle, el.dataset.date);
      onRefresh && onRefresh();
    });
  });
  container.querySelectorAll('[data-edit]').forEach((el) => {
    el.addEventListener('click', () => {
      openAddEdit({ existingRow: S.rowById(el.dataset.edit), onSaved: onRefresh });
    });
  });
}

function section(title, rowsHtml) {
  return `<div class="today-section">
    <div class="section-title">${title}</div>
    <div class="today-list">${rowsHtml.join('')}</div>
  </div>`;
}

function checkbox(rowId, dateStr, done, checkable) {
  return `<div class="checkbox ${done ? 'done' : ''}" data-toggle="${rowId}" data-date="${dateStr}"
    style="${checkable ? '' : 'opacity:.35; pointer-events:none;'}">${ICONS.check}</div>`;
}

function rowItem(row, dateKey, readOnly) {
  const done = !!(row.completions && row.completions[dateKey]);
  const checkable = !readOnly && M.isCheckable(dateKey);
  return `<div class="today-row" data-edit="${row.id}">
    <span class="chip" style="background:${row.color}"></span>
    ${checkbox(row.id, dateKey, done, checkable)}
    <div class="body"><div class="title">${esc(row.name)}</div></div>
  </div>`;
}

function taskItem(row, dateKey, readOnly) {
  const overdue = M.isTaskOverdue(row);
  const done = M.isTaskComplete(row);
  if (done) return '';
  const checkable = !readOnly && (M.isCheckable(row.dueDate) || M.isCheckable(dateKey));
  const toggleDate = M.isCheckable(row.dueDate) ? row.dueDate : dateKey;
  return `<div class="today-row ${overdue ? 'overdue' : ''}">
    <span class="chip" style="background:${row.color}"></span>
    ${checkbox(row.id, toggleDate, done, checkable)}
    <div class="body" data-edit="${row.id}">
      <div class="title">${esc(row.name)}</div>
      <div class="meta">${overdue ? 'Overdue · ' : ''}Due ${row.dueDate}</div>
    </div>
  </div>`;
}

function projectItem(project, allRows, dateKey, readOnly) {
  const children = allRows.filter((r) => r.parentProjectId === project.id && r.type === M.ROW_TYPES.TASK && !M.isTaskComplete(r));
  const relevant = children.filter((c) => c.dueDate === dateKey || (dateKey === M.todayKey() && M.isTaskOverdue(c)));
  if (!relevant.length) return null;
  const sub = relevant[0];
  const overdue = M.isTaskOverdue(sub);
  const done = M.isTaskComplete(sub);
  if (done) return null;
  const checkable = !readOnly && (M.isCheckable(sub.dueDate) || M.isCheckable(dateKey));
  return `<div class="today-row ${overdue ? 'overdue' : ''}">
    <span class="chip" style="background:${project.color}"></span>
    ${checkbox(sub.id, M.isCheckable(sub.dueDate) ? sub.dueDate : dateKey, done, checkable)}
    <div class="body" data-edit="${sub.id}">
      <div class="title">${esc(sub.name)}</div>
      <div class="sub">${esc(project.name)}</div>
    </div>
  </div>`;
}

function esc(s = '') { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
