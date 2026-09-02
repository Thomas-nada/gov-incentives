// Treasury-side simulation.
//
// The claim pages read a frozen snapshot. This module models the other half of
// the programme — the stake pool earning yield, the reward account filling up,
// a window closing, the payout script being funded, claims draining it and the
// remainder sweeping to reserve — as a state machine you can step an epoch at a
// time. It is the piece you drive when walking someone through the whole cycle.
//
// Nothing here touches the bundled snapshot; the simulation starts from it and
// projects forward, so stepping never invalidates the claim flow.

import { state, snap } from './app.js';
import { STORAGE } from './config.js';

const VERSION = 1;

const BLOCKS_PER_EPOCH = 21_600;
const EPOCHS_PER_YEAR = 73;
const WINDOW_BASE = 449;        // window boundaries: 449, 452, … 521, 524
const WINDOW_LENGTH = 3;
const REWARD_LAG_EPOCHS = 2;    // Cardano pays staking rewards two epochs in arrears

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
// A fixed seed means a rehearsed demo tells the same story every time it is
// reset, rather than surprising the presenter with a new one.
function rngFrom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function gauss(rand, mean, sd) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hex(rand, length = 64) {
  let out = '';
  for (let i = 0; i < length; i++) out += '0123456789abcdef'[Math.floor(rand() * 16)];
  return out;
}

// ─── Epoch helpers ────────────────────────────────────────────────────────────
export function windowOf(epoch) {
  return Math.floor((epoch - WINDOW_BASE) / WINDOW_LENGTH);
}

export function isWindowClose(epoch) {
  return (epoch - WINDOW_BASE) % WINDOW_LENGTH === WINDOW_LENGTH - 1;
}

export function windowEpochs(epoch) {
  const last = WINDOW_BASE + windowOf(epoch) * WINDOW_LENGTH + WINDOW_LENGTH - 1;
  return [last - 2, last - 1, last];
}

export function epochStartIso(epoch) {
  const base = new Date(snap.chain.current_epoch_start).getTime();
  const days = (epoch - snap.chain.current_epoch) * (snap.chain.epoch_length_days || 5);
  return new Date(base + days * 86_400_000).toISOString();
}

export function epochEndIso(epoch) {
  return epochStartIso(epoch + 1);
}

function blockAt(epoch) {
  return (snap.chain.tip_block || 0) + (epoch - snap.chain.current_epoch) * BLOCKS_PER_EPOCH;
}

// ─── Seeding ──────────────────────────────────────────────────────────────────
function historicalYield(epoch) {
  const row = state.epochs.find(e => e.epoch === epoch);
  return row?.rewards_generated_lovelace || 0;
}

/**
 * The starting position is the world as the snapshot describes it: epoch 524 in
 * progress, window 521-523 already funded and part-way through settling, and a
 * reward account holding only what has been credited since.
 */
function seed() {
  const w = snap.window;
  const chain = snap.chain;
  const startEpoch = chain.current_epoch;
  const rand = rngFrom(startEpoch * 7919);

  // Window 521-523 was funded at its close, so the account has been drained and
  // refilled only by the credit that arrived at the start of the current epoch.
  const credited = historicalYield(startEpoch - REWARD_LAG_EPOCHS);

  const sim = {
    version: VERSION,
    seed: startEpoch * 7919,
    tick: 0,
    epoch: startEpoch,
    accounts: {
      reward: credited,
      payout: Math.max(0, (w.total_pool_lovelace || 0) - (w.claims_settled_lovelace || 0)),
      reserve: snap.totals.reserve_balance_lovelace || 0,
    },
    // Yield earned but not yet credited to the reward account.
    pending: [
      { earned: startEpoch - 1, credit: startEpoch + 1, amount: historicalYield(startEpoch - 1) },
    ],
    creditedByWindow: { [windowOf(startEpoch)]: credited },
    epochLog: [],
    windows: [{
      id: windowOf(w.epochs[w.epochs.length - 1]),
      epochs: [...w.epochs],
      status: 'claiming',
      fundedLovelace: w.total_pool_lovelace,
      drepPool: w.drep_pool_lovelace,
      ccPool: w.cc_pool_lovelace,
      drepShare: w.drep_share_lovelace,
      ccShare: w.cc_share_lovelace,
      eligibleDreps: w.eligible_dreps,
      eligibleCc: w.eligible_cc,
      claimedCount: w.claims_settled,
      claimedLovelace: w.claims_settled_lovelace,
      totalClaimants: (w.eligible_dreps || 0) + (w.eligible_cc || 0),
      deadlineEpoch: w.claim_deadline_epoch,
      snapshotHash: w.snapshot_hash,
      snapshotBlock: w.snapshot_block,
      seeded: true,
    }],
    ledger: [],
  };

  // A few opening entries so the ledger is not blank on first view.
  push(sim, {
    epoch: startEpoch, type: 'fund',
    label: `Payout script funded for window ${w.epochs.join('–')}`,
    amount: w.total_pool_lovelace, direction: 'in', account: 'payout',
    at: w.claim_opens_at, tx: hex(rand),
  });
  push(sim, {
    epoch: startEpoch, type: 'claims',
    label: `${w.claims_settled} of ${sim.windows[0].totalClaimants} claims settled`,
    amount: w.claims_settled_lovelace, direction: 'out', account: 'payout',
    at: epochStartIso(startEpoch), tx: hex(rand),
  });
  push(sim, {
    epoch: startEpoch, type: 'reward',
    label: `Reward credit for epoch ${startEpoch - REWARD_LAG_EPOCHS}`,
    amount: credited, direction: 'in', account: 'reward',
    at: epochStartIso(startEpoch), tx: hex(rand),
  });

  return sim;
}

function push(sim, entry) {
  sim.ledger.unshift({ id: `${sim.ledger.length}-${entry.type}-${entry.epoch}`, ...entry });
  if (sim.ledger.length > 200) sim.ledger.length = 200;
}

// ─── Persistence ──────────────────────────────────────────────────────────────
let cache = null;

export function getSim() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE.simulation);
    if (raw) {
      const parsed = JSON.parse(raw);
      // A snapshot regeneration moves the world; start over rather than mixing.
      if (parsed?.version === VERSION && parsed.startedFrom === snap.chain.current_epoch) {
        cache = parsed;
        return cache;
      }
    }
  } catch { /* fall through to a fresh seed */ }

  cache = seed();
  cache.startedFrom = snap.chain.current_epoch;
  persist();
  return cache;
}

function persist() {
  try { localStorage.setItem(STORAGE.simulation, JSON.stringify(cache)); } catch {}
}

export function resetSim() {
  cache = seed();
  cache.startedFrom = snap.chain.current_epoch;
  persist();
  return cache;
}

// ─── Stepping ─────────────────────────────────────────────────────────────────
/**
 * Closes the current epoch and opens the next one. Everything the treasury does
 * happens on an epoch boundary, so this is the only mutation the page needs.
 */
export function advanceEpoch() {
  const sim = getSim();
  const closing = sim.epoch;
  const rand = rngFrom(sim.seed + sim.tick * 104_729);
  sim.tick += 1;

  // 1. The pool mints its blocks and earns the epoch's yield.
  const activeStake = state.epochs[state.epochs.length - 1]?.active_stake_lovelace
    || 21_700_000_000 * 1_000_000;
  const principal = snap.programme.principal_lovelace;
  const expectedBlocks = (BLOCKS_PER_EPOCH * principal) / activeStake;
  // Par is the pool's own mean yield, so simulated luck sits on the same scale
  // as the historical epochs the chart shows alongside it.
  const parRoa = (snap.programme.stake_pool?.par_roa_pct ?? 2.74) / 100;
  const parYield = (principal * parRoa) / EPOCHS_PER_YEAR;

  const luck = Math.max(0.55, Math.min(1.45, gauss(rand, 1, 0.16)));
  const blocks = Math.max(1, Math.round(expectedBlocks * luck));
  const earned = Math.round(parYield * luck);

  sim.epochLog.push({
    epoch: closing,
    blocks,
    expectedBlocks: Number(expectedBlocks.toFixed(1)),
    luckPct: Number((luck * 100).toFixed(1)),
    yieldLovelace: earned,
    roaPct: Number(((earned / principal) * EPOCHS_PER_YEAR * 100).toFixed(2)),
  });
  if (sim.epochLog.length > 40) sim.epochLog.shift();

  sim.pending.push({ earned: closing, credit: closing + REWARD_LAG_EPOCHS, amount: earned });

  push(sim, {
    epoch: closing, type: 'epoch',
    label: `Epoch ${closing} closed · ${blocks} blocks minted · ${(luck * 100).toFixed(0)}% luck`,
    amount: earned, direction: 'earned', account: null,
    at: epochEndIso(closing), tx: null,
    detail: `${blocks} of ${expectedBlocks.toFixed(1)} expected · ${((earned / principal) * EPOCHS_PER_YEAR * 100).toFixed(2)}% ROA`,
  });

  // 2. The epoch boundary is crossed.
  const opening = closing + 1;
  sim.epoch = opening;

  // 3. Rewards earned two epochs ago are credited to the reward account.
  const due = sim.pending.filter(p => p.credit === opening);
  sim.pending = sim.pending.filter(p => p.credit !== opening);
  for (const p of due) {
    sim.accounts.reward += p.amount;
    const wid = windowOf(opening);
    sim.creditedByWindow[wid] = (sim.creditedByWindow[wid] || 0) + p.amount;
    push(sim, {
      epoch: opening, type: 'reward',
      label: `Reward credit for epoch ${p.earned}`,
      amount: p.amount, direction: 'in', account: 'reward',
      at: epochStartIso(opening), tx: hex(rand),
      detail: 'Credited two epochs in arrears',
    });
  }

  // 4. Claims continue to settle against any open window.
  settleClaims(sim, rand, opening);

  // 5. A window that has just ended is withdrawn, split, sealed and funded.
  if (isWindowClose(closing)) settleWindow(sim, rand, closing);

  // 6. A window past its deadline sweeps whatever is left to reserve.
  sweepExpired(sim, rand, opening);

  persist();
  return sim;
}

function settleClaims(sim, rand, epoch) {
  for (const w of sim.windows) {
    if (w.status !== 'claiming') continue;
    const outstanding = w.totalClaimants - w.claimedCount;
    if (outstanding <= 0) continue;

    // Uptake decays: most eligible accounts claim in the first epoch or two.
    const epochsOpen = epoch - (w.epochs[2] + 1);
    const rate = Math.max(0.12, 0.55 - 0.12 * epochsOpen);
    const settled = Math.min(outstanding, Math.max(1, Math.round(outstanding * rate * (0.7 + rand() * 0.6))));

    const drepsLeft = Math.max(0, w.eligibleDreps - Math.min(w.claimedCount, w.eligibleDreps));
    const ccPortion = Math.min(settled, Math.max(0, w.eligibleCc - Math.max(0, w.claimedCount - w.eligibleDreps)));
    const ccCount = drepsLeft > 0 ? Math.min(ccPortion, Math.round(settled * 0.03)) : ccPortion;
    const drepCount = settled - ccCount;
    const amount = drepCount * w.drepShare + ccCount * w.ccShare;

    w.claimedCount += settled;
    w.claimedLovelace += amount;
    sim.accounts.payout = Math.max(0, sim.accounts.payout - amount);

    push(sim, {
      epoch, type: 'claims',
      label: `${settled} claims settled for window ${w.epochs[0]}–${w.epochs[2]}`,
      amount, direction: 'out', account: 'payout',
      at: epochStartIso(epoch), tx: hex(rand),
      detail: `${w.claimedCount} of ${w.totalClaimants} eligible accounts have now claimed`,
    });
  }
}

function settleWindow(sim, rand, closingEpoch) {
  const wid = windowOf(closingEpoch);
  const epochs = windowEpochs(closingEpoch);
  const credited = sim.creditedByWindow[wid] || 0;
  if (credited <= 0) return;

  const at = epochEndIso(closingEpoch);
  const maxDreps = snap.programme.max_eligible_dreps;
  const committee = snap.programme.committee_size;

  // Withdraw everything credited during the window.
  sim.accounts.reward = Math.max(0, sim.accounts.reward - credited);
  push(sim, {
    epoch: closingEpoch, type: 'withdrawal',
    label: `Reward account withdrawal for window ${epochs[0]}–${epochs[2]}`,
    amount: credited, direction: 'out', account: 'reward',
    at, tx: hex(rand),
    detail: `Yield credited during epochs ${epochs.join(', ')}, earned in ${epochs[0] - REWARD_LAG_EPOCHS}–${epochs[2] - REWARD_LAG_EPOCHS}`,
  });

  // Split by role.
  const drepPool = Math.round((credited * snap.programme.drep_pool_pct) / 100);
  const ccPool = credited - drepPool;
  push(sim, {
    epoch: closingEpoch, type: 'split',
    label: `Pool split ${snap.programme.drep_pool_pct}/${snap.programme.cc_pool_pct}`,
    amount: credited, direction: 'note', account: null, at, tx: null,
    detail: `DRep pool ${(drepPool / 1e6).toFixed(2)} ₳ · committee pool ${(ccPool / 1e6).toFixed(2)} ₳`,
  });

  // Seal the snapshot and fix eligibility.
  const eligibleDreps = Math.max(150, Math.min(maxDreps, Math.round(gauss(rand, maxDreps - 6, 12))));
  const eligibleCc = Math.max(3, Math.min(committee, Math.round(gauss(rand, 5, 1))));
  const drepShare = Math.floor(drepPool / maxDreps);
  const ccShare = Math.floor(ccPool / committee);
  const snapshotHash = hex(rand);
  const snapshotBlock = blockAt(closingEpoch + 1);

  push(sim, {
    epoch: closingEpoch, type: 'snapshot',
    label: `Snapshot sealed at block ${snapshotBlock.toLocaleString('en-US')}`,
    amount: null, direction: 'note', account: null, at, tx: null,
    detail: `${eligibleDreps} DReps and ${eligibleCc} committee members voted on every action`,
    hash: snapshotHash,
  });

  // Fund the payout script with the full pool, including the slots nobody filled.
  sim.accounts.payout += credited;
  push(sim, {
    epoch: closingEpoch, type: 'fund',
    label: `Payout script funded for window ${epochs[0]}–${epochs[2]}`,
    amount: credited, direction: 'in', account: 'payout',
    at, tx: hex(rand),
    detail: `DRep share ${(drepShare / 1e6).toFixed(6)} ₳ · committee share ${(ccShare / 1e6).toFixed(6)} ₳`,
  });

  sim.windows.unshift({
    id: wid,
    epochs,
    status: 'claiming',
    fundedLovelace: credited,
    drepPool, ccPool, drepShare, ccShare,
    eligibleDreps, eligibleCc,
    claimedCount: 0,
    claimedLovelace: 0,
    totalClaimants: eligibleDreps + eligibleCc,
    deadlineEpoch: closingEpoch + snap.programme.claim_grace_epochs,
    snapshotHash, snapshotBlock,
    seeded: false,
  });
  if (sim.windows.length > 6) sim.windows.length = 6;

  sim.creditedByWindow[wid] = 0;
}

function sweepExpired(sim, rand, epoch) {
  for (const w of sim.windows) {
    if (w.status !== 'claiming' || epoch <= w.deadlineEpoch) continue;

    const unclaimedSlots = (snap.programme.max_eligible_dreps - w.eligibleDreps) * w.drepShare
      + (snap.programme.committee_size - w.eligibleCc) * w.ccShare;
    const remainder = Math.max(0, w.fundedLovelace - w.claimedLovelace);

    w.status = 'closed';
    if (remainder > 0) {
      sim.accounts.payout = Math.max(0, sim.accounts.payout - remainder);
      sim.accounts.reserve += remainder;
      push(sim, {
        epoch, type: 'sweep',
        label: `Window ${w.epochs[0]}–${w.epochs[2]} swept to reserve`,
        amount: remainder, direction: 'in', account: 'reserve',
        at: epochStartIso(epoch), tx: hex(rand),
        detail: `${(unclaimedSlots / 1e6).toFixed(2)} ₳ from unfilled slots, the rest unclaimed`,
      });
    }
  }
}

/**
 * A claim made on the claim page. Recording it here keeps the two halves of the
 * demo consistent: taking a share out on the claim page visibly drains the
 * payout script on the treasury page.
 */
export function recordExternalClaim(receipt) {
  const sim = getSim();
  const w = sim.windows.find(x => x.epochs.join('-') === receipt.epochs.join('-'));
  if (!w || w.status !== 'claiming') return;

  w.claimedCount += 1;
  w.claimedLovelace += receipt.amount_lovelace;
  sim.accounts.payout = Math.max(0, sim.accounts.payout - receipt.amount_lovelace);

  push(sim, {
    epoch: sim.epoch, type: 'claims',
    label: `Claim ${receipt.claim_id} settled`,
    amount: receipt.amount_lovelace, direction: 'out', account: 'payout',
    at: receipt.confirmed_at, tx: receipt.tx_hash,
    detail: `${receipt.type === 'cc' ? 'Committee member' : 'DRep'} claim submitted from the claim page`,
  });
  persist();
}

// ─── Derived views ────────────────────────────────────────────────────────────
export function activeWindow(sim = getSim()) {
  return sim.windows.find(w => w.status === 'claiming') || sim.windows[0] || null;
}

/** The window currently accruing yield — the one the pool is filling right now. */
export function accruingWindow(sim = getSim()) {
  const epochs = windowEpochs(sim.epoch);
  const wid = windowOf(sim.epoch);
  return {
    id: wid,
    epochs,
    creditedLovelace: sim.creditedByWindow[wid] || 0,
    epochsElapsed: sim.epoch - epochs[0] + 1,
    closesAtEpoch: epochs[2],
  };
}

export function recentEpochs(sim = getSim(), count = 12) {
  const historical = state.epochs
    .slice(-count)
    .map(e => ({
      epoch: e.epoch,
      blocks: e.pool_blocks,
      expectedBlocks: e.pool_expected_blocks,
      luckPct: e.pool_expected_blocks ? Number(((e.pool_blocks / e.pool_expected_blocks) * 100).toFixed(1)) : null,
      yieldLovelace: e.rewards_generated_lovelace,
      roaPct: e.pool_roa_pct,
      simulated: false,
    }));
  const simulated = sim.epochLog.map(e => ({ ...e, simulated: true }));
  return [...historical, ...simulated].slice(-count);
}

export const CONSTANTS = { BLOCKS_PER_EPOCH, EPOCHS_PER_YEAR, REWARD_LAG_EPOCHS, WINDOW_LENGTH };
