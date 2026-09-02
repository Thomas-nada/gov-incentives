import { renderHome }     from './components/home.js';
import { renderClaim }    from './components/claim.js';
import { renderEpochs }   from './components/epochs.js';
import { renderExplorer } from './components/explorer.js';
import { renderDocs }     from './components/docs.js';
import { renderProfile }  from './components/profile.js';

import {
  loadJSON, hexToStakeAddress, shortId, copyToClipboard, escapeHtml,
  formatCountdown, relativeTime, formatDateTime, adaCompact, formatInt,
  progressBetween, explorer,
} from './utils.js';

import {
  APP_NAME, APP_SHORT_NAME, WALLET_DEFS, DEMO_ACCOUNTS, STORAGE, SUPPORT_EMAIL,
} from './config.js';

// ─── Application state ────────────────────────────────────────────────────────
export const state = {
  dark: false,
  loading: true,
  loadError: null,
  snapshot: null,
  epochs: [],
  rankings: {},
  eligibility: {},
  governanceActions: {},
  votes: {},
  payouts: [],
  profileHistory: {},
  wallet: null,           // { stakeAddress, govId, type, walletName, connectedAt }
  loadedAt: null,
};

/** Snapshot-derived shortcuts every view needs. */
export const snap = {
  get programme() { return state.snapshot?.programme || {}; },
  get chain()     { return state.snapshot?.chain || {}; },
  get window()    { return state.snapshot?.window || {}; },
  get totals()    { return state.snapshot?.totals || {}; },
  get windowId()  { return state.snapshot?.window?.id || 'window_521_523'; },
  get epochs()    { return state.snapshot?.window?.epochs || []; },
  get ranking()   { return state.rankings?.[this.windowId] || null; },
  get voteLedger(){ return state.votes?.[this.windowId]?.votes || []; },
  /** Every governance action in the open window, with its epoch attached. */
  get windowActions() {
    return this.epochs.flatMap(ep =>
      (state.governanceActions?.[String(ep)] || []).map(a => ({ ...a, epoch: ep })));
  },
};

// ─── Data loading ─────────────────────────────────────────────────────────────
const SOURCES = [
  ['snapshot',          'data/snapshot.json'],
  ['epochs',            'data/epochs.json'],
  ['rankings',          'data/rankings.json'],
  ['eligibility',       'data/eligibility.json'],
  ['governanceActions', 'data/governance_actions.json'],
  ['votes',             'data/votes.json'],
  ['payouts',           'data/payouts.json'],
  ['profileHistory',    'data/profile_history.json'],
];

export async function loadData() {
  try {
    const results = await Promise.all(SOURCES.map(([, path]) => loadJSON(path)));
    SOURCES.forEach(([key], i) => { state[key] = results[i]; });
    state.loadError = null;
    state.loadedAt = Date.now();
  } catch (err) {
    state.loadError = err.message || String(err);
  } finally {
    state.loading = false;
  }
}

// ─── Wallet session ───────────────────────────────────────────────────────────
export function setWallet(data) {
  state.wallet = { ...data, connectedAt: new Date().toISOString() };
  try { localStorage.setItem(STORAGE.wallet, JSON.stringify(state.wallet)); } catch {}
}

export function clearWallet() {
  state.wallet = null;
  try { localStorage.removeItem(STORAGE.wallet); } catch {}
}

/** Accepts a stake address, DRep ID or CC hot credential and returns the stake key. */
export function resolveToStakeAddress(input) {
  const value = (input || '').trim();
  if (!value) return null;
  if (value.startsWith('stake1')) return value;
  for (const [addr, rec] of Object.entries(state.eligibility)) {
    if (addr.startsWith('_')) continue;
    if (rec.drep_id === value || rec.cc_credential === value) return addr;
  }
  // Fall back to the full ranking table so any listed DRep can be looked up.
  const rank = snap.ranking;
  const hit = rank?.dreps?.find(d => d.drep_id === value)
    || rank?.cc?.find(c => c.credential === value);
  return hit?.stake_address || value;
}

/** The full record for a stake address, whether or not it is eligible. */
export function lookupAccount(stakeAddress) {
  if (!stakeAddress) return null;
  const direct = state.eligibility[stakeAddress];
  if (direct) return direct;

  const rank = snap.ranking;
  const drep = rank?.dreps?.find(d => d.stake_address === stakeAddress);
  if (drep) {
    const total = snap.window.total_actions || 0;
    let reason = null;
    if (drep.voted_actions < total) reason = 'incomplete_votes';
    else if (!drep.eligible) reason = 'outside_top_200';
    return {
      type: 'drep',
      eligible: drep.eligible,
      voted_all: drep.voted_actions === total,
      voted_actions: drep.voted_actions,
      total_actions: total,
      voting_power_lovelace: drep.voting_power_lovelace,
      delegators: drep.delegators,
      registered_epoch: drep.registered_epoch,
      name: drep.name,
      drep_id: drep.drep_id,
      rank: drep.rank,
      participation_rank: drep.participation_rank,
      eligible_pool_size: snap.window.eligible_dreps,
      ineligible_reason: reason,
      amount_lovelace: drep.share_lovelace,
    };
  }

  const cc = rank?.cc?.find(c => c.stake_address === stakeAddress);
  if (cc) {
    const total = snap.window.total_actions || 0;
    return {
      type: 'cc',
      eligible: cc.eligible,
      voted_all: cc.voted_actions === total,
      voted_actions: cc.voted_actions,
      total_actions: total,
      name: cc.name,
      region: cc.region,
      term_end_epoch: cc.term_end_epoch,
      cc_credential: cc.credential,
      eligible_pool_size: snap.window.eligible_cc,
      ineligible_reason: cc.eligible ? null : 'incomplete_votes',
      amount_lovelace: cc.share_lovelace,
    };
  }
  return null;
}

// ─── Router ───────────────────────────────────────────────────────────────────
const ROUTES = {
  home:     renderHome,
  claim:    renderClaim,
  epochs:   renderEpochs,
  explorer: renderExplorer,
  docs:     renderDocs,
  profile:  renderProfile,
};

const ALIASES = { transparency: 'explorer', guide: 'docs' };

export function currentRoute() {
  const hash = window.location.hash.slice(1) || 'home';
  const [raw, ...rest] = hash.split('/');
  const view = ALIASES[raw] || raw;
  return { view: ROUTES[view] ? view : 'home', params: rest };
}

export function route() {
  const { view, params } = currentRoute();
  const app = document.getElementById('app');

  renderChrome(view);

  if (state.loading) { app.innerHTML = skeleton(); lucide.createIcons(); return; }
  if (state.loadError) { app.innerHTML = errorPanel(state.loadError); lucide.createIcons(); return; }

  app.innerHTML = '';
  ROUTES[view](app, params);
  lucide.createIcons();
  tickLiveValues();
}

// ─── Chrome: banner, header, status strip, footer ─────────────────────────────
function renderChrome(view) {
  renderBanner();
  renderHeader(view);
  renderFooter();
}

function bannerDismissed() {
  try { return localStorage.getItem(STORAGE.banner) === '1'; } catch { return false; }
}

function renderBanner() {
  const el = document.getElementById('env-banner');
  if (!el) return;
  if (bannerDismissed()) { el.innerHTML = ''; el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 h-9 flex items-center justify-between gap-3 text-xs">
      <p class="flex items-center gap-2 min-w-0">
        <span class="env-dot"></span>
        <span class="font-semibold uppercase tracking-wider">Demo environment</span>
        <span class="hidden sm:inline text-amber-900/70 dark:text-amber-200/70 truncate">
          Snapshot data is simulated and no transaction is ever submitted to Cardano.
        </span>
      </p>
      <button id="banner-dismiss" class="shrink-0 px-2 py-0.5 rounded font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
        Dismiss
      </button>
    </div>`;
  el.querySelector('#banner-dismiss')?.addEventListener('click', () => {
    try { localStorage.setItem(STORAGE.banner, '1'); } catch {}
    renderBanner();
  });
}

const NAV = [
  { id: 'home',     label: 'Overview', icon: 'layout-dashboard' },
  { id: 'claim',    label: 'Claim',    icon: 'hand-coins' },
  { id: 'epochs',   label: 'Epochs',   icon: 'calendar-range' },
  { id: 'explorer', label: 'Explorer', icon: 'table-2' },
  { id: 'docs',     label: 'Docs',     icon: 'book-open' },
];

function renderHeader(view) {
  const nav = document.getElementById('nav');
  nav.innerHTML = `
    <div class="border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-950/85 backdrop-blur">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <a href="#home" class="flex items-center gap-2.5 shrink-0 no-underline group">
          <span class="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <path d="M12 2 4 5.5v5.9c0 4.6 3.2 8.4 8 10.6 4.8-2.2 8-6 8-10.6V5.5L12 2Z"/>
              <path d="m9 12 2.2 2.2L15.5 10"/>
            </svg>
          </span>
          <span class="leading-none">
            <span class="block text-sm font-bold text-slate-900 dark:text-slate-50 tracking-tight">${APP_SHORT_NAME}</span>
            <span class="hidden md:block text-[10px] font-medium text-slate-400 tracking-wide">${APP_NAME}</span>
          </span>
        </a>

        <nav class="hidden lg:flex items-center gap-0.5 ml-4" aria-label="Primary">
          ${NAV.map(l => `
            <a href="#${l.id}" class="nav-link ${view === l.id ? 'nav-link-active' : ''}">
              <i data-lucide="${l.icon}" class="w-3.5 h-3.5"></i>${l.label}
            </a>`).join('')}
        </nav>

        <div class="ml-auto flex items-center gap-2">
          ${headerWallet(view)}
          <button id="theme-toggle" class="icon-btn" title="Toggle theme" aria-label="Toggle theme">
            <i data-lucide="${state.dark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    </div>

    ${statusStrip()}

    <div class="lg:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-x-auto">
      <div class="flex items-center gap-1 px-3 py-1.5 min-w-max">
        ${NAV.map(l => `
          <a href="#${l.id}" class="nav-link text-xs ${view === l.id ? 'nav-link-active' : ''}">
            <i data-lucide="${l.icon}" class="w-3.5 h-3.5"></i>${l.label}
          </a>`).join('')}
      </div>
    </div>`;

  nav.querySelector('#theme-toggle')?.addEventListener('click', toggleTheme);
  nav.querySelector('#wallet-connect')?.addEventListener('click', () => openWalletDialog());
  nav.querySelector('#wallet-disconnect')?.addEventListener('click', () => {
    clearWallet();
    showToast('Wallet disconnected', 'info');
    if (currentRoute().view === 'profile') window.location.hash = '#home';
    else route();
  });
}

function headerWallet(view) {
  if (!state.wallet) {
    return `
      <button id="wallet-connect" class="btn-primary text-sm h-9 px-3.5">
        <i data-lucide="wallet" class="w-4 h-4"></i>
        <span class="hidden sm:inline">Connect wallet</span>
        <span class="sm:hidden">Connect</span>
      </button>`;
  }
  const label = state.wallet.name || shortId(state.wallet.govId || state.wallet.stakeAddress, 10, 5);
  const active = view === 'profile';
  return `
    <div class="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden h-9">
      <a href="#profile" class="flex items-center gap-2 px-3 h-full text-xs font-semibold transition-colors
        ${active ? 'bg-brand-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}">
        <span class="status-dot status-dot-live"></span>
        <span class="max-w-[9rem] truncate">${escapeHtml(label)}</span>
      </a>
      <button id="wallet-disconnect" title="Disconnect"
        class="px-2 h-full border-l border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
        <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
      </button>
    </div>`;
}

function statusStrip() {
  if (state.loading || state.loadError) {
    return `<div class="status-strip"><div class="max-w-7xl mx-auto px-4 h-8 flex items-center text-[11px] text-slate-400">
      ${state.loadError ? 'Snapshot unavailable' : 'Loading snapshot…'}
    </div></div>`;
  }

  const chain = snap.chain;
  const win = snap.window;
  const pct = Math.round(progressBetween(chain.current_epoch_start, chain.current_epoch_end) * 100);

  return `
    <div class="status-strip">
      <div class="max-w-7xl mx-auto px-4 h-8 flex items-center gap-4 text-[11px] overflow-x-auto">
        <span class="status-item shrink-0">
          <span class="status-dot status-dot-live"></span>
          <span class="font-semibold text-slate-600 dark:text-slate-300 capitalize">${escapeHtml(snap.programme.network || 'mainnet')}</span>
        </span>
        <span class="status-sep"></span>
        <span class="status-item shrink-0" title="Epoch ${chain.current_epoch} ends ${formatDateTime(chain.current_epoch_end)}">
          <i data-lucide="calendar-clock" class="w-3 h-3 text-slate-400"></i>
          Epoch <strong class="text-slate-700 dark:text-slate-200">${chain.current_epoch}</strong>
          <span class="epoch-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
          <span class="text-slate-500 dark:text-slate-400" data-countdown="${chain.current_epoch_end}">${formatCountdown(chain.current_epoch_end)}</span>
        </span>
        <span class="status-sep hidden sm:inline-block"></span>
        <span class="status-item shrink-0 hidden sm:inline-flex" title="Claims close at the end of epoch ${win.claim_deadline_epoch}">
          <i data-lucide="hourglass" class="w-3 h-3 text-slate-400"></i>
          Claim window ${win.epochs?.join('–')} closes
          <strong class="text-amber-600 dark:text-amber-400" data-countdown="${win.claim_deadline_at}">${formatCountdown(win.claim_deadline_at)}</strong>
        </span>
        <span class="status-sep hidden lg:inline-block"></span>
        <span class="status-item shrink-0 hidden lg:inline-flex" title="Snapshot taken at block ${formatInt(win.snapshot_block)}">
          <i data-lucide="database" class="w-3 h-3 text-slate-400"></i>
          Snapshot <span class="text-slate-500 dark:text-slate-400">${relativeTime(win.snapshot_taken_at)}</span>
        </span>
        <a href="#explorer" class="status-item shrink-0 ml-auto hidden md:inline-flex text-brand-600 dark:text-brand-400 hover:underline">
          ${formatInt(win.claims_settled)} of ${formatInt((win.eligible_dreps || 0) + (win.eligible_cc || 0))} claims settled
          <i data-lucide="arrow-right" class="w-3 h-3"></i>
        </a>
      </div>
    </div>`;
}

function renderFooter() {
  const el = document.getElementById('footer');
  if (!el) return;
  const p = snap.programme;
  const w = snap.window;
  el.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-10">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div>
          <div class="flex items-center gap-2 mb-3">
            <span class="brand-mark brand-mark-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                <path d="M12 2 4 5.5v5.9c0 4.6 3.2 8.4 8 10.6 4.8-2.2 8-6 8-10.6V5.5L12 2Z"/><path d="m9 12 2.2 2.2L15.5 10"/>
              </svg>
            </span>
            <span class="text-sm font-bold text-slate-800 dark:text-slate-100">${APP_SHORT_NAME}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Equal-share rewards for DReps and Constitutional Committee members who vote on every
            governance action in a three-epoch window.
          </p>
        </div>
        ${footerColumn('Programme', [
          ['Overview', '#home'], ['Claim rewards', '#claim'],
          ['Epoch history', '#epochs'], ['Snapshot explorer', '#explorer'],
        ])}
        ${footerColumn('Resources', [
          ['Documentation', '#docs'], ['Eligibility rules', '#docs'],
          ['Treasury stake pool', p.stake_pool ? explorer.pool(p.stake_pool.pool_id) : '#docs', true],
          ['Service status', p.status_url || '#docs', true],
        ])}
        <div>
          <p class="footer-heading">Support</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
            Claim not showing as expected? Include your DRep ID and claim reference.
          </p>
          <a href="mailto:${SUPPORT_EMAIL}" class="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">${SUPPORT_EMAIL}</a>
        </div>
      </div>

      <div class="border-t border-slate-200 dark:border-slate-800 pt-5 flex flex-col lg:flex-row gap-3 lg:items-center justify-between text-[11px] text-slate-400">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Portal v${escapeHtml(p.version || '—')}</span>
          <span class="hidden sm:inline">·</span>
          <span>Snapshot <code class="addr-chip">${shortId(w.snapshot_hash, 10, 6)}</code></span>
          <span class="hidden sm:inline">·</span>
          <span>Block ${formatInt(w.snapshot_block)}</span>
          <span class="hidden sm:inline">·</span>
          <span>Reserve ${adaCompact(snap.totals.reserve_balance_lovelace)}</span>
        </div>
        <p class="max-w-xl lg:text-right">
          Simulated data for demonstration. Not financial advice and not affiliated with any
          Cardano entity. No wallet signature performed here moves funds.
        </p>
      </div>
    </div>`;
}

function footerColumn(heading, links) {
  return `
    <div>
      <p class="footer-heading">${heading}</p>
      <ul class="space-y-1.5">
        ${links.map(([label, href, external]) => `
          <li><a href="${href}" ${external ? 'target="_blank" rel="noopener"' : ''} class="footer-link">
            ${label}${external ? '<i data-lucide="external-link" class="w-3 h-3 inline-block ml-0.5 -mt-0.5"></i>' : ''}
          </a></li>`).join('')}
      </ul>
    </div>`;
}

// ─── Loading and error states ─────────────────────────────────────────────────
function skeleton() {
  return `
    <div class="max-w-7xl mx-auto px-4 py-10">
      <div class="skel h-8 w-64 mb-3"></div>
      <div class="skel h-4 w-96 mb-8"></div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${'<div class="skel h-24 rounded-xl"></div>'.repeat(4)}
      </div>
      <div class="skel h-72 rounded-2xl"></div>
    </div>`;
}

function errorPanel(message) {
  return `
    <div class="max-w-lg mx-auto px-4 py-24 text-center">
      <div class="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
        <i data-lucide="cloud-off" class="w-7 h-7 text-red-500"></i>
      </div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">Snapshot unavailable</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">
        The portal could not load the reward snapshot, so eligibility and claim data cannot be shown.
      </p>
      <p class="text-xs text-slate-400 mb-6 addr-chip">${escapeHtml(message)}</p>
      <button onclick="location.reload()" class="btn-primary text-sm h-9 px-4 mx-auto">
        <i data-lucide="rotate-cw" class="w-4 h-4"></i> Retry
      </button>
    </div>`;
}

// ─── Wallet dialog ────────────────────────────────────────────────────────────
export function openWalletDialog() {
  if (document.getElementById('wallet-dialog')) return;

  const installed = typeof window.cardano !== 'undefined'
    ? WALLET_DEFS.filter(w => window.cardano[w.id])
    : [];

  const el = document.createElement('div');
  el.id = 'wallet-dialog';
  el.className = 'modal-root';
  el.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Connect wallet">
      <div class="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div>
          <h2 class="text-base font-bold text-slate-900 dark:text-slate-50">Connect wallet</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Read-only. The portal requests your reward address to look up eligibility.
          </p>
        </div>
        <button class="icon-btn" data-close aria-label="Close"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <div class="px-5 pb-5 space-y-5 max-h-[70vh] overflow-y-auto">
        <section>
          <p class="field-label mb-2">Browser wallets</p>
          ${installed.length ? `
            <div class="grid grid-cols-2 gap-2">
              ${installed.map(w => `
                <button class="wallet-option" data-wallet="${w.id}">
                  <span class="wallet-swatch" style="background:${w.accent}"></span>
                  <span class="text-sm font-medium">${w.label}</span>
                </button>`).join('')}
            </div>` : `
            <div class="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              No CIP-30 wallet extension detected in this browser. Use a test account or enter a
              governance ID below.
            </div>`}
        </section>

        <section>
          <p class="field-label mb-2">Test accounts</p>
          <div class="space-y-1.5">
            ${DEMO_ACCOUNTS.map((d, i) => `
              <button class="demo-option" data-demo="${i}">
                <span class="min-w-0 text-left">
                  <span class="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">${escapeHtml(d.name)}</span>
                  <span class="block text-xs text-slate-400 truncate">${escapeHtml(d.summary)}</span>
                </span>
                <span class="outcome-pill outcome-${d.outcome}">${d.outcome === 'eligible' ? 'Eligible' : d.outcome === 'ineligible' ? 'Ineligible' : 'Not found'}</span>
              </button>`).join('')}
          </div>
        </section>

        <section>
          <label for="wallet-manual" class="field-label mb-1.5 block">Or enter a governance ID</label>
          <div class="flex gap-2">
            <input id="wallet-manual" type="text" spellcheck="false" autocomplete="off"
              placeholder="drep1… · cc_hot1… · stake1…" class="input addr-chip flex-1" />
            <button id="wallet-manual-go" class="btn-primary h-10 px-4 text-sm">Look up</button>
          </div>
          <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">
            In production, connecting proves control of the DRep or committee key by signing a
            CIP-8 challenge. Nothing is signed here.
          </p>
        </section>
      </div>
    </div>`;

  document.body.appendChild(el);
  document.body.classList.add('overflow-hidden');
  lucide.createIcons({ nodes: [el] });

  el.querySelectorAll('[data-close]').forEach(n => n.addEventListener('click', closeWalletDialog));
  el.querySelectorAll('[data-wallet]').forEach(btn =>
    btn.addEventListener('click', () => connectBrowserWallet(btn.dataset.wallet)));
  el.querySelectorAll('[data-demo]').forEach(btn =>
    btn.addEventListener('click', () => connectDemoAccount(Number(btn.dataset.demo))));
  el.querySelector('#wallet-manual-go').addEventListener('click', connectManual);
  el.querySelector('#wallet-manual').addEventListener('keydown', e => {
    if (e.key === 'Enter') connectManual();
  });
  document.addEventListener('keydown', escToClose);
  setTimeout(() => el.querySelector('#wallet-manual')?.focus(), 60);
}

function escToClose(e) {
  if (e.key === 'Escape') closeWalletDialog();
}

function closeWalletDialog() {
  document.getElementById('wallet-dialog')?.remove();
  document.body.classList.remove('overflow-hidden');
  document.removeEventListener('keydown', escToClose);
}

function finishConnect(stakeAddress, { govId, walletName, name } = {}) {
  const record = lookupAccount(stakeAddress);
  setWallet({
    stakeAddress,
    govId: govId || record?.drep_id || record?.cc_credential || stakeAddress,
    type: record?.type || 'unknown',
    name: name || record?.name || null,
    walletName: walletName || null,
  });
  closeWalletDialog();
  showToast(`Connected as ${name || shortId(govId || stakeAddress, 12, 6)}`, 'success');
  window.location.hash = '#profile';
  if (currentRoute().view === 'profile') route();
}

function connectManual() {
  const raw = document.getElementById('wallet-manual')?.value.trim();
  if (!raw) { showToast('Enter a DRep ID, committee credential or stake address', 'warning'); return; }
  const stakeAddress = resolveToStakeAddress(raw);
  const govId = (raw.startsWith('drep1') || raw.startsWith('cc_hot1')) ? raw : null;
  finishConnect(stakeAddress, { govId });
}

function connectDemoAccount(index) {
  const demo = DEMO_ACCOUNTS[index];
  if (!demo) return;
  finishConnect(demo.address, { govId: demo.govId, walletName: 'demo', name: demo.name });
}

async function connectBrowserWallet(walletId) {
  const btn = document.querySelector(`[data-wallet="${walletId}"]`);
  const def = WALLET_DEFS.find(w => w.id === walletId);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span><span class="text-sm font-medium">Connecting…</span>`;
  }
  try {
    const api = await window.cardano[walletId].enable();
    const hexAddresses = await api.getRewardAddresses();
    if (!hexAddresses?.length) throw new Error('wallet exposed no reward address');
    const stakeAddress = hexToStakeAddress(hexAddresses[0]) || hexAddresses[0];
    finishConnect(stakeAddress, { walletName: walletId });
  } catch (err) {
    showToast(`${def?.label || walletId}: ${err.message || 'connection refused'}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="wallet-swatch" style="background:${def?.accent || '#64748b'}"></span><span class="text-sm font-medium">${def?.label || walletId}</span>`;
    }
  }
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function toggleTheme() {
  state.dark = !state.dark;
  document.documentElement.classList.toggle('dark', state.dark);
  try { localStorage.setItem(STORAGE.theme, state.dark ? 'dark' : 'light'); } catch {}
  route();
}

// ─── Toasts ───────────────────────────────────────────────────────────────────
export function showToast(message, type = 'info', duration = 4200) {
  const container = document.getElementById('toasts');
  if (!container) return;
  const tone = {
    info:    'bg-slate-900 text-white dark:bg-slate-700',
    success: 'bg-emerald-600 text-white',
    error:   'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
  }[type] || 'bg-slate-900 text-white';
  const icon = { info: 'info', success: 'check-circle-2', error: 'x-circle', warning: 'alert-triangle' }[type] || 'info';

  const el = document.createElement('div');
  el.className = `toast toast-enter ${tone}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  lucide.createIcons({ nodes: [el] });

  setTimeout(() => {
    el.classList.replace('toast-enter', 'toast-exit');
    setTimeout(() => el.remove(), 260);
  }, duration);
}

// ─── Live values ──────────────────────────────────────────────────────────────
// Countdowns tick without re-rendering the view, so tables keep their scroll
// position and open menus stay open.
function tickLiveValues() {
  document.querySelectorAll('[data-countdown]').forEach(el => {
    el.textContent = formatCountdown(el.dataset.countdown, { withSeconds: el.dataset.seconds === '1' });
  });
  document.querySelectorAll('[data-reltime]').forEach(el => {
    el.textContent = relativeTime(el.dataset.reltime);
  });
}

// ─── Global click delegation for copy chips ───────────────────────────────────
document.addEventListener('click', async e => {
  const target = e.target.closest('[data-copy]');
  if (!target) return;
  e.preventDefault();
  const ok = await copyToClipboard(target.dataset.copy);
  showToast(ok ? 'Copied to clipboard' : 'Could not access the clipboard', ok ? 'success' : 'error', 1800);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.showToast = showToast;
window.openWalletDialog = openWalletDialog;
window.appRoute = route;

document.addEventListener('DOMContentLoaded', async () => {
  let stored = null;
  try { stored = localStorage.getItem(STORAGE.theme); } catch {}
  state.dark = stored
    ? stored === 'dark'
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  document.documentElement.classList.toggle('dark', state.dark);

  try {
    const saved = localStorage.getItem(STORAGE.wallet);
    if (saved) state.wallet = JSON.parse(saved);
  } catch {
    try { localStorage.removeItem(STORAGE.wallet); } catch {}
  }

  route();                 // paint the skeleton immediately
  await loadData();
  route();

  window.addEventListener('hashchange', () => {
    route();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  setInterval(tickLiveValues, 1000);
});
