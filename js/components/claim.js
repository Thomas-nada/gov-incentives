import {
  state, snap, lookupAccount, resolveToStakeAddress, openWalletDialog, showToast,
} from '../app.js';
import { getClaim, saveClaim, nextClaimId } from '../claims.js';
import { DEMO_ACCOUNTS, STORAGE } from '../config.js';
import {
  ada, adaExact, adaCompact, formatInt, formatDate, formatDateTime, formatCountdown,
  relativeTime, escapeHtml, shortId, copyable, randomHex, isValidPaymentAddress,
  downloadFile, explorer,
} from '../utils.js';
import { checklist, buildChecks, identityCell, emptyState } from './shared.js';

const STEPS = ['Account', 'Eligibility', 'Payout', 'Confirmation'];

// Wizard state. Reset when the account under inspection changes, not on every
// re-render, so a theme toggle mid-claim does not throw away progress.
const cs = {
  key: null,
  step: 1,
  stakeAddress: null,
  record: null,
  lookupPerformed: false,
  destination: '',
  termsAccepted: false,
  submitting: false,
  progressIndex: -1,
  receipt: null,
};

function accountKey() {
  return `${snap.windowId}::${state.wallet?.stakeAddress || 'anonymous'}`;
}

function reset() {
  cs.key = accountKey();
  cs.step = 1;
  cs.stakeAddress = null;
  cs.record = null;
  cs.lookupPerformed = false;
  cs.destination = savedPayoutAddress();
  cs.termsAccepted = false;
  cs.submitting = false;
  cs.progressIndex = -1;
  cs.receipt = null;
}

function savedPayoutAddress() {
  try { return localStorage.getItem(STORAGE.addressBook) || ''; } catch { return ''; }
}

export function renderClaim(app) {
  if (cs.key !== accountKey()) reset();

  // A connected wallet skips the account step automatically.
  if (!cs.lookupPerformed && state.wallet?.stakeAddress) {
    runLookup(state.wallet.stakeAddress);
  }

  draw(app);
}

function runLookup(input) {
  const stakeAddress = resolveToStakeAddress(input);
  cs.stakeAddress = stakeAddress;
  cs.record = lookupAccount(stakeAddress);
  cs.lookupPerformed = true;

  const existing = getClaim(stakeAddress, snap.windowId);
  if (existing) {
    cs.receipt = existing;
    cs.step = 4;
  } else {
    cs.step = 2;
  }
}

function draw(app) {
  const w = snap.window;

  app.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="mb-5">
        <h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Claim rewards</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          ${escapeHtml(w.label || '')} · epochs ${w.epochs?.join(', ')} ·
          closes ${formatDate(w.claim_deadline_at)}
        </p>
      </div>

      <div class="grid lg:grid-cols-[1fr_20rem] gap-6 items-start">
        <div class="space-y-5">
          <div class="card card-pad">${stepper()}</div>
          <div class="card">${stepBody()}</div>
        </div>
        ${sidebar()}
      </div>
    </div>`;

  wire(app);
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function stepper() {
  return `
    <div class="stepper">
      ${STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < cs.step;
        const active = n === cs.step;
        return `
          ${i > 0 ? `<div class="step-line ${done || active ? 'step-line-done' : ''}"></div>` : ''}
          <div class="step-node">
            <div class="step-dot ${done ? 'step-dot-done' : active ? 'step-dot-active' : ''}">
              ${done ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : n}
            </div>
            <span class="step-label ${active ? 'step-label-active' : ''}">${label}</span>
          </div>`;
      }).join('')}
    </div>`;
}

function stepBody() {
  if (cs.step === 4) return stepConfirmation();
  if (cs.step === 3) return stepPayout();
  if (cs.step === 2) return stepEligibility();
  return stepAccount();
}

// ─── Step 1 — account ─────────────────────────────────────────────────────────
function stepAccount() {
  return `
    <div class="card-pad">
      <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Identify your governance account</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5 leading-relaxed">
        Connect the wallet holding your DRep or committee key, or look up an account directly by
        its governance identifier.
      </p>

      <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-4 mb-5">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Connect a wallet</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            Reads your reward address over CIP-30. No spending permission is requested.
          </p>
        </div>
        <button id="claim-connect" class="btn-primary text-sm h-9 px-4 shrink-0">
          <i data-lucide="wallet" class="w-4 h-4"></i> Connect
        </button>
      </div>

      <label for="claim-lookup" class="field-label mb-1.5 block">Or enter a governance identifier</label>
      <div class="flex gap-2">
        <input id="claim-lookup" type="text" spellcheck="false" autocomplete="off"
          class="input addr-chip flex-1" placeholder="drep1… · cc_hot1… · stake1…" />
        <button id="claim-lookup-go" class="btn-primary h-10 px-4 text-sm">
          <i data-lucide="search" class="w-4 h-4"></i> Look up
        </button>
      </div>
      ${cs.lookupPerformed && !cs.record ? `
        <p class="text-xs text-red-500 mt-2 flex items-center gap-1.5">
          <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
          Not found in the ${escapeHtml(snap.window.label || '')} snapshot.
        </p>` : ''}

      <div class="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
        <p class="field-label mb-2.5">Test accounts</p>
        <div class="grid sm:grid-cols-2 gap-2">
          ${DEMO_ACCOUNTS.map((d, i) => `
            <button class="demo-option" data-demo="${i}">
              <span class="min-w-0 text-left">
                <span class="block text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">${escapeHtml(d.name)}</span>
                <span class="block text-[11px] text-slate-400 truncate">${escapeHtml(d.summary)}</span>
              </span>
              <span class="outcome-pill outcome-${d.outcome}">${d.outcome === 'eligible' ? 'Eligible' : d.outcome === 'ineligible' ? 'Ineligible' : 'Not found'}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>`;
}

// ─── Step 2 — eligibility ─────────────────────────────────────────────────────
function accountHeader() {
  const r = cs.record;
  const id = r?.drep_id || r?.cc_credential || cs.stakeAddress;
  const roleLabel = r?.type === 'cc' ? 'Constitutional Committee' : r?.type === 'drep' ? 'Delegated Representative' : 'Stake key';
  return `
    <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        ${identityCell(r?.name, id, { idHead: 18, idTail: 8 })}
      </div>
      <div class="text-right shrink-0">
        <div class="text-[11px] text-slate-400">${escapeHtml(roleLabel)}</div>
        <button id="claim-change" class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">Change account</button>
      </div>
    </div>`;
}

function stepEligibility() {
  const r = cs.record;
  if (!r) return accountHeader() + notFoundBody();

  const w = snap.window;
  const checks = buildChecks(r, {
    windowMeta: { ...w, max_eligible_dreps: snap.programme.max_eligible_dreps },
    existingClaim: getClaim(cs.stakeAddress, snap.windowId),
  });
  const passed = checks.every(c => c.passed);

  return `
    ${accountHeader()}
    <div class="card-pad">
      ${passed ? `
        <div class="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/25 p-4 mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600 dark:text-emerald-400"></i>
            </span>
            <div>
              <p class="text-sm font-bold text-slate-900 dark:text-slate-50">Eligible to claim</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">All requirements met for ${escapeHtml(w.label || '')}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular leading-none">${ada(r.amount_lovelace)}</div>
            <div class="addr-chip text-emerald-600/70 dark:text-emerald-500/70 mt-1">${adaExact(r.amount_lovelace)}</div>
          </div>
        </div>` : ineligibleBanner(r)}

      <p class="field-label mb-1">Requirements</p>
      ${checklist(checks)}

      <div class="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 grid sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
        ${r.type === 'drep' ? `
          ${kv('Voting power', adaCompact(r.voting_power_lovelace))}
          ${kv('Delegators', formatInt(r.delegators))}
          ${kv('Voting power rank', r.rank ? `${formatInt(r.rank)} of ${formatInt(w.registered_dreps)}` : '—')}
          ${kv('Full-participation rank', r.participation_rank ? `${formatInt(r.participation_rank)} of ${formatInt(w.full_participation_dreps)}` : '—')}
        ` : `
          ${kv('Committee seat', escapeHtml(r.region || 'Global'))}
          ${kv('Term ends', r.term_end_epoch ? `Epoch ${r.term_end_epoch}` : '—')}
          ${kv('Qualifying members', formatInt(w.eligible_cc))}
          ${kv('Committee size', formatInt(snap.programme.committee_size))}
        `}
      </div>

      <div class="mt-6 flex flex-wrap gap-2.5">
        ${passed
          ? `<button id="claim-to-payout" class="btn-primary text-sm h-10 px-5">
               Continue to payout <i data-lucide="arrow-right" class="w-4 h-4"></i>
             </button>`
          : `<a href="#docs" class="btn-secondary text-sm h-10 px-4">
               <i data-lucide="book-open" class="w-4 h-4"></i> Read the eligibility rules
             </a>`}
        <a href="#profile" class="btn-secondary text-sm h-10 px-4">
          <i data-lucide="list" class="w-4 h-4"></i> See my voting record
        </a>
      </div>
    </div>`;
}

function kv(label, value) {
  return `
    <div class="flex items-baseline justify-between gap-3">
      <span class="text-slate-400">${label}</span>
      <span class="font-medium text-slate-700 dark:text-slate-200 tabular text-right">${value}</span>
    </div>`;
}

function ineligibleBanner(r) {
  const max = formatInt(snap.programme.max_eligible_dreps);
  let title = 'Not eligible for this window';
  let body = 'This account does not meet the requirements for the current claim window.';
  let advice = '';

  if (r.ineligible_reason === 'incomplete_votes') {
    const missed = (r.total_actions || 0) - (r.voted_actions || 0);
    title = `${missed} governance action${missed === 1 ? '' : 's'} missed`;
    body = `Eligibility is all-or-nothing: every one of the ${r.total_actions} actions in the window must be voted on. There is no partial share.`;
    advice = 'Vote on every action in the next window to qualify. Vote direction — Yes, No or Abstain — does not matter.';
  } else if (r.ineligible_reason === 'outside_top_200') {
    const place = r.participation_rank;
    const field = snap.window.full_participation_dreps;
    title = `Outside the top ${max} by voting power`;
    body = `This DRep voted on all ${r.total_actions} actions${place ? `, placing ${formatInt(place)} of the ${formatInt(field)} accounts that did` : ''}. Only the largest ${max} by delegated stake qualify.`;
    advice = `The cut-off is recalculated every window, so growing delegation can bring the account inside the top ${max}.`;
  }

  return `
    <div class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/25 p-4 mb-5">
      <div class="flex items-start gap-3">
        <span class="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
          <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-600 dark:text-amber-400"></i>
        </span>
        <div class="min-w-0">
          <p class="text-sm font-bold text-slate-900 dark:text-slate-50">${escapeHtml(title)}</p>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">${escapeHtml(body)}</p>
          ${advice ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">${escapeHtml(advice)}</p>` : ''}
        </div>
      </div>
    </div>`;
}

function notFoundBody() {
  return `
    <div class="card-pad">
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 mb-5 flex items-start gap-3">
        <span class="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
          <i data-lucide="search-x" class="w-5 h-5 text-slate-400"></i>
        </span>
        <div>
          <p class="text-sm font-bold text-slate-900 dark:text-slate-50">Not in this snapshot</p>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            This stake key was not registered as a DRep and did not hold a committee seat at block
            ${formatInt(snap.window.snapshot_block)}, when the ${escapeHtml(snap.window.label || '')} snapshot was taken.
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Registering as a DRep now makes the account eligible from the next window onward,
            provided it votes on every action in that window.
          </p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2.5">
        <button id="claim-change" class="btn-secondary text-sm h-10 px-4">
          <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Try another account
        </button>
        <a href="#docs" class="btn-secondary text-sm h-10 px-4">
          <i data-lucide="book-open" class="w-4 h-4"></i> Eligibility rules
        </a>
      </div>
    </div>`;
}

// ─── Step 3 — payout details ──────────────────────────────────────────────────
function stepPayout() {
  const r = cs.record;
  const valid = isValidPaymentAddress(cs.destination);
  const showError = cs.destination.length > 0 && !valid;

  if (cs.submitting) return accountHeader() + submissionBody();

  return `
    ${accountHeader()}
    <div class="card-pad">
      <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Where should the reward go?</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5 leading-relaxed">
        The programme sends ${ada(r.amount_lovelace)} to this address once the claim is authorised.
        Payment addresses only — a stake address cannot receive funds.
      </p>

      <label for="claim-destination" class="field-label mb-1.5 block">Payout address</label>
      <div class="relative">
        <input id="claim-destination" type="text" spellcheck="false" autocomplete="off"
          value="${escapeHtml(cs.destination)}" placeholder="addr1…"
          class="input addr-chip pr-9 ${showError ? 'input-error' : valid ? 'input-valid' : ''}" />
        ${valid ? `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2"></i>` : ''}
      </div>
      ${showError
        ? `<p class="text-xs text-red-500 mt-1.5">Enter a valid Cardano payment address beginning with <code>addr1</code>.</p>`
        : `<p class="text-xs text-slate-400 mt-1.5">Paste the receive address from any Cardano wallet.</p>`}

      <div class="mt-3 flex flex-wrap gap-2">
        <button id="claim-fill-demo" class="btn-secondary text-xs h-7 px-2.5">
          <i data-lucide="clipboard-paste" class="w-3.5 h-3.5"></i> Use a sample address
        </button>
        ${savedPayoutAddress() && savedPayoutAddress() !== cs.destination ? `
          <button id="claim-fill-saved" class="btn-secondary text-xs h-7 px-2.5">
            <i data-lucide="history" class="w-3.5 h-3.5"></i> Use last payout address
          </button>` : ''}
      </div>

      <div class="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/25 p-3 mt-4 flex items-start gap-2.5">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-px"></i>
        <p class="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
          Do not use an exchange deposit address. Exchanges credit deposits by memo and a programme
          payout carries none, so funds sent there are usually unrecoverable.
        </p>
      </div>

      <div class="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
        <p class="field-label mb-3">Claim summary</p>
        <dl class="space-y-2 text-xs">
          ${kv('Reward', `<span class="addr-chip">${adaExact(r.amount_lovelace)}</span>`)}
          ${kv('Network fee', '<span class="text-slate-400">paid by the programme</span>')}
          ${kv('You receive', `<strong class="text-slate-900 dark:text-slate-50">${adaExact(r.amount_lovelace)}</strong>`)}
          ${kv('Settlement', 'Within one epoch of authorisation')}
        </dl>
      </div>

      <label class="flex items-start gap-2.5 mt-5 cursor-pointer">
        <input id="claim-terms" type="checkbox" ${cs.termsAccepted ? 'checked' : ''}
          class="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 shrink-0" />
        <span class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          I confirm I control this payout address and that one claim is permitted per account per
          window. I understand a claim cannot be reversed or redirected once authorised.
        </span>
      </label>

      <div class="mt-5 flex flex-wrap gap-2.5">
        <button id="claim-submit" class="btn-primary text-sm h-10 px-5" ${valid && cs.termsAccepted ? '' : 'disabled'}>
          <i data-lucide="pen-line" class="w-4 h-4"></i> Sign and submit claim
        </button>
        <button id="claim-back" class="btn-secondary text-sm h-10 px-4">Back</button>
      </div>
    </div>`;
}

// ─── Submission progress ──────────────────────────────────────────────────────
const PROGRESS_STEPS = [
  'Validating your signature',
  'Verifying eligibility against the snapshot',
  'Building the payout transaction',
  'Submitting to the network',
  'Waiting for confirmation',
];

function submissionBody() {
  return `
    <div class="card-pad">
      <h2 class="text-base font-bold text-slate-900 dark:text-slate-50 mb-1">Processing your claim</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-5">
        Keep this page open. The claim is recorded once the transaction confirms.
      </p>
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        ${PROGRESS_STEPS.map((label, i) => {
          const done = i < cs.progressIndex;
          const active = i === cs.progressIndex;
          return `
            <div class="tx-step ${active ? 'tx-step-active' : done ? 'tx-step-done' : ''}">
              <span class="tx-step-icon">
                ${done
                  ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500"></i>'
                  : active
                    ? '<span class="spinner text-brand-500"></span>'
                    : '<span class="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>'}
              </span>
              <span>${escapeHtml(label)}</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Step 4 — receipt ─────────────────────────────────────────────────────────
function stepConfirmation() {
  const c = cs.receipt;
  if (!c) return emptyState('receipt', 'No claim on record', 'Start a claim to see its receipt here.');

  return `
    <div class="px-5 py-6 text-center border-b border-slate-100 dark:border-slate-800">
      <div class="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
        <i data-lucide="check-circle-2" class="w-7 h-7 text-emerald-600 dark:text-emerald-400"></i>
      </div>
      <h2 class="text-lg font-bold text-slate-900 dark:text-slate-50">Claim confirmed</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
        ${ada(c.amount_lovelace)} sent to your payout address.
      </p>
      <p class="text-xs text-slate-400 mt-1">
        Confirmed <span data-reltime="${c.confirmed_at}">${relativeTime(c.confirmed_at)}</span>
        · ${formatDateTime(c.confirmed_at)}
      </p>
    </div>

    <div class="card-pad">
      <p class="field-label mb-3">Receipt</p>
      <dl class="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
        ${receiptRow('Claim reference', copyable(c.claim_id))}
        ${receiptRow('Window', `${escapeHtml(c.window_label)} · epochs ${c.epochs.join(', ')}`)}
        ${receiptRow('Account', copyable(c.gov_id, { display: shortId(c.gov_id, 16, 8) }))}
        ${receiptRow('Amount', `<span class="addr-chip font-semibold text-slate-800 dark:text-slate-100">${adaExact(c.amount_lovelace)}</span>`)}
        ${receiptRow('Network fee', `<span class="addr-chip text-slate-500">${adaExact(c.fee_lovelace)}</span>`)}
        ${receiptRow('Payout address', copyable(c.destination_address, { display: shortId(c.destination_address, 18, 10) }))}
        ${receiptRow('Transaction', `
          <span class="inline-flex items-center gap-2">
            ${copyable(c.tx_hash, { display: shortId(c.tx_hash, 16, 8) })}
            <a href="${explorer.tx(c.tx_hash)}" target="_blank" rel="noopener" class="text-brand-600 dark:text-brand-400 hover:underline whitespace-nowrap">
              Explorer <i data-lucide="external-link" class="w-3 h-3 inline-block -mt-0.5"></i>
            </a>
          </span>`)}
        ${receiptRow('Block', formatInt(c.block_height))}
        ${receiptRow('Status', `<span class="pill pill-yes"><i data-lucide="check" class="w-3 h-3"></i> ${escapeHtml(c.status)}</span>`)}
      </dl>

      <div class="mt-5 flex flex-wrap gap-2.5">
        <button id="claim-download" class="btn-secondary text-sm h-9 px-4">
          <i data-lucide="download" class="w-4 h-4"></i> Download receipt
        </button>
        <a href="#profile" class="btn-secondary text-sm h-9 px-4">
          <i data-lucide="user" class="w-4 h-4"></i> My account
        </a>
        <button id="claim-change" class="btn-ghost text-sm h-9 px-3">Claim for another account</button>
      </div>

      <p class="text-[11px] text-slate-400 mt-5 leading-relaxed">
        This receipt is stored in your browser. In production it would also be retrievable from the
        programme API by claim reference.
      </p>
    </div>`;
}

function receiptRow(label, value) {
  // The value column must not be flex-shrunk: squeezing it makes short
  // identifiers such as the claim reference ellipsise for no reason.
  return `
    <div class="flex items-center justify-between gap-4 px-3.5 py-2.5">
      <dt class="text-slate-400 min-w-0 truncate">${label}</dt>
      <dd class="text-right shrink-0 max-w-[70%] text-slate-700 dark:text-slate-200">${value}</dd>
    </div>`;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function sidebar() {
  const w = snap.window;
  return `
    <aside class="space-y-4 lg:sticky lg:top-28">
      <div class="card card-pad">
        <p class="field-label mb-3">This window</p>
        <dl class="space-y-2.5 text-xs">
          ${kv('Epochs', w.epochs?.join(', ') || '—')}
          ${kv('Governance actions', formatInt(w.total_actions))}
          ${kv('Reward pool', adaCompact(w.total_pool_lovelace))}
          ${kv('Eligible DReps', formatInt(w.eligible_dreps))}
          ${kv('Eligible committee', formatInt(w.eligible_cc))}
        </dl>
        <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p class="text-[11px] text-slate-400 mb-1">Claims close in</p>
          <p class="text-lg font-bold text-amber-600 dark:text-amber-400 tabular"
             data-countdown="${w.claim_deadline_at}" data-seconds="1">
            ${formatCountdown(w.claim_deadline_at, { withSeconds: true })}
          </p>
          <p class="text-[11px] text-slate-400 mt-1">End of epoch ${w.claim_deadline_epoch}, ${formatDate(w.claim_deadline_at)}</p>
        </div>
      </div>

      <div class="card card-pad">
        <p class="field-label mb-2.5">Before you claim</p>
        <ul class="space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <li class="flex gap-2"><i data-lucide="info" class="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px"></i><span class="leading-relaxed">One claim per account per window. It cannot be redirected afterwards.</span></li>
          <li class="flex gap-2"><i data-lucide="info" class="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px"></i><span class="leading-relaxed">Signing proves key ownership. It never authorises a spend from your wallet.</span></li>
          <li class="flex gap-2"><i data-lucide="info" class="w-3.5 h-3.5 text-slate-400 shrink-0 mt-px"></i><span class="leading-relaxed">Anything unclaimed by the deadline returns to the programme reserve.</span></li>
        </ul>
        <a href="#docs" class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline mt-3 inline-block">
          Read the full rules →
        </a>
      </div>
    </aside>`;
}

// ─── Event wiring ─────────────────────────────────────────────────────────────
function wire(app) {
  lucide.createIcons();

  app.querySelector('#claim-connect')?.addEventListener('click', () => openWalletDialog());

  app.querySelector('#claim-lookup-go')?.addEventListener('click', () => {
    const value = app.querySelector('#claim-lookup')?.value.trim();
    if (!value) { showToast('Enter a DRep ID, committee credential or stake address', 'warning'); return; }
    runLookup(value);
    draw(app);
  });
  app.querySelector('#claim-lookup')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') app.querySelector('#claim-lookup-go').click();
  });

  app.querySelectorAll('[data-demo]').forEach(btn => btn.addEventListener('click', () => {
    const demo = DEMO_ACCOUNTS[Number(btn.dataset.demo)];
    if (!demo) return;
    runLookup(demo.address);
    draw(app);
  }));

  app.querySelectorAll('#claim-change').forEach(btn => btn.addEventListener('click', () => {
    cs.step = 1;
    cs.lookupPerformed = false;
    cs.record = null;
    cs.stakeAddress = null;
    cs.receipt = null;
    cs.termsAccepted = false;
    draw(app);
  }));

  app.querySelector('#claim-to-payout')?.addEventListener('click', () => {
    cs.step = 3;
    draw(app);
  });

  app.querySelector('#claim-back')?.addEventListener('click', () => {
    cs.step = 2;
    draw(app);
  });

  const dest = app.querySelector('#claim-destination');
  if (dest) {
    dest.addEventListener('input', () => {
      const caret = dest.selectionStart;
      cs.destination = dest.value.trim();
      redrawPayout(app, caret);
    });
  }

  app.querySelector('#claim-fill-demo')?.addEventListener('click', () => {
    cs.destination = sampleAddress();
    draw(app);
  });
  app.querySelector('#claim-fill-saved')?.addEventListener('click', () => {
    cs.destination = savedPayoutAddress();
    draw(app);
  });

  app.querySelector('#claim-terms')?.addEventListener('change', e => {
    cs.termsAccepted = e.target.checked;
    const submit = app.querySelector('#claim-submit');
    if (submit) submit.disabled = !(cs.termsAccepted && isValidPaymentAddress(cs.destination));
  });

  app.querySelector('#claim-submit')?.addEventListener('click', () => openSignatureDialog(app));

  app.querySelector('#claim-download')?.addEventListener('click', () => {
    const c = cs.receipt;
    downloadFile(`${c.claim_id}.json`, JSON.stringify(c, null, 2), 'application/json');
    showToast('Receipt downloaded', 'success');
  });
}

/** Re-renders and restores the caret so validation can update while typing. */
function redrawPayout(app, caret) {
  draw(app);
  const field = app.querySelector('#claim-destination');
  if (field) {
    field.focus();
    try { field.setSelectionRange(caret, caret); } catch {}
  }
}

function sampleAddress() {
  const chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  let out = 'addr1q';
  const bytes = new Uint8Array(92);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

// ─── Signature dialog ─────────────────────────────────────────────────────────
function openSignatureDialog(app) {
  const r = cs.record;
  const w = snap.window;
  const nonce = randomHex(32);
  const issued = new Date().toISOString();
  const govId = r.drep_id || r.cc_credential || cs.stakeAddress;

  const payload = [
    'Cardano Governance Rewards — claim authorisation',
    '',
    `Window:     ${w.label} (epochs ${w.epochs.join(', ')})`,
    `Claimant:   ${govId}`,
    `Stake key:  ${cs.stakeAddress}`,
    `Amount:     ${adaExact(r.amount_lovelace, { symbol: false })} ADA`,
    `Payout to:  ${cs.destination}`,
    `Snapshot:   ${w.snapshot_hash}`,
    `Nonce:      ${nonce}`,
    `Issued:     ${issued}`,
  ].join('\n');

  const el = document.createElement('div');
  el.id = 'sign-dialog';
  el.className = 'modal-root';
  el.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-panel modal-panel-wide" role="dialog" aria-modal="true" aria-label="Sign claim authorisation">
      <div class="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <i data-lucide="pen-line" class="w-4 h-4 text-slate-500 dark:text-slate-400"></i>
          </span>
          <div>
            <h2 class="text-sm font-bold text-slate-900 dark:text-slate-50">Sign message</h2>
            <p class="text-[11px] text-slate-400">${escapeHtml(state.wallet?.walletName === 'demo' || !state.wallet?.walletName ? 'Simulated wallet prompt' : state.wallet.walletName)} · CIP-8 data signature</p>
          </div>
        </div>
      </div>
      <div class="px-5 py-4">
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          This proves you control the governance key. It is a message signature, not a transaction —
          it cannot move funds from your wallet.
        </p>
        <pre class="addr-chip bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-x-auto leading-relaxed text-slate-600 dark:text-slate-300">${escapeHtml(payload)}</pre>
      </div>
      <div class="px-5 pb-5 flex gap-2.5 justify-end">
        <button id="sign-reject" class="btn-secondary text-sm h-9 px-4">Reject</button>
        <button id="sign-approve" class="btn-primary text-sm h-9 px-5">
          <i data-lucide="check" class="w-4 h-4"></i> Sign
        </button>
      </div>
    </div>`;

  document.body.appendChild(el);
  document.body.classList.add('overflow-hidden');
  lucide.createIcons({ nodes: [el] });

  const close = () => {
    el.remove();
    document.body.classList.remove('overflow-hidden');
  };

  el.querySelector('#sign-reject').addEventListener('click', () => {
    close();
    showToast('Signature rejected — no claim was submitted', 'warning');
  });
  el.querySelector('#sign-approve').addEventListener('click', () => {
    close();
    submitClaim(app, { nonce, issued });
  });
}

// ─── Submission ───────────────────────────────────────────────────────────────
const STEP_DELAYS = [520, 700, 900, 1100, 1400];

function submitClaim(app, signature) {
  cs.submitting = true;
  cs.progressIndex = 0;
  draw(app);

  const advance = () => {
    cs.progressIndex += 1;
    if (cs.progressIndex >= PROGRESS_STEPS.length) return finaliseClaim(app, signature);
    draw(app);
    setTimeout(advance, STEP_DELAYS[cs.progressIndex] || 800);
  };
  setTimeout(advance, STEP_DELAYS[0]);
}

function finaliseClaim(app, signature) {
  const r = cs.record;
  const w = snap.window;
  const settlementEpoch = w.epochs[w.epochs.length - 1];
  // The wizard has just spent ~5s simulating build, submit and confirmation, so
  // date the receipt as if that had happened rather than in the future.
  const confirmedAt = new Date();
  const submittedAt = new Date(confirmedAt.getTime() - 47_000);

  const receipt = {
    claim_id: nextClaimId(settlementEpoch, w.claims_settled),
    window_id: snap.windowId,
    window_label: w.label,
    epochs: w.epochs,
    epoch: settlementEpoch,
    stake_address: cs.stakeAddress,
    gov_id: r.drep_id || r.cc_credential || cs.stakeAddress,
    name: r.name || null,
    type: r.type,
    amount_lovelace: r.amount_lovelace,
    fee_lovelace: 168_009 + Math.floor(Math.random() * 23_396),
    destination_address: cs.destination,
    tx_hash: randomHex(64),
    block_height: (w.snapshot_block || 0) + 8_200 + Math.floor(Math.random() * 12_000),
    status: 'confirmed',
    submitted_at: submittedAt.toISOString(),
    confirmed_at: confirmedAt.toISOString(),
    signature: { nonce: signature.nonce, issued_at: signature.issued, scheme: 'CIP-8' },
    snapshot_hash: w.snapshot_hash,
  };

  saveClaim(receipt);
  try { localStorage.setItem(STORAGE.addressBook, cs.destination); } catch {}

  cs.receipt = receipt;
  cs.submitting = false;
  cs.progressIndex = -1;
  cs.step = 4;
  draw(app);
  showToast(`Claim ${receipt.claim_id} confirmed`, 'success', 5200);
}
