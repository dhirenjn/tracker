// today.js — mobile default view: sectioned, tap-once check-off list.
import * as S from '../state.js';
import * as M from '../model.js';
import { ICONS } from '../components/ring.js';
import { openAddEdit } from './addEdit.js';

export function renderToday(container, { onOpenGrid } = {}) {
  const todayStr = M.todayKey();
  const rows = S.activeRows();
  const refresh = () => renderToday(container, { onOpenGrid });

  const habits = rows.filter((r) => r.type === M.ROW_TYPES.HABIT);
  const weekly = rows.filter((r) => r.type === M.ROW_TYPES.WEEKLY);
  const tasks = rows.filter((r) => r.type === M.ROW_TYPES.TASK && !r.parentProjectId && M.isRelevantToday(r, todayStr) && !M.isTaskComplete(r));
  const projects = rows.filter((r) => r.type === M.ROW_TYPES.PROJECT);
  const bounded = rows.filter((r) => r.type === M.ROW_TYPES.BOUNDED && M.isRelevantToday(r, todayStr));

  if (!rows.length) {
    container.innerHTML = emptyState();
    bindEmptyState(container, refresh);
    return;
  }

  const sections = [];
  if (habits.length) sections.push(section('Habits', habits.map((r) => habitRow(r, todayStr))));
  if (tasks.length) sections.push(section("Today's tasks", tasks.map((r) => taskRow(r, todayStr))));
  const projectRows = projects.map((p) => projectTodayRow(p, rows, todayStr)).filter(Boolean);
  if (projectRows.length) sections.push(section('Active projects', projectRows));
  if (bounded.length) sections.push(section('Bounded projects', bounded.map((r) => boundedRow(r, todayStr))));
  if (weekly.length) sections.push(section('Weekly slot', weekly.map((r) => weeklyRow(r, todayStr))));

  const recurringRows = [...habits, ...weekly, ...bounded];
  const allDone = (recurringRows.length + tasks.length + projectRows.length) > 0
    && recurringRows.every((r) => r.completions && r.completions[todayStr])
    && tasks.length === 0 && projectRows.length === 0;

  container.innerHTML = `
    <div class="today-header" style="margin-bottom:6px;">
      <h2 style="font-size:20px;">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      <button type="button" class="link-to-grid" id="open-grid-link">Open full grid →</button>
    </div>
    ${sections.join('') || `<div class="all-done">Nothing scheduled today ✨</div>`}
    ${allDone ? `<div class="all-done">All settled for today ✨</div>` : ''}
  `;

  container.querySelector('#open-grid-link')?.addEventListener('click', () => onOpenGrid && onOpenGrid());

  container.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      await S.toggleCompletion(el.dataset.toggle, el.dataset.date);
      refresh();
    });
  });
  container.querySelectorAll('[data-edit]').forEach((el) => {
    el.addEventListener('click', () => {
      const row = S.rowById(el.dataset.edit);
      openAddEdit({ existingRow: row, onSaved: refresh });
    });
  });
  container.querySelectorAll('[data-toggle-project]').forEach((el) => {
    el.addEventListener('click', () => {
      const row = S.rowById(el.dataset.toggleProject);
      row.collapsed = !row.collapsed;
      S.saveRow(row).then(refresh);
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
      style="${checkable ? '' : 'opacity:.4; pointer-events:none;'}">${ICONS.check}</div>`;
}

function habitRow(row, todayStr) {
  const done = !!(row.completions && row.completions[todayStr]);
  const monthPct = M.habitMonthPct(row, M.currentMonthKey());
  return `<div class="today-row" data-edit="${row.id}">
    <span class="chip" style="background:${row.color}"></span>
    ${checkbox(row.id, todayStr, done, true)}
    <div class="body">
      <div class="title">${esc(row.name)}</div>
      <div class="meta">${row.cadenceCount}x/week &middot; ${monthPct}% this month</div>
    </div>
  </div>`;
}

function taskRow(row, todayStr) {
  const overdue = M.isTaskOverdue(row);
  const done = M.isTaskComplete(row);
  if (done) return '';
  const checkable = M.isCheckable(row.dueDate) || M.isCheckable(todayStr);
  return `<div class="today-row ${overdue ? 'overdue' : ''}">
    <span class="chip" style="background:${row.color}"></span>
    ${checkbox(row.id, checkableDate(row, todayStr), done, checkable)}
    <div class="body" data-edit="${row.id}">
      <div class="title">${esc(row.name)}</div>
      <div class="meta">${overdue ? 'Overdue &middot; ' : ''}Due ${row.dueDate}</div>
    </div>
  </div>`;
}
function checkableDate(row, todayStr) {
  return M.isCheckable(row.dueDate) ? row.dueDate : todayStr;
}

function boundedRow(row, todayStr) {
  const overdue = M.isBoundedOverdue(row);
  const done = !!(row.completions && row.completions[todayStr]);
  const inRange = todayStr >= row.startDate && todayStr <= row.endDate;
  return `<div class="today-row ${overdue ? 'overdue' : ''}">
    <span class="chip" style="background:${row.color}"></span>
    ${checkbox(row.id, todayStr, done, inRange)}
    <div class="body" data-edit="${row.id}">
      <div class="title">${esc(row.name)}</div>
      <div class="meta">${overdue ? 'Overdue &middot; ' : ''}${row.startDate} → ${row.endDate}</div>
    </div>
  </div>`;
}

function weeklyRow(row, todayStr) {
  const done = !!(row.completions && row.completions[todayStr]);
  return `<div class="today-row">
    <span class="chip" style="background:${row.color}"></span>
    ${checkbox(row.id, todayStr, done, true)}
    <div class="body" data-edit="${row.id}">
      <div class="title">${esc(row.weeklyTitle || 'Set this week\'s focus')}</div>
      <div class="sub">${esc(row.name)}</div>
    </div>
  </div>`;
}

function projectTodayRow(project, allRows, todayStr) {
  const children = allRows.filter((r) => r.parentProjectId === project.id && r.type === M.ROW_TYPES.TASK);
  const relevant = children.filter((c) => M.isRelevantToday(c, todayStr) && !M.isTaskComplete(c));
  if (!relevant.length) return null;
  const sub = relevant[0];
  const overdue = M.isTaskOverdue(sub);
  const done = M.isTaskComplete(sub);
  return `<div class="today-row ${overdue ? 'overdue' : ''}">
    <span class="chip" style="background:${project.color}"></span>
    ${checkbox(sub.id, checkableDate(sub, todayStr), done, M.isCheckable(sub.dueDate) || M.isCheckable(todayStr))}
    <div class="body" data-edit="${sub.id}">
      <div class="title">${esc(sub.name)}</div>
      <div class="sub">${esc(project.name)}${relevant.length > 1 ? ` &middot; +${relevant.length - 1} more today` : ''}</div>
    </div>
  </div>`;
}

function emptyState() {
  return `<div class="empty-state">
    <h2>Your day, empty for now</h2>
    <p>Add a habit, a task, or a project to start tracking. It all works offline — nothing leaves your device unless you set up sync later.</p>
    <button class="btn btn-primary" id="empty-add">Add your first row</button>
  </div>`;
}
function bindEmptyState(container, refresh) {
  container.querySelector('#empty-add')?.addEventListener('click', () => {
    openAddEdit({ onSaved: refresh });
  });
}

function esc(s = '') { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
