import { state }                               from '../app.js?v=15';
import { formatAda, formatVotingPower,
         truncateDrepId, truncateAddress }     from '../utils.js?v=15';
import { OPEN_EPOCHS, DREP_POOL_PCT, CC_POOL_PCT,
         MAX_ELIGIBLE_DREPS }                  from '../config.js?v=15';

// How many DRep rows to show per page in the table
const DREP_PAGE_SIZE = 50;
const VOTE_PAGE_SIZE = 100;

const ACTION_TYPE_LABELS = {
  TreasuryWithdrawal: { label: 'Treasury Withdrawal',     color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  ParameterChange:    { label: 'Parameter Change',        color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  Info:               { label: 'Info',                    color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
  HardForkInitiation: { label: 'Hard Fork',               color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
  NewConstitution:    { label: 'Constitution / Policy',   color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' },
  UpdateConstitution: { label: 'Constitution / Policy',   color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' },
  NoConfidence:       { label: 'No-Confidence',           color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' },
  NewCommittee:       { label: 'Committee / Terms',       color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
};

export function renderTransparency(app) {
  // Load the current bundled snapshot from rankings.json
  const windowKey = 'window_521_523';
  const windowData = state.rankings[windowKey];
  const voteData = state.votes?.[windowKey] || null;

  // All governance actions across the window epochs
  const allActions = OPEN_EPOCHS.flatMap(ep =>
    (state.governanceActions?.[String(ep)] || []).map(a => ({ ...a, epoch: ep }))
  );
  const voteRecords = voteData?.votes || [];

  // Payouts across all open epochs
  const payouts = state.payouts.filter(p => OPEN_EPOCHS.includes(p.epoch));
  const paidTotal = payouts.reduce((s, p) => s + p.amount, 0);

  app.innerHTML = `
    <div class="max-w-5xl mx-auto px-4 py-10">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">Transparency</h1>
        <p class="text-slate-500 dark:text-slate-400">
          Current snapshot · Epochs ${OPEN_EPOCHS.join(', ')} · ${allActions.length} governance actions · ${voteRecords.length.toLocaleString()} recorded votes.
        </p>
      </div>

      ${windowData ? windowContent(windowData, allActions, payouts, paidTotal, voteRecords) : noDataCard()}
    </div>
  `;

  lucide.createIcons();

  // Set up interactive DRep table (paginated, filterable)
  if (windowData) {
    const dreps       = windowData.dreps || [];
    const totalActions = allActions.length;

    window.__drepFilterEligible = false;
    window.__drepPage           = 0;
    window.__drepPageSize       = DREP_PAGE_SIZE;
    window.__drepAll            = dreps;
    window.__drepTotalActions   = totalActions;

    window.__renderDrepTable = function () {
      const filterEl  = document.getElementById('drep-filter-btn');
      const tbody     = document.getElementById('drep-tbody');
      const pageLabel = document.getElementById('drep-paging-label');
      const prevBtn   = document.getElementById('drep-prev-btn');
      const nextBtn   = document.getElementById('drep-next-btn');
      if (!tbody) return;

      const filtered  = window.__drepFilterEligible
        ? window.__drepAll.filter(d => d.eligible)
        : window.__drepAll;
      const pageSize  = window.__drepPageSize;
      const totalPages = Math.ceil(filtered.length / pageSize);
      if (window.__drepPage >= totalPages) window.__drepPage = Math.max(0, totalPages - 1);
      const start     = window.__drepPage * pageSize;
      const slice     = filtered.slice(start, start + pageSize);

      tbody.innerHTML = slice.map(d => drepRow(d, window.__drepTotalActions)).join('');
      lucide.createIcons();

      const showing = start + slice.length;
      pageLabel.textContent = filtered.length === 0
        ? 'No results'
        : `Showing ${start + 1}–${showing} of ${filtered.length} DReps${window.__drepFilterEligible ? ' (eligible only)' : ''}`;

      prevBtn.disabled = window.__drepPage === 0;
      nextBtn.disabled = window.__drepPage >= totalPages - 1;

      if (filterEl) {
        filterEl.textContent = window.__drepFilterEligible ? 'Show all DReps' : 'Show eligible only';
        filterEl.classList.toggle('border-brand-500', window.__drepFilterEligible);
        filterEl.classList.toggle('text-brand-600',   window.__drepFilterEligible);
      }
    };

    window.__renderDrepTable();

    const sortedVotes = [...voteRecords].sort((a, b) =>
      a.epoch - b.epoch ||
      a.action_id.localeCompare(b.action_id) ||
      a.actor_type.localeCompare(b.actor_type) ||
      a.actor_id.localeCompare(b.actor_id)
    );

    window.__votePage        = 0;
    window.__votePageSize    = VOTE_PAGE_SIZE;
    window.__voteRole        = 'all';
    window.__voteAll         = sortedVotes;
    window.__voteActionMap   = Object.fromEntries(allActions.map(a => [a.id, a]));

    window.__renderVoteTable = function () {
      const tbody     = document.getElementById('vote-tbody');
      const pageLabel = document.getElementById('vote-paging-label');
      const prevBtn   = document.getElementById('vote-prev-btn');
      const nextBtn   = document.getElementById('vote-next-btn');
      if (!tbody) return;

      const filtered = window.__voteRole === 'all'
        ? window.__voteAll
        : window.__voteAll.filter(v => v.actor_type === window.__voteRole);
      const pageSize = window.__votePageSize;
      const totalPages = Math.ceil(filtered.length / pageSize);
      if (window.__votePage >= totalPages) window.__votePage = Math.max(0, totalPages - 1);
      const start = window.__votePage * pageSize;
      const slice = filtered.slice(start, start + pageSize);

      tbody.innerHTML = slice.map(v => voteRow(v, window.__voteActionMap[v.action_id])).join('');

      const showing = start + slice.length;
      pageLabel.textContent = filtered.length === 0
        ? 'No recorded votes'
        : `Showing ${start + 1}–${showing} of ${filtered.length.toLocaleString()} vote records${window.__voteRole === 'all' ? '' : ` (${window.__voteRole.toUpperCase()} only)`}`;

      prevBtn.disabled = window.__votePage === 0;
      nextBtn.disabled = window.__votePage >= totalPages - 1;

      ['all', 'drep', 'cc'].forEach(role => {
        const btn = document.getElementById(`vote-filter-${role}`);
        if (!btn) return;
        const active = role === window.__voteRole;
        btn.classList.toggle('border-brand-500', active);
        btn.classList.toggle('text-brand-600', active);
      });
    };

    window.__renderVoteTable();
  }
}

function windowContent(data, allActions, payouts, paidTotal, voteRecords) {
  const dreps = data.dreps || [];
  const cc    = data.cc    || [];
  const eligibleDreps = dreps.filter(d => d.eligible);
  const eligibleCc    = cc.filter(c => c.eligible);
  const drepVotes = voteRecords.filter(v => v.actor_type === 'drep').length;
  const ccVotes   = voteRecords.filter(v => v.actor_type === 'cc').length;

  return `
    <!-- Pool breakdown cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${miniCard('Total Pool', formatAda(data.total_pool_ada), 'piggy-bank', 'brand')}
      ${miniCard('DRep Pool ('+DREP_POOL_PCT+'%)', formatAda(data.drep_pool_ada), 'vote', 'emerald')}
      ${miniCard('CC Pool ('+CC_POOL_PCT+'%)', formatAda(data.cc_pool_ada), 'scale', 'violet')}
      ${miniCard('Actions in Window', allActions.length.toString(), 'file-text', 'amber')}
    </div>

    <!-- Per-person share cards -->
    <div class="grid md:grid-cols-2 gap-4 mb-8">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-center gap-4">
        <div class="w-12 h-12 bg-brand-100 dark:bg-brand-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
          <i data-lucide="vote" class="w-6 h-6 text-brand-600 dark:text-brand-400"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs text-slate-400 mb-0.5">DRep equal share</div>
          <div class="text-2xl font-bold text-brand-600 dark:text-brand-400">${data.drep_share_ada} ₳</div>
          <div class="text-xs text-slate-400 mt-0.5">${formatAda(data.drep_pool_ada)} ÷ ${eligibleDreps.length} eligible DReps</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-xs text-slate-400 mb-0.5">Must vote on</div>
          <div class="text-sm font-semibold text-slate-700 dark:text-slate-300">all ${allActions.length} actions</div>
          <div class="text-xs text-slate-400">top ${MAX_ELIGIBLE_DREPS} by power</div>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex items-center gap-4">
        <div class="w-12 h-12 bg-violet-100 dark:bg-violet-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
          <i data-lucide="scale" class="w-6 h-6 text-violet-600 dark:text-violet-400"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs text-slate-400 mb-0.5">CC equal share</div>
          <div class="text-2xl font-bold text-violet-600 dark:text-violet-400">${data.cc_share_ada} ₳</div>
          <div class="text-xs text-slate-400 mt-0.5">${formatAda(data.cc_pool_ada)} ÷ ${eligibleCc.length} eligible CC members</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-xs text-slate-400 mb-0.5">Must vote on</div>
          <div class="text-sm font-semibold text-slate-700 dark:text-slate-300">all ${allActions.length} actions</div>
          <div class="text-xs text-slate-400">no top-N cutoff</div>
        </div>
      </div>
    </div>

    <!-- Eligibility rule callout -->
    <div class="flex items-start gap-3 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/40 rounded-xl p-4 mb-8 text-sm">
      <i data-lucide="info" class="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5"></i>
      <p class="text-brand-700 dark:text-brand-300">
        <strong>All-or-nothing eligibility:</strong> DReps and CC members must have voted on every governance action across epochs ${OPEN_EPOCHS.join(', ')} (${allActions.length} actions total). Missing even one action disqualifies the participant for this window. Among qualifying DReps, the top ${MAX_ELIGIBLE_DREPS} by voting power share the DRep pool equally.
      </p>
    </div>

    <!-- Governance actions list -->
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <i data-lucide="list-checks" class="w-4 h-4 text-brand-500"></i>
        <h2 class="font-semibold text-slate-900 dark:text-slate-100">Required Actions — ${allActions.length} total across epochs ${OPEN_EPOCHS.join(', ')}</h2>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        ${OPEN_EPOCHS.map(ep => {
          const epActions = allActions.filter(a => a.epoch === ep);
          return epActions.length ? `
            <div class="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div class="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Epoch ${ep}</span>
                <span class="text-xs text-slate-400">${epActions.length} action${epActions.length !== 1 ? 's' : ''}</span>
              </div>
              ${epActions.map(a => {
                const def = ACTION_TYPE_LABELS[a.type] || { label: a.type, color: 'bg-slate-100 dark:bg-slate-700 text-slate-500' };
                return `
                  <div class="px-4 py-3 flex items-center gap-3 border-b border-slate-50 dark:border-slate-800/40 last:border-0">
                    <span class="addr-chip text-xs text-slate-400 flex-shrink-0">${a.id}</span>
                    <span class="text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-0 truncate">${a.title}</span>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${def.color}">${def.label}</span>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '';
        }).join('')}
      </div>
    </div>

    <!-- Vote ledger -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="list" class="w-4 h-4 text-brand-500"></i>
          <h2 class="font-semibold text-slate-900 dark:text-slate-100">Vote Ledger</h2>
          <span class="text-slate-400 font-normal text-sm">
            — ${voteRecords.length.toLocaleString()} recorded votes · ${drepVotes.toLocaleString()} DRep · ${ccVotes.toLocaleString()} CC
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button id="vote-filter-all"
            onclick="window.__voteRole='all'; window.__votePage=0; window.__renderVoteTable();"
            class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 transition-colors">
            All votes
          </button>
          <button id="vote-filter-drep"
            onclick="window.__voteRole='drep'; window.__votePage=0; window.__renderVoteTable();"
            class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 transition-colors">
            DRep only
          </button>
          <button id="vote-filter-cc"
            onclick="window.__voteRole='cc'; window.__votePage=0; window.__renderVoteTable();"
            class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 transition-colors">
            CC only
          </button>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Epoch</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Governance Action</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actor</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Vote</th>
              </tr>
            </thead>
            <tbody id="vote-tbody"></tbody>
          </table>
        </div>
        <div class="border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-4">
          <span class="text-xs text-slate-400" id="vote-paging-label"></span>
          <div class="flex gap-2">
            <button id="vote-prev-btn"
              onclick="if(window.__votePage>0){window.__votePage--;window.__renderVoteTable();}"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 disabled:opacity-30 transition-colors">
              ← Prev
            </button>
            <button id="vote-next-btn"
              onclick="window.__votePage++;window.__renderVoteTable();"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 disabled:opacity-30 transition-colors">
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- DRep eligibility table -->
    <div class="mb-8" id="drep-table-section">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="bar-chart-3" class="w-4 h-4 text-brand-500"></i>
          <h2 class="font-semibold text-slate-900 dark:text-slate-100">DRep Rankings</h2>
          <span class="text-slate-400 font-normal text-sm" id="drep-count-label">
            — ${eligibleDreps.length} eligible · ${dreps.length - eligibleDreps.length} ineligible
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button id="drep-filter-btn"
            onclick="window.__drepFilterEligible = !window.__drepFilterEligible; window.__drepPage = 0; window.__renderDrepTable();"
            class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 transition-colors">
            Show eligible only
          </button>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-14">Rank</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">DRep ID</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Voted All</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Voting Power</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Reward</th>
              </tr>
            </thead>
            <tbody id="drep-tbody"></tbody>
          </table>
        </div>
        <div class="border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-4">
          <span class="text-xs text-slate-400" id="drep-paging-label"></span>
          <div class="flex gap-2">
            <button id="drep-prev-btn"
              onclick="if(window.__drepPage>0){window.__drepPage--;window.__renderDrepTable();}"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 disabled:opacity-30 transition-colors">
              ← Prev
            </button>
            <button id="drep-next-btn"
              onclick="window.__drepPage++;window.__renderDrepTable();"
              class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand-400 disabled:opacity-30 transition-colors">
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CC table -->
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <i data-lucide="scale" class="w-4 h-4 text-violet-500"></i>
        <h2 class="font-semibold text-slate-900 dark:text-slate-100">Constitutional Committee</h2>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">CC Credential</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions Voted</th>
                <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Eligible</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Reward</th>
              </tr>
            </thead>
            <tbody>
              ${cc.map(c => ccRow(c, allActions.length)).join('')}
            </tbody>
          </table>
        </div>
        <div class="border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-xs text-slate-400 text-center">
          CC members must vote on all ${allActions.length} actions to qualify. ${CC_POOL_PCT}% of the pool (${formatAda(data.cc_pool_ada)}) shared equally among ${eligibleCc.length} eligible members.
        </div>
      </div>
    </div>

    <!-- Payouts -->
    <div>
      <div class="flex items-center gap-2 mb-4">
        <i data-lucide="send" class="w-4 h-4 text-emerald-500"></i>
        <h2 class="font-semibold text-slate-900 dark:text-slate-100">
          Confirmed Payouts
          ${payouts.length > 0
            ? `<span class="text-slate-400 font-normal text-sm ml-1">(${payouts.length} transactions — ${formatAda(paidTotal)} total)</span>`
            : ''}
        </h2>
      </div>
      ${payouts.length > 0 ? payoutTable(payouts) : `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          <i data-lucide="clock" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="text-sm">No payouts recorded yet for the currently displayed window.</p>
        </div>
      `}
    </div>
  `;
}

// ─── DRep row ─────────────────────────────────────────────────────────────────
function drepRow(d, totalActions) {
  const eligible = d.eligible;
  return `
    <tr class="border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${eligible ? '' : 'opacity-50'}">
      <td class="px-4 py-3 text-center font-bold ${eligible ? 'text-slate-600 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600'}">${d.rank}</td>
      <td class="px-4 py-3">
        <span class="addr-chip text-xs text-slate-600 dark:text-slate-300">${truncateDrepId(d.drep_id)}</span>
      </td>
      <td class="px-4 py-3 text-center">
        ${d.voted_actions === totalActions
          ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> ${d.voted_actions}/${totalActions}</span>`
          : `<span class="inline-flex items-center gap-1 text-xs font-semibold text-red-500 dark:text-red-400"><i data-lucide="x-circle" class="w-3.5 h-3.5"></i> ${d.voted_actions}/${totalActions}</span>`
        }
      </td>
      <td class="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">${formatVotingPower(d.voting_power)}</td>
      <td class="px-4 py-3 text-right font-semibold ${eligible ? 'text-brand-600 dark:text-brand-400' : 'text-slate-300 dark:text-slate-600'}">
        ${eligible ? d.share_ada + ' ₳' : '—'}
      </td>
    </tr>
  `;
}

// ─── CC row ───────────────────────────────────────────────────────────────────
function ccRow(c, totalActions) {
  const eligible = c.eligible;
  return `
    <tr class="border-b border-slate-50 dark:border-slate-800/50 last:border-0 ${eligible ? '' : 'opacity-50'}">
      <td class="px-4 py-3">
        <span class="addr-chip text-xs text-slate-600 dark:text-slate-300">${truncateDrepId(c.credential)}</span>
      </td>
      <td class="px-4 py-3 text-center">
        ${c.voted_actions === totalActions
          ? `<span class="text-emerald-600 dark:text-emerald-400 font-semibold">${c.voted_actions}</span><span class="text-slate-400">/${totalActions}</span>`
          : `<span class="text-red-500 dark:text-red-400 font-semibold">${c.voted_actions}</span><span class="text-slate-400">/${totalActions}</span>`
        }
      </td>
      <td class="px-4 py-3 text-center">
        ${eligible
          ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-full"><i data-lucide="check" class="w-3 h-3"></i> Yes</span>`
          : `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full"><i data-lucide="x" class="w-3 h-3"></i> No</span>`
        }
      </td>
      <td class="px-4 py-3 text-right font-semibold ${eligible ? 'text-violet-600 dark:text-violet-400' : 'text-slate-300 dark:text-slate-600'}">
        ${eligible ? c.share_ada + ' ₳' : '—'}
      </td>
    </tr>
  `;
}

// ─── Payout table ─────────────────────────────────────────────────────────────
function payoutTable(payouts) {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 dark:border-slate-800">
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Stake Address</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Tx Hash</th>
            </tr>
          </thead>
          <tbody>
            ${payouts.map(p => `
              <tr class="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                <td class="px-4 py-3">
                  <span class="addr-chip text-xs text-slate-600 dark:text-slate-300">${truncateAddress(p.stake_address)}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium ${p.type === 'cc'
                    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                    : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'}">
                    ${p.type === 'cc' ? 'CC' : 'DRep'}
                  </span>
                </td>
                <td class="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">${p.amount} ₳</td>
                <td class="px-4 py-3 hidden md:table-cell">
                  <a href="https://cardanoscan.io/transaction/${p.tx_hash}" target="_blank" rel="noopener"
                    class="addr-chip text-xs text-brand-500 hover:text-brand-600 hover:underline flex items-center gap-1">
                    ${truncateAddress(p.tx_hash, 14, 6)}
                    <i data-lucide="external-link" class="w-3 h-3 flex-shrink-0"></i>
                  </a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Mini card ────────────────────────────────────────────────────────────────
function miniCard(label, value, icon, color) {
  const colors = {
    brand:   'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400',
    violet:  'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    amber:   'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
  };
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
      <div class="w-9 h-9 ${colors[color]} rounded-lg flex items-center justify-center flex-shrink-0">
        <i data-lucide="${icon}" class="w-4 h-4"></i>
      </div>
      <div>
        <div class="text-xs text-slate-400">${label}</div>
        <div class="font-bold text-slate-900 dark:text-slate-100 text-sm">${value}</div>
      </div>
    </div>
  `;
}

// ─── No data ──────────────────────────────────────────────────────────────────
function noDataCard() {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
      <i data-lucide="database" class="w-10 h-10 text-slate-300 mx-auto mb-3"></i>
      <h3 class="font-semibold text-slate-700 dark:text-slate-300 mb-1">No data for this window</h3>
      <p class="text-sm text-slate-400">Snapshot data is not available for the currently displayed window.</p>
    </div>
  `;
}

function voteRow(vote, action) {
  const actor = vote.actor_type === 'cc'
    ? truncateDrepId(vote.actor_id)
    : truncateDrepId(vote.actor_id);
  const roleClass = vote.actor_type === 'cc'
    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
    : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300';

  return `
    <tr class="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
      <td class="px-4 py-3 text-center font-medium text-slate-700 dark:text-slate-300">${vote.epoch}</td>
      <td class="px-4 py-3">
        <div class="addr-chip text-xs text-slate-400 mb-0.5">${vote.action_id}</div>
        <div class="text-sm text-slate-700 dark:text-slate-300">${action?.title || vote.action_id}</div>
      </td>
      <td class="px-4 py-3">
        <div class="addr-chip text-xs text-slate-600 dark:text-slate-300">${actor}</div>
        <div class="text-xs text-slate-400 mt-0.5">${truncateAddress(vote.stake_address)}</div>
      </td>
      <td class="px-4 py-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${roleClass}">
          ${vote.actor_type === 'cc' ? 'CC' : 'DRep'}
        </span>
      </td>
      <td class="px-4 py-3 text-center">
        ${votePill(vote.vote)}
      </td>
    </tr>
  `;
}

function votePill(vote) {
  const styles = {
    Yes: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    No: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    Abstain: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  };
  return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${styles[vote] || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'}">${vote}</span>`;
}
