// main.js — app shell: routing, navigation (NCPI), banners, boot sequence.
import * as S from './state.js';
import * as M from './model.js';
import { renderToday } from './views/today.js';
import { renderGrid, getGridMonth, setGridMonth, shiftGridMonth } from './views/grid.js';
import { renderGallery } from './views/gallery.js';
import { renderSettings } from './views/settings.js';
import { renderDay } from './views/day.js';
import { openAddEdit } from './views/addEdit.js';
import { maybeRunTurnover } from './views/monthTurnover.js';
import { ICONS } from './components/ring.js';
import { openSheet, toast } from './components/ui.js';
import { SCREENS, homeScreen, breadcrumbTrail, canGoBack } from './components/nav.js';
import { openMonthCalendar } from './components/calendar.js';

const appEl = document.getElementById('app');

let currentScreen = homeScreen();
let dayContext = { dateKey: null, fromMonthKey: null };
let navHistory = []; // stack for back navigation

function navigateTo(screen, ctx = {}, { pushHistory = true } = {}) {
  if (pushHistory && currentScreen !== screen) {
    navHistory.push({ screen: currentScreen, dayContext: { ...dayContext } });
  }
  if (screen === SCREENS.DAY) {
    dayContext = { dateKey: ctx.dateKey, fromMonthKey: ctx.fromMonthKey || getGridMonth() };
  } else if (ctx.monthKey) {
    setGridMonth(ctx.monthKey);
  }
  currentScreen = screen;
  renderMain();
}

function goBack() {
  if (navHistory.length) {
    const prev = navHistory.pop();
    currentScreen = prev.screen;
    dayContext = prev.dayContext || { dateKey: null, fromMonthKey: null };
    renderMain();
    return;
  }
  navigateTo(homeScreen(), {}, { pushHistory: false });
}

function goHome() {
  navHistory = [];
  dayContext = { dateKey: null, fromMonthKey: null };
  currentScreen = homeScreen();
  renderMain();
}

async function boot() {
  await S.loadAll();
  document.documentElement.setAttribute('data-theme', S.state.settings.theme || 'light');
  renderShell();
  maybeRunTurnover(() => { renderMain(); });
  registerServiceWorker();
}

function renderShell() {
  appEl.innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <button type="button" class="back-home ${canGoBack(currentScreen) ? 'visible' : ''}" id="back-btn" aria-label="Go back" title="Back to your tracker">
          ${ICONS.chevronLeft}<span class="back-home-label">Back</span>
        </button>
        <button type="button" class="brand" id="brand-home" aria-label="Home">
          <span class="brand-mark">Everyday</span><span class="brand-sub">TRACKER</span>
        </button>
      </div>
      <nav class="context-trail" id="context-trail" aria-label="Current location"></nav>
      <div class="topbar-right">
        <div id="topbar-controls"></div>
        <nav class="desktop-nav" aria-label="Main">
          <button type="button" data-nav="today" class="mobile-only nav-pill">${ICONS.today}<span>Today</span></button>
          <button type="button" data-nav="grid" class="nav-pill">${ICONS.grid}<span>Grid</span></button>
          <button type="button" data-nav="gallery" class="nav-pill">${ICONS.gallery}<span>Gallery</span></button>
          <button type="button" data-nav="settings" class="nav-pill">${ICONS.settings}<span>Settings</span></button>
        </nav>
      </div>
    </header>
    <main id="main-area"></main>
    <button type="button" class="fab" id="fab-add" title="Add row" aria-label="Add row">${ICONS.plus}</button>
    <nav class="tabbar mobile-only">
      <button type="button" data-tab="today">${ICONS.today}<span>Today</span></button>
      <button type="button" data-tab="grid">${ICONS.grid}<span>Grid</span></button>
      <button type="button" data-tab="gallery">${ICONS.gallery}<span>Gallery</span></button>
      <button type="button" data-tab="settings">${ICONS.settings}<span>Settings</span></button>
    </nav>
  `;

  document.getElementById('back-btn').addEventListener('click', goBack);
  document.getElementById('brand-home').addEventListener('click', goHome);
  document.getElementById('fab-add').addEventListener('click', () => openAddEdit({ onSaved: renderMain }));

  document.querySelectorAll('.tabbar [data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navHistory = [];
      dayContext = { dateKey: null, fromMonthKey: null };
      navigateTo(btn.dataset.tab, {}, { pushHistory: false });
    });
  });

  document.querySelectorAll('.desktop-nav [data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navHistory = [];
      dayContext = { dateKey: null, fromMonthKey: null };
      navigateTo(btn.dataset.nav, {}, { pushHistory: false });
    });
  });

  S.subscribe(() => { renderContextTrail(); renderTopbarControls(); });
}

function renderContextTrail() {
  const el = document.getElementById('context-trail');
  const backBtn = document.getElementById('back-btn');
  if (!el) return;

  const ctx = currentScreen === SCREENS.GRID || currentScreen === SCREENS.DAY
    ? { monthKey: getGridMonth(), dateKey: dayContext.dateKey, fromMonthKey: dayContext.fromMonthKey }
    : {};
  const crumbs = breadcrumbTrail(currentScreen, ctx);

  el.innerHTML = crumbs.map((c, i) => {
    const sep = i > 0 ? '<span class="crumb-sep">/</span>' : '';
    if (c.active) {
      return `${sep}<span class="crumb active">${esc(c.label)}</span>`;
    }
    return `${sep}<button type="button" class="crumb link" data-crumb-screen="${c.screen}" ${c.ctx?.monthKey ? `data-crumb-month="${c.ctx.monthKey}"` : ''}>${esc(c.label)}</button>`;
  }).join('');

  el.querySelectorAll('[data-crumb-screen]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navHistory = [];
      const mk = btn.dataset.crumbMonth;
      navigateTo(btn.dataset.crumbScreen, mk ? { monthKey: mk } : {}, { pushHistory: false });
    });
  });

  if (backBtn) {
    const showBack = canGoBack(currentScreen, navHistory.length);
    backBtn.classList.toggle('visible', showBack);
    const destination = navHistory.length ? 'previous view' : (homeScreen() === SCREENS.GRID ? 'month grid' : 'today');
    backBtn.setAttribute('aria-label', `Back to ${destination}`);
    backBtn.title = `Back to ${destination}`;
  }
}

function renderMain() {
  const mainArea = document.getElementById('main-area');
  renderContextTrail();
  renderTopbarControls();
  renderBanners(mainArea);

  const content = document.createElement('div');
  content.className = 'screen-content';
  mainArea.innerHTML = '';
  mainArea.appendChild(bannerHost);
  mainArea.appendChild(content);

  document.querySelectorAll('.tabbar [data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === currentScreen);
  });
  document.querySelectorAll('.desktop-nav [data-nav]').forEach((b) => {
    b.classList.toggle('active', b.dataset.nav === currentScreen);
  });

  if (currentScreen === SCREENS.TODAY) renderToday(content, { onOpenGrid: () => navigateTo(SCREENS.GRID) });
  else if (currentScreen === SCREENS.GRID) {
    renderGrid(content, {
      onMonthChange: renderMain,
      onGoDay: (dateKey) => navigateTo(SCREENS.DAY, { dateKey, fromMonthKey: getGridMonth() }),
    });
  }
  else if (currentScreen === SCREENS.GALLERY) {
    renderGallery(content, {
      onOpenMonth: (monthKey) => {
        setGridMonth(monthKey);
        navigateTo(SCREENS.GRID, { monthKey });
      },
    });
  }
  else if (currentScreen === SCREENS.SETTINGS) renderSettings(content);
  else if (currentScreen === SCREENS.DAY) {
    renderDay(content, dayContext.dateKey, { onRefresh: renderMain });
  }
}

function openCalendarFromGrid() {
  openMonthCalendar(getGridMonth(), {
    onMonthChange: (mk) => setGridMonth(mk),
    onSelectDay: (dateKey, monthKey) => {
      setGridMonth(monthKey);
      navigateTo(SCREENS.DAY, { dateKey, fromMonthKey: monthKey });
    },
  });
}

// Expose calendar opener for topbar month label
export function openCalendarPicker() {
  openCalendarFromGrid();
}

let bannerHost = document.createElement('div');
function renderBanners(mainArea) {
  bannerHost = document.createElement('div');
  const pending = S.state.settings.pendingHabitEdits || [];
  const banners = [];

  if (pending.length && currentScreen !== SCREENS.SETTINGS) {
    banners.push(`<div class="banner" id="pending-habits-banner">
      <div><div class="t">Pending habit edits</div><div class="s">${pending.length} habit${pending.length > 1 ? 's' : ''} to finish updating</div></div>
      <span>${ICONS.chevronRight}</span>
    </div>`);
  }

  const weeklySlots = S.activeRows().filter((r) => r.type === M.ROW_TYPES.WEEKLY);
  const wk = M.weekKeyOf(M.todayKey());
  const dismissedKey = `weeklyDismiss_${wk}`;
  const needsRetitle = weeklySlots.filter((r) => (r.lastRetitleWeek || '') !== wk && !(S.state.settings[dismissedKey] || []).includes(r.id));
  if (needsRetitle.length && (currentScreen === SCREENS.TODAY || currentScreen === SCREENS.GRID)) {
    needsRetitle.forEach((r) => {
      banners.push(`<div class="banner" data-retitle="${r.id}">
        <div><div class="t">Set this week's focus</div><div class="s">${esc(r.name)} — last: "${esc(r.weeklyTitle || '—')}"</div></div>
        <span>${ICONS.chevronRight}</span>
      </div>`);
    });
  }

  bannerHost.innerHTML = banners.join('');
  bannerHost.querySelector('#pending-habits-banner')?.addEventListener('click', () => openPendingHabits());
  bannerHost.querySelectorAll('[data-retitle]').forEach((el) => {
    el.addEventListener('click', () => openRetitle(el.dataset.retitle, wk));
  });
}

function openPendingHabits() {
  const ids = S.state.settings.pendingHabitEdits || [];
  const { close, sheetEl } = openSheet(`
    <div class="sheet-header"><h3 class="sheet-title">Pending habit edits</h3><button class="close-x" data-close-sheet>${ICONS.x}</button></div>
    ${ids.map((id) => {
      const row = S.rowById(id);
      return row ? `<div class="settings-row"><div class="l">${esc(row.name)}</div><button class="btn btn-ghost btn-sm" data-open="${id}">Edit</button></div>` : '';
    }).join('')}
  `);
  sheetEl.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = S.rowById(btn.dataset.open);
      close();
      openAddEdit({ existingRow: row, onSaved: async () => { await S.clearPendingHabitEdit(row.id); renderMain(); } });
    });
  });
}

function openRetitle(rowId, weekKey) {
  const row = S.rowById(rowId);
  const { close, sheetEl } = openSheet(`
    <div class="sheet-header"><h3 class="sheet-title">This week's focus</h3><button class="close-x" data-close-sheet>${ICONS.x}</button></div>
    <div class="field"><label>Last week</label><input type="text" disabled value="${esc(row.weeklyTitle || '—')}"></div>
    <div class="field"><label>New title</label><input type="text" id="new-title" placeholder="What are you exploring this week?"></div>
    <div style="display:flex; justify-content:flex-end; gap:10px;">
      <button class="btn btn-ghost" data-close-sheet>Later</button>
      <button class="btn btn-primary" id="save-title">Save</button>
    </div>
  `);
  sheetEl.querySelector('#save-title').addEventListener('click', async () => {
    const val = sheetEl.querySelector('#new-title').value.trim();
    if (!val) return;
    row.weeklyTitle = val;
    row.lastRetitleWeek = weekKey;
    await S.saveRow(row);
    close();
    toast('Weekly focus updated');
    renderMain();
  });
}

function renderTopbarControls() {
  const el = document.getElementById('topbar-controls');
  if (!el) return;

  if (currentScreen === SCREENS.GRID) {
    const mk = getGridMonth();
    el.innerHTML = `<div class="month-nav">
      <button type="button" id="prev-month" aria-label="Previous month">${ICONS.chevronLeft}</button>
      <button type="button" class="month-label month-label-tap" id="open-calendar" aria-label="Open calendar">${M.monthLabel(mk)}</button>
      <button type="button" id="next-month" aria-label="Next month">${ICONS.chevronRight}</button>
    </div>`;
    el.querySelector('#prev-month').addEventListener('click', () => { shiftGridMonth(-1); renderMain(); });
    el.querySelector('#next-month').addEventListener('click', () => { shiftGridMonth(1); renderMain(); });
    el.querySelector('#open-calendar').addEventListener('click', openCalendarFromGrid);
  } else if (currentScreen === SCREENS.DAY && dayContext.dateKey) {
    el.innerHTML = `<button type="button" class="month-label month-label-tap" id="open-calendar-day">${M.monthLabel(M.monthKeyOf(dayContext.dateKey))}</button>`;
    el.querySelector('#open-calendar-day').addEventListener('click', () => {
      openMonthCalendar(M.monthKeyOf(dayContext.dateKey), {
        onSelectDay: (dateKey, monthKey) => {
          dayContext = { dateKey, fromMonthKey: monthKey };
          setGridMonth(monthKey);
          renderMain();
        },
      });
    });
  } else {
    el.innerHTML = '';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function esc(s = '') { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

boot();
