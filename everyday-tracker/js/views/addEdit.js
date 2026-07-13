// addEdit.js — the Add/Edit Row flow: pick type -> fill fields -> save.
// Every row (manual or from an AI Insights draft) goes through this same form.
import * as S from '../state.js';
import * as M from '../model.js';
import { openSheet, toast, confirmDialog } from '../components/ui.js';
import { bindDateField } from '../components/datePicker.js';
import { ICONS } from '../components/ring.js';

const TYPE_ICON = {
  habit: '🔁', task: '📌', boundedProject: '⏳', weeklySlot: '💡', project: '🗂️',
};

export function openAddEdit({ existingRow = null, parentProjectId = null, onSaved = null } = {}) {
  if (existingRow) {
    renderForm(existingRow.type, existingRow, parentProjectId, onSaved);
    return;
  }
  const drafts = S.state.drafts;
  const { close, sheetEl } = openSheet(`
    <div class="sheet-header"><div><p class="form-step">Step 1 of 2</p><h3 class="sheet-title">What are you making space for?</h3></div>
      <button class="close-x" data-close-sheet>${ICONS.x}</button></div>
    ${drafts.length ? `<div id="draft-list">${drafts.map((d) => `
      <div class="draft-card" data-draft="${d.id}">
        <div class="src">${d.sourceLabel || 'From AI Insights'}</div>
        <div style="font-weight:600; font-size:14px; margin-top:2px;">${d.prefill?.name || 'Suggested row'}</div>
      </div>`).join('')}</div>` : ''}
    <div class="type-cards">
      ${Object.entries(M.TYPE_META).map(([type, meta]) => `
        <button type="button" class="type-card" data-type="${type}">
          <div class="ic" style="font-size:22px;">${TYPE_ICON[type]}</div>
          <div class="t">${meta.label}</div>
          <div class="e">${meta.example}</div>
        </button>`).join('')}
    </div>
  `);
  sheetEl.querySelectorAll('.type-card').forEach((card) => {
    card.addEventListener('click', () => {
      close();
      renderForm(card.dataset.type, null, parentProjectId, onSaved);
    });
  });
  sheetEl.querySelectorAll('[data-draft]').forEach((card) => {
    card.addEventListener('click', () => {
      const draft = drafts.find((d) => d.id === card.dataset.draft);
      close();
      renderForm(draft.type, { ...draft.prefill, _draftId: draft.id }, parentProjectId, onSaved);
    });
  });
}

function fieldsFor(type, row) {
  const name = row?.name || '';
  const color = row?.color || '';
  const swatches = `
    <div class="field"><label>Color</label>
      <div class="color-swatches">
        ${M.PALETTE.map((c) => `<span class="swatch ${c === color ? 'selected' : ''}" data-color="${c}" style="background:${c}"></span>`).join('')}
      </div>
    </div>`;

  if (type === M.ROW_TYPES.HABIT) {
    return `
      <div class="field"><label>Name</label><input type="text" id="f-name" value="${esc(name)}" placeholder="e.g. Meditate"></div>
      <div class="field"><label>Times per week</label><input type="number" id="f-cadence" min="1" max="7" value="${row?.cadenceCount || 3}"></div>
      <p class="hint">Floating cadence — any days you pick that week count, not fixed weekdays.</p>
      ${swatches}`;
  }
  if (type === M.ROW_TYPES.TASK) {
    return `
      <div class="field"><label>Name</label><input type="text" id="f-name" value="${esc(name)}" placeholder="e.g. Submit assignment"></div>
      <div class="field"><label>Due date</label><input type="hidden" id="f-due" value="${row?.dueDate || M.todayKey()}"></div>
      ${swatches}`;
  }
  if (type === M.ROW_TYPES.BOUNDED) {
    return `
      <div class="field"><label>Name</label><input type="text" id="f-name" value="${esc(name)}" placeholder="e.g. Build landing page"></div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input type="hidden" id="f-start" value="${row?.startDate || M.todayKey()}"></div>
        <div class="field"><label>End date</label><input type="hidden" id="f-end" value="${row?.endDate || M.todayKey()}"></div>
      </div>
      ${swatches}`;
  }
  if (type === M.ROW_TYPES.WEEKLY) {
    return `
      <div class="field"><label>Slot name</label><input type="text" id="f-name" value="${esc(name || 'Weekly slot')}" placeholder="e.g. This week's idea"></div>
      <div class="field"><label>This week's title</label><input type="text" id="f-weekly" value="${esc(row?.weeklyTitle || '')}" placeholder="What are you exploring this week?"></div>
      ${swatches}`;
  }
  if (type === M.ROW_TYPES.PROJECT) {
    return `
      <div class="field"><label>Project name</label><input type="text" id="f-name" value="${esc(name)}" placeholder="e.g. Short film"></div>
      ${swatches}
      <p class="hint">You'll add the first task next.</p>`;
  }
  return '';
}

function esc(s = '') {
  return String(s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderForm(type, existingRow, parentProjectId, onSaved) {
  const isEdit = !!(existingRow && existingRow.id);
  const meta = M.TYPE_META[type];
  const { close, sheetEl } = openSheet(`
    <div class="sheet-header">
      <div><p class="form-step">${isEdit ? 'Refine this entry' : 'Step 2 of 2'}</p><h3 class="sheet-title">${isEdit ? 'Edit' : 'Add'} ${meta.label.toLowerCase()}</h3></div>
      <button class="close-x" data-close-sheet>${ICONS.x}</button>
    </div>
    <form id="row-form">
      ${fieldsFor(type, existingRow)}
      <div style="display:flex; gap:10px; justify-content:space-between; margin-top:18px;">
        <div>${isEdit ? '<button type="button" class="btn btn-danger btn-sm" id="f-delete">Delete</button>' : ''}</div>
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-ghost" data-close-sheet>Cancel</button>
          <button type="submit" class="btn btn-primary" id="f-save">Save</button>
        </div>
      </div>
    </form>
  `);

  if (type === M.ROW_TYPES.TASK) bindDateField(sheetEl, 'f-due', { title: 'Due date' });
  if (type === M.ROW_TYPES.BOUNDED) {
    bindDateField(sheetEl, 'f-start', { title: 'Start date' });
    bindDateField(sheetEl, 'f-end', { title: 'End date' });
  }

  let selectedColor = existingRow?.color || M.nextColor(S.activeRows());
  sheetEl.querySelectorAll('.swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      selectedColor = sw.dataset.color;
      sheetEl.querySelectorAll('.swatch').forEach((s) => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });

  if (isEdit) {
    sheetEl.querySelector('#f-delete')?.addEventListener('click', async () => {
      const ok = await confirmDialog(
        `Archive ${existingRow.name}?`,
        'It will leave your active tracker but stay recoverable in Settings.',
        'Archive row',
      );
      if (!ok) return;
      await S.archiveRow(existingRow.id);
      toast('Row archived — recoverable in Settings');
      close();
      onSaved && onSaved();
    });
  }

  sheetEl.querySelector('#row-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = sheetEl.querySelector('#f-name')?.value.trim();
    if (!name) return;
    const row = existingRow && existingRow.id ? { ...existingRow } : {
      type, name: '', color: selectedColor, completions: {}, archived: false, createdAt: new Date().toISOString(),
    };
    row.name = name;
    row.color = selectedColor;
    row.parentProjectId = parentProjectId || row.parentProjectId || null;

    if (type === M.ROW_TYPES.HABIT) {
      row.cadenceCount = Number(sheetEl.querySelector('#f-cadence').value) || 3;
    } else if (type === M.ROW_TYPES.TASK) {
      row.dueDate = sheetEl.querySelector('#f-due').value;
    } else if (type === M.ROW_TYPES.BOUNDED) {
      row.startDate = sheetEl.querySelector('#f-start').value;
      row.endDate = sheetEl.querySelector('#f-end').value;
      if (row.endDate < row.startDate) {
        toast('Choose an end date after the start date');
        return;
      }
    } else if (type === M.ROW_TYPES.WEEKLY) {
      row.weeklyTitle = sheetEl.querySelector('#f-weekly').value.trim();
    } else if (type === M.ROW_TYPES.PROJECT) {
      row.childTaskIds = row.childTaskIds || [];
      row.collapsed = row.collapsed || false;
    }

    const saved = await S.saveRow(row);

    if (existingRow?._draftId) await S.consumeDraft(existingRow._draftId);

    close();
    toast(isEdit ? 'Saved' : 'Added');

    if (type === M.ROW_TYPES.PROJECT && !isEdit) {
      // chain straight into adding the first task under this project (skip type picker)
      setTimeout(() => renderForm(M.ROW_TYPES.TASK, null, saved.id, onSaved), 200);
    }
    onSaved && onSaved();
  });
}
