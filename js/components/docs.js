import { snap } from '../app.js';
import { SUPPORT_EMAIL, ACTION_TYPES } from '../config.js';
import {
  adaExact, adaCompact, adaRound, formatInt, formatDate, formatDateTime,
  escapeHtml, shortId, copyable,
} from '../utils.js';
import { actionTypePill } from './shared.js';

const SECTIONS = [
  ['funding',      'Where the rewards come from'],
  ['window',       'The three-epoch window'],
  ['actions',      'What counts as a governance action'],
  ['eligibility',  'Eligibility rules'],
  ['calculation',  'How your share is calculated'],
  ['claiming',     'Claiming and settlement'],
  ['reserve',      'The reserve'],
  ['faq',          'Frequently asked questions'],
  ['glossary',     'Glossary'],
];

export function renderDocs(app) {
  const p = snap.programme;
  const w = snap.window;

  app.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="grid lg:grid-cols-[16rem_1fr] gap-8 items-start">

        <aside class="hidden lg:block lg:sticky lg:top-28">
          <p class="field-label mb-3">Contents</p>
          <nav class="space-y-0.5">
            ${SECTIONS.map(([id, label], i) => `
              <a href="#docs" data-scroll="doc-${id}" class="doc-toc flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
                <span class="tabular text-slate-300 dark:text-slate-600 w-3.5 shrink-0">${i + 1}</span>
                <span class="leading-snug">${label}</span>
              </a>`).join('')}
          </nav>
          <div class="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <p class="field-label mb-2">Need help?</p>
            <a href="mailto:${SUPPORT_EMAIL}" class="text-xs text-brand-600 dark:text-brand-400 hover:underline break-all">${SUPPORT_EMAIL}</a>
          </div>
        </aside>

        <div class="min-w-0 max-w-3xl">
          <header class="mb-8">
            <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-2">Programme documentation</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Everything that determines whether an account qualifies for a reward, how much it
              receives, and how the payment settles. Figures shown are from the live snapshot,
              ${escapeHtml(w.label || '')}.
            </p>
            <div class="flex flex-wrap gap-2 mt-4 text-xs">
              <span class="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Portal v${escapeHtml(p.version || '')}</span>
              <span class="pill bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Updated ${formatDate(snap.window.snapshot_taken_at)}</span>
              <span class="pill bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Demo data</span>
            </div>
          </header>

          ${fundingSection(p, w)}
          ${windowSection(w)}
          ${actionsSection(w)}
          ${eligibilitySection(p, w)}
          ${calculationSection(p, w)}
          ${claimingSection(w)}
          ${reserveSection()}
          ${faqSection(p, w)}
          ${glossarySection()}

          <section class="card card-pad mt-10">
            <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Still stuck?</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              Include your DRep ID or committee credential and, if you have one, the claim reference
              from your receipt. Most eligibility questions are answered by the requirement list on
              the claim page.
            </p>
            <div class="flex flex-wrap gap-2">
              <a href="mailto:${SUPPORT_EMAIL}" class="btn-primary text-sm h-9 px-4">
                <i data-lucide="mail" class="w-4 h-4"></i> Contact support
              </a>
              <a href="#claim" class="btn-secondary text-sm h-9 px-4">
                <i data-lucide="hand-coins" class="w-4 h-4"></i> Check eligibility
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>`;

  lucide.createIcons();

  app.querySelectorAll('[data-scroll]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById(link.dataset.scroll)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

// ─── Section helpers ──────────────────────────────────────────────────────────
function section(id, index, title, body) {
  return `
    <section id="doc-${id}" class="mb-10 scroll-mt-32">
      <div class="flex items-baseline gap-2.5 mb-3">
        <span class="text-xs font-bold text-slate-300 dark:text-slate-600 tabular">${String(index).padStart(2, '0')}</span>
        <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">${title}</h2>
      </div>
      <div class="prose-doc">${body}</div>
    </section>`;
}

function callout(text, tone = 'brand', icon = 'info') {
  const cls = {
    brand: 'border-brand-200 dark:border-brand-900/50 bg-brand-50 dark:bg-brand-950/25 text-brand-800 dark:text-brand-200',
    amber: 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/25 text-amber-800 dark:text-amber-200',
  }[tone];
  return `
    <div class="rounded-xl border ${cls} p-3.5 flex items-start gap-2.5 my-4">
      <i data-lucide="${icon}" class="w-4 h-4 shrink-0 mt-px opacity-70"></i>
      <p class="text-xs leading-relaxed !mb-0">${text}</p>
    </div>`;
}

function dataTable(rows) {
  return `
    <div class="card overflow-hidden my-4">
      <table class="data-table">
        <tbody>
          ${rows.map(([k, v]) => `
            <tr>
              <td class="text-slate-500 dark:text-slate-400 w-1/2">${k}</td>
              <td class="text-right font-medium text-slate-800 dark:text-slate-100 tabular">${v}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── Sections ─────────────────────────────────────────────────────────────────
function fundingSection(p, w) {
  const pool = p.stake_pool || {};
  return section('funding', 1, 'Where the rewards come from', `
    <p>The programme is funded by a single delegation of <strong>${adaCompact(p.principal_lovelace)}</strong>
    from the Cardano treasury to a dedicated stake pool. The principal is never spent. Only the
    staking yield it produces is distributed, so the programme never needs a recurring treasury
    withdrawal to keep running.</p>
    <p>Yield varies with network conditions and pool performance. The three epochs in the current
    window produced <strong>${adaRound(w.total_pool_lovelace)}</strong> between them, and that
    figure is the entire reward pool for the window.</p>
    ${dataTable([
      ['Stake pool', `${escapeHtml(pool.ticker || '')} — ${escapeHtml(pool.name || '')}`],
      ['Pool ID', copyable(pool.pool_id, { display: shortId(pool.pool_id, 14, 8) })],
      ['Delegated principal', adaCompact(pool.delegated_lovelace)],
      ['Saturation', `${pool.saturation_pct}%`],
      ['Lifetime ROA', `${pool.lifetime_roa_pct}%`],
    ])}
    ${callout('Because rewards are yield only, a poor epoch for the pool means a smaller pool that window — not a shortfall paid from elsewhere.')}
    <p>The <a href="#treasury" class="text-brand-600 dark:text-brand-400 hover:underline">treasury page</a>
    shows this side of the programme end to end, and lets you step an epoch at a time through the
    pool earning yield, a window closing and being funded, claims draining the payout script, and
    the remainder sweeping to reserve.</p>
  `);
}

function windowSection(w) {
  return section('window', 2, 'The three-epoch window', `
    <p>Activity is grouped into rolling windows of three epochs, roughly fifteen days. Windows serve
    two purposes: they make each payout large enough to be worth claiming, and they reward sustained
    participation rather than a single well-timed vote.</p>
    <ul>
      <li><strong>Epochs 1 and 2</strong> — voting continues, yield accrues, nothing is decided.</li>
      <li><strong>End of epoch 3</strong> — the ledger is read at a fixed block. Vote records, DRep
      registrations, committee seats and delegated stake are all frozen at that point.</li>
      <li><strong>Claim period</strong> — qualifying accounts have ${snap.programme.claim_grace_epochs}
      epochs to claim before the window closes for good.</li>
    </ul>
    ${dataTable([
      ['Current window', escapeHtml(w.label || '')],
      ['Epochs', (w.epochs || []).join(', ')],
      ['Window closed', formatDateTime(w.closed_at)],
      ['Snapshot block', formatInt(w.snapshot_block)],
      ['Snapshot slot', formatInt(w.snapshot_slot)],
      ['Claim deadline', `End of epoch ${w.claim_deadline_epoch}, ${formatDate(w.claim_deadline_at)}`],
    ])}
  `);
}

function actionsSection(w) {
  const types = Object.entries(ACTION_TYPES)
    .filter(([key]) => key !== 'NewConstitution');
  return section('actions', 3, 'What counts as a governance action', `
    <p>A governance action is any on-chain proposal submitted under CIP-1694. Every action that
    reaches a vote during the window counts towards eligibility, whatever its type or outcome.
    The current window contains <strong>${w.total_actions}</strong> of them.</p>
    <div class="grid sm:grid-cols-2 gap-2 my-4">
      ${types.map(([key, meta]) => `
        <div class="card px-3.5 py-3">
          <div class="mb-1.5">${actionTypePill(key, { short: false })}</div>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed !mb-0">${escapeHtml(TYPE_BLURB[key] || '')}</p>
        </div>`).join('')}
    </div>
    ${callout('Vote direction is irrelevant. Yes, No and Abstain all count as participation — the programme rewards showing up, not agreeing.')}
  `);
}

const TYPE_BLURB = {
  TreasuryWithdrawal: 'Moves ADA out of the treasury to a specified reward address.',
  ParameterChange: 'Alters one or more updatable protocol parameters, excluding the major version.',
  Info: 'Records a community signal. Nothing on-chain changes when it ratifies.',
  HardForkInitiation: 'Triggers a non-backwards-compatible upgrade; needs a prior software release.',
  UpdateConstitution: 'Changes the Constitution or the proposal policy, recorded as on-chain hashes.',
  NoConfidence: 'Moves the network into a state of no confidence in the current committee.',
  NewCommittee: 'Changes committee membership, its signature threshold, or member terms.',
};

function eligibilitySection(p, w) {
  return section('eligibility', 4, 'Eligibility rules', `
    <p>Eligibility is <strong>all or nothing</strong>. Missing a single action in the window
    disqualifies an account for that window; there is no partial share and no appeal, because the
    determination is made mechanically from the frozen ledger.</p>
    <p><strong>DReps</strong> must satisfy three conditions:</p>
    <ul>
      <li>Registered as a DRep at the snapshot block.</li>
      <li>Voted on all ${w.total_actions} governance actions in the window.</li>
      <li>Ranked in the top ${formatInt(p.max_eligible_dreps)} by delegated voting power among those
      who voted on everything.</li>
    </ul>
    <p><strong>Committee members</strong> must satisfy two:</p>
    <ul>
      <li>Held an active seat at the snapshot block.</li>
      <li>Voted on all ${w.total_actions} governance actions in the window.</li>
    </ul>
    ${callout(`The top-${formatInt(p.max_eligible_dreps)} cut-off is applied <em>after</em> full participation is checked, so it ranks only the accounts that already voted on everything. In this window ${formatInt(w.eligible_dreps)} DReps and ${formatInt(w.eligible_cc)} committee members qualified.`)}
  `);
}

function calculationSection(p, w) {
  return section('calculation', 5, 'How your share is calculated', `
    <p>The pool is split by role, then divided into equal shares. Voting power affects whether you
    qualify, never how much you receive — a DRep ranked 200th is paid exactly what a DRep ranked
    first is paid.</p>
    ${dataTable([
      ['Window pool', adaExact(w.total_pool_lovelace)],
      [`DRep pool (${p.drep_pool_pct}%)`, adaExact(w.drep_pool_lovelace)],
      [`Committee pool (${p.cc_pool_pct}%)`, adaExact(w.cc_pool_lovelace)],
      [`DRep share (÷ ${formatInt(p.max_eligible_dreps)})`, adaExact(w.drep_share_lovelace)],
      [`Committee share (÷ ${p.committee_size})`, adaExact(w.cc_share_lovelace)],
    ])}
    <p>Note the divisors: the DRep pool is always divided by the cap of
    ${formatInt(p.max_eligible_dreps)} and the committee pool by the full committee size of
    ${p.committee_size}, regardless of how many accounts actually qualify. Shares belonging to slots
    nobody filled are added to the reserve rather than inflating everyone else's payout.</p>
    ${callout('If two or more DReps tie in voting power exactly at the cut-off, all tied accounts qualify and the divisor increases accordingly.', 'amber', 'alert-triangle')}
  `);
}

function claimingSection(w) {
  return section('claiming', 6, 'Claiming and settlement', `
    <p>Claiming has four steps and takes about a minute.</p>
    <ul>
      <li><strong>Identify the account.</strong> Connect a CIP-30 wallet, or enter a DRep ID,
      committee credential or stake address to look up eligibility read-only.</li>
      <li><strong>Review the requirement list.</strong> Each condition is shown with the value used
      to evaluate it, so a failure is always traceable to a specific number.</li>
      <li><strong>Provide a payout address.</strong> Any Cardano payment address beginning with
      <code>addr1</code>. Not a stake address, and not an exchange deposit address.</li>
      <li><strong>Sign the authorisation.</strong> A CIP-8 message signature proves you control the
      governance key. It is not a transaction and cannot move funds from your wallet.</li>
    </ul>
    <p>Settlement follows within one epoch. The receipt records the claim reference, transaction
    hash, block height and exact amount, and remains retrievable afterwards.</p>
    ${callout(`One claim per account per window, and a payout address cannot be changed after authorisation. Claims for ${escapeHtml(w.label || '')} close at the end of epoch ${w.claim_deadline_epoch}.`, 'amber', 'alert-triangle')}
  `);
}

function reserveSection() {
  const t = snap.totals;
  return section('reserve', 7, 'The reserve', `
    <p>Two things flow into the reserve: shares for slots that nobody qualified for, and shares that
    qualifying accounts never claimed before the deadline. Nothing is returned to the treasury and
    nothing is redistributed to other participants in the same window.</p>
    ${dataTable([
      ['Reserve balance', adaExact(t.reserve_balance_lovelace)],
      ['Lifetime yield generated', adaCompact(t.generated_lovelace)],
      ['Lifetime distributed', adaCompact(t.distributed_lovelace)],
      ['Epochs recorded', formatInt(t.epochs_recorded)],
    ])}
    <p>The reserve exists so the programme can absorb a weak yield epoch without cutting payouts,
    and so a governance decision could later direct the accumulated balance somewhere useful.</p>
  `);
}

function faqSection(p, w) {
  const faqs = [
    ['I voted on every action but I am still not eligible. Why?',
     `Almost always the top-${formatInt(p.max_eligible_dreps)} cut-off. Full participation qualifies you for the ranking, and the ranking then keeps only the largest ${formatInt(p.max_eligible_dreps)} by delegated stake. The claim page shows your placing among the ${formatInt(w.full_participation_dreps)} accounts that voted on everything, which is the number the cut-off is applied to.`],
    ['Does voting Abstain hurt me?',
     'No. Abstain is a recorded vote and counts exactly like Yes or No. Only a missing vote costs eligibility.'],
    ['I delegated more stake after the window closed. Does it help?',
     'Not for this window — the snapshot is fixed at the closing block. It counts from the next window onward.'],
    ['Can I claim to an exchange address?',
     'You can, but you should not. Exchanges credit deposits using a memo or tag that a programme payout does not carry, and funds sent that way are usually unrecoverable.'],
    ['What happens if I miss the claim deadline?',
     `The share returns to the programme reserve. It cannot be claimed retroactively, so claims for ${escapeHtml(w.label || '')} must be made before the end of epoch ${w.claim_deadline_epoch}.`],
    ['Is signing the authorisation risky?',
     'No. It is a CIP-8 data signature over a plain-text message, not a transaction. It has no inputs, no outputs and no witness that a spend could use.'],
    ['Can one account claim twice?',
     'No. Claims are keyed by stake address and window, and a second attempt returns the original receipt.'],
    ['Why do the amounts have six decimal places?',
     'Everything is computed in lovelace, the smallest ADA unit. The pool rarely divides evenly, so shares carry a fractional remainder that stays in the reserve.'],
  ];

  return section('faq', 8, 'Frequently asked questions', `
    <div class="space-y-2 not-prose">
      ${faqs.map(([q, a]) => `
        <details class="card group">
          <summary class="px-4 py-3 cursor-pointer flex items-center justify-between gap-3 list-none">
            <span class="text-[13px] font-medium text-slate-800 dark:text-slate-100">${escapeHtml(q)}</span>
            <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open:rotate-180"></i>
          </summary>
          <p class="px-4 pb-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed !mb-0">${a}</p>
        </details>`).join('')}
    </div>
  `);
}

function glossarySection() {
  const terms = [
    ['DRep', 'Delegated Representative. An account registered to vote on governance actions on behalf of the stake delegated to it.'],
    ['Constitutional Committee', 'The body that checks governance actions against the Constitution. It has a fixed number of seats and fixed terms.'],
    ['Governance action', 'An on-chain proposal under CIP-1694 that DReps, the committee and stake pool operators vote on.'],
    ['Claim window', 'Three consecutive epochs treated as one reward period.'],
    ['Snapshot block', 'The block at which the ledger is read to determine eligibility. Nothing after it counts.'],
    ['Lovelace', 'The smallest unit of ADA. One ADA is 1,000,000 lovelace.'],
    ['Voting power', 'The total stake delegated to a DRep at the snapshot block.'],
    ['CIP-8', 'The Cardano standard for signing arbitrary messages with a wallet key, used here to prove ownership.'],
  ];
  return section('glossary', 9, 'Glossary', `
    <dl class="not-prose card divide-y divide-slate-100 dark:divide-slate-800">
      ${terms.map(([term, def]) => `
        <div class="px-4 py-3">
          <dt class="text-[13px] font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(term)}</dt>
          <dd class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">${escapeHtml(def)}</dd>
        </div>`).join('')}
    </dl>
  `);
}
