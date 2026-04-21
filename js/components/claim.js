import { state, showToast }   from '../app.js?v=15';
import { truncateAddress, fakeTxHash } from '../utils.js?v=15';
import { DEMO_ADDRESSES, OPEN_EPOCHS, DREP_POOL_PCT, CC_POOL_PCT, MAX_ELIGIBLE_DREPS } from '../config.js?v=15';

// Module-level claim state
const cs = {
  step: 1,           // 1 = connect, 2 = result, 3 = claimed
  walletName: null,
  stakeAddress: null,
  eligibility: null,    // full record only when eligible=true
  ineligRecord: null,   // full record when found but ineligible (for explainer)
  destAddress: null,    // user-supplied payout wallet address
  claimedAmount: 0,
  txHash: null,
};

export function renderClaim(app) {
  cs.step = 1;
  cs.walletName = state.wallet?.walletName || null;
  cs.stakeAddress = state.wallet?.stakeAddress || null;
  cs.eligibility = null;
  cs.ineligRecord = null;
  cs.destAddress = null;
  cs.claimedAmount = 0;
  cs.txHash = null;

  if (state.wallet?.stakeAddress) {
    checkEligibility(state.wallet.stakeAddress, state.wallet.walletName, app);
    return;
  }

  drawClaim(app);
}

function drawClaim(app) {
  app.innerHTML = `
    <div class="max-w-2xl mx-auto px-4 py-10">
      <h1 class="text-3xl font-bold mb-1 text-slate-900 dark:text-slate-100">Claim Rewards</h1>
      <p class="text-slate-500 dark:text-slate-400 mb-8">
        Check your eligibility for the current rewards snapshot covering epochs
        <strong class="text-slate-700 dark:text-slate-300">${OPEN_EPOCHS.join(', ')}</strong>.
        You must have voted on <strong class="text-slate-700 dark:text-slate-300">every</strong> governance action in the window to qualify.
      </p>

      <!-- Step indicator -->
      ${stepIndicator(cs.step)}

      <!-- Step content -->
      <div id="step-content" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mt-6">
        ${cs.step === 1 ? renderStep1() : cs.step === 2 ? renderStep2() : renderStep3()}
      </div>
    </div>
  `;

  attachClaimEvents(app);
}

// ─── Step 1: Connect / enter address ─────────────────────────────────────────
function renderStep1() {
  const connectedWallet = state.wallet;

  return `
    <h2 class="text-lg font-semibold mb-1 text-slate-900 dark:text-slate-100">Identify Your Governance Profile</h2>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
      Wallet connection now lives in the top bar. Connect there to load your stake address automatically, or enter a DRep ID, CC hot credential, or stake address manually below.
    </p>

    ${connectedWallet ? `
      <div class="mb-6 border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Connected in top bar</div>
            <div class="addr-chip text-sm font-medium text-slate-800 dark:text-slate-200 break-all">${connectedWallet.govId || connectedWallet.stakeAddress}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">Use this connected profile for claim lookup, or enter a different governance ID below.</div>
          </div>
          <button id="use-connected-wallet" class="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm whitespace-nowrap">
            Use Connected
          </button>
        </div>
      </div>
    ` : `
      <div class="flex items-start justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 mb-6">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Connect from the header</div>
          <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Open the wallet button in the top bar to connect via CIP-30 or enter a governance ID manually. Once connected, the claim page will use that profile automatically.</p>
        </div>
        <button id="open-wallet-modal" class="bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm whitespace-nowrap">
          Connect Wallet
        </button>
      </div>
    `}

    <!-- Manual entry -->
    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">DRep ID, CC hot credential, or stake address</label>
    <div class="flex gap-2">
      <input id="stake-input" type="text" placeholder="drep1… / cc_hot1… / stake1…"
        class="flex-1 addr-chip bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
      />
      <button id="check-manual" class="bg-brand-600 hover:bg-brand-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm flex items-center gap-1.5">
        <i data-lucide="search" class="w-4 h-4"></i> Check
      </button>
    </div>

    <!-- Demo addresses -->
    <div class="mt-5 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Demo addresses — click to test</p>
      <div class="space-y-2">
        ${DEMO_ADDRESSES.map(d => `
          <button class="demo-addr w-full text-left flex items-center justify-between p-2.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors group" data-address="${d.address}" data-govid="${d.govId || d.address}">
            <div>
              <span class="addr-chip text-xs text-slate-600 dark:text-slate-300">${truncateAddress(d.govId || d.address)}</span>
              <span class="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">${d.label}</span>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4 text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// ─── Step 2: Eligibility result ───────────────────────────────────────────────
function renderStep2() {
  const { stakeAddress, eligibility, walletName } = cs;
  const alreadyClaimed = sessionStorage.getItem(`claimed_${stakeAddress}`);

  if (alreadyClaimed) {
    return alreadyClaimedCard(JSON.parse(alreadyClaimed));
  }

  return `
    ${identifierBar(walletName, stakeAddress, cs.eligibility || cs.ineligRecord)}

    ${eligibility ? eligibleCard(eligibility) : ineligibleCard(cs.ineligRecord)}
  `;
}

function eligibleCard(e) {
  const isCc  = e.type === 'cc';
  const total = e.amount || 0;
  const poolPct = isCc ? CC_POOL_PCT : DREP_POOL_PCT;
  const colorClass = isCc
    ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/50'
    : 'bg-brand-50 dark:bg-brand-950/30 border-brand-200 dark:border-brand-800/50';
  const amountColor = isCc
    ? 'text-violet-700 dark:text-violet-300'
    : 'text-brand-700 dark:text-brand-300';
  const subColor = isCc
    ? 'text-violet-500 dark:text-violet-500'
    : 'text-brand-500 dark:text-brand-500';

  return `
    <div class="text-center py-4 mb-5">
      <div class="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
        <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500"></i>
      </div>
      <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Eligible!</h3>
      <p class="text-slate-500 dark:text-slate-400 text-sm mb-1">${isCc ? 'Constitutional Committee Member' : 'DRep'}</p>
      ${!isCc
        ? `<p class="text-xs text-slate-400">${(e.voting_power / 1_000_000).toFixed(2)}M ₳ voting power · rank #${e.rank}</p>`
        : `<p class="text-xs text-slate-400 addr-chip">${e.cc_credential}</p>`
      }
    </div>

    <!-- Eligibility summary -->
    <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-5">
      <div class="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rewards Snapshot — Epochs ${OPEN_EPOCHS.join(', ')}</span>
      </div>
      <div class="divide-y divide-slate-100 dark:divide-slate-800">
        <div class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-slate-600 dark:text-slate-300">Governance actions voted on</span>
          <span class="text-sm font-semibold text-emerald-600 dark:text-emerald-400">${e.voted_actions} / ${e.total_actions} ✓</span>
        </div>
        <div class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-slate-600 dark:text-slate-300">Eligibility status</span>
          <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
            <i data-lucide="check" class="w-3 h-3"></i> All actions voted
          </span>
        </div>
        <div class="px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-slate-600 dark:text-slate-300">Reward pool share</span>
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Equal share of ${poolPct}% pool</span>
        </div>
      </div>
    </div>

    <!-- Reward callout -->
    <div class="${colorClass} border rounded-xl p-4 mb-5 flex items-center justify-between">
      <div>
        <div class="text-xs font-medium uppercase tracking-wider mb-0.5 ${subColor}">Your reward</div>
        <div class="text-3xl font-bold ${amountColor}">${total} ₳</div>
        <div class="text-xs mt-0.5 ${subColor}">Equal share · ${poolPct}% of the ${OPEN_EPOCHS.join('–')} reward pool</div>
      </div>
      <i data-lucide="coins" class="w-10 h-10 ${isCc ? 'text-violet-300 dark:text-violet-700' : 'text-brand-300 dark:text-brand-700'}"></i>
    </div>

    <!-- Destination wallet -->
    <div class="mb-5">
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        Payout wallet address
      </label>
      <p class="text-xs text-slate-400 dark:text-slate-500 mb-2">
        Enter the Cardano wallet address where you'd like to receive your reward. This can be any <span class="font-medium">addr1…</span> address.
      </p>
      <div class="relative">
        <input id="dest-addr-input" type="text" placeholder="addr1…"
          value="${cs.destAddress || ''}"
          class="w-full addr-chip bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
        />
        <span id="dest-addr-status" class="absolute right-3 top-1/2 -translate-y-1/2 hidden">
          <i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i>
        </span>
      </div>
      <p id="dest-addr-error" class="text-xs text-red-500 mt-1 hidden">Please enter a valid Cardano payment address (starts with addr1…)</p>
    </div>

    <button id="do-claim" disabled
      class="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 opacity-40 cursor-not-allowed">
      <i data-lucide="send" class="w-4 h-4"></i> Record Demo Claim ${total} ₳
    </button>
  `;
}

function ineligibleCard(record) {
  const reason   = record?.ineligible_reason || null;
  const roleLabel = record?.type === 'cc' ? 'CC member' : 'DRep';

  // Pick the right explainer based on the reason code
  let reasonBlock;
  if (!record) {
    reasonBlock = `
      <div class="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left mb-5">
        <i data-lucide="help-circle" class="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5"></i>
        <div class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong class="text-slate-700 dark:text-slate-300 block mb-1">Address not found in snapshot</strong>
          This stake address does not appear in the current rewards snapshot for epochs ${OPEN_EPOCHS.join(', ')}. It was either not registered as an active DRep or CC member during this window, or did not cast any votes.
        </div>
      </div>`;
  } else if (reason === 'incomplete_votes') {
    reasonBlock = `
      <div class="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 text-left mb-5">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"></i>
        <div class="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
          <strong class="block mb-1">Incomplete participation</strong>
          This ${roleLabel} voted on <strong>${record.voted_actions} of ${record.total_actions}</strong> governance actions in the current window. All ${record.total_actions} actions must be voted on to qualify — there is no partial credit.
        </div>
      </div>`;
  } else if (reason === 'outside_top_200') {
    reasonBlock = `
      <div class="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 text-left mb-5">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"></i>
        <div class="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
          <strong class="block mb-1">Outside the top ${MAX_ELIGIBLE_DREPS} cutoff</strong>
          This DRep voted on all ${record.total_actions} governance actions but ranked <strong>#${record.rank}</strong> by delegated voting power. Only the top ${MAX_ELIGIBLE_DREPS} DReps by voting power qualify. Growing your delegation will improve your chances in future windows.
        </div>
      </div>`;
  } else {
    reasonBlock = `
      <div class="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left mb-5">
        <i data-lucide="info" class="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5"></i>
        <div class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong class="text-slate-700 dark:text-slate-300 block mb-1">Not eligible for this window</strong>
          Eligibility requires voting on every governance action in the window as a DRep ranked in the top ${MAX_ELIGIBLE_DREPS} by voting power, or as an active CC member.
        </div>
      </div>`;
  }

  return `
    <div class="text-center py-4 mb-4">
      <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
        <i data-lucide="x-circle" class="w-8 h-8 text-slate-400"></i>
      </div>
      <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Not eligible</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400">Rewards snapshot · epochs ${OPEN_EPOCHS.join(', ')}</p>
    </div>
    ${reasonBlock}
    <button id="change-addr" class="w-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      Try another address
    </button>
  `;
}

function alreadyClaimedCard(info) {
  return `
    <div class="text-center py-6">
      <div class="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
        <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-500"></i>
      </div>
      <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Demo claim already recorded</h3>
      <p class="text-slate-500 dark:text-slate-400 text-sm mb-1">You claimed <strong>${info.amount} ₳</strong> this session.</p>
      <p class="text-xs text-slate-400 mb-4">Snapshot epochs ${OPEN_EPOCHS.join(', ')}</p>
      ${info.destAddress ? `
        <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-left mb-2">
          <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Sent to</div>
          <div class="addr-chip text-xs text-slate-500 dark:text-slate-400 break-all">${info.destAddress}</div>
        </div>
      ` : ''}
      <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-xs addr-chip text-slate-500 dark:text-slate-400 mb-1">
        Placeholder tx: ${truncateAddress(info.txHash, 16, 8)}
      </div>
      <p class="text-xs text-slate-400">Stored locally in this browser session.</p>
    </div>
    <button id="change-addr" class="w-full mt-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      Check another address
    </button>
  `;
}

// ─── Step 3: Success ──────────────────────────────────────────────────────────
function renderStep3() {
  const txHash = cs.txHash || '';
  const amount = cs.claimedAmount;
  return `
    <div class="text-center py-6">
      <div class="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-5">
        <i data-lucide="party-popper" class="w-10 h-10 text-emerald-500"></i>
      </div>
      <h3 class="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Demo Claim Recorded</h3>
      <p class="text-slate-500 dark:text-slate-400 mb-1">This prototype stored the claim in your browser session.</p>
      <p class="text-2xl font-bold text-brand-600 dark:text-brand-400 mb-1">${amount} ₳</p>
      <p class="text-xs text-slate-400 mb-6">Equal share · snapshot epochs ${OPEN_EPOCHS.join(', ')}</p>

      <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-left mb-3">
        <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Sent to</div>
        <div class="addr-chip text-xs text-slate-600 dark:text-slate-300 break-all">${cs.destAddress}</div>
      </div>

      <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-left mb-4">
        <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Placeholder transaction hash</div>
        <div class="addr-chip text-xs text-slate-600 dark:text-slate-300 break-all">${txHash}</div>
      </div>
      <p class="text-xs text-slate-400 mb-8">No live transaction was submitted.</p>

      <div class="flex gap-3 justify-center">
        <button id="change-addr" class="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium px-5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">
          Check another address
        </button>
        <a href="#transparency" class="bg-brand-600 hover:bg-brand-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm flex items-center gap-1.5">
          <i data-lucide="search" class="w-4 h-4"></i> View Transparency
        </a>
      </div>
    </div>
  `;
}

// ─── Event wiring ─────────────────────────────────────────────────────────────
function attachClaimEvents(app) {
  lucide.createIcons();

  app.querySelector('#open-wallet-modal')?.addEventListener('click', () => {
    window.showWalletModal?.();
  });

  app.querySelector('#use-connected-wallet')?.addEventListener('click', () => {
    if (!state.wallet?.stakeAddress) {
      showToast('Connect a wallet from the top bar first', 'warning');
      return;
    }
    checkEligibility(state.wallet.stakeAddress, state.wallet.walletName, app);
  });

  // Demo address buttons — fill with governance ID where available
  app.querySelectorAll('.demo-addr').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = app.querySelector('#stake-input');
      if (input) { input.value = btn.dataset.govid; input.focus(); }
    });
  });

  // Manual check
  const checkBtn = app.querySelector('#check-manual');
  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      const val = app.querySelector('#stake-input')?.value.trim();
      if (!val) { showToast('Please enter a governance ID or stake address', 'warning'); return; }
      checkEligibility(val, null, app);
    });
  }

  // Enter key on input
  const input = app.querySelector('#stake-input');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') app.querySelector('#check-manual')?.click();
    });
  }

  // Destination address — live validation
  const destInput = app.querySelector('#dest-addr-input');
  const claimBtn  = app.querySelector('#do-claim');
  if (destInput && claimBtn) {
    // Restore saved value if user came back to this step
    if (cs.destAddress) destInput.value = cs.destAddress;

    const validateDest = () => {
      const val = destInput.value.trim();
      const valid = val.startsWith('addr1') && val.length >= 58;
      const errEl    = app.querySelector('#dest-addr-error');
      const statusEl = app.querySelector('#dest-addr-status');

      if (val.length === 0) {
        // Empty — neutral state
        errEl?.classList.add('hidden');
        statusEl?.classList.add('hidden');
        claimBtn.disabled = true;
        claimBtn.classList.add('opacity-40', 'cursor-not-allowed');
        claimBtn.classList.remove('hover:bg-brand-700');
      } else if (valid) {
        errEl?.classList.add('hidden');
        statusEl?.classList.remove('hidden');
        claimBtn.disabled = false;
        claimBtn.classList.remove('opacity-40', 'cursor-not-allowed');
        claimBtn.classList.add('hover:bg-brand-700');
      } else {
        errEl?.classList.remove('hidden');
        statusEl?.classList.add('hidden');
        claimBtn.disabled = true;
        claimBtn.classList.add('opacity-40', 'cursor-not-allowed');
        claimBtn.classList.remove('hover:bg-brand-700');
      }
    };

    destInput.addEventListener('input', validateDest);
    validateDest(); // run once on render in case value was pre-filled
  }

  // Claim button
  if (claimBtn) {
    claimBtn.addEventListener('click', () => executeClaim(app));
  }

  // Change address
  app.querySelectorAll('#change-addr').forEach(btn => {
    btn.addEventListener('click', () => {
      cs.step = 1;
      drawClaim(app);
    });
  });
}

// ─── Eligibility lookup ───────────────────────────────────────────────────────
function resolveToStakeAddress(input) {
  // If it's already a stake address, use it directly
  if (input.startsWith('stake1')) return input;
  // Otherwise scan eligibility records for a matching drep_id or cc_credential
  for (const [stakeAddr, rec] of Object.entries(state.eligibility)) {
    if (stakeAddr.startsWith('_')) continue;
    if (rec.drep_id === input || rec.cc_credential === input) return stakeAddr;
  }
  return input; // fall through unchanged — will produce a "not found" result
}

function checkEligibility(rawInput, walletName, app) {
  const stakeAddr = resolveToStakeAddress(rawInput.trim());
  cs.stakeAddress = stakeAddr;
  cs.walletName   = walletName;

  // eligibility.json is keyed by stake address; eligible = voted on all actions
  const record = state.eligibility[stakeAddr] || null;
  if (record && record.eligible === true) {
    cs.eligibility  = record;
    cs.ineligRecord = null;
  } else {
    cs.eligibility  = null;
    cs.ineligRecord = record; // may be null (not in snapshot) or an ineligible record
  }

  cs.step = 2;
  drawClaim(app);
}

// ─── Execute claim (prototype) ────────────────────────────────────────────────
function executeClaim(app) {
  const btn = app.querySelector('#do-claim');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Submitting…';
    lucide.createIcons({ nodes: [btn] });
  }

  setTimeout(() => {
    const amount   = cs.eligibility?.amount || 0;
    const txHash   = fakeTxHash();
    const destAddr = document.querySelector('#dest-addr-input')?.value.trim() || '';

    cs.txHash        = txHash;
    cs.claimedAmount = amount;
    cs.destAddress   = destAddr;

    sessionStorage.setItem(`claimed_${cs.stakeAddress}`, JSON.stringify({
      txHash,
      amount,
      type: cs.eligibility?.type,
      destAddress: destAddr,
    }));

    cs.step = 3;
    showToast(`Demo claim recorded for ${amount} ₳`, 'success');
    drawClaim(app);
  }, 1400);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getWallet(id) {
  return WALLET_DEFS.find(w => w.id === id);
}

const WALLET_DEFS = [
  { id: 'eternl', label: 'Eternl', icon: '🔵' },
  { id: 'lace',   label: 'Lace',   icon: '⚡' },
  { id: 'flint',  label: 'Flint',  icon: '🔥' },
  { id: 'yoroi',  label: 'Yoroi',  icon: '🟡' },
];

// ─── Identifier bar (step 2 header) ──────────────────────────────────────────
function identifierBar(walletName, stakeAddress, record) {
  // Prefer governance ID over raw stake address
  let label, id;
  if (record?.type === 'drep' && record?.drep_id) {
    label = 'DRep ID';
    id    = record.drep_id;
  } else if (record?.type === 'cc' && record?.cc_credential) {
    label = 'CC hot credential';
    id    = record.cc_credential;
  } else {
    label = 'Stake address';
    id    = stakeAddress;
  }

  return `
    <div class="flex items-center gap-3 mb-5 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
      ${walletName ? `<span class="text-xl">${getWallet(walletName)?.icon || '💳'}</span>` : '<i data-lucide="fingerprint" class="w-5 h-5 text-slate-400"></i>'}
      <div class="min-w-0 flex-1">
        <div class="text-xs text-slate-400 mb-0.5">${label}</div>
        <div class="addr-chip text-sm text-slate-700 dark:text-slate-300 truncate">${id}</div>
      </div>
      <button id="change-addr" class="text-xs text-brand-500 hover:text-brand-600 font-medium flex-shrink-0">Change</button>
    </div>
  `;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function stepIndicator(current) {
  const steps = ['Profile', 'Eligibility', 'Done'];
  return `
    <div class="flex items-start gap-0">
      ${steps.map((label, i) => {
        const n = i + 1;
        const done   = n < current;
        const active = n === current;
        return `
          ${i > 0 ? `<div class="step-connector${done || active ? ' active' : ''} text-brand-400 dark:text-brand-600"></div>` : ''}
          <div class="flex flex-col items-center gap-1 min-w-0">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              done   ? 'bg-emerald-500 text-white' :
              active ? 'bg-brand-600 text-white'  :
                       'bg-slate-200 dark:bg-slate-700 text-slate-400'
            }">
              ${done ? '<i data-lucide="check" class="w-4 h-4"></i>' : n}
            </div>
            <span class="text-xs ${active ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-slate-400'} whitespace-nowrap">${label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
