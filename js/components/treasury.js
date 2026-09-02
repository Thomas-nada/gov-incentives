import { state, snap, showToast } from '../app.js';
import {
  getSim, resetSim, advanceEpoch, activeWindow, accruingWindow, recentEpochs,
  epochStartIso, isWindowClose, CONSTANTS,
} from '../simulation.js';
import {
  ada, adaExact, adaCompact, adaRound, formatInt, formatPct, formatDate,
  escapeHtml, shortId, copyable, explorer,
} from '../utils.js';
import { metric, emptyState } from './shared.js';

// Auto-run timer, kept outside the render so a repaint does not restart it.
let autoplay = null;
let root = null;

const STEP_MS = 1700;

export function renderTreasury(app) {
  root = app;
  draw();
}

function draw() {
  const sim = getSim();
  const accruing = accruingWindow(sim);
  const open = activeWindow(sim);

  root.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Treasury operations</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          The funding side of the programme: the stake pool earning yield, the reward account
          filling, a window closing, the payout script being funded and drained, and whatever is
          left sweeping to reserve.
        </p>
      </div>

      ${controlBar(sim)}
      ${accountsRow(sim)}

      <div class="grid lg:grid-cols-[1.35fr_1fr] gap-5 items-start">
        <div class="space-y-5">
          ${pipelineCard(sim, accruing, open)}
          ${yieldCard(sim)}
          ${ledgerCard(sim)}
        </div>
        <div class="space-y-5">
          ${delegationCard()}
          ${accrualCard(sim, accruing)}
          ${windowsCard(sim)}
        </div>
      </div>

      ${walkthroughCard()}
    </div>`;

  lucide.createIcons();
  wire();
}

// ─── Walkthrough ──────────────────────────────────────────────────────────────
const WALKTHROUGH = [
  ['Start here', 'The balances above are the live snapshot: window 521–523 funded and part-way through settling, the reward account refilling for the next one.', null],
  ['Claim as a participant', 'Open the claim page, pick a test account and take a share out of the payout script.', '#claim'],
  ['Close a window', 'Come back and run to the window close. The reward account is withdrawn, split, sealed and moved to the payout script in one epoch boundary.', null],
  ['Watch it drain', 'Keep advancing. Claims settle against the new window, and at the deadline whatever is left sweeps to reserve.', null],
  ['Check the arithmetic', 'The explorer holds the vote ledger and per-account shares the snapshot was computed from.', '#explorer'],
];

function walkthroughCard() {
  return `
    <section class="card card-pad">
      <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Suggested walkthrough</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
        An order that shows both halves of the programme in a few minutes.
      </p>
      <ol class="grid md:grid-cols-5 gap-3">
        ${WALKTHROUGH.map(([title, body, href], i) => `
          <li class="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step ${i + 1}</span>
            <p class="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mt-1">${escapeHtml(title)}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">${escapeHtml(body)}</p>
            ${href ? `<a href="${href}" class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline mt-1.5 inline-block">Go →</a>` : ''}
          </li>`).join('')}
      </ol>
    </section>`;
}

// ─── Simulation controls ──────────────────────────────────────────────────────
function controlBar(sim) {
  const running = Boolean(autoplay);
  const nextIsClose = isWindowClose(sim.epoch);

  return `
    <section class="card overflow-hidden">
      <div class="px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-4 justify-between">
        <div class="flex items-center gap-4 min-w-0">
          <span class="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
            <i data-lucide="orbit" class="w-5 h-5 text-brand-600 dark:text-brand-400"></i>
          </span>
          <div class="min-w-0">
            <div class="flex items-baseline gap-2">
              <span class="text-lg font-bold text-slate-900 dark:text-slate-50 tabular">Epoch ${sim.epoch}</span>
              <span class="pill ${nextIsClose
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}">
                ${nextIsClose ? 'Window closes next' : 'Accruing'}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ${sim.tick === 0
                ? 'Starting position, taken from the live snapshot. Step forward to run the cycle.'
                : `${sim.tick} epoch${sim.tick === 1 ? '' : 's'} simulated · ${formatDate(epochStartIso(sim.epoch))}`}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button id="sim-step" class="btn-secondary text-sm h-9 px-3.5" ${running ? 'disabled' : ''}>
            <i data-lucide="skip-forward" class="w-4 h-4"></i> Advance one epoch
          </button>
          <button id="sim-window" class="btn-secondary text-sm h-9 px-3.5" ${running ? 'disabled' : ''}>
            <i data-lucide="fast-forward" class="w-4 h-4"></i> Run to window close
          </button>
          <button id="sim-toggle" class="btn-primary text-sm h-9 px-4">
            <i data-lucide="${running ? 'pause' : 'play'}" class="w-4 h-4"></i>
            ${running ? 'Pause' : 'Auto-run'}
          </button>
          <button id="sim-reset" class="icon-btn" title="Reset to the starting position">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      ${running ? `
        <div class="h-0.5 bg-brand-100 dark:bg-brand-900/40 overflow-hidden">
          <div class="h-full w-1/3 bg-brand-500 sim-progress"></div>
        </div>` : ''}
    </section>`;
}

// ─── Account balances ─────────────────────────────────────────────────────────
function accountsRow(sim) {
  const a = sim.accounts;
  return `
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${metric({
        label: 'Delegated principal', value: adaCompact(snap.programme.principal_lovelace),
        icon: 'landmark', tone: 'slate', sub: 'Never spent — staked indefinitely',
      })}
      ${metric({
        label: 'Reward account', value: adaRound(a.reward), icon: 'piggy-bank', tone: 'brand',
        sub: 'Yield credited, awaiting the next window close',
      })}
      ${metric({
        label: 'Payout script', value: adaRound(a.payout), icon: 'wallet-cards', tone: 'emerald',
        sub: 'Funded and available to claimants',
      })}
      ${metric({
        label: 'Reserve', value: adaCompact(a.reserve), icon: 'vault', tone: 'violet',
        sub: 'Unfilled slots and expired claims',
      })}
    </section>`;
}

// ─── Lifecycle pipeline ───────────────────────────────────────────────────────
function pipelineCard(sim, accruing, open) {
  const stages = buildStages(sim, accruing, open);

  return `
    <section class="card overflow-hidden">
      <div class="card-header">
        <div>
          <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Window lifecycle</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            What the treasury does with a window's yield, from block production to sweep.
          </p>
        </div>
        <span class="text-xs text-slate-400 whitespace-nowrap">
          ${open ? `Window ${open.epochs[0]}–${open.epochs[2]}` : '—'}
        </span>
      </div>
      <div class="px-5 py-4">
        ${stages.map(stageRow).join('')}
      </div>
    </section>`;
}

function buildStages(sim, accruing, open) {
  const p = snap.programme;
  const done = s => ({ state: 'done', ...s });
  const active = s => ({ state: 'active', ...s });
  const pending = s => ({ state: 'pending', ...s });

  const claimingNow = open && open.status === 'claiming';
  const claimedPct = open && open.totalClaimants
    ? (open.claimedCount / open.totalClaimants) * 100 : 0;

  // The pipeline follows one window from end to end. That is the funded window
  // when there is one; before the first close it is the window still accruing.
  return [
    open ? done({
      icon: 'zap', title: 'Yield accrues',
      body: `The pool minted blocks across epochs ${open.epochs.join(', ')}. Rewards reach the reward
             account ${CONSTANTS.REWARD_LAG_EPOCHS} epochs after they are earned, so this window was
             filled by yield earned in epochs ${open.epochs[0] - CONSTANTS.REWARD_LAG_EPOCHS}–${open.epochs[2] - CONSTANTS.REWARD_LAG_EPOCHS}.`,
      value: `${adaRound(open.fundedLovelace)} accrued`,
    }) : active({
      icon: 'zap', title: 'Yield accrues',
      body: `The pool is minting blocks across epochs ${accruing.epochs.join(', ')}. Rewards reach the
             reward account ${CONSTANTS.REWARD_LAG_EPOCHS} epochs after they are earned.`,
      value: `${adaRound(accruing.creditedLovelace)} credited so far`,
    }),

    open ? done({
      icon: 'arrow-down-to-line', title: 'Reward account withdrawal',
      body: 'At the close of the third epoch, everything credited during the window is withdrawn in a single transaction.',
      value: `${adaRound(open.fundedLovelace)} withdrawn`,
    }) : pending({
      icon: 'arrow-down-to-line', title: 'Reward account withdrawal',
      body: `Runs at the close of epoch ${accruing.closesAtEpoch}.`,
      value: 'Waiting for the window to close',
    }),

    open ? done({
      icon: 'split', title: `Split ${p.drep_pool_pct} / ${p.cc_pool_pct}`,
      body: 'The pool is divided by role, then by the participant caps rather than by the number that actually qualified.',
      value: `DRep ${adaCompact(open.drepPool)} · committee ${adaCompact(open.ccPool)}`,
    }) : pending({
      icon: 'split', title: `Split ${p.drep_pool_pct} / ${p.cc_pool_pct}`,
      body: 'Runs immediately after the withdrawal.',
      value: '—',
    }),

    open ? done({
      icon: 'shield-check', title: 'Snapshot sealed',
      body: 'The ledger is read at the closing block. Vote records, registrations and delegated stake are frozen there.',
      value: `${formatInt(open.eligibleDreps)} DReps · ${open.eligibleCc} committee eligible`,
      hash: open.snapshotHash,
    }) : pending({
      icon: 'shield-check', title: 'Snapshot sealed',
      body: 'Eligibility is fixed at the closing block.',
      value: '—',
    }),

    open ? done({
      icon: 'send', title: 'Payout script funded',
      body: 'The full pool moves to the payout script, including the shares for slots nobody qualified for.',
      value: `${adaExact(open.drepShare)} per DRep`,
    }) : pending({
      icon: 'send', title: 'Payout script funded',
      body: 'Claimants can only draw once the script holds the pool.',
      value: '—',
    }),

    claimingNow ? active({
      icon: 'hand-coins', title: 'Claims settle',
      body: `Eligible accounts claim their equal share until the end of epoch ${open.deadlineEpoch}.`,
      value: `${formatInt(open.claimedCount)} of ${formatInt(open.totalClaimants)} settled · ${adaRound(open.claimedLovelace)} paid`,
      progress: claimedPct,
      link: open.seeded ? '#claim' : null,
    }) : open ? done({
      icon: 'hand-coins', title: 'Claims settle',
      body: 'The claim period has closed for this window.',
      value: `${formatInt(open.claimedCount)} of ${formatInt(open.totalClaimants)} settled`,
    }) : pending({
      icon: 'hand-coins', title: 'Claims settle',
      body: 'Opens once the payout script is funded.',
      value: '—',
    }),

    (() => {
      const swept = sim.windows.find(w => w.status === 'closed');
      return swept ? done({
        icon: 'vault', title: 'Unclaimed swept to reserve',
        body: 'At the deadline the script is emptied. Nothing returns to the treasury and nothing is redistributed.',
        value: `Window ${swept.epochs[0]}–${swept.epochs[2]} swept`,
      }) : pending({
        icon: 'vault', title: 'Unclaimed swept to reserve',
        body: `Runs after epoch ${open?.deadlineEpoch ?? '—'}. Unfilled slots and expired claims both land here.`,
        value: '—',
      });
    })(),
  ];
}

function stageRow(s, i, all) {
  const tone = {
    done:    { dot: 'bg-emerald-500 text-white', text: 'text-slate-700 dark:text-slate-200', icon: 'check' },
    active:  { dot: 'bg-brand-600 text-white ring-4 ring-brand-500/25', text: 'text-slate-900 dark:text-slate-50', icon: null },
    pending: { dot: 'bg-slate-200 dark:bg-slate-800 text-slate-400', text: 'text-slate-400', icon: null },
  }[s.state];

  return `
    <div class="flex gap-3.5">
      <div class="flex flex-col items-center shrink-0">
        <span class="w-7 h-7 rounded-full flex items-center justify-center ${tone.dot}">
          <i data-lucide="${tone.icon || s.icon}" class="w-3.5 h-3.5"></i>
        </span>
        ${i < all.length - 1 ? `<span class="w-px flex-1 my-1 ${s.state === 'done' ? 'bg-emerald-500/40' : 'bg-slate-200 dark:bg-slate-800'}"></span>` : ''}
      </div>
      <div class="min-w-0 flex-1 ${i < all.length - 1 ? 'pb-4' : ''}">
        <div class="flex items-baseline justify-between gap-3 flex-wrap">
          <span class="text-[13px] font-semibold ${tone.text}">${escapeHtml(s.title)}</span>
          <span class="text-xs tabular ${s.state === 'pending' ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}">${s.value}</span>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">${escapeHtml(s.body)}</p>
        ${s.progress !== undefined ? `
          <div class="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-2 max-w-sm">
            <div class="h-full rounded-full bg-emerald-500" style="width:${s.progress.toFixed(1)}%"></div>
          </div>` : ''}
        ${s.hash ? `<div class="mt-1.5">${copyable(s.hash, { display: shortId(s.hash, 16, 8), className: 'text-slate-400' })}</div>` : ''}
        ${s.link ? `<a href="${s.link}" class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline mt-1.5 inline-block">Open the claim page →</a>` : ''}
      </div>
    </div>`;
}

// ─── Pool performance ─────────────────────────────────────────────────────────
function yieldCard(sim) {
  const rows = recentEpochs(sim, 14);
  const max = Math.max(...rows.map(r => r.yieldLovelace), 1);
  const avgLuck = rows.filter(r => r.luckPct).reduce((s, r, _, a) => s + r.luckPct / a.length, 0);

  return `
    <section class="card overflow-hidden">
      <div class="card-header">
        <div>
          <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Pool performance</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Yield per epoch. Simulated epochs are picked out in colour.
          </p>
        </div>
        <span class="text-xs text-slate-400 whitespace-nowrap">Average luck ${formatPct(avgLuck, 0)}</span>
      </div>

      <div class="px-5 pt-5 pb-3">
        <div class="flex items-end gap-1.5">
          ${rows.map(r => {
            const h = Math.max(4, (r.yieldLovelace / max) * 100);
            return `
              <div class="flex-1 min-w-0 group"
                   title="Epoch ${r.epoch} · ${(r.yieldLovelace / 1e6).toFixed(0)} ₳ · ${r.blocks} blocks${r.luckPct ? ` · ${r.luckPct}% luck` : ''}">
                <div class="h-24 flex items-end">
                  <div class="w-full rounded-t transition-all group-hover:opacity-75 ${r.simulated
                    ? 'bg-brand-500 dark:bg-brand-400'
                    : 'bg-slate-300 dark:bg-slate-700'}"
                    style="height:${h}%"></div>
                </div>
                <span class="block text-[9px] text-slate-400 tabular text-center mt-1 truncate">${r.epoch}</span>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
        ${miniStat('Latest yield', adaRound(rows[rows.length - 1]?.yieldLovelace || 0))}
        ${miniStat('Blocks last epoch', `${rows[rows.length - 1]?.blocks ?? 0} of ${rows[rows.length - 1]?.expectedBlocks ?? '—'}`)}
        ${miniStat('Annualised ROA', formatPct(rows[rows.length - 1]?.roaPct || 0, 2))}
      </div>
    </section>`;
}

function miniStat(label, value) {
  return `
    <div class="px-4 py-3">
      <div class="text-[11px] text-slate-400">${escapeHtml(label)}</div>
      <div class="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular mt-0.5">${value}</div>
    </div>`;
}

// ─── Delegation ───────────────────────────────────────────────────────────────
function delegationCard() {
  const pool = snap.programme.stake_pool || {};
  const latest = state.epochs[state.epochs.length - 1] || {};
  const share = latest.active_stake_lovelace
    ? (snap.programme.principal_lovelace / latest.active_stake_lovelace) * 100 : 0;

  return `
    <section class="card card-pad">
      <div class="flex items-center gap-2.5 mb-1">
        <span class="px-1.5 py-0.5 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-bold tracking-wide">
          ${escapeHtml(pool.ticker || 'POOL')}
        </span>
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(pool.name || '')}</h2>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
        The delegation is already in place and does not move. Only the yield it produces is ever spent.
      </p>

      <dl class="space-y-2 text-xs">
        ${kv('Delegated', adaCompact(pool.delegated_lovelace))}
        ${kv('Share of active stake', formatPct(share, 3))}
        ${kv('Saturation', formatPct(pool.saturation_pct))}
        ${kv('Lifetime ROA', formatPct(pool.lifetime_roa_pct, 2))}
        ${kv('Blocks minted', formatInt(pool.blocks_lifetime))}
        ${kv('Expected per epoch', `${((CONSTANTS.BLOCKS_PER_EPOCH * share) / 100).toFixed(0)} blocks`)}
      </dl>

      <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-slate-400">Pool ID</span>
          ${copyable(pool.pool_id, { display: shortId(pool.pool_id, 10, 6), className: 'text-slate-500' })}
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-slate-400">Payout script</span>
          ${copyable(snap.programme.payout_script_address, { display: shortId(snap.programme.payout_script_address, 10, 6), className: 'text-slate-500' })}
        </div>
        <a href="${explorer.pool(pool.pool_id || '')}" target="_blank" rel="noopener"
           class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline inline-block pt-1">
          View pool on Cardanoscan <i data-lucide="external-link" class="w-3 h-3 inline-block -mt-0.5"></i>
        </a>
      </div>
    </section>`;
}

function kv(label, value) {
  return `
    <div class="flex items-baseline justify-between gap-3">
      <dt class="text-slate-400">${escapeHtml(label)}</dt>
      <dd class="font-medium text-slate-700 dark:text-slate-200 tabular text-right">${value}</dd>
    </div>`;
}

// ─── Accrual ──────────────────────────────────────────────────────────────────
function accrualCard(sim, accruing) {
  const pct = (accruing.epochsElapsed / CONSTANTS.WINDOW_LENGTH) * 100;
  const earnedRange = `${accruing.epochs[0] - CONSTANTS.REWARD_LAG_EPOCHS}–${accruing.epochs[2] - CONSTANTS.REWARD_LAG_EPOCHS}`;

  return `
    <section class="card card-pad">
      <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Next window</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
        Epochs ${accruing.epochs.join(', ')} are filling the reward account now. They will be funded
        from the yield credited during those epochs, which was earned in epochs ${earnedRange}.
      </p>

      <div class="flex items-baseline justify-between text-xs mb-1.5">
        <span class="text-slate-400">Window progress</span>
        <span class="tabular font-semibold text-slate-700 dark:text-slate-200">
          ${Math.min(accruing.epochsElapsed, CONSTANTS.WINDOW_LENGTH)} of ${CONSTANTS.WINDOW_LENGTH} epochs
        </span>
      </div>
      <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-4">
        <div class="h-full rounded-full bg-brand-600" style="width:${Math.min(100, pct).toFixed(0)}%"></div>
      </div>

      <dl class="space-y-2 text-xs">
        ${kv('Credited so far', adaExact(accruing.creditedLovelace))}
        ${kv('Awaiting credit', adaExact(sim.pending.reduce((s, p) => s + p.amount, 0)))}
        ${kv('Closes at epoch', accruing.closesAtEpoch)}
        ${kv('Projected DRep share', accruing.creditedLovelace
          ? ada(Math.floor((accruing.creditedLovelace * snap.programme.drep_pool_pct / 100) / snap.programme.max_eligible_dreps))
          : '—')}
      </dl>

      ${sim.pending.length ? `
        <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          ${sim.pending.map(p => `
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-400">Epoch ${p.earned} yield</span>
              <span class="text-slate-500 dark:text-slate-400 tabular">${ada(p.amount)} · credits in ${p.credit}</span>
            </div>`).join('')}
        </div>` : ''}
    </section>`;
}

// ─── Windows ──────────────────────────────────────────────────────────────────
function windowsCard(sim) {
  return `
    <section class="card overflow-hidden">
      <div class="card-header">
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Funded windows</h2>
      </div>
      ${sim.windows.length ? `
        <div class="divide-y divide-slate-100 dark:divide-slate-800">
          ${sim.windows.map(w => {
            const pct = w.totalClaimants ? (w.claimedCount / w.totalClaimants) * 100 : 0;
            return `
              <div class="px-4 py-3">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <span class="text-[13px] font-semibold text-slate-800 dark:text-slate-100 tabular">
                    ${w.epochs[0]}–${w.epochs[2]}
                  </span>
                  <span class="pill ${w.status === 'claiming'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}">
                    ${w.status === 'claiming' ? 'Claims open' : 'Swept'}
                  </span>
                </div>
                <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span>${adaRound(w.fundedLovelace)} funded</span>
                  <span class="tabular">${formatInt(w.claimedCount)} / ${formatInt(w.totalClaimants)} claimed</span>
                </div>
                <div class="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div class="h-full rounded-full ${w.status === 'claiming' ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}"
                       style="width:${pct.toFixed(1)}%"></div>
                </div>
              </div>`;
          }).join('')}
        </div>` : emptyState('inbox', 'No funded windows yet', 'Step past a window close to fund one.')}
    </section>`;
}

// ─── Event ledger ─────────────────────────────────────────────────────────────
const LEDGER_ICONS = {
  epoch:      { icon: 'clock', tone: 'text-slate-400' },
  reward:     { icon: 'coins', tone: 'text-brand-500' },
  withdrawal: { icon: 'arrow-down-to-line', tone: 'text-amber-500' },
  split:      { icon: 'split', tone: 'text-slate-400' },
  snapshot:   { icon: 'shield-check', tone: 'text-emerald-500' },
  fund:       { icon: 'send', tone: 'text-emerald-500' },
  claims:     { icon: 'hand-coins', tone: 'text-brand-500' },
  sweep:      { icon: 'vault', tone: 'text-violet-500' },
};

function ledgerCard(sim) {
  return `
    <section class="card overflow-hidden">
      <div class="card-header">
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Treasury events</h2>
        <span class="text-xs text-slate-400">${sim.ledger.length} recorded · newest first</span>
      </div>
      ${sim.ledger.length ? `
        <div class="divide-y divide-slate-100 dark:divide-slate-800 max-h-[26rem] overflow-y-auto">
          ${sim.ledger.map(ledgerRow).join('')}
        </div>` : emptyState('list', 'Nothing recorded yet', 'Advance an epoch to see treasury activity.')}
    </section>`;
}

function ledgerRow(e) {
  const meta = LEDGER_ICONS[e.type] || LEDGER_ICONS.epoch;
  const sign = e.direction === 'in' ? '+' : e.direction === 'out' ? '−' : '';
  const amountTone = e.direction === 'in'
    ? 'text-emerald-600 dark:text-emerald-400'
    : e.direction === 'out'
      ? 'text-slate-700 dark:text-slate-200'
      : 'text-slate-400';

  return `
    <div class="px-4 py-2.5 flex items-start gap-3">
      <span class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
        <i data-lucide="${meta.icon}" class="w-3 h-3 ${meta.tone}"></i>
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">${escapeHtml(e.label)}</p>
        ${e.detail ? `<p class="text-[11px] text-slate-400 mt-0.5 leading-relaxed">${escapeHtml(e.detail)}</p>` : ''}
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="text-[11px] text-slate-400">Epoch ${e.epoch}</span>
          ${e.tx ? `<a href="${explorer.tx(e.tx)}" target="_blank" rel="noopener"
              class="addr-chip text-slate-400 hover:text-brand-500 truncate">${escapeHtml(shortId(e.tx, 10, 4))}</a>` : ''}
        </div>
      </div>
      ${e.amount != null ? `
        <span class="text-xs font-semibold tabular whitespace-nowrap ${amountTone} shrink-0 mt-0.5">
          ${sign}${ada(e.amount)}
        </span>` : ''}
    </div>`;
}

// ─── Wiring ───────────────────────────────────────────────────────────────────
function wire() {
  root.querySelector('#sim-step')?.addEventListener('click', () => step(1));

  root.querySelector('#sim-window')?.addEventListener('click', () => {
    // Stop on the epoch after the close, so the funded window is visible.
    const sim = getSim();
    let steps = 1;
    let e = sim.epoch;
    while (!isWindowClose(e) && steps < 4) { e += 1; steps += 1; }
    step(steps);
  });

  root.querySelector('#sim-toggle')?.addEventListener('click', toggleAutoplay);

  root.querySelector('#sim-reset')?.addEventListener('click', () => {
    stopAutoplay();
    resetSim();
    draw();
    showToast('Simulation reset to the starting position', 'info');
  });
}

function step(count = 1) {
  for (let i = 0; i < count; i++) advanceEpoch();
  draw();
}

function toggleAutoplay() {
  if (autoplay) { stopAutoplay(); draw(); return; }
  autoplay = setInterval(() => {
    // The page may have been navigated away from while the timer was running.
    if (!document.body.contains(root)) { stopAutoplay(); return; }
    advanceEpoch();
    draw();
  }, STEP_MS);
  draw();
}

export function stopAutoplay() {
  if (autoplay) { clearInterval(autoplay); autoplay = null; }
}
