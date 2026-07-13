// model.js — pure logic: dates, row rules, completion math.
// No DOM, no storage — makes this easy to reason about and reuse.

export const ROW_TYPES = {
  HABIT: 'habit',
  TASK: 'task',
  PROJECT: 'project',
  BOUNDED: 'boundedProject',
  WEEKLY: 'weeklySlot',
};

export const PALETTE = ['#E3A548', '#3D8073', '#7A6BAE', '#4C86A8', '#C06B84', '#B54834'];

// ---------- date helpers (local time, ISO date strings) ----------
export function pad2(n) { return String(n).padStart(2, '0'); }

export function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function todayKey() { return dateKey(new Date()); }
export function todayDate() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }
export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function monthKeyOf(dateStrOrDate) {
  const d = typeof dateStrOrDate === 'string' ? parseKey(dateStrOrDate) : dateStrOrDate;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
export function currentMonthKey() { return monthKeyOf(todayDate()); }
export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}
export function daysOfMonth(monthKey) {
  const n = daysInMonth(monthKey);
  const [y, m] = monthKey.split('-').map(Number);
  const out = [];
  for (let i = 1; i <= n; i++) out.push(`${y}-${pad2(m)}-${pad2(i)}`);
  return out;
}
export function isWeekend(dateStr) {
  const d = parseKey(dateStr).getDay();
  return d === 0 || d === 6;
}
// ISO-ish week key: Monday-start week, label = year + week-of-year (simple, stable within a year)
export function weekKeyOf(dateStrOrDate) {
  const d = typeof dateStrOrDate === 'string' ? parseKey(dateStrOrDate) : new Date(dateStrOrDate);
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day); // back to Monday
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil((((date - jan1) / 86400000) + jan1.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${pad2(week)}`;
}
export function startOfWeek(dateStrOrDate) {
  const d = typeof dateStrOrDate === 'string' ? parseKey(dateStrOrDate) : new Date(dateStrOrDate);
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date;
}
export function daysBetweenToday(dateStr) {
  const a = todayDate();
  const b = parseKey(dateStr);
  return Math.round((a - b) / 86400000); // positive => dateStr is in the past
}
export const BACKFILL_DAYS = 3; // 2-3 day backfill window (inclusive of today)
export function isCheckable(dateStr) {
  const diff = daysBetweenToday(dateStr); // >0 past, 0 today, <0 future
  if (diff < 0) return false; // no future checking
  return diff <= BACKFILL_DAYS;
}

// ---------- row helpers ----------
export function isRowActiveOnDate(row, dateStr) {
  switch (row.type) {
    case ROW_TYPES.HABIT:
    case ROW_TYPES.WEEKLY:
      return true; // shown every day; user picks which days
    case ROW_TYPES.TASK: {
      if (row.dueDate === dateStr) return true;
      // overdue & unchecked stays visible on today's cell only within grid context;
      // callers handle "today" separately via isTaskOverdueVisible
      return false;
    }
    case ROW_TYPES.BOUNDED:
      return dateStr >= row.startDate && dateStr <= row.endDate;
    default:
      return false;
  }
}

export function isTaskOverdue(row) {
  if (row.type !== ROW_TYPES.TASK) return false;
  if (isTaskComplete(row)) return false;
  return daysBetweenToday(row.dueDate) > 0;
}
export function isTaskComplete(row) {
  return row.type === ROW_TYPES.TASK && !!Object.values(row.completions || {}).some(Boolean);
}
export function isBoundedOverdue(row) {
  if (row.type !== ROW_TYPES.BOUNDED) return false;
  const allChecked = allBoundedDaysChecked(row);
  return daysBetweenToday(row.endDate) > 0 && !allChecked;
}
export function allBoundedDaysChecked(row) {
  const days = [];
  let cur = parseKey(row.startDate);
  const end = parseKey(row.endDate);
  while (cur <= end) { days.push(dateKey(cur)); cur.setDate(cur.getDate() + 1); }
  return days.every((d) => row.completions && row.completions[d]);
}

// What should appear in "Today" for a given row (habits/weekly always; tasks
// on due date or while overdue; bounded projects while active or overdue).
export function isRelevantToday(row, todayStr = todayKey()) {
  if (row.archived) return false;
  switch (row.type) {
    case ROW_TYPES.HABIT:
    case ROW_TYPES.WEEKLY:
      return true;
    case ROW_TYPES.TASK:
      return row.dueDate === todayStr || isTaskOverdue(row);
    case ROW_TYPES.BOUNDED:
      return (todayStr >= row.startDate && todayStr <= row.endDate) || isBoundedOverdue(row);
    default:
      return false;
  }
}

// ---------- completion math ----------
export function habitTargetForMonth(row, monthKey) {
  const weeks = daysInMonth(monthKey) / 7;
  return Math.max(1, Math.round((row.cadenceCount || 3) * weeks));
}
export function completionsInMonth(row, monthKey) {
  if (!row.completions) return 0;
  return Object.keys(row.completions).filter((k) => row.completions[k] && monthKeyOf(k) === monthKey).length;
}
export function habitMonthPct(row, monthKey) {
  const target = habitTargetForMonth(row, monthKey);
  const done = completionsInMonth(row, monthKey);
  return Math.min(100, Math.round((done / target) * 100));
}
export function weeklySlotMonthPct(row, monthKey) {
  // one "success" per calendar week the row has at least one check
  const weeksInMonth = new Set(daysOfMonth(monthKey).map((d) => weekKeyOf(d)));
  let hit = 0;
  weeksInMonth.forEach((wk) => {
    const anyChecked = Object.keys(row.completions || {}).some((k) => row.completions[k] && weekKeyOf(k) === wk);
    if (anyChecked) hit += 1;
  });
  return Math.round((hit / weeksInMonth.size) * 100);
}
export function taskMonthPct(row, monthKey) {
  if (monthKeyOf(row.dueDate) !== monthKey) return null;
  return isTaskComplete(row) ? 100 : 0;
}
export function boundedMonthPct(row, monthKey) {
  const days = [];
  let cur = parseKey(row.startDate);
  const end = parseKey(row.endDate);
  while (cur <= end) { days.push(dateKey(cur)); cur.setDate(cur.getDate() + 1); }
  const inMonth = days.filter((d) => monthKeyOf(d) === monthKey);
  if (!inMonth.length) return null;
  const done = inMonth.filter((d) => row.completions && row.completions[d]).length;
  return Math.round((done / inMonth.length) * 100);
}
export function rowMonthPct(row, monthKey) {
  switch (row.type) {
    case ROW_TYPES.HABIT: return habitMonthPct(row, monthKey);
    case ROW_TYPES.WEEKLY: return weeklySlotMonthPct(row, monthKey);
    case ROW_TYPES.TASK: return taskMonthPct(row, monthKey);
    case ROW_TYPES.BOUNDED: return boundedMonthPct(row, monthKey);
    default: return null;
  }
}
export function overallMonthPct(rows, monthKey) {
  const scored = rows
    .filter((r) => !r.archived && r.type !== ROW_TYPES.PROJECT)
    .map((r) => rowMonthPct(r, monthKey))
    .filter((v) => v !== null && v !== undefined);
  if (!scored.length) return 0;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

export function nextColor(existingRows) {
  const used = existingRows.map((r) => r.color);
  const free = PALETTE.find((c) => !used.includes(c));
  return free || PALETTE[existingRows.length % PALETTE.length];
}

export const TYPE_META = {
  [ROW_TYPES.HABIT]: { label: 'Habit', example: 'Meditate, workout' },
  [ROW_TYPES.TASK]: { label: 'Task', example: 'Due June 15' },
  [ROW_TYPES.BOUNDED]: { label: 'Bounded project', example: 'Build X in 2 weeks' },
  [ROW_TYPES.WEEKLY]: { label: 'Weekly slot', example: "This week's idea" },
  [ROW_TYPES.PROJECT]: { label: 'Project', example: 'Short film' },
};
