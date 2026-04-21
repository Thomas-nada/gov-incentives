import { state }    from '../app.js?v=15';
import { formatAda } from '../utils.js?v=15';
import { DREP_POOL_PCT, CC_POOL_PCT, MAX_ELIGIBLE_DREPS,
         PRINCIPAL_ADA, CURRENT_EPOCH, OPEN_EPOCH, OPEN_EPOCHS,
         RESERVE_BALANCE_ADA } from '../config.js?v=15';

export function renderHome(app) {
  const latestEpoch = state.epochs.find(e => e.epoch === OPEN_EPOCH);
  const windowData = state.rankings?.window_521_523 || null;
  const totalPoolAda = windowData?.total_pool_ada || 0;
  const drepPoolAda = windowData?.drep_pool_ada || 0;
  const ccPoolAda = windowData?.cc_pool_ada || 0;
  const drepShareAda = windowData?.drep_share_ada || 0;
  const ccShareAda = windowData?.cc_share_ada || 0;
  const totalDistributed = state.epochs.reduce((s, e) => s + (e.ada_distributed || 0), 0);

  app.innerHTML = `
    <!-- Hero -->
    <section class="hero-gradient text-white">
      <div class="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <div class="max-w-2xl">
          <div class="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-sm font-medium mb-5">
            <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            Epoch ${CURRENT_EPOCH} in progress — the current UI evaluates epochs ${OPEN_EPOCHS.join(', ')}
          </div>
          <h1 class="text-4xl md:text-5xl font-bold leading-tight mb-4">
            Governance<br/>Rewards Engine
          </h1>
          <p class="text-lg text-white/80 mb-8 max-w-lg">
            Rewarding DReps and CC members who vote on every governance action, funded entirely by staking yields from a 75M ₳ treasury stake pool.
          </p>
          <div class="flex flex-wrap gap-3">
            <a href="#claim" class="bg-white text-brand-700 font-semibold px-6 py-2.5 rounded-xl hover:bg-brand-50 transition-colors flex items-center gap-2">
              <i data-lucide="coins" class="w-4 h-4"></i> Check Eligibility
            </a>
            <a href="#epochs" class="bg-white/15 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-white/25 transition-colors flex items-center gap-2">
              <i data-lucide="calendar" class="w-4 h-4"></i> View Epochs
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats bar -->
    <section class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div class="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        ${statCard('Current Epoch', CURRENT_EPOCH.toString(), 'calendar', 'Voting in progress')}
        ${statCard('Open Claim Epochs', OPEN_EPOCHS.length.toString(), 'unlock', `Epochs ${OPEN_EPOCHS[0]}–${OPEN_EPOCHS[OPEN_EPOCHS.length-1]}`)}
        ${statCard('Reserve Balance', formatAda(RESERVE_BALANCE_ADA), 'piggy-bank', 'Accumulated surplus')}
        ${statCard('Total Distributed', formatAda(totalDistributed), 'trending-up', 'Across all epochs')}
      </div>
    </section>

    <!-- Reward breakdown -->
    <section class="max-w-6xl mx-auto px-4 py-12">
      <h2 class="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">Reward Structure</h2>
      <p class="text-slate-500 dark:text-slate-400 mb-8">
        Equal shares from the current 3-epoch reward pool, derived from the generated epoch yields and bundled vote snapshot.
      </p>

      <!-- Pool split visual -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">3-Epoch Reward Pool</span>
          <span class="text-lg font-bold text-slate-900 dark:text-slate-100">${formatAda(totalPoolAda)}</span>
        </div>
        <div class="flex rounded-xl overflow-hidden h-5 mb-3">
          <div class="bg-brand-500 flex items-center justify-center text-white text-xs font-bold" style="width:${DREP_POOL_PCT}%">${DREP_POOL_PCT}%</div>
          <div class="bg-violet-500 flex items-center justify-center text-white text-xs font-bold" style="width:${CC_POOL_PCT}%">${CC_POOL_PCT}%</div>
        </div>
        <div class="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-brand-500 inline-block"></span>DRep pool — ${formatAda(drepPoolAda)}</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-violet-500 inline-block"></span>CC pool — ${formatAda(ccPoolAda)}</span>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-6 mb-12">
        <!-- DRep card -->
        <div class="stat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="w-12 h-12 bg-brand-100 dark:bg-brand-900/40 rounded-xl flex items-center justify-center">
              <i data-lucide="vote" class="w-6 h-6 text-brand-600 dark:text-brand-400"></i>
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400 mb-0.5">equal share of ${DREP_POOL_PCT}%</div>
              <span class="text-3xl font-bold text-brand-600 dark:text-brand-400">~${drepShareAda} ₳</span>
            </div>
          </div>
          <h3 class="text-lg font-semibold mb-1">DRep Reward</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mb-4">Top ${MAX_ELIGIBLE_DREPS} DReps by voting power who voted on <strong>every</strong> governance action in the 3-epoch window share ${DREP_POOL_PCT}% of the pool equally.</p>
          <ul class="space-y-2 text-sm">
            ${bullet(`Must vote on all governance actions across epochs ${OPEN_EPOCHS.join(', ')}`)}
            ${bullet(`Top ${MAX_ELIGIBLE_DREPS} by voting power among those who qualify`)}
            ${bullet(`All ${MAX_ELIGIBLE_DREPS} qualifying DReps receive the exact same payout`)}
            ${bullet(`If fewer than ${MAX_ELIGIBLE_DREPS} qualify, the eligible DReps split the full DRep pool among themselves`)}
            ${bullet('One claim per window — no partial credit for missed actions')}
          </ul>
        </div>
        <!-- CC card -->
        <div class="stat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div class="flex items-start justify-between mb-4">
            <div class="w-12 h-12 bg-violet-100 dark:bg-violet-900/40 rounded-xl flex items-center justify-center">
              <i data-lucide="scale" class="w-6 h-6 text-violet-600 dark:text-violet-400"></i>
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400 mb-0.5">equal share of ${CC_POOL_PCT}%</div>
              <span class="text-3xl font-bold text-violet-600 dark:text-violet-400">~${ccShareAda.toLocaleString()} ₳</span>
            </div>
          </div>
          <h3 class="text-lg font-semibold mb-1">CC Member Reward</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mb-4">Constitutional Committee members who voted on <strong>every</strong> governance action in the 3-epoch window share ${CC_POOL_PCT}% of the pool equally.</p>
          <ul class="space-y-2 text-sm">
            ${bullet(`Must vote on all governance actions across epochs ${OPEN_EPOCHS.join(', ')}`)}
            ${bullet('All qualifying CC members receive the exact same payout')}
            ${bullet('If fewer than 7 qualify, the eligible CC members split the full CC pool among themselves')}
            ${bullet('Vote direction (Yes/No/Abstain) does not affect eligibility')}
            ${bullet('One claim per window — no partial credit for missed actions')}
          </ul>
        </div>
      </div>

      <!-- How it works -->
      <h2 class="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">How It Works</h2>
      <p class="text-slate-500 dark:text-slate-400 mb-8">A self-sustaining yield engine — no ongoing treasury requests needed.</p>
      <div class="grid md:grid-cols-3 gap-6 mb-12">
        ${step(1, 'Treasury Bootstrap', `75M ₳ from the Cardano Treasury is delegated to a dedicated stake pool. In the current window, the app sums the generated rewards from epochs ${OPEN_EPOCHS.join(', ')} into a live 3-epoch pool of ${formatAda(totalPoolAda)}.`, 'landmark', 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400')}
        ${step(2, 'Snapshot & Eligibility', `The bundled snapshot for epochs ${OPEN_EPOCHS.join(', ')} determines eligibility. DReps and CC members who voted on every governance action qualify. Top ${MAX_ELIGIBLE_DREPS} DReps share ${DREP_POOL_PCT}% of the pool; eligible CC members share ${CC_POOL_PCT}%.`, 'camera', 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400')}
        ${step(3, 'Claim Your Equal Share', 'Connect your wallet or enter your stake address. If eligible, the current prototype shows your fixed share, collects a payout address, and records a demo claim in-browser with a placeholder transaction hash.', 'wallet', 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400')}
      </div>

      <!-- Epoch example -->
      ${latestEpoch ? exampleSection(latestEpoch) : ''}

      <!-- CTA -->
      <div class="hero-gradient rounded-2xl p-8 text-white text-center">
        <h3 class="text-2xl font-bold mb-2">Ready to claim?</h3>
        <p class="text-white/75 mb-6">The current rewards snapshot covers epochs ${OPEN_EPOCHS.join(', ')}. Vote on all governance actions in the window to qualify for your equal share.</p>
        <a href="#claim" class="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-3 rounded-xl hover:bg-brand-50 transition-colors">
          <i data-lucide="coins" class="w-4 h-4"></i> Check My Eligibility
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-slate-200 dark:border-slate-800 mt-8">
      <div class="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
        <div class="flex items-center gap-2">
          <i data-lucide="shield-check" class="w-4 h-4 text-brand-500"></i>
          Governance Rewards Engine — Cardano
        </div>
        <div class="flex gap-4">
          <a href="#transparency" class="hover:text-brand-500 transition-colors">Transparency</a>
          <a href="#epochs" class="hover:text-brand-500 transition-colors">Epoch History</a>
        </div>
      </div>
    </footer>
  `;
}

function statCard(label, value, icon, sub) {
  return `
    <div class="stat-card bg-slate-50 dark:bg-slate-800 rounded-xl p-4 flex items-center gap-4">
      <div class="w-10 h-10 bg-brand-100 dark:bg-brand-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
        <i data-lucide="${icon}" class="w-5 h-5 text-brand-600 dark:text-brand-400"></i>
      </div>
      <div>
        <div class="text-xs text-slate-500 dark:text-slate-400">${label}</div>
        <div class="text-xl font-bold text-slate-900 dark:text-slate-100">${value}</div>
        <div class="text-xs text-slate-400 dark:text-slate-500">${sub}</div>
      </div>
    </div>
  `;
}

function bullet(text) {
  return `<li class="flex items-start gap-2 text-slate-600 dark:text-slate-300">
    <i data-lucide="check" class="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0"></i>
    <span>${text}</span>
  </li>`;
}

function step(n, title, desc, icon, colorClass) {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 ${colorClass} rounded-xl flex items-center justify-center">
          <i data-lucide="${icon}" class="w-5 h-5"></i>
        </div>
        <span class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Step ${n}</span>
      </div>
      <h3 class="font-semibold text-slate-900 dark:text-slate-100 mb-2">${title}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">${desc}</p>
    </div>
  `;
}

function exampleSection(epoch) {
  return `
    <div class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-12">
      <h3 class="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <i data-lucide="bar-chart-2" class="w-4 h-4 text-brand-500"></i>
        Epoch ${epoch.epoch} — Example Breakdown
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        ${miniStat('Rewards generated', formatAda(epoch.rewards_generated))}
        ${miniStat('DReps rewarded', epoch.dreps_rewarded + ' eligible')}
        ${miniStat('CC members rewarded', epoch.cc_rewarded + ' eligible')}
        ${miniStat('Added to reserve', formatAda(epoch.reserve_added))}
      </div>
    </div>
  `;
}

function miniStat(label, value) {
  return `<div>
    <div class="text-xs text-slate-400 dark:text-slate-500 mb-0.5">${label}</div>
    <div class="font-semibold text-slate-800 dark:text-slate-200">${value}</div>
  </div>`;
}
