import { state, snap, lookupAccount, clearWallet, openWalletDialog } from '../app.js';
import { getClaim, claimsForAddress } from '../claims.js';
import {
  ada, adaCompact, formatInt, formatPct, formatDate, formatDateTime,
  relativeTime, escapeHtml, shortId, copyable, downloadFile, toCsv, explorer,
} from '../utils.js';
import {
  metric, avatar, votePill, actionTypePill, checklist, buildChecks, emptyState,
} from './shared.js';

export function renderProfile(app) {
  if (!state.wallet) return renderDisconnected(app);

  const { stakeAddress, govId, walletName } = state.wallet;
  const record = lookupAccount(stakeAddress);
  const w = snap.window;
  const claim = getClaim(stakeAddress, snap.windowId);

  const voteMap = {};
  for (const v of snap.voteLedger) {
    if (v.stake_address === stakeAddress) voteMap[v.action_id] = v;
  }
  const actions = snap.windowActions;
  const votedCount = actions.filter(a => voteMap[a.id]).length;

  const settled = [...state.payouts]
    .filter(p => p.stake_address === stakeAddress)
    .sort((a, b) => (b.confirmed_at || '').localeCompare(a.confirmed_at || ''));
  const localClaims = claimsForAddress(stakeAddress);
  const lifetime = settled.reduce((s, p) => s + p.amount_lovelace, 0)
    + localClaims.reduce((s, c) => s + c.amount_lovelace, 0);

  const history = [...(state.profileHistory?.[stakeAddress] || [])]
    .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));

  const roleLabel = record?.type === 'cc'
    ? 'Constitutional Committee'
    : record?.type === 'drep' ? 'Delegated Representative' : 'Stake key';

  app.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-5">

      <!-- Identity header -->
      <section class="card card-pad">
        <div class="flex flex-wrap items-start justify-between gap-5">
          <div class="flex items-start gap-4 min-w-0">
            ${avatar(record?.name || state.wallet.name, govId || stakeAddress, { size: '3rem' })}
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <h1 class="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
                  ${escapeHtml(record?.name || state.wallet.name || 'Unnamed account')}
                </h1>
                <span class="pill ${record?.type === 'cc'
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                  : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'}">${roleLabel}</span>
              </div>
              <div class="space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="text-slate-400 w-[4.75rem] shrink-0">Governance</span>
                  ${copyable(govId || stakeAddress, { display: shortId(govId || stakeAddress, 24, 10), className: 'text-slate-600 dark:text-slate-300' })}
                </div>
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="text-slate-400 w-[4.75rem] shrink-0">Stake key</span>
                  ${copyable(stakeAddress, { display: shortId(stakeAddress, 24, 10), className: 'text-slate-500' })}
                </div>
              </div>
              <p class="text-[11px] text-slate-400 mt-2">
                ${walletName === 'demo' ? 'Test account' : walletName ? `Connected via ${escapeHtml(walletName)}` : 'Connected by identifier'}
                · session opened ${relativeTime(state.wallet.connectedAt)}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            ${record?.eligible && !claim
              ? `<a href="#claim" class="btn-primary text-sm h-9 px-4"><i data-lucide="hand-coins" class="w-4 h-4"></i> Claim ${ada(record.amount_lovelace)}</a>`
              : `<a href="#claim" class="btn-secondary text-sm h-9 px-4"><i data-lucide="hand-coins" class="w-4 h-4"></i> Claim page</a>`}
            <button id="profile-export" class="btn-secondary text-sm h-9 px-3" title="Export voting record">
              <i data-lucide="download" class="w-4 h-4"></i>
            </button>
            <button id="profile-disconnect" class="btn-secondary text-sm h-9 px-3 !text-red-600 dark:!text-red-400" title="Disconnect">
              <i data-lucide="log-out" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </section>

      <!-- Metrics -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${metric({
          label: 'Lifetime rewards', value: adaCompact(lifetime), icon: 'coins', tone: 'brand',
          sub: `${formatInt(settled.length + localClaims.length)} settled claims`,
        })}
        ${metric({
          label: 'This window', value: windowStatusLabel(record, claim), icon: 'shield-check',
          tone: claim ? 'emerald' : record?.eligible ? 'brand' : 'amber',
          sub: windowStatusSub(record, claim),
        })}
        ${metric({
          label: 'Participation', value: `${votedCount} / ${actions.length}`, icon: 'check-square',
          tone: votedCount === actions.length ? 'emerald' : 'amber',
          sub: `${formatPct(actions.length ? (votedCount / actions.length) * 100 : 0, 0)} of window actions`,
        })}
        ${metric({
          label: record?.type === 'cc' ? 'Committee seat' : 'Voting power',
          value: record?.type === 'cc'
            ? escapeHtml(record?.region || '—')
            : adaCompact(record?.voting_power_lovelace || 0),
          icon: record?.type === 'cc' ? 'scale' : 'gauge', tone: 'violet',
          sub: record?.type === 'cc'
            ? `Term ends epoch ${record?.term_end_epoch ?? '—'}`
            : record?.rank ? `Rank ${formatInt(record.rank)} of ${formatInt(w.registered_dreps)}` : 'Not ranked',
        })}
      </section>

      <div class="grid lg:grid-cols-[1fr_20rem] gap-5 items-start">
        <div class="space-y-5">
          ${currentWindowCard(record, claim, votedCount, actions.length)}
          ${voteBreakdown(actions, voteMap, votedCount)}
          ${rewardHistory(settled, localClaims)}
        </div>
        <aside class="space-y-5 lg:sticky lg:top-28">
          ${participationHistory(history)}
        </aside>
      </div>
    </div>`;

  lucide.createIcons();

  app.querySelector('#profile-disconnect')?.addEventListener('click', () => {
    clearWallet();
    window.location.hash = '#home';
  });
  app.querySelector('#profile-export')?.addEventListener('click', () => exportVotes(actions, voteMap, govId));
}

// ─── Disconnected ─────────────────────────────────────────────────────────────
function renderDisconnected(app) {
  app.innerHTML = `
    <div class="max-w-md mx-auto px-4 py-24 text-center">
      <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
        <i data-lucide="wallet" class="w-7 h-7 text-slate-400"></i>
      </div>
      <h1 class="text-lg font-bold text-slate-900 dark:text-slate-50 mb-2">No account connected</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        Connect a wallet or enter a governance identifier to see your voting record, eligibility
        and reward history.
      </p>
      <button id="profile-connect" class="btn-primary text-sm h-10 px-5 mx-auto">
        <i data-lucide="wallet" class="w-4 h-4"></i> Connect wallet
      </button>
    </div>`;
  lucide.createIcons();
  app.querySelector('#profile-connect').addEventListener('click', () => openWalletDialog());
}

// ─── Current window ───────────────────────────────────────────────────────────
function windowStatusLabel(record, claim) {
  if (claim) return 'Claimed';
  if (!record) return 'Not found';
  return record.eligible ? 'Eligible' : 'Ineligible';
}

function windowStatusSub(record, claim) {
  if (claim) return `${ada(claim.amount_lovelace)} settled`;
  if (!record) return 'Absent from this snapshot';
  if (record.eligible) return `${ada(record.amount_lovelace)} available`;
  if (record.ineligible_reason === 'outside_top_200') return `Placed ${formatInt(record.participation_rank)}, below the cut-off`;
  return `Voted ${record.voted_actions} of ${record.total_actions} actions`;
}

function currentWindowCard(record, claim, voted, total) {
  const w = snap.window;

  if (!record) {
    return `
      <section class="card">
        <div class="card-header"><h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Window ${w.epochs?.join('–')}</h2></div>
        ${emptyState('search-x', 'Not in this snapshot',
          'This stake key was not a registered DRep or committee member when the window closed.')}
      </section>`;
  }

  const checks = buildChecks(record, {
    windowMeta: { ...w, max_eligible_dreps: snap.programme.max_eligible_dreps },
    existingClaim: claim,
  });

  return `
    <section class="card">
      <div class="card-header">
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Window ${w.epochs?.join('–')} status</h2>
        <span class="text-xs text-slate-400">Snapshot ${formatDate(w.snapshot_taken_at)}</span>
      </div>

      ${claim ? `
        <div class="px-5 py-4 bg-emerald-50/70 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p class="text-sm font-bold text-slate-900 dark:text-slate-50">Reward claimed</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ${escapeHtml(claim.claim_id)} · confirmed ${formatDateTime(claim.confirmed_at)}
              </p>
            </div>
            <div class="text-right">
              <div class="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular">${ada(claim.amount_lovelace)}</div>
              <a href="${explorer.tx(claim.tx_hash)}" target="_blank" rel="noopener"
                 class="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline">
                ${shortId(claim.tx_hash, 10, 6)} <i data-lucide="external-link" class="w-3 h-3 inline-block -mt-0.5"></i>
              </a>
            </div>
          </div>
        </div>` : record.eligible ? `
        <div class="px-5 py-4 bg-brand-50/70 dark:bg-brand-950/20 border-b border-brand-100 dark:border-brand-900/40 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-slate-50">${ada(record.amount_lovelace)} ready to claim</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Claims close at the end of epoch ${w.claim_deadline_epoch}, ${formatDate(w.claim_deadline_at)}
            </p>
          </div>
          <a href="#claim" class="btn-primary text-sm h-9 px-4">Claim now</a>
        </div>` : ''}

      <div class="card-pad">${checklist(checks)}</div>
    </section>`;
}

// ─── Vote breakdown ───────────────────────────────────────────────────────────
function voteBreakdown(actions, voteMap, votedCount) {
  return `
    <section class="card overflow-hidden">
      <div class="card-header">
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Voting record this window</h2>
        <span class="text-xs font-semibold tabular ${votedCount === actions.length
          ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">
          ${votedCount} of ${actions.length} actions
        </span>
      </div>
      ${actions.length ? `
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th class="text-center w-14">Epoch</th>
                <th>Governance action</th>
                <th class="text-center">Vote</th>
                <th class="text-right hidden md:table-cell">Cast</th>
              </tr>
            </thead>
            <tbody>
              ${actions.map(a => {
                const v = voteMap[a.id];
                return `
                  <tr class="${v ? '' : 'bg-red-50/40 dark:bg-red-950/10'}">
                    <td class="text-center tabular text-slate-500 dark:text-slate-400">${a.epoch}</td>
                    <td>
                      <div class="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">${escapeHtml(a.short_title)}</div>
                      <div class="mt-1">${actionTypePill(a.type)}</div>
                    </td>
                    <td class="text-center">${votePill(v?.vote)}</td>
                    <td class="text-right hidden md:table-cell text-xs text-slate-400 whitespace-nowrap">
                      ${v ? formatDate(v.voted_at) : '—'}
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : emptyState('inbox', 'No actions in this window', 'Nothing was proposed during these epochs.')}
    </section>`;
}

// ─── Reward history ───────────────────────────────────────────────────────────
function rewardHistory(settled, localClaims) {
  const rows = [
    ...localClaims.map(c => ({
      reference: c.claim_id,
      period: c.window_label || `Epoch ${c.epoch}`,
      when: c.confirmed_at,
      amount: c.amount_lovelace,
      tx: c.tx_hash,
      type: c.type,
      local: true,
    })),
    ...settled.map(p => ({
      reference: p.claim_id,
      period: p.window ? `Window ${p.window[0]}–${p.window[2]}` : `Epoch ${p.epoch}`,
      when: p.confirmed_at,
      amount: p.amount_lovelace,
      tx: p.tx_hash,
      type: p.type,
      local: false,
    })),
  ].sort((a, b) => (b.when || '').localeCompare(a.when || ''));

  return `
    <section class="card overflow-hidden">
      <div class="card-header">
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Reward history</h2>
        <span class="text-xs text-slate-400">${rows.length} settled claim${rows.length === 1 ? '' : 's'}</span>
      </div>
      ${rows.length ? `
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th class="hidden sm:table-cell">Window</th>
                <th class="text-right">Amount</th>
                <th class="hidden md:table-cell">Transaction</th>
                <th class="text-right">Settled</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>
                    <div class="addr-chip text-slate-700 dark:text-slate-200">${escapeHtml(r.reference || '—')}</div>
                    <div class="text-[11px] text-slate-400">${r.type === 'cc' ? 'Committee payout' : 'DRep payout'}${r.local ? ' · this session' : ''}</div>
                  </td>
                  <td class="hidden sm:table-cell text-xs text-slate-500 dark:text-slate-400 tabular whitespace-nowrap">${escapeHtml(r.period)}</td>
                  <td class="text-right tabular font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">${ada(r.amount)}</td>
                  <td class="hidden md:table-cell">
                    <a href="${explorer.tx(r.tx)}" target="_blank" rel="noopener"
                       class="addr-chip text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1">
                      ${escapeHtml(shortId(r.tx, 12, 6))}<i data-lucide="external-link" class="w-3 h-3"></i>
                    </a>
                  </td>
                  <td class="text-right text-xs text-slate-400 whitespace-nowrap">${formatDate(r.when)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : emptyState('receipt', 'No settled rewards yet',
          'Claims settled by this account will be listed here with their transaction references.')}
    </section>`;
}

// ─── Participation history ────────────────────────────────────────────────────
function participationHistory(rows) {
  if (!rows.length) {
    return `
      <section class="card overflow-hidden">
        <div class="card-header"><h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Window history</h2></div>
        ${emptyState('history', 'No prior windows', 'This account has no recorded history in earlier claim windows.')}
      </section>`;
  }

  return `
    <section class="card overflow-hidden">
      <div class="card-header">
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Window history</h2>
      </div>
      <div class="divide-y divide-slate-100 dark:divide-slate-800">
        ${rows.map(r => {
          const full = r.voted_actions === r.total_actions;
          return `
            <div class="px-4 py-3">
              <div class="flex items-center justify-between gap-3 mb-1.5">
                <span class="text-[13px] font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(r.window_label)}</span>
                ${outcomeTag(r)}
              </div>
              <div class="flex items-center justify-between gap-3 text-xs">
                <span class="text-slate-400 tabular">
                  <span class="${full ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}">${r.voted_actions}</span>
                  / ${r.total_actions} actions voted
                </span>
                <span class="tabular font-semibold text-slate-700 dark:text-slate-200">
                  ${r.amount_lovelace ? ada(r.amount_lovelace) : '—'}
                </span>
              </div>
              ${r.claim_id ? `<div class="addr-chip text-slate-400 mt-1">${escapeHtml(r.claim_id)}</div>` : ''}
            </div>`;
        }).join('')}
      </div>
    </section>`;
}

function outcomeTag(r) {
  if (r.status === 'current') {
    return r.eligible
      ? '<span class="pill bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Open</span>'
      : `<span class="pill pill-abstain">${reasonLabel(r.ineligible_reason)}</span>`;
  }
  return r.eligible
    ? '<span class="pill pill-yes">Paid</span>'
    : `<span class="pill pill-missed">${reasonLabel(r.ineligible_reason)}</span>`;
}

function reasonLabel(reason) {
  if (reason === 'outside_top_200') return 'Below cut-off';
  if (reason === 'incomplete_votes') return 'Missed actions';
  return 'No payout';
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportVotes(actions, voteMap, govId) {
  const headers = ['epoch', 'action_id', 'title', 'type', 'vote', 'voted_at', 'tx_hash'];
  const rows = actions.map(a => {
    const v = voteMap[a.id];
    return [a.epoch, a.id, a.title, a.type, v?.vote || 'NOT VOTED', v?.voted_at || '', v?.tx_hash || ''];
  });
  downloadFile(`voting-record-${shortId(govId || 'account', 12, 4)}.csv`,
    toCsv(headers, rows), 'text/csv;charset=utf-8');
  window.showToast?.('Voting record exported', 'success');
}
