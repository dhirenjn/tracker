// monthTurnover.js — automatic 2-step wizard shown at the start of a new
// month: (1) habit keep/edit/drop review, (2) photo + reflection gate.
import * as S from '../state.js';
import * as M from '../model.js';
import { toast } from '../components/ui.js';
import { openAddEdit } from './addEdit.js';

export function maybeRunTurnover(onDone) {
  const status = S.turnoverStatus();
  if (!status) { onDone && onDone(); return; }
  runWizard(status, onDone);
}

async function runWizard(status, onDone) {
  const { skippedMonths } = status;
  if (skippedMonths.length) await S.finalizeSkippedMonths(skippedMonths);

  const habits = S.activeRows().filter((r) => r.type === M.ROW_TYPES.HABIT);
  const decisions = {}; // rowId -> 'keep' | 'editNow' | 'editLater' | 'drop'

  const wrap = document.createElement('div');
  wrap.className = 'turnover-wrap';
  document.body.appendChild(wrap);

  function renderStep1() {
    wrap.innerHTML = `
      <div class="turnover-inner">
        <div class="progress-dots"><span class="active"></span><span></span></div>
        <h2 style="margin-bottom:4px;">Review your habits</h2>
        <p style="color:var(--ink-soft); font-size:14px; margin-bottom:18px;">A new month is starting. Decide what happens to each habit going forward — nothing about past days changes.</p>
        ${habits.length ? habits.map((h) => `
          <div class="habit-review-row" data-habit="${h.id}">
            <div class="name">${esc(h.name)} <span style="color:var(--ink-faint); font-weight:400;">— ${h.cadenceCount}x/week</span></div>
            <div class="chip-row">
              <button class="chip" data-decision="keep">Keep as is</button>
              <button class="chip" data-decision="editNow">Edit now</button>
              <button class="chip" data-decision="editLater">Edit later</button>
              <button class="chip" data-decision="drop">Drop</button>
            </div>
          </div>`).join('') : `<p style="color:var(--ink-faint); font-size:13.5px;">No habits yet — nothing to review.</p>`}
        <div style="display:flex; justify-content:flex-end; margin-top:22px;">
          <button class="btn btn-primary" id="to-step2" ${habits.length ? 'disabled' : ''}>Continue</button>
        </div>
      </div>`;

    wrap.querySelectorAll('.habit-review-row').forEach((row) => {
      const rowId = row.dataset.habit;
      row.querySelectorAll('[data-decision]').forEach((btn) => {
        btn.addEventListener('click', () => {
          decisions[rowId] = btn.dataset.decision;
          row.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
          btn.classList.add('selected');
          checkStep1Complete();
        });
      });
    });
    wrap.querySelector('#to-step2').addEventListener('click', async () => {
      await applyHabitDecisions(decisions);
      renderStep2();
    });
    checkStep1Complete();
  }

  function checkStep1Complete() {
    const btn = wrap.querySelector('#to-step2');
    if (!btn) return;
    const allDecided = habits.every((h) => decisions[h.id]);
    btn.disabled = !allDecided;
  }

  let photoDataUrl = null;
  function renderStep2() {
    wrap.innerHTML = `
      <div class="turnover-inner">
        <div class="progress-dots"><span class="active"></span><span class="active"></span></div>
        <h2 style="margin-bottom:4px;">A quick photo + reflection</h2>
        <p style="color:var(--ink-soft); font-size:14px; margin-bottom:18px;">How have you changed since last month? This is permanent once submitted — an honest snapshot, not a polished one.</p>
        <label class="photo-drop" id="photo-drop">
          <span id="photo-placeholder">Tap to add a photo</span>
          <input type="file" accept="image/*" id="photo-input" style="display:none;">
        </label>
        <div class="field">
          <label>1–2 line reflection</label>
          <textarea id="reflection" placeholder="What's different about you or your work this month?"></textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:10px;">
          <button class="btn btn-primary" id="finish-turnover" disabled>Finish</button>
        </div>
      </div>`;

    const input = wrap.querySelector('#photo-input');
    wrap.querySelector('#photo-drop').addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        photoDataUrl = reader.result;
        wrap.querySelector('#photo-drop').innerHTML = `<img src="${photoDataUrl}">`;
        checkStep2Complete();
      };
      reader.readAsDataURL(file);
    });
    wrap.querySelector('#reflection').addEventListener('input', checkStep2Complete);

    wrap.querySelector('#finish-turnover').addEventListener('click', async () => {
      const reflection = wrap.querySelector('#reflection').value.trim();
      const monthKey = M.shiftMonth(M.currentMonthKey(), -1); // the month that just ended
      await S.saveMonthRecord({
        id: `mr_${monthKey}`,
        monthKey,
        completedTurnover: true,
        away: false,
        photo: photoDataUrl,
        reflection,
        completionPct: M.overallMonthPct(S.activeRows(), monthKey),
      });
      wrap.remove();
      toast('New month unlocked ✨');
      onDone && onDone();
    });
  }
  function checkStep2Complete() {
    const r = wrap.querySelector('#reflection')?.value.trim();
    wrap.querySelector('#finish-turnover').disabled = !(photoDataUrl && r);
  }

  renderStep1();
}

async function applyHabitDecisions(decisions) {
  const editLater = [];
  for (const [rowId, decision] of Object.entries(decisions)) {
    if (decision === 'drop') {
      await S.archiveRow(rowId);
    } else if (decision === 'editLater') {
      editLater.push(rowId);
    }
    // 'keep' and 'editNow' handled inline via openAddEdit below
  }
  for (const id of editLater) await S.addPendingHabitEdit(id);

  const editNowIds = Object.entries(decisions).filter(([, d]) => d === 'editNow').map(([id]) => id);
  for (const id of editNowIds) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      const row = S.rowById(id);
      openAddEdit({ existingRow: row, onSaved: resolve });
    });
  }
}

function esc(s = '') { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
