// Presentational pieces shared by more than one view.

import { ACTION_TYPES, TONE_CLASSES } from '../config.js';
import { escapeHtml, formatInt, shortId, adaCompact } from '../utils.js';

// ─── Metric tile ──────────────────────────────────────────────────────────────
export function metric({ label, value, sub = '', icon = null, tone = 'slate' }) {
  const toneText = {
    brand:   'text-brand-600 dark:text-brand-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber:   'text-amber-600 dark:text-amber-400',
    violet:  'text-violet-600 dark:text-violet-400',
    slate:   'text-slate-400',
  }[tone] || 'text-slate-400';

  return `
    <div class="metric">
      <div class="flex items-start justify-between gap-2">
        <span class="metric-label">${escapeHtml(label)}</span>
        ${icon ? `<i data-lucide="${icon}" class="w-3.5 h-3.5 ${toneText} shrink-0"></i>` : ''}
      </div>
      <div class="metric-value">${value}</div>
      ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
    </div>`;
}

// ─── Governance action type ───────────────────────────────────────────────────
export function actionTypeMeta(type) {
  return ACTION_TYPES[type] || { label: type, short: type, tone: 'slate' };
}

export function actionTypePill(type, { short = true } = {}) {
  const meta = actionTypeMeta(type);
  return `<span class="pill ${TONE_CLASSES[meta.tone] || TONE_CLASSES.slate}">${escapeHtml(short ? meta.short : meta.label)}</span>`;
}

const OUTCOME_TONE = {
  Enacted:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Ratified: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Expired:  'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  Voting:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export function outcomePill(outcome) {
  return `<span class="pill ${OUTCOME_TONE[outcome] || OUTCOME_TONE.Expired}">${escapeHtml(outcome || '—')}</span>`;
}

// ─── Votes ────────────────────────────────────────────────────────────────────
export function votePill(vote) {
  if (!vote) return `<span class="pill pill-missed">Not voted</span>`;
  const cls = { Yes: 'pill-yes', No: 'pill-no', Abstain: 'pill-abstain' }[vote] || 'pill-missed';
  return `<span class="pill ${cls}">${escapeHtml(vote)}</span>`;
}

/** Three-segment tally bar used on action rows. */
export function tallyBar(tally) {
  if (!tally) return '';
  const { yes_pct: y = 0, no_pct: n = 0, abstain_pct: a = 0 } = tally;
  return `
    <div class="flex items-center gap-2" title="Yes ${y}% · No ${n}% · Abstain ${a}%">
      <span class="flex h-1.5 w-24 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
        <span class="bg-emerald-500" style="width:${y}%"></span>
        <span class="bg-red-500" style="width:${n}%"></span>
        <span class="bg-amber-400" style="width:${a}%"></span>
      </span>
      <span class="text-[11px] text-slate-400 tabular whitespace-nowrap">${y.toFixed(0)}% yes</span>
    </div>`;
}

// ─── Identity ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#0284c7', '#65a30d', '#ea580c',
];

export function avatarColor(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function avatar(name, id, { size = '1.75rem' } = {}) {
  const initials = name
    ? name.replace(/[^A-Za-z0-9 .]/g, '').split(/[\s.]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('')
    : '··';
  return `<span class="avatar" style="background:${avatarColor(id || name || '')};width:${size};height:${size}">${escapeHtml(initials)}</span>`;
}

/** Name + truncated identifier, or an "unnamed" treatment when there is no metadata. */
export function identityCell(name, id, { idHead = 14, idTail = 6 } = {}) {
  return `
    <div class="flex items-center gap-2.5 min-w-0">
      ${avatar(name, id)}
      <div class="min-w-0">
        ${name
          ? `<div class="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">${escapeHtml(name)}</div>`
          : `<div class="text-[13px] text-slate-400 italic">No metadata registered</div>`}
        <div class="addr-chip text-slate-400 truncate">${escapeHtml(shortId(id, idHead, idTail))}</div>
      </div>
    </div>`;
}

// ─── Eligibility checks ───────────────────────────────────────────────────────
/**
 * The requirement list a claimant sees. Kept in one place so the claim page,
 * the profile page and the explorer all explain eligibility identically.
 */
export function buildChecks(record, { windowMeta, existingClaim = null } = {}) {
  if (!record) return [];
  const total = record.total_actions || windowMeta?.total_actions || 0;
  const voted = record.voted_actions || 0;
  const maxEligible = windowMeta?.max_eligible_dreps || 200;

  const checks = [];

  if (record.type === 'cc') {
    checks.push({
      id: 'membership',
      label: 'Serving committee member at the snapshot block',
      detail: record.term_end_epoch
        ? `Term runs to epoch ${record.term_end_epoch}`
        : 'Present in the committee set',
      passed: true,
    });
  } else {
    checks.push({
      id: 'registration',
      label: 'Registered DRep at the snapshot block',
      detail: record.registered_epoch
        ? `Registered in epoch ${record.registered_epoch}`
        : 'Present in the DRep register',
      passed: true,
    });
  }

  checks.push({
    id: 'participation',
    label: `Voted on all ${total} governance actions in the window`,
    detail: `${voted} of ${total} actions${voted < total ? ` — ${total - voted} missed` : ''}`,
    passed: voted === total && total > 0,
  });

  if (record.type !== 'cc') {
    // The cut-off ranks only DReps that already voted on every action, so the
    // number that matters here is the participation rank, not the overall one.
    const place = record.participation_rank;
    checks.push({
      id: 'ranking',
      label: `Ranked in the top ${formatInt(maxEligible)} by voting power among full participants`,
      detail: place
        ? `Placed ${formatInt(place)} of ${formatInt(windowMeta?.full_participation_dreps || 0)} DReps that voted on everything`
        : 'Not ranked — full participation is required first',
      passed: Boolean(record.eligible),
    });
  }

  checks.push({
    id: 'unclaimed',
    label: 'No claim recorded for this window',
    detail: existingClaim
      ? `Already claimed as ${existingClaim.claim_id}`
      : 'One claim per window',
    passed: !existingClaim,
  });

  return checks;
}

export function checklist(checks) {
  if (!checks.length) return '';
  return `<div>${checks.map(c => `
    <div class="check-row">
      <span class="check-mark ${c.passed ? 'check-pass' : 'check-fail'}">
        <i data-lucide="${c.passed ? 'check' : 'x'}" class="w-3 h-3"></i>
      </span>
      <div class="min-w-0">
        <div class="text-[13px] font-medium ${c.passed ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}">${escapeHtml(c.label)}</div>
        <div class="text-xs text-slate-400 mt-0.5">${escapeHtml(c.detail)}</div>
      </div>
    </div>`).join('')}</div>`;
}

// ─── Pool split bar ───────────────────────────────────────────────────────────
export function poolSplitBar(drepLovelace, ccLovelace, drepPct, ccPct) {
  return `
    <div>
      <div class="flex rounded-lg overflow-hidden h-6 text-[11px] font-bold text-white">
        <div class="bg-brand-600 flex items-center justify-center" style="width:${drepPct}%">${drepPct}%</div>
        <div class="bg-violet-500 flex items-center justify-center" style="width:${ccPct}%">${ccPct}%</div>
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-xs text-slate-500 dark:text-slate-400">
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm bg-brand-600"></span>
          DRep pool <strong class="text-slate-700 dark:text-slate-200 tabular">${adaCompact(drepLovelace)}</strong>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm bg-violet-500"></span>
          Committee pool <strong class="text-slate-700 dark:text-slate-200 tabular">${adaCompact(ccLovelace)}</strong>
        </span>
      </div>
    </div>`;
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function emptyState(icon, title, body) {
  return `
    <div class="px-6 py-14 text-center">
      <i data-lucide="${icon}" class="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-3"></i>
      <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">${escapeHtml(title)}</p>
      <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">${escapeHtml(body)}</p>
    </div>`;
}

// ─── Pagination footer ────────────────────────────────────────────────────────
export function paginationBar(idPrefix) {
  return `
    <div class="flex items-center justify-between gap-4 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
      <span class="text-xs text-slate-400" id="${idPrefix}-label"></span>
      <div class="flex gap-1.5">
        <button id="${idPrefix}-prev" class="btn-secondary text-xs h-7 px-2.5">
          <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i> Prev
        </button>
        <button id="${idPrefix}-next" class="btn-secondary text-xs h-7 px-2.5">
          Next <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>`;
}
