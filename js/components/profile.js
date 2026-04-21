import { state, clearWallet } from '../app.js?v=15';
import { formatAda, truncateAddress } from '../utils.js?v=15';
import { OPEN_EPOCHS, MAX_ELIGIBLE_DREPS } from '../config.js?v=15';

const ACTION_TYPE_LABELS = {
  TreasuryWithdrawal: 'Treasury Withdrawal',
  ParameterChange: 'Protocol Parameter Change',
  Info: 'Info',
  HardForkInitiation: 'Hard Fork Initiation',
  UpdateConstitution: 'Update to the Constitution or Proposal Policy',
  ProposalPolicy: 'Update to the Constitution or Proposal Policy',
  NewConstitution: 'Update to the Constitution or Proposal Policy',
  NoConfidence: 'Motion of No-Confidence',
  NewCommittee: 'New Constitutional Committee and/or Threshold and/or Terms',
};

const VOTE_COLORS = {
  Yes: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  No: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  Abstain: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
};

export function renderProfile(app) {
  if (!state.wallet) {
    app.innerHTML = `
      <div class="max-w-2xl mx-auto px-4 py-20 text-center">
        <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <i data-lucide="wallet" class="w-8 h-8 text-slate-400"></i>
        </div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No wallet connected</h2>
        <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm">Connect a wallet or enter your governance ID from the top bar to view your profile and history.</p>
        <button onclick="window.showWalletModal()"
          class="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm inline-flex items-center gap-2">
          <i data-lucide="wallet" class="w-4 h-4"></i> Connect Wallet
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const { stakeAddress, govId, type, walletName } = state.wallet;
  const elig = state.eligibility[stakeAddress] || null;
  const allActions = OPEN_EPOCHS.flatMap(ep =>
    (state.governanceActions[String(ep)] || []).map(a => ({ ...a, epoch: ep }))
  );

  const voteMap = {};
  for (const vote of (state.votes?.window_521_523?.votes || [])) {
    if (vote.stake_address === stakeAddress) voteMap[vote.action_id] = vote.vote;
  }

  const votedCount = Object.keys(voteMap).length;
  const totalActions = allActions.length;
  const sessionClaim = readSessionClaim(stakeAddress);
  const historicalPayouts = [...(state.payouts || [])]
    .filter(p => p.stake_address === stakeAddress)
    .sort((a, b) => {
      if ((b.epoch || 0) !== (a.epoch || 0)) return (b.epoch || 0) - (a.epoch || 0);
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });
  const participationHistory = [...(state.profileHistory?.[stakeAddress] || [])]
    .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));

  const historyStats = buildHistoryStats(historicalPayouts, sessionClaim);
  const roleLabel = type === 'drep'
    ? 'Delegated Representative'
    : type === 'cc'
      ? 'Constitutional Committee Member'
      : 'Governance Participant';
  const roleIcon = type === 'cc' ? 'scale' : type === 'drep' ? 'vote' : 'user';
  const roleTheme = type === 'cc'
    ? {
        iconBg: 'bg-violet-100 dark:bg-violet-900/40',
        iconText: 'text-violet-600 dark:text-violet-400',
        pill: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
      }
    : type === 'drep'
      ? {
          iconBg: 'bg-brand-100 dark:bg-brand-900/40',
          iconText: 'text-brand-600 dark:text-brand-400',
          pill: 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
        }
      : {
          iconBg: 'bg-slate-100 dark:bg-slate-800',
          iconText: 'text-slate-600 dark:text-slate-300',
          pill: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
        };

  app.innerHTML = `
    <div class="max-w-5xl mx-auto px-4 py-10">

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 mb-6">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-4 min-w-0">
            <div class="w-14 h-14 ${roleTheme.iconBg} rounded-2xl flex items-center justify-center flex-shrink-0">
              <i data-lucide="${roleIcon}" class="w-7 h-7 ${roleTheme.iconText}"></i>
            </div>
            <div class="min-w-0">
              <span class="inline-block px-2.5 py-1 ${roleTheme.pill} text-xs font-semibold rounded-full mb-2">${roleLabel}</span>
              <div class="addr-chip text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">${govId || stakeAddress}</div>
              <div class="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                <span class="addr-chip">${truncateAddress(stakeAddress)}</span>
                ${walletName ? `<span>Connected via ${capitalize(walletName)}</span>` : '<span>Connected manually</span>'}
                ${type === 'drep' && elig?.rank ? `<span>Rank #${elig.rank}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <a href="#claim" class="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Open Claim
            </a>
            <button id="profile-disconnect" class="px-4 py-2 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${statCard('Historical Rewards', formatAda(historyStats.totalHistoricalRewards), `${historyStats.historicalPayoutCount} payout records in the demo dataset`, 'coins', 'text-brand-600 dark:text-brand-400')}
        ${statCard('Latest Payout', historyStats.latestPayout ? `Epoch ${historyStats.latestPayout.epoch}` : 'None', historyStats.latestPayout ? `${formatAda(historyStats.latestPayout.amount)} on ${formatHistoryDate(historyStats.latestPayout.timestamp)}` : 'No historical payout for this profile', 'history', 'text-emerald-600 dark:text-emerald-400')}
        ${statCard('Current Window', currentWindowStatusLabel(elig, sessionClaim), currentWindowStatusSubtext(elig, sessionClaim), 'shield-check', sessionClaim ? 'text-emerald-600 dark:text-emerald-400' : elig?.eligible ? 'text-brand-600 dark:text-brand-400' : 'text-amber-600 dark:text-amber-400')}
        ${statCard('Votes This Window', `${votedCount} / ${totalActions || 0}`, totalActions ? `${Math.round((votedCount / totalActions) * 100)}% participation across epochs ${OPEN_EPOCHS.join(', ')}` : 'No open-window actions found', 'check-square', votedCount === totalActions && totalActions ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-300')}
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-6">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6">
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Current Window Status</h2>
          ${currentWindowCard(elig, type, votedCount, totalActions, sessionClaim)}
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6">
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">History Snapshot</h2>
          ${historySnapshot(historyStats, sessionClaim)}
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Participation History</h2>
          <span class="text-xs text-slate-400">Current window plus recent closed windows</span>
        </div>
        ${participationHistoryTable(participationHistory)}
      </div>

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Window Vote Breakdown</h2>
          <span class="text-xs font-semibold ${votedCount === totalActions && totalActions ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">
            ${votedCount} / ${totalActions} actions voted
          </span>
        </div>
        ${votingRecordTable(allActions, voteMap)}
      </div>

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Reward History</h2>
        </div>
        ${rewardHistoryTable(historicalPayouts, sessionClaim)}
      </div>

    </div>
  `;

  lucide.createIcons();

  app.querySelector('#profile-disconnect')?.addEventListener('click', () => {
    clearWallet();
    window.location.hash = '#home';
  });
}

function statCard(label, value, detail, icon, accentClass) {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${label}</span>
        <i data-lucide="${icon}" class="w-4 h-4 ${accentClass}"></i>
      </div>
      <div class="text-2xl font-bold text-slate-900 dark:text-slate-100">${value}</div>
      <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${detail}</div>
    </div>
  `;
}

function currentWindowCard(elig, type, voted, total, sessionClaim) {
  if (!elig) {
    return `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
          <i data-lucide="help-circle" class="w-5 h-5 text-slate-400"></i>
        </div>
        <div>
          <div class="font-semibold text-slate-900 dark:text-slate-100">Not found in current snapshot</div>
          <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">This connected profile does not appear as an active DRep or CC member in the current rewards window.</div>
        </div>
      </div>
    `;
  }

  if (sessionClaim) {
    return `
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center flex-shrink-0">
              <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-500"></i>
            </div>
            <div>
              <div class="font-semibold text-slate-900 dark:text-slate-100">Demo claim recorded this session</div>
              <div class="text-xs text-slate-400 mt-0.5">${voted}/${total} actions voted in the current window</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${formatAda(sessionClaim.amount)}</div>
            <div class="text-xs text-slate-400">Current window claim</div>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3">
          <div class="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
            <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Destination Address</div>
            <div class="addr-chip text-xs text-slate-600 dark:text-slate-300 break-all">${sessionClaim.destAddress || 'No payout address recorded'}</div>
          </div>
          <div class="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
            <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Placeholder Transaction</div>
            <div class="addr-chip text-xs text-slate-600 dark:text-slate-300 break-all">${sessionClaim.txHash}</div>
          </div>
        </div>
      </div>
    `;
  }

  if (elig.eligible) {
    const isCc = type === 'cc';
    return `
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center flex-shrink-0">
            <i data-lucide="check-circle" class="w-5 h-5 text-emerald-500"></i>
          </div>
          <div>
            <div class="font-semibold text-slate-900 dark:text-slate-100">Eligible to claim</div>
            <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              ${isCc ? 'CC member with full participation' : `Rank #${elig.rank} and inside the top ${MAX_ELIGIBLE_DREPS}`} · voted ${voted}/${total} actions
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-right">
            <div class="text-2xl font-bold text-brand-600 dark:text-brand-400">${formatAda(elig.amount)}</div>
            <div class="text-xs text-slate-400">Current window share</div>
          </div>
          <a href="#claim" class="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap">
            <i data-lucide="coins" class="w-4 h-4"></i> Claim Reward
          </a>
        </div>
      </div>
    `;
  }

  let reasonText = 'Does not meet eligibility criteria for this window.';
  if (elig.ineligible_reason === 'incomplete_votes') {
    reasonText = `Voted ${voted}/${total} governance actions. All ${total} actions are required for a payout.`;
  } else if (elig.ineligible_reason === 'outside_top_200') {
    reasonText = `Voted all ${total} actions but ranked #${elig.rank}. Only the top ${MAX_ELIGIBLE_DREPS} DReps by voting power qualify.`;
  }

  return `
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-500"></i>
      </div>
      <div>
        <div class="font-semibold text-slate-900 dark:text-slate-100">Not eligible this window</div>
        <div class="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${reasonText}</div>
      </div>
    </div>
  `;
}

function historySnapshot(stats, sessionClaim) {
  return `
    <div class="space-y-4">
      <div class="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Historical Rewards</div>
        <div class="text-xl font-bold text-slate-900 dark:text-slate-100">${formatAda(stats.totalHistoricalRewards)}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">${stats.historicalPayoutCount} recorded payout${stats.historicalPayoutCount === 1 ? '' : 's'} in the demo history</div>
      </div>
      <div class="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Latest Historical Record</div>
        <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">${stats.latestPayout ? `Epoch ${stats.latestPayout.epoch}` : 'No payout record found'}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">${stats.latestPayout ? `${formatAda(stats.latestPayout.amount)} · ${formatHistoryDate(stats.latestPayout.timestamp)}` : 'This profile has not received a historical payout in the bundled dataset.'}</div>
      </div>
      <div class="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Current Session</div>
        <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">${sessionClaim ? 'Demo claim recorded' : 'No claim recorded yet'}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">${sessionClaim ? `${formatAda(sessionClaim.amount)} stored in this browser session` : 'A current-window demo claim will appear here after submission.'}</div>
      </div>
    </div>
  `;
}

function votingRecordTable(actions, voteMap) {
  if (!actions.length) {
    return `<div class="px-5 py-8 text-center text-sm text-slate-400">No governance actions found for this window.</div>`;
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100 dark:border-slate-800">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
            <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell whitespace-nowrap">Epoch</th>
            <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Vote</th>
          </tr>
        </thead>
        <tbody>
          ${actions.map(action => {
            const vote = voteMap[action.id];
            const typeLabel = ACTION_TYPE_LABELS[action.type] || action.type;
            return `
              <tr class="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                <td class="px-5 py-3">
                  <div class="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">${action.title}</div>
                  <div class="text-xs text-slate-400 mt-0.5">${typeLabel} · ${action.id}</div>
                </td>
                <td class="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">${action.epoch}</td>
                <td class="px-4 py-3 text-center">
                  ${vote
                    ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${VOTE_COLORS[vote] || ''}">${vote}</span>`
                    : `<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">Missed</span>`
                  }
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function participationHistoryTable(rows) {
  if (!rows.length) {
    return `
      <div class="px-5 py-8 text-center text-sm text-slate-400">
        No multi-window participation history found for this profile.
      </div>
    `;
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100 dark:border-slate-800">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Window</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Epochs</th>
            <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Participation</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Outcome</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Reward</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <td class="px-5 py-3">
                <div class="font-medium text-slate-700 dark:text-slate-300">${row.window_label}</div>
                <div class="text-xs text-slate-400 mt-0.5 md:hidden">${row.epochs.join(', ')}</div>
              </td>
              <td class="px-5 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">${row.epochs.join(', ')}</td>
              <td class="px-4 py-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${row.voted_actions === row.total_actions ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}">
                  ${row.voted_actions} / ${row.total_actions}
                </span>
              </td>
              <td class="px-5 py-3 text-right">
                ${historyOutcomePill(row)}
              </td>
              <td class="px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100 hidden lg:table-cell">${row.amount ? formatAda(row.amount) : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function rewardHistoryTable(payouts, sessionClaim) {
  if (!payouts.length && !sessionClaim) {
    return `
      <div class="px-5 py-8 text-center text-sm text-slate-400">
        No reward history found for this connected profile in the demo dataset.
      </div>
    `;
  }

  const rows = [];
  if (sessionClaim) {
    rows.push({
      period: `Window ${OPEN_EPOCHS.join('-')}`,
      dateLabel: 'This browser session',
      typeLabel: 'Current demo claim',
      amount: sessionClaim.amount,
      ref: sessionClaim.txHash,
      status: 'Demo claim',
      statusClass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
      destination: sessionClaim.destAddress || '—',
    });
  }

  for (const payout of payouts) {
    rows.push({
      period: `Epoch ${payout.epoch}`,
      dateLabel: formatHistoryDate(payout.timestamp),
      typeLabel: payout.type === 'cc' ? 'CC member payout' : 'DRep payout',
      amount: payout.amount,
      ref: payout.tx_hash,
      status: 'Paid',
      statusClass: 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300',
      destination: 'Historical payout',
    });
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100 dark:border-slate-800">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Period</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Date</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Type</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
            <th class="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden xl:table-cell">Reference</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
              <td class="px-5 py-3">
                <div class="font-medium text-slate-700 dark:text-slate-300">${row.period}</div>
                <div class="text-xs text-slate-400 mt-0.5 xl:hidden">${row.destination}</div>
              </td>
              <td class="px-5 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">${row.dateLabel}</td>
              <td class="px-5 py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">${row.typeLabel}</td>
              <td class="px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">${formatAda(row.amount)}</td>
              <td class="px-5 py-3 text-right">
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${row.statusClass}">${row.status}</span>
              </td>
              <td class="px-5 py-3 text-right hidden xl:table-cell">
                <span class="addr-chip text-xs text-slate-400">${truncateAddress(row.ref, 8, 6)}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function historyOutcomePill(row) {
  if (row.status === 'current') {
    if (row.eligible) {
      return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">Current eligible</span>`;
    }
    return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">${historyReasonLabel(row.ineligible_reason)}</span>`;
  }

  if (row.eligible) {
    return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Paid</span>`;
  }

  return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${historyReasonLabel(row.ineligible_reason)}</span>`;
}

function historyReasonLabel(reason) {
  if (reason === 'outside_top_200') return 'Outside top 200';
  if (reason === 'incomplete_votes') return 'Missed actions';
  return 'No payout';
}

function buildHistoryStats(payouts, sessionClaim) {
  const totalHistoricalRewards = payouts.reduce((sum, payout) => sum + (payout.amount || 0), 0);
  return {
    totalHistoricalRewards,
    historicalPayoutCount: payouts.length,
    latestPayout: payouts[0] || null,
    sessionClaimAmount: sessionClaim?.amount || 0,
  };
}

function currentWindowStatusLabel(elig, sessionClaim) {
  if (sessionClaim) return 'Claimed';
  if (!elig) return 'Not found';
  if (elig.eligible) return 'Eligible';
  return 'Ineligible';
}

function currentWindowStatusSubtext(elig, sessionClaim) {
  if (sessionClaim) return `${formatAda(sessionClaim.amount)} recorded in this browser session`;
  if (!elig) return 'Profile not found in the current rewards snapshot';
  if (elig.eligible) return `${formatAda(elig.amount)} available for the open window`;
  if (elig.ineligible_reason === 'outside_top_200') return `Ranked #${elig.rank}, outside top ${MAX_ELIGIBLE_DREPS}`;
  if (elig.ineligible_reason === 'incomplete_votes') return `Voted ${elig.voted_actions}/${elig.total_actions} actions`;
  return 'Did not meet the current window rules';
}

function readSessionClaim(stakeAddress) {
  try {
    const raw = sessionStorage.getItem(`claimed_${stakeAddress}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatHistoryDate(timestamp) {
  if (!timestamp) return '—';
  return timestamp.split('T')[0] || timestamp;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
