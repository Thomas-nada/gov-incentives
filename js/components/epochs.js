import { state, snap } from '../app.js';
import {
  ada, adaCompact, adaRound, formatInt, formatPct, formatDate, formatDateTime,
  formatCountdown, progressBetween, toCsv, downloadFile,
} from '../utils.js';
import { metric } from './shared.js';

const WINDOW_LENGTH = 3;

export function renderEpochs(app) {
  const epochs = [...state.epochs].sort((a, b) => b.epoch - a.epoch);
  const windows = groupIntoWindows(epochs);

  const totalGenerated = epochs.reduce((s, e) => s + (e.rewards_generated_lovelace || 0), 0);
  const totalDistributed = epochs.reduce((s, e) => s + (e.distributed_lovelace || 0), 0);
  const totalReserve = epochs.reduce((s, e) => s + (e.reserve_added_lovelace || 0), 0);
  const avgRoa = epochs.length
    ? epochs.reduce((s, e) => s + (e.pool_roa_pct || 0), 0) / epochs.length
    : 0;

  app.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Epoch history</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
            ${formatInt(epochs.length)} epochs recorded, grouped into ${windows.length} claim windows of
            ${WINDOW_LENGTH} epochs each.
          </p>
        </div>
        <button id="epochs-export" class="btn-secondary text-sm h-9 px-3.5">
          <i data-lucide="download" class="w-4 h-4"></i> Export CSV
        </button>
      </div>

      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${metric({ label: 'Yield generated', value: adaCompact(totalGenerated), sub: 'Across all recorded epochs', icon: 'zap', tone: 'brand' })}
        ${metric({ label: 'Distributed', value: adaCompact(totalDistributed), sub: `${formatInt(snap.totals.payout_records)} payout records`, icon: 'send', tone: 'emerald' })}
        ${metric({ label: 'To reserve', value: adaCompact(totalReserve), sub: 'Unfilled slots and rounding', icon: 'piggy-bank', tone: 'violet' })}
        ${metric({ label: 'Average pool ROA', value: formatPct(avgRoa, 2), sub: `${snap.programme.stake_pool?.ticker || 'Pool'} lifetime ${formatPct(snap.programme.stake_pool?.lifetime_roa_pct, 2)}`, icon: 'trending-up', tone: 'amber' })}
      </section>

      ${currentEpochCard()}

      <section class="card overflow-hidden">
        <div class="card-header">
          <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Windows</h2>
          <p class="text-xs text-slate-400">Rewards settle on the final epoch of each window</p>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Epoch</th>
                <th class="hidden md:table-cell">Dates</th>
                <th class="text-right">Actions</th>
                <th class="text-right">Yield</th>
                <th class="text-right hidden sm:table-cell">Recipients</th>
                <th class="text-right hidden lg:table-cell">Distributed</th>
                <th class="text-right hidden lg:table-cell">To reserve</th>
                <th class="text-right">Status</th>
              </tr>
            </thead>
            <tbody>${windows.map(windowRows).join('')}</tbody>
          </table>
        </div>
      </section>
    </div>`;

  lucide.createIcons();

  app.querySelector('#epochs-export')?.addEventListener('click', () => exportCsv(epochs));
}

// ─── Current epoch ────────────────────────────────────────────────────────────
function currentEpochCard() {
  const chain = snap.chain;
  const w = snap.window;
  const pct = progressBetween(chain.current_epoch_start, chain.current_epoch_end) * 100;

  return `
    <section class="card card-pad">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="status-dot status-dot-live"></span>
            <span class="section-title">In progress</span>
          </div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-slate-50">Epoch ${chain.current_epoch}</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Started ${formatDateTime(chain.current_epoch_start)} ·
            ends ${formatDateTime(chain.current_epoch_end)}
          </p>
          <p class="text-xs text-slate-400 mt-1">
            First epoch of the next claim window. Votes cast now count towards window
            ${chain.current_epoch}–${chain.current_epoch + 2}.
          </p>
        </div>
        <div class="w-full sm:w-64">
          <div class="flex items-baseline justify-between text-xs mb-1.5">
            <span class="text-slate-400">Epoch progress</span>
            <span class="font-semibold text-slate-700 dark:text-slate-200 tabular">${pct.toFixed(0)}%</span>
          </div>
          <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div class="h-full rounded-full bg-brand-600" style="width:${pct.toFixed(1)}%"></div>
          </div>
          <p class="text-xs text-slate-400 mt-2">
            Ends in <strong class="text-slate-600 dark:text-slate-300" data-countdown="${chain.current_epoch_end}">${formatCountdown(chain.current_epoch_end)}</strong>
            · tip block ${formatInt(chain.tip_block)}
          </p>
        </div>
      </div>
    </section>`;
}

// ─── Window grouping ──────────────────────────────────────────────────────────
function groupIntoWindows(sortedDesc) {
  const buckets = new Map();
  for (const e of sortedDesc) {
    const w = e.window ?? Math.floor((e.epoch - 449) / WINDOW_LENGTH);
    if (!buckets.has(w)) buckets.set(w, []);
    buckets.get(w).push(e);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([id, eps]) => ({ id, epochs: eps.sort((a, b) => b.epoch - a.epoch) }));
}

function windowRows({ id, epochs }) {
  const last = epochs[0];
  const first = epochs[epochs.length - 1];
  const settlement = epochs.find(e => e.distributed_lovelace > 0);
  const shareEpoch = epochs.find(e => e.drep_share_lovelace > 0);
  const isOpen = epochs.some(e => e.claim_open);
  const yieldTotal = epochs.reduce((s, e) => s + (e.rewards_generated_lovelace || 0), 0);

  const status = isOpen
    ? `<span class="pill bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
         <span class="status-dot status-dot-live"></span> Claims open
       </span>`
    : settlement
      ? `<span class="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Settled</span>`
      : `<span class="pill pill-missed">No payouts</span>`;

  const shares = shareEpoch
    ? `<span class="hidden sm:inline text-xs text-slate-500 dark:text-slate-400">
         DRep <strong class="text-slate-700 dark:text-slate-200 tabular">${ada(shareEpoch.drep_share_lovelace)}</strong>
         · Committee <strong class="text-slate-700 dark:text-slate-200 tabular">${ada(shareEpoch.cc_share_lovelace)}</strong>
       </span>`
    : '';

  const header = `
    <tr class="bg-slate-50 dark:bg-slate-900/60">
      <td colspan="8" class="px-4 py-2">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Window ${first.epoch}–${last.epoch}
          </span>
          <span class="text-[11px] text-slate-400">${formatDate(first.start_time)} – ${formatDate(last.end_time)}</span>
          <span class="text-[11px] text-slate-400">·</span>
          <span class="text-[11px] text-slate-400 tabular">${adaRound(yieldTotal)} yield</span>
          ${shares}
          <span class="ml-auto">${status}</span>
        </div>
      </td>
    </tr>`;

  return header + epochs.map(epochRow).join('');
}

function epochRow(e) {
  const settled = (e.distributed_lovelace || 0) > 0;
  const open = e.status === 'open';
  const dash = '<span class="text-slate-300 dark:text-slate-700">—</span>';

  return `
    <tr class="${!settled && !open ? 'text-slate-500 dark:text-slate-400' : ''}">
      <td class="pl-7">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-slate-800 dark:text-slate-100 tabular">${e.epoch}</span>
          ${settled ? '<i data-lucide="coins" class="w-3.5 h-3.5 text-brand-400"></i>' : ''}
        </div>
        <div class="text-[11px] text-slate-400 mt-0.5 md:hidden">${formatDate(e.start_time)}</div>
      </td>
      <td class="hidden md:table-cell text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
        ${formatDate(e.start_time)} – ${formatDate(e.end_time)}
      </td>
      <td class="text-right tabular">${e.action_count || 0}</td>
      <td class="text-right tabular whitespace-nowrap">
        ${adaRound(e.rewards_generated_lovelace)}
        <span class="block text-[11px] text-slate-400">${formatPct(e.pool_roa_pct, 2)} ROA</span>
      </td>
      <td class="text-right hidden sm:table-cell tabular">
        ${settled ? `${formatInt(e.dreps_rewarded)} <span class="text-slate-400">DRep</span> · ${e.cc_rewarded} <span class="text-slate-400">CC</span>` : dash}
      </td>
      <td class="text-right hidden lg:table-cell tabular font-medium ${settled ? 'text-brand-600 dark:text-brand-400' : ''}">
        ${settled ? adaRound(e.distributed_lovelace) : dash}
      </td>
      <td class="text-right hidden lg:table-cell tabular ${settled ? 'text-emerald-600 dark:text-emerald-400' : ''}">
        ${settled ? adaRound(e.reserve_added_lovelace) : dash}
      </td>
      <td class="text-right">
        ${open
          ? '<span class="pill bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Open</span>'
          : settled
            ? '<span class="pill bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Paid</span>'
            : '<span class="pill pill-missed">Accruing</span>'}
      </td>
    </tr>`;
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportCsv(epochs) {
  const headers = [
    'epoch', 'window', 'start_time', 'end_time', 'first_block', 'action_count',
    'rewards_generated_ada', 'pool_roa_pct', 'dreps_rewarded', 'cc_rewarded',
    'distributed_ada', 'reserve_added_ada', 'drep_share_ada', 'cc_share_ada', 'status',
  ];
  const rows = [...epochs].sort((a, b) => a.epoch - b.epoch).map(e => [
    e.epoch, e.window, e.start_time, e.end_time, e.first_block, e.action_count,
    (e.rewards_generated_lovelace / 1e6).toFixed(6), e.pool_roa_pct,
    e.dreps_rewarded, e.cc_rewarded,
    (e.distributed_lovelace / 1e6).toFixed(6), (e.reserve_added_lovelace / 1e6).toFixed(6),
    (e.drep_share_lovelace / 1e6).toFixed(6), (e.cc_share_lovelace / 1e6).toFixed(6), e.status,
  ]);
  downloadFile('govrewards-epochs.csv', toCsv(headers, rows), 'text/csv;charset=utf-8');
  window.showToast?.('Epoch history exported', 'success');
}
