// nav.js — NCPI navigation: location awareness, back stack, home resolution.
import * as M from '../model.js';

export const SCREENS = {
  TODAY: 'today',
  GRID: 'grid',
  GALLERY: 'gallery',
  SETTINGS: 'settings',
  DAY: 'day',
};

export function homeScreen() {
  return window.matchMedia('(min-width: 860px)').matches ? SCREENS.GRID : SCREENS.TODAY;
}

export function screenLabel(screen, ctx = {}) {
  switch (screen) {
    case SCREENS.TODAY: return 'Today';
    case SCREENS.GRID: return ctx.monthKey ? M.monthLabel(ctx.monthKey) : 'Month grid';
    case SCREENS.GALLERY: return 'Growth gallery';
    case SCREENS.SETTINGS: return 'Settings';
    case SCREENS.DAY: {
      const d = M.parseKey(ctx.dateKey || M.todayKey());
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    default: return '';
  }
}

export function breadcrumbTrail(screen, ctx = {}) {
  const home = homeScreen();
  const crumbs = [];

  if (screen === SCREENS.DAY) {
    crumbs.push({ screen: home, label: home === SCREENS.GRID ? 'Grid' : 'Today' });
    if (ctx.fromMonthKey) crumbs.push({ screen: SCREENS.GRID, label: M.monthLabel(ctx.fromMonthKey), ctx: { monthKey: ctx.fromMonthKey } });
    crumbs.push({ screen: SCREENS.DAY, label: screenLabel(SCREENS.DAY, ctx), active: true });
    return crumbs;
  }

  if (screen === home) {
    crumbs.push({ screen, label: screenLabel(screen, ctx), active: true });
    return crumbs;
  }

  crumbs.push({ screen: home, label: home === SCREENS.GRID ? 'Grid' : 'Today' });
  crumbs.push({ screen, label: screenLabel(screen, ctx), active: true });
  return crumbs;
}

// A top-level destination is still a place a person can leave.  Returning this
// from the navigation module keeps the shell's Back affordance reliable on
// Settings and Gallery as well as on drilled-in days.
export function canGoBack(screen, historyLen = 0) {
  return screen !== homeScreen() || historyLen > 0;
}
