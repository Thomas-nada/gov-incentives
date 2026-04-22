import { state } from '../app.js?v=15';
import { DREP_POOL_PCT, CC_POOL_PCT, MAX_ELIGIBLE_DREPS,
         PRINCIPAL_ADA, OPEN_EPOCHS } from '../config.js?v=15';

export function renderGuide(app) {
  const windowData = state.rankings?.window_521_523 || null;
  const totalPoolAda = windowData?.total_pool_ada || 0;
  const drepPoolAda = windowData?.drep_pool_ada || 0;
  const ccPoolAda = windowData?.cc_pool_ada || 0;
  const drepShareAda = windowData?.drep_share_ada || 0;
  const ccShareAda = windowData?.cc_share_ada || 0;

  app.innerHTML = `
    <div class="max-w-3xl mx-auto px-4 py-10">

      <!-- Header -->
      <div class="mb-10">
        <div class="inline-flex items-center gap-2 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full px-3 py-1 text-xs font-semibold mb-4">
          <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Programme Guide
        </div>
        <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">How It Works</h1>
        <p class="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
          A complete walkthrough of the Governance Rewards Engine — from treasury funding to claiming your share.
        </p>
      </div>

      <!-- Table of contents -->
      <nav class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-10">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contents</p>
        <ol class="space-y-1.5 text-sm">
          ${tocItem(1, 'The Funding Source', '#guide-funding')}
          ${tocItem(2, 'The 3-Epoch Window', '#guide-window')}
          ${tocItem(3, 'Governance Actions', '#guide-actions')}
          ${tocItem(4, 'DRep Eligibility & Rewards', '#guide-dreps')}
          ${tocItem(5, 'CC Member Eligibility & Rewards', '#guide-cc')}
          ${tocItem(6, 'How the Reward Pool Is Split', '#guide-split')}
          ${tocItem(7, 'Claiming Your Reward', '#guide-claim')}
          ${tocItem(8, 'The Reserve Fund', '#guide-reserve')}
          ${tocItem(9, 'Key Rules at a Glance', '#guide-rules')}
        </ol>
      </nav>

      <!-- 1. Funding source -->
      <section id="guide-funding" class="mb-12">
        ${sectionHeader('1', 'The Funding Source', 'landmark')}
        <div class="prose-section">
          <p>The programme is seeded by a one-time delegation of <strong>${(PRINCIPAL_ADA / 1_000_000).toLocaleString()}M ₳</strong> from the Cardano Treasury to a dedicated stake pool. This principal is never spent — only the staking yield it generates is used as rewards.</p>
          <p>Each epoch, the staked principal generates yield that varies with network conditions and pool performance. The three epochs in the current window produced a combined reward pool of <strong>${totalPoolAda.toLocaleString()} ₳</strong>, which is then split between DReps and CC members.</p>
          <p>Because the programme runs entirely on yield, no recurring treasury proposals are required. The 75M ₳ principal remains staked indefinitely, sustaining the engine for as long as the Cardano network operates.</p>
        </div>
        ${infoBox('The pool is self-sustaining. Governance participants are rewarded from staking yield — not from spending the treasury principal.')}
      </section>

      <!-- 2. The 3-Epoch Window -->
      <section id="guide-window" class="mb-12">
        ${sectionHeader('2', 'The 3-Epoch Window', 'calendar')}
        <div class="prose-section">
          <p>The app groups activity into <strong>rolling 3-epoch windows</strong>. In the current bundled snapshot, the claim and transparency views focus on epochs <strong>${OPEN_EPOCHS.join(', ')}</strong>.</p>
          <p>The window structure serves two purposes:</p>
          <ul>
            <li>It gives governance participants a larger, more meaningful reward amount per claim.</li>
            <li>It groups governance actions together so that only participants who engaged consistently across the entire window are rewarded — one missed vote in three epochs disqualifies you.</li>
          </ul>
          <p>Each epoch runs for approximately 5 days, making each window roughly <strong>15 days</strong>. In the current prototype, eligibility for the displayed window is precomputed in bundled snapshot data rather than generated live from chain events.</p>
        </div>
        ${windowDiagram()}
      </section>

      <!-- 3. Governance Actions -->
      <section id="guide-actions" class="mb-12">
        ${sectionHeader('3', 'Governance Actions', 'file-text')}
        <div class="prose-section">
          <p>A governance action is any on-chain proposal submitted to the Cardano governance system under CIP-1694. The full action set is:</p>
        </div>
        <div class="grid sm:grid-cols-2 gap-3 mb-5">
          ${actionType('Motion of No-Confidence', 'A motion to create a state of no-confidence in the current constitutional committee.', 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300')}
          ${actionType('New Constitutional Committee / Threshold / Terms', 'Changes to the members of the constitutional committee and/or its signature threshold and/or terms.', 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300')}
          ${actionType('Update to the Constitution or Proposal Policy', 'A modification to the Constitution or proposal policy, recorded as on-chain hashes.', 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300')}
          ${actionType('Hard Fork Initiation', 'Triggers a non-backwards compatible upgrade of the network; requires a prior software upgrade.', 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300')}
          ${actionType('Protocol Parameter Changes', 'Any change to one or more updatable protocol parameters, excluding changes to major protocol versions (hard forks).', 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300')}
          ${actionType('Treasury Withdrawals', 'Withdrawals from the on-chain Cardano treasury.', 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300')}
          ${actionType('Info', 'Records information on-chain without causing any direct on-chain effects.', 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300')}
        </div>
        <div class="prose-section">
          <p>The current bundled dataset uses a subset of those categories in the displayed window, but eligibility rules apply the same way regardless of type: a participant must vote on <strong>every</strong> governance action in the 3-epoch window.</p>
        </div>
        ${warningBox('Voting direction — Yes, No, or Abstain — does not affect eligibility. What matters is that a vote was cast.')}
      </section>

      <!-- 4. DRep Eligibility -->
      <section id="guide-dreps" class="mb-12">
        ${sectionHeader('4', 'DRep Eligibility & Rewards', 'vote')}
        <div class="prose-section">
          <p>A <strong>Delegated Representative (DRep)</strong> is an on-chain governance delegate who votes on behalf of ADA holders that have delegated their voting power to them.</p>
          <p>To qualify for a DRep reward in a given window, you must meet <strong>both</strong> of the following conditions:</p>
        </div>
        <div class="space-y-3 mb-5">
          ${ruleCard('check-circle', 'emerald', 'Voted on every governance action', 'You must have cast a vote on all governance actions that expired during the 3-epoch window. Missing even one action removes you from eligibility entirely — there is no partial credit.')}
          ${ruleCard('bar-chart-3', 'brand', 'Ranked in the top 200 by voting power', `Among all DReps who voted on every action, only the top ${MAX_ELIGIBLE_DREPS} by delegated voting power share the reward pool. This incentivises DReps to grow their delegation alongside staying active.`)}
        </div>
        <div class="prose-section">
          <p>The DRep pool is always divided by exactly <strong>${MAX_ELIGIBLE_DREPS}</strong> — the cap — not the actual number of eligible DReps. This means the per-DRep share is fixed and predictable: <strong>${drepShareAda} ₳</strong> this window.</p>
          <p>If fewer than ${MAX_ELIGIBLE_DREPS} DReps qualify, each eligible DRep still receives the same fixed share. The unallocated portion (unclaimed slots) rolls into the reserve fund rather than being redistributed.</p>
          <p>If multiple DReps tie at exactly rank #${MAX_ELIGIBLE_DREPS} by voting power, all tied DReps are included and the divisor increases to account for them — so no DRep is unfairly excluded by a tie.</p>
        </div>
      </section>

      <!-- 5. CC Eligibility -->
      <section id="guide-cc" class="mb-12">
        ${sectionHeader('5', 'CC Member Eligibility & Rewards', 'scale')}
        <div class="prose-section">
          <p>The <strong>Constitutional Committee (CC)</strong> is a group of elected members responsible for reviewing governance actions for constitutional compliance. They vote on every action that comes before them.</p>
          <p>CC members qualify for rewards by meeting a single condition:</p>
        </div>
        <div class="mb-5">
          ${ruleCard('check-circle', 'violet', 'Voted on every governance action in the window', 'All CC members who cast a vote on every action that expired during the 3-epoch window share the CC reward pool equally. There is no ranking or cutoff — every qualifying member receives the same amount.')}
        </div>
        <div class="prose-section">
          <p>The CC pool is always divided by the fixed cap of <strong>7</strong> — the total number of CC seats — regardless of how many members actually qualify. If only 5 members voted on every action, those 5 still receive pool ÷ 7 each. The 2 unclaimed slots go to the reserve, just like unfilled DRep slots.</p>
          <p>The current per-CC-member reward is approximately <strong>${ccShareAda} ₳</strong> per window — roughly twice the DRep reward, reflecting the mandatory nature of the CC role.</p>
        </div>
        ${infoBox('CC members have no top-N cutoff. Every member who voted on all actions qualifies, regardless of committee size.')}
      </section>

      <!-- 6. Pool split -->
      <section id="guide-split" class="mb-12">
        ${sectionHeader('6', 'How the Reward Pool Is Split', 'pie-chart')}
        <div class="prose-section">
          <p>The total staking yield accumulated over 3 epochs (${totalPoolAda.toLocaleString()} ₳ in the current window) is divided between the two participant groups:</p>
        </div>

        <!-- Split bar -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-5">
          <div class="flex rounded-xl overflow-hidden h-6 mb-3">
            <div class="bg-brand-500 flex items-center justify-center text-white text-xs font-bold" style="width:${DREP_POOL_PCT}%">${DREP_POOL_PCT}%</div>
            <div class="bg-violet-500 flex items-center justify-center text-white text-xs font-bold" style="width:${CC_POOL_PCT}%">${CC_POOL_PCT}%</div>
          </div>
          <div class="grid sm:grid-cols-2 gap-4 text-sm">
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded bg-brand-500 flex-shrink-0"></span>
              <div>
                <div class="font-semibold text-slate-800 dark:text-slate-200">DRep Pool — ${DREP_POOL_PCT}%</div>
                <div class="text-slate-400 text-xs">${drepPoolAda.toLocaleString()} ₳ shared equally among top ${MAX_ELIGIBLE_DREPS}</div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded bg-violet-500 flex-shrink-0"></span>
              <div>
                <div class="font-semibold text-slate-800 dark:text-slate-200">CC Pool — ${CC_POOL_PCT}%</div>
                <div class="text-slate-400 text-xs">${ccPoolAda.toLocaleString()} ₳ shared equally among all eligible CC members</div>
              </div>
            </div>
          </div>
        </div>

        <div class="prose-section">
          <p>Per-participant shares are calculated using <strong>floor division</strong> — any remainder after equal distribution rolls into the reserve fund rather than being distributed unevenly.</p>
          <p><strong>DRep pool:</strong> always divided by the hard cap of <strong>${MAX_ELIGIBLE_DREPS}</strong>, regardless of how many DReps actually qualify. If only 150 DReps are eligible, each still receives pool ÷ 200 — the 50 unclaimed slots flow into the reserve rather than inflating the per-DRep payout.</p>
          <p><strong>CC pool:</strong> always divided by the hard cap of <strong>7</strong> (total CC seats), regardless of how many members qualify. Unfilled CC slots roll into the reserve — they do not inflate the per-member payout.</p>
          <p>The split is designed so that CC members receive approximately <strong>twice</strong> the per-person reward of DReps, reflecting the mandatory and constitutionally critical nature of the CC role.</p>
        </div>
      </section>

      <!-- 7. Claiming -->
      <section id="guide-claim" class="mb-12">
        ${sectionHeader('7', 'Claiming Your Reward', 'wallet')}
        <div class="prose-section">
          <p>In the current prototype, the claim page checks eligibility for epochs <strong>${OPEN_EPOCHS.join(', ')}</strong> using bundled snapshot data. The flow is designed to mirror the intended product, but it does not submit a live on-chain payout.</p>
          <p>Rather than connecting a real wallet, the prototype lets you paste any stake address directly — or use one of the pre-loaded demo addresses — to look up eligibility against the bundled snapshot. No wallet extension is required and nothing is signed or broadcast. The wallet detection UI is present to illustrate what the final product would look like.</p>
          <p>To try the flow:</p>
        </div>
        <ol class="space-y-3 mb-5">
          ${claimStep('1', 'Enter a stake address', 'Paste a stake address manually or pick one of the demo addresses provided on the claim page. In the final product, wallet connection will be required to verify ownership of the DRep certificate — proving that the person claiming is the actual DRep, not just someone who knows their stake address. All CIP-30 compatible wallets will be supported. CLI-based and multisig DReps, as well as CC members who operate via CLI, will also be supported through a separate signing flow.')}
          ${claimStep('2', 'Check eligibility', 'Your stake address is matched against the bundled eligibility snapshot. You\'ll see your voting record, rank (if a DRep), and exact reward amount.')}
          ${claimStep('3', 'Record the demo claim', 'Enter a payment address and submit the claim flow. The app stores the result in this browser session for that stake address and shows a placeholder transaction hash.')}
        </ol>
        ${warningBox('The current prototype prevents repeat claims for the same stake address only within this browser session. It does not yet enforce duplicate protection or expiry on-chain.')}
      </section>

      <!-- 8. Reserve -->
      <section id="guide-reserve" class="mb-12">
        ${sectionHeader('8', 'The Reserve Fund', 'piggy-bank')}
        <div class="prose-section">
          <p>The current app displays a reference reserve balance and historical <strong>reserve added</strong> amounts for closed windows.</p>
          <p>Each window, any ada that is not paid out flows into the reserve. There are three sources:</p>
          <ul>
            <li>If fewer than ${MAX_ELIGIBLE_DREPS} DReps qualify, the unused DRep slot amounts go to the reserve. Because the pool is always divided by the cap, the per-DRep share stays fixed and the shortfall simply isn't paid out. This is typically the largest source of reserve growth.</li>
            <li>If fewer than 7 CC members qualify, the unfilled CC slots contribute to the reserve in the same way. The per-CC share is always pool ÷ 7 regardless of how many members vote.</li>
            <li>Per-share amounts are rounded down to the nearest whole ₳. The small remainder left over by floor division accumulates in the reserve over time.</li>
          </ul>
          <p>Once the claim window closes, any rewards that were allocated but never claimed are also returned to the reserve. The running balance is displayed in the UI and is available to supplement future windows.</p>
          <p>The reserve is also intended to fund programme enhancements over time. Planned uses could include:</p>
          <ul>
            <li>Bonus rewards for governance participants who attach a rationale to their votes — encouraging transparent, well-reasoned governance rather than silent participation.</li>
            <li>Delegation based rewards, where governance participants gets compensated based on their delegation on top of the base compensation.</li>
            <li>Supplementing windows where staking yield is lower than usual, ensuring a consistent baseline reward even during periods of reduced pool performance.</li>
            <li>An optional annual contribution back to the Cardano Treasury — returning surplus funds to the ecosystem if the reserve grows beyond what the programme needs to operate sustainably.</li>
          </ul>
        </div>
      </section>

      <!-- 9. Key rules -->
      <section id="guide-rules" class="mb-12">
        ${sectionHeader('9', 'Key Rules at a Glance', 'list-checks')}
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          ${rule('check', 'emerald', 'All-or-nothing eligibility', 'You must vote on every governance action in the window. One missed vote = no reward.')}
          ${rule('check', 'emerald', 'Equal shares only', 'All eligible participants within their group receive identical payouts. Voting power does not affect the amount for DReps who qualify.')}
          ${rule('check', 'emerald', 'Unclaimed DRep slots go to reserve', `If fewer than ${MAX_ELIGIBLE_DREPS} DReps qualify, each eligible DRep still receives the same fixed share (pool ÷ ${MAX_ELIGIBLE_DREPS}). The unused slots roll into the reserve — they are never redistributed to other DReps.`)}
          ${rule('check', 'emerald', 'Fixed cap for both groups', 'DRep pool ÷ 200, CC pool ÷ 7 — always. Unfilled slots in either group go to the reserve, not to the remaining participants.')}
          ${rule('check', 'emerald', 'Vote direction is irrelevant', 'Yes, No, and Abstain all count equally for eligibility. The programme rewards participation, not any particular outcome.')}
          ${rule('check', 'emerald', 'One demo claim per session', 'The current prototype remembers one claim per stake address in this browser session. Reloading a different session clears that local record.')}
          ${rule('check', 'emerald', 'Top 200 DRep cutoff', `Only the top ${MAX_ELIGIBLE_DREPS} DReps by delegated voting power qualify, even if more voted on all actions. This encourages delegation growth.`)}
          ${rule('check', 'emerald', 'No CC cutoff', 'Every CC member who voted on all actions qualifies — there is no ranking or maximum.')}
          ${rule('x-circle', 'red', 'No partial credit', 'Missing any governance action in the window removes you from eligibility entirely for that window.')}
          ${rule('x-circle', 'red', 'Live payout not implemented yet', 'The current claim flow is a browser-side prototype. It shows a placeholder transaction hash instead of submitting a real on-chain payout.')}
        </div>
      </section>

      <!-- CTA -->
      <div class="hero-gradient rounded-2xl p-8 text-white text-center">
        <h3 class="text-xl font-bold mb-2">Ready to participate?</h3>
        <p class="text-white/75 mb-6 text-sm">Check your eligibility for the current window or review the full ranking on the Transparency page.</p>
        <div class="flex flex-wrap gap-3 justify-center">
          <a href="#claim" class="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-6 py-2.5 rounded-xl hover:bg-brand-50 transition-colors text-sm">
            <i data-lucide="coins" class="w-4 h-4"></i> Check Eligibility
          </a>
          <a href="#transparency" class="inline-flex items-center gap-2 bg-white/15 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-white/25 transition-colors text-sm">
            <i data-lucide="search" class="w-4 h-4"></i> View Rankings
          </a>
        </div>
      </div>

    </div>
  `;

  lucide.createIcons();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tocItem(n, label, href) {
  return `
    <li>
      <a href="${href}" class="flex items-center gap-2.5 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
        <span class="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 text-xs font-bold flex items-center justify-center flex-shrink-0">${n}</span>
        ${label}
      </a>
    </li>
  `;
}

function sectionHeader(n, title, icon) {
  return `
    <div class="flex items-center gap-3 mb-5">
      <div class="w-9 h-9 bg-brand-100 dark:bg-brand-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
        <i data-lucide="${icon}" class="w-4.5 h-4.5 text-brand-600 dark:text-brand-400"></i>
      </div>
      <div>
        <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Section ${n}</div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">${title}</h2>
      </div>
    </div>
  `;
}

function infoBox(text) {
  return `
    <div class="flex items-start gap-3 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/40 rounded-xl p-4 mt-4 text-sm">
      <i data-lucide="info" class="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5"></i>
      <p class="text-brand-700 dark:text-brand-300">${text}</p>
    </div>
  `;
}

function warningBox(text) {
  return `
    <div class="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 mt-4 text-sm">
      <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"></i>
      <p class="text-amber-700 dark:text-amber-300">${text}</p>
    </div>
  `;
}

function actionType(label, desc, colorClass) {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${colorClass}">${label}</span>
      <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${desc}</p>
    </div>
  `;
}

function ruleCard(icon, color, title, desc) {
  const colors = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    brand:   'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400',
    violet:  'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
  };
  return `
    <div class="flex items-start gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <div class="w-9 h-9 ${colors[color]} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <i data-lucide="${icon}" class="w-4 h-4"></i>
      </div>
      <div>
        <div class="font-semibold text-slate-800 dark:text-slate-200 mb-1">${title}</div>
        <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">${desc}</p>
      </div>
    </div>
  `;
}

function claimStep(n, title, desc) {
  return `
    <li class="flex items-start gap-4">
      <span class="w-7 h-7 rounded-full bg-brand-600 dark:bg-brand-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">${n}</span>
      <div>
        <div class="font-semibold text-slate-800 dark:text-slate-200 mb-0.5">${title}</div>
        <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">${desc}</p>
      </div>
    </li>
  `;
}

function rule(icon, color, title, desc) {
  const iconColors = {
    emerald: 'text-emerald-500',
    red:     'text-red-400',
  };
  return `
    <div class="flex items-start gap-4 px-5 py-4">
      <i data-lucide="${icon}" class="w-4 h-4 ${iconColors[color]} flex-shrink-0 mt-0.5"></i>
      <div>
        <span class="font-semibold text-slate-800 dark:text-slate-200">${title}</span>
        <span class="text-slate-500 dark:text-slate-400 text-sm"> — ${desc}</span>
      </div>
    </div>
  `;
}

function windowDiagram() {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mt-5">
      <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Current prototype flow</p>
      <!-- Phase row -->
      <div class="flex items-stretch gap-1 mb-1">
        <div class="flex-1 rounded-lg bg-brand-100 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700/40 px-3 py-3 text-center">
          <div class="text-xs font-bold text-brand-700 dark:text-brand-300">Epoch N</div>
          <div class="text-xs mt-1 text-brand-500 dark:text-brand-400">Accumulating</div>
        </div>
        <div class="flex items-center text-slate-300 dark:text-slate-600 text-lg font-light">›</div>
        <div class="flex-1 rounded-lg bg-brand-100 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700/40 px-3 py-3 text-center">
          <div class="text-xs font-bold text-brand-700 dark:text-brand-300">Epoch N+1</div>
          <div class="text-xs mt-1 text-brand-500 dark:text-brand-400">Accumulating</div>
        </div>
        <div class="flex items-center text-slate-300 dark:text-slate-600 text-lg font-light">›</div>
        <div class="flex-1 rounded-lg bg-brand-500 dark:bg-brand-600 px-3 py-3 text-center">
          <div class="text-xs font-bold text-white">Epoch N+2</div>
          <div class="text-xs mt-1 text-brand-100">Window total</div>
        </div>
        <div class="flex items-center text-slate-300 dark:text-slate-600 text-lg font-light">›</div>
        <div class="flex-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/40 px-3 py-3 text-center">
          <div class="text-xs font-bold text-emerald-700 dark:text-emerald-300">Bundled snapshot</div>
          <div class="text-xs mt-1 text-emerald-600 dark:text-emerald-400">Eligibility lookup</div>
        </div>
        <div class="flex items-center text-slate-300 dark:text-slate-600 text-lg font-light">›</div>
        <div class="flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-3 text-center">
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400">Demo claim</div>
          <div class="text-xs mt-1 text-slate-400 dark:text-slate-500">Session-only record</div>
        </div>
      </div>
      <!-- Legend -->
      <div class="grid sm:grid-cols-2 gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
        <div class="flex items-start gap-2"><i data-lucide="zap" class="w-3.5 h-3.5 text-brand-400 flex-shrink-0 mt-0.5"></i> Staking yield accrues each epoch and forms the window total shown in the UI</div>
        <div class="flex items-start gap-2"><i data-lucide="database" class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5"></i> Eligibility for the displayed window is loaded from bundled snapshot files</div>
        <div class="flex items-start gap-2"><i data-lucide="wallet" class="w-3.5 h-3.5 text-brand-400 flex-shrink-0 mt-0.5"></i> The claim page checks stake addresses and collects a payout address without sending a live transaction</div>
        <div class="flex items-start gap-2"><i data-lucide="monitor" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5"></i> Demo claims are stored locally in this browser session with a placeholder transaction hash</div>
      </div>
    </div>
  `;
}
