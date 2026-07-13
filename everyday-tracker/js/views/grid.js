// grid.js — PC planning surface: whole month, clear day anchors, quiet check-off.
import * as S from '../state.js';
import * as M from '../model.js';
import { ringWithLabel } from '../components/ring.js';
import { openAddEdit } from './addEdit.js';

let currentMonthKey = M.currentMonthKey();

export function renderGrid(container, { onMonthChange, onGoDay } = {}) {
  const rows = S.activeRows();
  const days = M.daysOfMonth(currentMonthKey);
  const overallPct = M.overallMonthPct(rows, currentMonthKey);
  const refresh = () => renderGrid(container, { onMonthChange, onGoDay });

  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">
      <h2>Nothing on the grid yet</h2>
      <p>Add your first habit, task, or project — the whole month will lay out automatically.</p>
      <button class="add-row-trigger" id="empty-add"><span class="add-row-spark">+</span><span>Begin with one thing</span></button>
    </div>`;
    container.querySelector('#empty-add').addEventListener('click', () => openAddEdit({ onSaved: refresh }));
    return;
  }

  // A completed one-off task is history, not unfinished work. It stays stored,
  // but leaves both its own row and its project group from the working grid.
  const visibleRows = rows.filter((row) => !M.isTaskComplete(row));
  const topLevelRows = visibleRows.filter((row) => !row.parentProjectId);

  if (!visibleRows.length) {
    container.innerHTML = `<div class="empty-state settled-grid">
      ${ringWithLabel(overallPct, 'This month', { size: 76 })}
      <h2>The grid is clear</h2>
      <p>Your completed tasks are safely part of this month’s record. Add only what deserves your attention next.</p>
      <button class="add-row-trigger" id="empty-add"><span class="add-row-spark">+</span><span>Add a new entry</span></button>
    </div>`;
    container.querySelector('#empty-add').addEventListener('click', () => openAddEdit({ onSaved: refresh }));
    return;
  }

  container.innerHTML = `
    <div class="grid-intro">
      ${ringWithLabel(overallPct, 'This month', { size: 68 })}
      <p class="grid-intro-copy">Choose a day to focus. Tap a circle only when it is truly done.</p>
      <button class="add-row-trigger" id="grid-add"><span class="add-row-spark">+</span><span>Make space for something new</span></button>
    </div>
    <div class="grid-wrap">
      <table class="grid">
        <thead>
          <tr>
            <th class="grid-row-name" style="cursor:default;">Row</th>
            ${days.map(dateHeader).join('')}
          </tr>
        </thead>
        <tbody>${topLevelRows.map((row) => renderRowGroup(row, visibleRows, days)).join('')}</tbody>
      </table>
    </div>
  `;

  container.querySelector('#grid-add')?.addEventListener('click', () => openAddEdit({ onSaved: refresh }));
  container.querySelectorAll('[data-edit]').forEach((el) => {
    el.addEventListener('click', () => openAddEdit({ existingRow: S.rowById(el.dataset.edit), onSaved: refresh }));
  });
  container.querySelectorAll('[data-toggle-project]').forEach((el) => {
    el.addEventListener('click', () => {
      const row = S.rowById(el.dataset.toggleProject);
      row.collapsed = !row.collapsed;
      S.saveRow(row).then(refresh);
    });
  });
  container.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('click', () => S.toggleCompletion(el.dataset.toggle, el.dataset.date).then(refresh));
  });
  container.querySelectorAll('[data-add-task]').forEach((el) => {
    el.addEventListener('click', () => openAddEdit({ parentProjectId: el.dataset.addTask, onSaved: refresh }));
  });
  container.querySelectorAll('[data-goto-day]').forEach((el) => {
    el.addEventListener('click', () => onGoDay && onGoDay(el.dataset.gotoDay));
  });
}

function dateHeader(dateKey) {
  const weekday = M.parseKey(dateKey).toLocaleDateString(undefined, { weekday: 'narrow' });
  return `<th class="grid-date-head ${M.isWeekend(dateKey) ? 'weekend' : ''} ${dateKey === M.todayKey() ? 'is-today' : ''}"
    title="Open ${dateKey}"><button type="button" class="grid-date-button" data-goto-day="${dateKey}" aria-label="Open ${dateKey}"><span>${weekday}</span>${Number(dateKey.split('-')[2])}</button></th>`;
}

function renderRowGroup(row, allRows, days) {
  if (row.type !== M.ROW_TYPES.PROJECT) return renderDataRow(row, days);
  const children = allRows.filter((child) => child.parentProjectId === row.id);
  const header = `<tr class="project-group-header">
    <td class="grid-row-name project-name">
      <button type="button" class="project-toggle" data-toggle-project="${row.id}" aria-expanded="${!row.collapsed}">
        <span class="dot" style="background:${row.color}"></span><span class="project-caret">${row.collapsed ? '▸' : '▾'}</span>${esc(row.name)}
      </button>
      <button type="button" class="project-add" data-add-task="${row.id}" title="Add a task to ${esc(row.name)}" aria-label="Add a task to ${esc(row.name)}">+</button>
    </td>
    ${days.map(() => '<td></td>').join('')}
  </tr>`;
  const childRows = row.collapsed ? '' : children.map((child) => renderDataRow(child, days)).join('');
  return header + childRows;
}

function renderDataRow(row, days) {
  const pct = M.rowMonthPct(row, currentMonthKey);
  const overdue = M.isTaskOverdue(row) || M.isBoundedOverdue(row);
  const dueLabel = row.type === M.ROW_TYPES.TASK
    ? `Due ${M.parseKey(row.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '';
  return `<tr>
    <td class="grid-row-name ${overdue ? 'is-overdue' : ''}" style="${row.parentProjectId ? 'padding-left:28px !important; font-weight:500;' : ''}">
      <button type="button" class="row-edit" data-edit="${row.id}" aria-label="Edit ${esc(row.name)}">
        <span class="dot" style="background:${row.color}"></span>${esc(row.name)}
        ${overdue ? '<span class="row-status overdue-status">Needs attention</span>' : (dueLabel ? `<span class="row-status">${dueLabel}</span>` : '')}
      </button>
      ${pct !== null ? `<span class="row-percent">${pct}%</span>` : ''}
    </td>
    ${days.map((dateKey) => cell(row, dateKey)).join('')}
  </tr>`;
}

function cell(row, dateKey) {
  const active = M.isRowActiveOnDate(row, dateKey);
  if (!active) return '<td class="grid-cell out-of-range"></td>';
  const checked = !!(row.completions && row.completions[dateKey]);
  const overdue = (row.type === M.ROW_TYPES.TASK && row.dueDate === dateKey && M.isTaskOverdue(row))
    || (row.type === M.ROW_TYPES.BOUNDED && dateKey === row.endDate && M.isBoundedOverdue(row));
  const checkable = M.isCheckable(dateKey);
  const state = checked ? 'Complete' : (checkable ? 'Mark complete' : 'Read only');
  return `<td class="grid-cell ${overdue ? 'overdue' : ''} ${checkable ? '' : 'read-only'}">
    <button type="button" class="grid-cell-button" data-toggle="${row.id}" data-date="${dateKey}" ${checkable ? '' : 'disabled'} aria-label="${state}: ${esc(row.name)} on ${dateKey}">
      <span class="mini ${checked ? 'done' : ''}"></span>
    </button>
  </td>`;
}

export function setGridMonth(monthKey) { currentMonthKey = monthKey; }
export function getGridMonth() { return currentMonthKey; }
export function shiftGridMonth(delta) { currentMonthKey = M.shiftMonth(currentMonthKey, delta); return currentMonthKey; }

function esc(value = '') { return String(value).replace(/[<>&"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[char])); }
