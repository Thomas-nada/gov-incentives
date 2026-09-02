import { state, snap } from '../app.js';
import {
  ada, adaCompact, adaRound, formatInt, formatDate, formatDateTime,
  relativeTime, escapeHtml, shortId, copyable, toCsv, downloadFile, explorer,
} from '../utils.js';
import {
  metric, actionTypePill, actionTypeMeta, outcomePill, votePill, tallyBar,
  identityCell, emptyState, paginationBar,
} from './shared.js';

const TABS = [
  { id: 'actions',     label: 'Actions',      icon: 'file-text' },
  { id: 'dreps',       label: 'DReps',        icon: 'vote' },
  { id: 'committee',   label: 'Committee',    icon: 'scale' },
  { id: 'votes',       label: 'Vote ledger',  icon: 'list' },
  { id: 'settlements', label: 'Settlements',  icon: 'send' },
];

const PAGE_SIZE = { dreps: 50, votes: 60, settlements: 40 };

// View state, kept across re-renders so paging and filters survive a repaint.
const ex = {
  tab: 'actions',
  query: '',
  page: 0,
  sort: 'rank',
  dir: 'asc',
  eligibleOnly: false,
  voteRole: 'all',
  expanded: null,
};

let root = null;

export function renderExplorer(app) {
  root = app;
  draw();
}

function draw() {
  const w = snap.window;
  root.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Snapshot explorer</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Every input to the ${escapeHtml(w.label || '')} reward calculation, exactly as it was frozen
          at block ${formatInt(w.snapshot_block)}.
        </p>
      </div>

      ${verificationPanel()}

      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${metric({ label: 'Reward pool', value: adaRound(w.total_pool_lovelace), sub: `Epochs ${w.epochs?.join(', ')}`, icon: 'wallet-cards', tone: 'brand' })}
        ${metric({ label: 'Governance actions', value: formatInt(w.total_actions), sub: 'All must be voted on', icon: 'file-text', tone: 'amber' })}
        ${metric({ label: 'Vote records', value: formatInt(w.vote_records), sub: `${formatInt(w.registered_dreps)} DReps in register`, icon: 'list', tone: 'slate' })}
        ${metric({ label: 'Qualifying', value: formatInt((w.eligible_dreps || 0) + (w.eligible_cc || 0)), sub: `${formatInt(w.eligible_dreps)} DReps · ${formatInt(w.eligible_cc)} committee`, icon: 'badge-check', tone: 'emerald' })}
      </section>

      <section class="card overflow-hidden">
        <div class="border-b border-slate-100 dark:border-slate-800 px-2 flex items-center gap-1 overflow-x-auto">
          ${TABS.map(t => `
            <button class="tab-btn nav-link ${ex.tab === t.id ? 'nav-link-active' : ''}" data-tab="${t.id}">
              <i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>${t.label}
            </button>`).join('')}
        </div>
        ${tabPanel()}
      </section>
    </div>`;

  lucide.createIcons();
  wire();
}

// ─── Snapshot verification ────────────────────────────────────────────────────
function verificationPanel() {
  const w = snap.window;
  return `
    <section class="card card-pad">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="flex items-start gap-3 min-w-0">
          <span class="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <i data-lucide="shield-check" class="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400"></i>
          </span>
          <div class="min-w-0">
            <p class="text-sm font-bold text-slate-900 dark:text-slate-50">Snapshot sealed</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed max-w-lg">
              Taken ${formatDateTime(w.snapshot_taken_at)} at slot ${formatInt(w.snapshot_slot)}. The
              digest below covers the vote ledger and the computed shares; it changes if any input changes.
            </p>
            <div class="mt-2">${copyable(w.snapshot_hash, { display: w.snapshot_hash, className: 'text-slate-500 dark:text-slate-400' })}</div>
          </div>
        </div>
        <button id="download-manifest" class="btn-secondary text-xs h-8 px-3 shrink-0">
          <i data-lucide="file-json" class="w-3.5 h-3.5"></i> Download manifest
        </button>
      </div>
    </section>`;
}

// ─── Tab panels ───────────────────────────────────────────────────────────────
function tabPanel() {
  switch (ex.tab) {
    case 'dreps':       return drepsPanel();
    case 'committee':   return committeePanel();
    case 'votes':       return votesPanel();
    case 'settlements': return settlementsPanel();
    default:            return actionsPanel();
  }
}

function toolbar({ placeholder, extra = '', showSearch = true, count }) {
  return `
    <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
      ${showSearch ? `
        <div class="relative flex-1 min-w-[13rem]">
          <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input id="explorer-search" type="search" value="${escapeHtml(ex.query)}" placeholder="${escapeHtml(placeholder)}"
            class="input h-9 pl-8 text-[13px]" spellcheck="false" autocomplete="off" />
        </div>` : '<div class="flex-1"></div>'}
      ${extra}
      <span class="text-xs text-slate-400 whitespace-nowrap">${count}</span>
      <button id="explorer-export" class="btn-secondary text-xs h-9 px-3">
        <i data-lucide="download" class="w-3.5 h-3.5"></i> CSV
      </button>
    </div>`;
}

// ─── Actions ──────────────────────────────────────────────────────────────────
function actionsPanel() {
  const q = ex.query.toLowerCase();
  const actions = snap.windowActions.filter(a =>
    !q || a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
    || (a.proposer || '').toLowerCase().includes(q));

  if (!actions.length) {
    return toolbar({ placeholder: 'Search actions…', count: '0 actions' })
      + emptyState('file-search', 'No matching actions', 'Try a different title, proposer or action ID.');
  }

  return `
    ${toolbar({ placeholder: 'Search by title, proposer or action ID…', count: `${actions.length} of ${snap.windowActions.length} actions` })}
    <div class="divide-y divide-slate-100 dark:divide-slate-800">
      ${actions.map(actionRow).join('')}
    </div>`;
}

function actionRow(a) {
  const open = ex.expanded === a.id;
  return `
    <article>
      <button class="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors" data-action="${escapeHtml(a.id)}">
        <span class="text-[11px] font-bold text-slate-300 dark:text-slate-600 tabular w-8 shrink-0 pt-1">${a.epoch}</span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">${escapeHtml(a.short_title)}</p>
          <div class="flex items-center gap-2 mt-1.5 flex-wrap">
            ${actionTypePill(a.type)}
            ${outcomePill(a.outcome)}
            <span class="text-[11px] text-slate-400">by ${escapeHtml(a.proposer)}</span>
          </div>
        </div>
        <div class="hidden sm:block shrink-0 pt-1">${tallyBar(a.tally)}</div>
        <i data-lucide="chevron-${open ? 'up' : 'down'}" class="w-4 h-4 text-slate-400 shrink-0 mt-1"></i>
      </button>
      ${open ? actionDetail(a) : ''}
    </article>`;
}

function actionDetail(a) {
  return `
    <div class="px-4 pb-4 pl-15 sm:pl-15">
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4">
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">${escapeHtml(a.abstract)}</p>
        <dl class="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
          ${row('Action ID', copyable(a.id, { display: shortId(a.id, 20, 8) }))}
          ${row('Transaction', copyable(a.tx, { display: shortId(a.tx, 16, 8) }))}
          ${row('Type', actionTypeMeta(a.type).label)}
          ${row('Proposed', `Epoch ${a.proposed_epoch}`)}
          ${row('Expires', `Epoch ${a.expires_epoch}`)}
          ${row('Deposit', adaRound(a.deposit_lovelace))}
          ${row('Yes / No / Abstain', `<span class="tabular">${a.tally.yes_pct}% · ${a.tally.no_pct}% · ${a.tally.abstain_pct}%</span>`)}
          ${row('Metadata', `<a href="${escapeHtml(a.anchor_url)}" target="_blank" rel="noopener" class="text-brand-600 dark:text-brand-400 hover:underline break-all">${escapeHtml(shortId(a.anchor_url, 30, 10))}</a>`)}
        </dl>
        <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <span class="addr-chip text-slate-400">anchor ${shortId(a.anchor_hash, 12, 8)}</span>
          <a href="${explorer.govAction(a.id)}" target="_blank" rel="noopener"
             class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
            View on Cardanoscan <i data-lucide="external-link" class="w-3 h-3 inline-block -mt-0.5"></i>
          </a>
        </div>
      </div>
    </div>`;
}

function row(label, value) {
  return `
    <div class="flex items-baseline justify-between gap-3 min-w-0">
      <dt class="text-slate-400 shrink-0">${label}</dt>
      <dd class="text-right text-slate-700 dark:text-slate-200 min-w-0 truncate">${value}</dd>
    </div>`;
}

// ─── DReps ────────────────────────────────────────────────────────────────────
const DREP_SORTS = {
  rank: d => d.rank,
  power: d => -d.voting_power_lovelace,
  voted: d => -d.voted_actions,
  delegators: d => -d.delegators,
};

function filteredDreps() {
  const q = ex.query.toLowerCase().trim();
  let rows = snap.ranking?.dreps || [];
  if (ex.eligibleOnly) rows = rows.filter(d => d.eligible);
  if (q) {
    rows = rows.filter(d =>
      (d.name || '').toLowerCase().includes(q)
      || d.drep_id.toLowerCase().includes(q)
      || d.stake_address.toLowerCase().includes(q));
  }
  const key = DREP_SORTS[ex.sort] || DREP_SORTS.rank;
  rows = [...rows].sort((a, b) => {
    const va = key(a), vb = key(b);
    return ex.dir === 'asc' ? va - vb : vb - va;
  });
  return rows;
}

function drepsPanel() {
  const rows = filteredDreps();
  const total = snap.window.total_actions || 0;
  const size = PAGE_SIZE.dreps;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  if (ex.page >= pages) ex.page = pages - 1;
  const slice = rows.slice(ex.page * size, ex.page * size + size);

  const filterBtn = `
    <button id="drep-eligible-toggle" class="btn-secondary text-xs h-9 px-3 ${ex.eligibleOnly ? '!border-brand-500 !text-brand-600 dark:!text-brand-400' : ''}">
      <i data-lucide="${ex.eligibleOnly ? 'check-square' : 'square'}" class="w-3.5 h-3.5"></i> Eligible only
    </button>`;

  return `
    ${toolbar({
      placeholder: 'Search by DRep name, ID or stake address…',
      extra: filterBtn,
      count: `${formatInt(rows.length)} DReps`,
    })}
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            ${sortableTh('Rank', 'rank', 'text-center w-16')}
            <th>DRep</th>
            ${sortableTh('Voted', 'voted', 'text-center')}
            ${sortableTh('Voting power', 'power', 'text-right')}
            ${sortableTh('Delegators', 'delegators', 'text-right hidden lg:table-cell')}
            <th class="text-right">Reward</th>
          </tr>
        </thead>
        <tbody>
          ${slice.map(d => drepRow(d, total)).join('')}
        </tbody>
      </table>
    </div>
    ${paginationBar('drep-page')}`;
}

function sortableTh(label, key, cls = '') {
  const active = ex.sort === key;
  return `
    <th class="${cls} th-sortable" data-sort="${key}">
      ${label}
      <i data-lucide="${active && ex.dir === 'desc' ? 'chevron-down' : 'chevron-up'}"
         class="w-3 h-3 inline-block sort-caret ${active ? 'sort-caret-active' : ''}"></i>
    </th>`;
}

function drepRow(d, total) {
  const connected = state.wallet?.stakeAddress === d.stake_address;
  return `
    <tr class="${d.eligible ? '' : 'row-muted'} ${connected ? 'row-highlight' : ''}">
      <td class="text-center tabular font-semibold text-slate-500 dark:text-slate-400">${d.rank}</td>
      <td>
        ${identityCell(d.name, d.drep_id, { idHead: 16, idTail: 6 })}
        ${connected ? '<span class="pill bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 mt-1">You</span>' : ''}
      </td>
      <td class="text-center">
        <span class="text-xs font-semibold tabular ${d.voted_actions === total ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">
          ${d.voted_actions}/${total}
        </span>
      </td>
      <td class="text-right tabular whitespace-nowrap">${adaCompact(d.voting_power_lovelace)}</td>
      <td class="text-right tabular hidden lg:table-cell text-slate-500 dark:text-slate-400">${formatInt(d.delegators)}</td>
      <td class="text-right tabular font-semibold ${d.eligible ? 'text-brand-600 dark:text-brand-400' : 'text-slate-300 dark:text-slate-700'}">
        ${d.eligible ? ada(d.share_lovelace) : '—'}
      </td>
    </tr>`;
}

// ─── Committee ────────────────────────────────────────────────────────────────
function committeePanel() {
  const rows = snap.ranking?.cc || [];
  const total = snap.window.total_actions || 0;
  return `
    ${toolbar({ showSearch: false, count: `${rows.length} seats`, placeholder: '' })}
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Member</th>
            <th class="hidden sm:table-cell">Region</th>
            <th class="text-center">Voted</th>
            <th class="text-center hidden md:table-cell">Term ends</th>
            <th class="text-right">Reward</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(c => `
            <tr class="${c.eligible ? '' : 'row-muted'}">
              <td>${identityCell(c.name, c.credential, { idHead: 16, idTail: 6 })}</td>
              <td class="hidden sm:table-cell text-xs text-slate-500 dark:text-slate-400">${escapeHtml(c.region || '—')}</td>
              <td class="text-center">
                <span class="text-xs font-semibold tabular ${c.voted_actions === total ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">
                  ${c.voted_actions}/${total}
                </span>
              </td>
              <td class="text-center hidden md:table-cell tabular text-slate-500 dark:text-slate-400">${c.term_end_epoch}</td>
              <td class="text-right tabular font-semibold ${c.eligible ? 'text-violet-600 dark:text-violet-400' : 'text-slate-300 dark:text-slate-700'}">
                ${c.eligible ? ada(c.share_lovelace) : '—'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
      ${snap.programme.cc_pool_pct}% of the pool (${adaRound(snap.window.cc_pool_lovelace)}) is divided by the
      full committee size of ${snap.programme.committee_size}. Seats that do not qualify leave their share in the reserve.
    </p>`;
}

// ─── Vote ledger ──────────────────────────────────────────────────────────────
function filteredVotes() {
  const q = ex.query.toLowerCase().trim();
  let rows = snap.voteLedger;
  if (ex.voteRole !== 'all') rows = rows.filter(v => v.actor_type === ex.voteRole);
  if (q) {
    rows = rows.filter(v =>
      (v.actor_name || '').toLowerCase().includes(q)
      || v.actor_id.toLowerCase().includes(q)
      || v.stake_address.toLowerCase().includes(q));
  }
  return rows;
}

function votesPanel() {
  const rows = filteredVotes();
  const size = PAGE_SIZE.votes;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  if (ex.page >= pages) ex.page = pages - 1;
  const slice = rows.slice(ex.page * size, ex.page * size + size);
  const actionMap = Object.fromEntries(snap.windowActions.map(a => [a.id, a]));

  const roleFilter = `
    <div class="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-9 shrink-0">
      ${[['all', 'All'], ['drep', 'DRep'], ['cc', 'Committee']].map(([id, label]) => `
        <button class="vote-role px-3 text-xs font-medium transition-colors ${ex.voteRole === id
          ? 'bg-brand-600 text-white'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}" data-role="${id}">${label}</button>`).join('')}
    </div>`;

  return `
    ${toolbar({
      placeholder: 'Search by voter name, ID or stake address…',
      extra: roleFilter,
      count: `${formatInt(rows.length)} votes`,
    })}
    ${slice.length ? `
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center w-14">Epoch</th>
              <th>Action</th>
              <th>Voter</th>
              <th class="text-center">Vote</th>
              <th class="text-right hidden lg:table-cell">Cast</th>
            </tr>
          </thead>
          <tbody>
            ${slice.map(v => {
              const a = actionMap[v.action_id];
              return `
                <tr>
                  <td class="text-center tabular text-slate-500 dark:text-slate-400">${v.epoch}</td>
                  <td class="max-w-xs">
                    <div class="text-[13px] text-slate-700 dark:text-slate-200 truncate">${escapeHtml(a?.short_title || v.action_id)}</div>
                    <div class="addr-chip text-slate-400 truncate">${escapeHtml(shortId(v.action_id, 18, 6))}</div>
                  </td>
                  <td class="max-w-xs">
                    <div class="text-[13px] text-slate-700 dark:text-slate-200 truncate">
                      ${v.actor_name ? escapeHtml(v.actor_name) : '<span class="text-slate-400 italic">Unnamed</span>'}
                      <span class="pill ${v.actor_type === 'cc' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'} ml-1">
                        ${v.actor_type === 'cc' ? 'CC' : 'DRep'}
                      </span>
                    </div>
                    <div class="addr-chip text-slate-400 truncate">${escapeHtml(shortId(v.actor_id, 18, 6))}</div>
                  </td>
                  <td class="text-center">${votePill(v.vote)}</td>
                  <td class="text-right hidden lg:table-cell text-xs text-slate-400 whitespace-nowrap">${formatDate(v.voted_at)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${paginationBar('vote-page')}`
      : emptyState('search-x', 'No matching votes', 'Nothing in the ledger matches that search.')}`;
}

// ─── Settlements ──────────────────────────────────────────────────────────────
function filteredSettlements() {
  const q = ex.query.toLowerCase().trim();
  let rows = [...state.payouts].sort((a, b) => (b.confirmed_at || '').localeCompare(a.confirmed_at || ''));
  if (q) {
    rows = rows.filter(p =>
      p.claim_id.toLowerCase().includes(q)
      || p.tx_hash.toLowerCase().includes(q)
      || p.stake_address.toLowerCase().includes(q));
  }
  return rows;
}

function settlementsPanel() {
  const rows = filteredSettlements();
  const size = PAGE_SIZE.settlements;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  if (ex.page >= pages) ex.page = pages - 1;
  const slice = rows.slice(ex.page * size, ex.page * size + size);
  const total = rows.reduce((s, p) => s + p.amount_lovelace, 0);

  return `
    ${toolbar({
      placeholder: 'Search by claim reference, tx hash or stake address…',
      count: `${formatInt(rows.length)} claims · ${adaCompact(total)}`,
    })}
    ${slice.length ? `
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th class="hidden sm:table-cell">Window</th>
              <th class="text-center">Role</th>
              <th class="text-right">Amount</th>
              <th class="hidden lg:table-cell">Transaction</th>
              <th class="text-right hidden md:table-cell">Confirmed</th>
            </tr>
          </thead>
          <tbody>
            ${slice.map(p => `
              <tr>
                <td>
                  <div class="addr-chip text-slate-700 dark:text-slate-200">${escapeHtml(p.claim_id)}</div>
                  <div class="addr-chip text-slate-400 truncate max-w-[10rem]">${escapeHtml(shortId(p.stake_address, 12, 5))}</div>
                </td>
                <td class="hidden sm:table-cell text-xs text-slate-500 dark:text-slate-400 tabular whitespace-nowrap">
                  ${p.window ? `${p.window[0]}–${p.window[2]}` : `Epoch ${p.epoch}`}
                </td>
                <td class="text-center">
                  <span class="pill ${p.type === 'cc'
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                    : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'}">
                    ${p.type === 'cc' ? 'Committee' : 'DRep'}
                  </span>
                </td>
                <td class="text-right tabular font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">${ada(p.amount_lovelace)}</td>
                <td class="hidden lg:table-cell">
                  <a href="${explorer.tx(p.tx_hash)}" target="_blank" rel="noopener"
                     class="addr-chip text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1">
                    ${escapeHtml(shortId(p.tx_hash, 12, 6))}
                    <i data-lucide="external-link" class="w-3 h-3"></i>
                  </a>
                </td>
                <td class="text-right hidden md:table-cell text-xs text-slate-400 whitespace-nowrap">
                  <span data-reltime="${p.confirmed_at}">${relativeTime(p.confirmed_at)}</span>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${paginationBar('settle-page')}`
      : emptyState('search-x', 'No matching settlements', 'No claim matches that reference, hash or address.')}`;
}

// ─── Wiring ───────────────────────────────────────────────────────────────────
function wire() {
  root.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
    ex.tab = btn.dataset.tab;
    ex.page = 0;
    ex.query = '';
    ex.expanded = null;
    draw();
  }));

  const search = root.querySelector('#explorer-search');
  if (search) {
    search.addEventListener('input', () => {
      const caret = search.selectionStart;
      ex.query = search.value;
      ex.page = 0;
      draw();
      const next = root.querySelector('#explorer-search');
      if (next) { next.focus(); try { next.setSelectionRange(caret, caret); } catch {} }
    });
  }

  root.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => {
    ex.expanded = ex.expanded === btn.dataset.action ? null : btn.dataset.action;
    draw();
  }));

  root.querySelectorAll('[data-sort]').forEach(th => th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (ex.sort === key) ex.dir = ex.dir === 'asc' ? 'desc' : 'asc';
    else { ex.sort = key; ex.dir = key === 'rank' ? 'asc' : 'desc'; }
    ex.page = 0;
    draw();
  }));

  root.querySelector('#drep-eligible-toggle')?.addEventListener('click', () => {
    ex.eligibleOnly = !ex.eligibleOnly;
    ex.page = 0;
    draw();
  });

  root.querySelectorAll('.vote-role').forEach(btn => btn.addEventListener('click', () => {
    ex.voteRole = btn.dataset.role;
    ex.page = 0;
    draw();
  }));

  wirePager('drep-page', filteredDreps().length, PAGE_SIZE.dreps, 'DReps');
  wirePager('vote-page', filteredVotes().length, PAGE_SIZE.votes, 'votes');
  wirePager('settle-page', filteredSettlements().length, PAGE_SIZE.settlements, 'claims');

  root.querySelector('#explorer-export')?.addEventListener('click', exportCurrentTab);
  root.querySelector('#download-manifest')?.addEventListener('click', () => {
    downloadFile('snapshot-manifest.json', JSON.stringify(state.snapshot, null, 2), 'application/json');
    window.showToast?.('Snapshot manifest downloaded', 'success');
  });
}

function wirePager(prefix, total, size, noun) {
  const label = root.querySelector(`#${prefix}-label`);
  const prev = root.querySelector(`#${prefix}-prev`);
  const next = root.querySelector(`#${prefix}-next`);
  if (!label) return;

  const pages = Math.max(1, Math.ceil(total / size));
  const start = ex.page * size;
  const end = Math.min(total, start + size);
  label.textContent = total
    ? `${formatInt(start + 1)}–${formatInt(end)} of ${formatInt(total)} ${noun}`
    : `No ${noun}`;

  prev.disabled = ex.page === 0;
  next.disabled = ex.page >= pages - 1;
  prev.addEventListener('click', () => { if (ex.page > 0) { ex.page -= 1; draw(); } });
  next.addEventListener('click', () => { if (ex.page < pages - 1) { ex.page += 1; draw(); } });
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportCurrentTab() {
  let headers, rows, name;

  if (ex.tab === 'dreps') {
    name = 'dreps';
    headers = ['rank', 'drep_id', 'name', 'stake_address', 'voting_power_ada', 'delegators', 'voted_actions', 'eligible', 'share_ada'];
    rows = filteredDreps().map(d => [
      d.rank, d.drep_id, d.name || '', d.stake_address,
      (d.voting_power_lovelace / 1e6).toFixed(6), d.delegators, d.voted_actions,
      d.eligible, (d.share_lovelace / 1e6).toFixed(6),
    ]);
  } else if (ex.tab === 'committee') {
    name = 'committee';
    headers = ['credential', 'name', 'region', 'stake_address', 'voted_actions', 'term_end_epoch', 'eligible', 'share_ada'];
    rows = (snap.ranking?.cc || []).map(c => [
      c.credential, c.name, c.region, c.stake_address, c.voted_actions,
      c.term_end_epoch, c.eligible, (c.share_lovelace / 1e6).toFixed(6),
    ]);
  } else if (ex.tab === 'votes') {
    name = 'votes';
    headers = ['epoch', 'action_id', 'actor_type', 'actor_id', 'actor_name', 'stake_address', 'vote', 'voted_at', 'tx_hash'];
    rows = filteredVotes().map(v => [
      v.epoch, v.action_id, v.actor_type, v.actor_id, v.actor_name || '',
      v.stake_address, v.vote, v.voted_at, v.tx_hash,
    ]);
  } else if (ex.tab === 'settlements') {
    name = 'settlements';
    headers = ['claim_id', 'epoch', 'type', 'stake_address', 'destination_address', 'amount_ada', 'fee_ada', 'tx_hash', 'block_height', 'confirmed_at'];
    rows = filteredSettlements().map(p => [
      p.claim_id, p.epoch, p.type, p.stake_address, p.destination_address,
      (p.amount_lovelace / 1e6).toFixed(6), (p.fee_lovelace / 1e6).toFixed(6),
      p.tx_hash, p.block_height, p.confirmed_at,
    ]);
  } else {
    name = 'actions';
    headers = ['epoch', 'action_id', 'tx', 'type', 'title', 'proposer', 'deposit_ada', 'expires_epoch', 'yes_pct', 'no_pct', 'abstain_pct', 'outcome'];
    rows = snap.windowActions.map(a => [
      a.epoch, a.id, a.tx, a.type, a.title, a.proposer,
      (a.deposit_lovelace / 1e6).toFixed(6), a.expires_epoch,
      a.tally.yes_pct, a.tally.no_pct, a.tally.abstain_pct, a.outcome,
    ]);
  }

  downloadFile(`govrewards-${name}.csv`, toCsv(headers, rows), 'text/csv;charset=utf-8');
  window.showToast?.(`Exported ${formatInt(rows.length)} rows`, 'success');
}
