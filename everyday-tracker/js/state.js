// state.js — single in-memory store synced to IndexedDB, with pub/sub.
import { Store, uid } from './db.js';
import * as M from './model.js';

const listeners = new Set();
export const state = {
  rows: [],
  monthRecords: [],
  drafts: [],
  settings: { id: 'app', theme: 'light', notificationsEnabled: false, notifyTime: '09:00', pendingHabitEdits: [] },
  loaded: false,
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn(state)); }

export async function loadAll() {
  const [rows, monthRecords, drafts, settingsArr] = await Promise.all([
    Store.getAll('rows'),
    Store.getAll('monthRecords'),
    Store.getAll('drafts'),
    Store.getAll('settings'),
  ]);
  state.rows = rows;
  state.monthRecords = monthRecords.sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
  state.drafts = drafts;
  if (settingsArr[0]) state.settings = settingsArr[0];
  state.loaded = true;
  emit();
}

export function activeRows() { return state.rows.filter((r) => !r.archived); }
export function rowById(id) { return state.rows.find((r) => r.id === id); }

export async function saveRow(row) {
  if (!row.id) row.id = uid('row');
  if (!row.color) row.color = M.nextColor(activeRows());
  if (!row.completions) row.completions = {};
  await Store.put('rows', row);
  const idx = state.rows.findIndex((r) => r.id === row.id);
  if (idx >= 0) state.rows[idx] = row; else state.rows.push(row);
  emit();
  return row;
}

export async function archiveRow(id) {
  const row = rowById(id);
  if (!row) return;
  row.archived = true;
  await Store.put('rows', row);
  emit();
}
export async function restoreRow(id) {
  const row = rowById(id);
  if (!row) return;
  row.archived = false;
  await Store.put('rows', row);
  emit();
}

export async function toggleCompletion(rowId, dateStr) {
  const row = rowById(rowId);
  if (!row) return;
  if (!M.isCheckable(dateStr)) return;
  row.completions = row.completions || {};
  if (row.completions[dateStr]) delete row.completions[dateStr];
  else row.completions[dateStr] = true;

  // one-off task: once checked it should disappear from the grid;
  // we keep the completion but callers filter it out of "Today"/relevant lists.
  await Store.put('rows', row);
  emit();
  return row;
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch, id: 'app' };
  await Store.put('settings', state.settings);
  emit();
}

export async function addPendingHabitEdit(rowId) {
  const list = new Set(state.settings.pendingHabitEdits || []);
  list.add(rowId);
  await saveSettings({ pendingHabitEdits: [...list] });
}
export async function clearPendingHabitEdit(rowId) {
  const list = (state.settings.pendingHabitEdits || []).filter((id) => id !== rowId);
  await saveSettings({ pendingHabitEdits: list });
}

export async function saveMonthRecord(rec) {
  await Store.put('monthRecords', rec);
  const idx = state.monthRecords.findIndex((r) => r.id === rec.id);
  if (idx >= 0) state.monthRecords[idx] = rec; else state.monthRecords.push(rec);
  state.monthRecords.sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
  emit();
}
export function monthRecordFor(monthKey) {
  return state.monthRecords.find((r) => r.monthKey === monthKey);
}
export function lastCompletedTurnoverMonthKey() {
  const done = state.monthRecords.filter((r) => r.completedTurnover);
  return done[0]?.monthKey || null;
}

export async function addDraft(draft) {
  draft.id = draft.id || uid('draft');
  draft.createdAt = new Date().toISOString();
  await Store.put('drafts', draft);
  state.drafts.push(draft);
  emit();
}
export async function consumeDraft(id) {
  await Store.delete('drafts', id);
  state.drafts = state.drafts.filter((d) => d.id !== id);
  emit();
}

// ---------- month turnover status ----------
// Returns null if no turnover is due, or an object describing what's pending.
export function turnoverStatus() {
  const cur = M.currentMonthKey();
  const lastDone = lastCompletedTurnoverMonthKey();
  if (lastDone === cur) return null; // already done for current month
  // find every month between lastDone (exclusive) and cur (inclusive) that needs handling
  if (!lastDone) {
    // first ever month: no turnover required until this month ends; nothing to lock.
    return null;
  }
  let cursor = M.shiftMonth(lastDone, 1);
  const skippedMonths = [];
  while (cursor !== cur) {
    skippedMonths.push(cursor);
    cursor = M.shiftMonth(cursor, 1);
  }
  return { dueForMonthKey: cur, skippedMonths };
}

export async function finalizeSkippedMonths(skippedMonths) {
  for (const mk of skippedMonths) {
    await saveMonthRecord({
      id: `mr_${mk}`,
      monthKey: mk,
      completedTurnover: true,
      away: true,
      photo: null,
      reflection: null,
      completionPct: null,
    });
  }
}
