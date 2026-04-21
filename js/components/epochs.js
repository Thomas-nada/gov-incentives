import { state }             from '../app.js?v=15';
import { formatAda }         from '../utils.js?v=15';
import { OPEN_EPOCH }        from '../config.js?v=15';

export function renderEpochs(app) {
  const sorted = [...state.epochs].sort((a, b) => b.epoch - a.epoch);

  app.innerHTML = `
    <div class="max-w-5xl mx-auto px-4 py-10">
      <div class="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">Epoch History</h1>
          <p class="text-slate-500 dark:text-slate-400">Governance reward distribution across all recorded epochs.</p>
        </div>
        <a href="#claim" class="bg-brand-600 hover:bg-brand-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors flex-shrink-0">
          <i data-lucide="coins" class="w-4 h-4"></i> Claim Rewards
        </a>
      </div>

      <!-- Summary bar -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        ${summaryCard('Epochs recorded', sorted.length, 'calendar')}
        ${summaryCard('Total ₳ distributed', formatAda(sorted.reduce((s, e) => s + (e.ada_distributed || 0), 0)), 'trending-up')}
        ${summaryCard('Total ₳ generated', formatAda(sorted.reduce((s, e) => s + (e.rewards_generated || 0), 0)), 'zap')}
        ${summaryCard('Current window ends', OPEN_EPOCH, 'unlock')}
      </div>

      <!-- Epochs table grouped by window -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <th class="text-left px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider whitespace-nowrap">Epoch</th>
                <th class="text-right px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider whitespace-nowrap">DReps</th>
                <th class="text-right px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider whitespace-nowrap">CC</th>
                <th class="text-right px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider hidden sm:table-cell whitespace-nowrap">₳ Distributed</th>
                <th class="text-right px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider hidden md:table-cell whitespace-nowrap">Reserve Added</th>
                <th class="text-center px-5 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              ${windowGroups(sorted)}
            </tbody>
          </table>
        </div>
      </div>

      <p class="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center">
        Distributions occur on the third epoch of each window. The current window remains open for claiming. Click any row to view transparency details.
      </p>
    </div>
  `;

  // Row click → transparency
  app.querySelectorAll('.epoch-row').forEach(row => {
    row.addEventListener('click', () => {
      window.location.hash = '#transparency';
    });
  });

  lucide.createIcons();
}

// Group sorted epochs (newest first) into 3-epoch windows and render them
function windowGroups(sorted) {
  // Base 449 aligns window boundaries so epochs 521,522,523 = window 24
  const WINDOW_BASE = 449;
  const buckets     = new Map();
  for (const e of sorted) {
    const w = Math.floor((e.epoch - WINDOW_BASE) / 3);
    if (!buckets.has(w)) buckets.set(w, []);
    buckets.get(w).push(e);
  }

  // Sort buckets newest-first
  const windows = [...buckets.entries()].sort((a, b) => b[0] - a[0]);

  return windows.map(([, epochs]) => {
    const eps        = epochs.sort((a, b) => b.epoch - a.epoch);
    const first      = eps[eps.length - 1].epoch;
    const last       = eps[0].epoch;
    const payout     = eps.find(e => e.ada_distributed > 0);
    const shareEpoch = eps.find(e => e.drep_share_ada > 0);
    const isClaimOpen = eps.some(e => e.claim_open);
    const drepShare  = shareEpoch?.drep_share_ada ?? 0;
    const ccShare    = shareEpoch?.cc_share_ada   ?? 0;

    // Status label — separate from shareTag so they're siblings in the flex row
    const statusLabel = isClaimOpen
      ? `<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
           <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>Open
         </span>`
      : payout
      ? `<span class="text-xs font-semibold text-brand-600 dark:text-brand-400 whitespace-nowrap">${formatAda(payout.ada_distributed)} distributed</span>`
      : `<span class="text-xs text-slate-400 whitespace-nowrap">No payouts</span>`;

    // Per-share amounts stacked (only when we have data)
    const shareTag = drepShare ? `
      <div class="flex flex-col leading-tight border-l border-slate-200 dark:border-slate-600 pl-3 ml-1">
        <span class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">DRep <strong class="text-slate-700 dark:text-slate-200">${drepShare} ₳</strong> each</span>
        <span class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">CC&nbsp;&nbsp; <strong class="text-slate-700 dark:text-slate-200">${ccShare} ₳</strong> each</span>
      </div>` : '';

    // Window header row — use a wrapping div inside the td for flex layout
    const headerRow = `
      <tr class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
        <td colspan="6" class="px-5 py-2.5">
          <div class="flex items-center gap-3">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
              ${first}–${last}
            </span>
            ${shareTag}
            <div class="ml-auto">
              ${statusLabel}
            </div>
          </div>
        </td>
      </tr>
    `;

    const epochRows = eps.map(epoch => epochRow(epoch)).join('');
    return headerRow + epochRows;
  }).join('');
}

function epochRow(epoch) {
  const isClaim   = epoch.claim_open;
  const isOpen    = epoch.status === 'open';
  const hasPayout = epoch.ada_distributed > 0;
  const isMid     = !isOpen && !hasPayout;

  const dash = '<span class="text-slate-300 dark:text-slate-600">—</span>';

  const subLabel = hasPayout ? 'Payout epoch' : 'Accumulating';

  return `
    <tr class="trow epoch-row border-b border-slate-100 dark:border-slate-800/60 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isMid ? 'opacity-50' : ''}" data-epoch="${epoch.epoch}">
      <td class="px-5 py-3 pl-8">
        <div class="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          ${hasPayout
            ? '<i data-lucide="coins" class="w-3.5 h-3.5 text-brand-400 flex-shrink-0"></i>'
            : '<span class="w-3.5 h-3.5 flex-shrink-0"></span>'}
          ${epoch.epoch}
        </div>
        <div class="text-xs text-slate-400 mt-0.5 ml-5 whitespace-nowrap">
          ${subLabel} · ${epoch.action_count ?? 0} action${(epoch.action_count ?? 0) !== 1 ? 's' : ''} · ${formatAda(epoch.rewards_generated)} ₳ yield
        </div>
      </td>
      <td class="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
        ${hasPayout ? epoch.dreps_rewarded.toLocaleString() : dash}
      </td>
      <td class="px-5 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
        ${hasPayout ? epoch.cc_rewarded : dash}
      </td>
      <td class="px-5 py-3 text-right hidden sm:table-cell font-medium ${hasPayout ? 'text-brand-600 dark:text-brand-400' : ''}">
        ${hasPayout ? formatAda(epoch.ada_distributed) + ' ₳' : dash}
      </td>
      <td class="px-5 py-3 text-right hidden md:table-cell font-medium ${hasPayout ? 'text-emerald-600 dark:text-emerald-400' : ''}">
        ${hasPayout ? formatAda(epoch.reserve_added) + ' ₳' : dash}
      </td>
      <td class="px-5 py-3 text-center">
        ${isOpen && isClaim
          ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-semibold rounded-full whitespace-nowrap"><span class="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse inline-block"></span>Open window</span>'
          : isClaim
          ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-full whitespace-nowrap"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block"></span>Claim open</span>'
          : isOpen
          ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-semibold rounded-full whitespace-nowrap"><span class="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse inline-block"></span>Open</span>'
          : hasPayout
          ? '<span class="px-2.5 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-semibold rounded-full whitespace-nowrap">Distributed</span>'
          : '<span class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-medium rounded-full whitespace-nowrap">Closed</span>'
        }
      </td>
    </tr>
  `;
}

function summaryCard(label, value, icon) {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
      <div class="w-9 h-9 bg-brand-100 dark:bg-brand-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
        <i data-lucide="${icon}" class="w-4 h-4 text-brand-600 dark:text-brand-400"></i>
      </div>
      <div>
        <div class="text-xs text-slate-400 dark:text-slate-500">${label}</div>
        <div class="font-bold text-slate-900 dark:text-slate-100">${value}</div>
      </div>
    </div>
  `;
}
