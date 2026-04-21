import { renderHome }         from './components/home.js?v=15';
import { renderClaim }        from './components/claim.js?v=15';
import { renderEpochs }       from './components/epochs.js?v=15';
import { renderTransparency } from './components/transparency.js?v=15';
import { renderGuide }        from './components/guide.js?v=15';
import { renderProfile }      from './components/profile.js?v=15';
import { loadJSON, hexToStakeAddress, truncateAddress } from './utils.js?v=15';
import { DEMO_ADDRESSES }     from './config.js?v=15';

export const state = {
  dark:             false,
  epochs:           [],
  rankings:         {},
  eligibility:      {},
  governanceActions:{},
  votes:            {},
  payouts:          [],
  profileHistory:   {},
  dataLoaded:       false,
  wallet:           null,   // { stakeAddress, govId, type, walletName }
};

// ─── Wallet helpers ───────────────────────────────────────────────────────────
const SAVED_WALLET_KEY = 'gov_rewards_wallet';

export function setWallet(data) {
  state.wallet = data;
  localStorage.setItem(SAVED_WALLET_KEY, JSON.stringify(data));
}

export function clearWallet() {
  state.wallet = null;
  localStorage.removeItem(SAVED_WALLET_KEY);
}

export function resolveToStakeAddress(input) {
  if (!input) return null;
  if (input.startsWith('stake1')) return input;
  for (const [addr, rec] of Object.entries(state.eligibility)) {
    if (addr.startsWith('_')) continue;
    if (rec.drep_id === input || rec.cc_credential === input) return addr;
  }
  return input;
}

export const WALLET_DEFS = [
  { id: 'eternl', label: 'Eternl', icon: '🔵' },
  { id: 'lace',   label: 'Lace',   icon: '⚡' },
  { id: 'flint',  label: 'Flint',  icon: '🔥' },
  { id: 'yoroi',  label: 'Yoroi',  icon: '🟡' },
];

// ─── Data loader ─────────────────────────────────────────────────────────────
export async function loadData() {
  if (state.dataLoaded) return;
  try {
    [state.epochs, state.rankings, state.eligibility, state.governanceActions, state.votes, state.payouts, state.profileHistory] = await Promise.all([
      loadJSON('data/epochs.json'),
      loadJSON('data/rankings.json'),
      loadJSON('data/eligibility.json'),
      loadJSON('data/governance_actions.json'),
      loadJSON('data/votes.json'),
      loadJSON('data/payouts.json'),
      loadJSON('data/profile_history.json'),
    ]);
    state.dataLoaded = true;
  } catch (e) {
    console.error('Failed to load data:', e);
    showToast('Failed to load data', 'error');
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────
function route() {
  const hash = window.location.hash.slice(1) || 'home';
  const [view] = hash.split('/');
  renderNav(view);

  const app = document.getElementById('app');
  app.innerHTML = '';

  switch (view) {
    case 'home':         renderHome(app);          break;
    case 'claim':        renderClaim(app);         break;
    case 'epochs':       renderEpochs(app);        break;
    case 'transparency': renderTransparency(app);  break;
    case 'guide':        renderGuide(app);         break;
    case 'profile':      renderProfile(app);       break;
    default:             renderHome(app);
  }

  lucide.createIcons();
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function renderNav(activeView) {
  const nav = document.getElementById('nav');
  const links = [
    { id: 'home',         label: 'Home',         icon: 'home' },
    { id: 'claim',        label: 'Claim',        icon: 'coins' },
    { id: 'epochs',       label: 'Epochs',       icon: 'calendar' },
    { id: 'transparency', label: 'Transparency', icon: 'search' },
    { id: 'guide',        label: 'Guide',        icon: 'book-open' },
  ];

  nav.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
      <a href="#home" class="flex items-center gap-2 font-bold text-brand-600 dark:text-brand-400 text-sm no-underline hover:opacity-80 transition-opacity">
        <div class="w-7 h-7 bg-brand-600 dark:bg-brand-500 rounded-lg flex items-center justify-center">
          <i data-lucide="shield-check" class="w-4 h-4 text-white"></i>
        </div>
        <span class="hidden sm:inline">Gov Rewards</span>
      </a>
      <div class="flex items-center gap-1">
        ${links.map(l => `
          <a href="#${l.id}" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${activeView === l.id
              ? 'bg-brand-600 text-white dark:bg-brand-500'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            }">
            <i data-lucide="${l.icon}" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">${l.label}</span>
          </a>
        `).join('')}

        <!-- Wallet widget -->
        ${walletNavWidget(activeView)}

        <button id="dark-toggle" class="ml-1 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Toggle dark mode">
          <i data-lucide="${state.dark ? 'sun' : 'moon'}" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;

  document.getElementById('dark-toggle').addEventListener('click', toggleDark);
  document.getElementById('wallet-connect-btn')?.addEventListener('click', showWalletModal);
  document.getElementById('wallet-disconnect')?.addEventListener('click', () => {
    clearWallet();
    route();
    if (window.location.hash === '#profile') window.location.hash = '#home';
  });
}

function walletNavWidget(activeView) {
  if (state.wallet) {
    const display = truncateForNav(state.wallet.govId || state.wallet.stakeAddress);
    const isProfile = activeView === 'profile';
    return `
      <div class="flex items-center gap-0.5 ml-1">
        <a href="#profile" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap
          ${isProfile
            ? 'bg-brand-600 dark:bg-brand-500 text-white'
            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}">
          <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0"></span>
          <span class="addr-chip hidden sm:inline">${display}</span>
          <span class="sm:hidden">Profile</span>
        </a>
        <button id="wallet-disconnect" title="Disconnect"
          class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  }
  return `
    <button id="wallet-connect-btn"
      class="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 dark:bg-brand-500 text-white hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors flex-shrink-0">
      <i data-lucide="wallet" class="w-3.5 h-3.5"></i>
      <span class="hidden sm:inline">Connect Wallet</span>
      <span class="sm:hidden">Connect</span>
    </button>
  `;
}

function truncateForNav(str) {
  if (!str) return '';
  if (str.length <= 18) return str;
  return str.slice(0, 10) + '…' + str.slice(-5);
}

// ─── Wallet connect modal ─────────────────────────────────────────────────────
export function showWalletModal() {
  if (document.getElementById('wallet-modal')) return;

  const available = typeof window.cardano !== 'undefined'
    ? WALLET_DEFS.filter(w => window.cardano[w.id])
    : [];

  const modal = document.createElement('div');
  modal.id = 'wallet-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div id="wallet-modal-bg" class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
    <div class="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">

      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="font-bold text-slate-900 dark:text-slate-100">Connect Wallet</h3>
          <p class="text-xs text-slate-400 mt-0.5">Enter your governance ID or stake address</p>
        </div>
        <button id="wallet-modal-close" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      ${available.length > 0 ? `
        <div class="grid grid-cols-2 gap-2 mb-4">
          ${available.map(w => `
            <button class="modal-wallet-btn flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 transition-colors" data-wallet="${w.id}">
              <span class="text-xl">${w.icon}</span>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">${w.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="flex items-center gap-3 mb-4">
          <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
          <span class="text-xs text-slate-400 uppercase tracking-wider">or enter manually</span>
          <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
        </div>
      ` : ''}

      <div class="mb-4">
        <div class="flex items-center gap-3 mb-3">
          <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
          <span class="text-xs text-slate-400 uppercase tracking-wider">demo users</span>
          <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
        </div>
        <div class="space-y-2 max-h-44 overflow-y-auto pr-1">
          ${DEMO_ADDRESSES.map((demo, index) => `
            <button class="modal-demo-btn w-full text-left p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-brand-400 dark:hover:border-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors" data-demo-index="${index}">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-slate-800 dark:text-slate-200">${demo.label}</div>
                  <div class="addr-chip text-xs text-slate-400 mt-1 break-all">${truncateAddress(demo.govId || demo.address, 14, 8)}</div>
                </div>
                <span class="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${demo.type === 'cc' ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' : demo.type === 'drep' ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">
                  ${demo.type === 'none' ? 'Demo' : demo.type.toUpperCase()}
                </span>
              </div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="flex items-center gap-3 mb-4">
        <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
        <span class="text-xs text-slate-400 uppercase tracking-wider">or enter manually</span>
        <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
      </div>

      <label class="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">DRep ID, CC hot credential, or stake address</label>
      <div class="flex gap-2 mb-3">
        <input id="modal-addr-input" type="text" placeholder="drep1… / cc_hot1… / stake1…"
          class="flex-1 addr-chip bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
        />
        <button id="modal-connect-btn" class="bg-brand-600 hover:bg-brand-700 text-white font-medium px-4 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap">
          Connect
        </button>
      </div>

      <p class="text-xs text-slate-400">
        In this prototype, no signing is required. In the final product, wallet connection verifies ownership of the DRep certificate.
      </p>
    </div>
  `;

  document.body.appendChild(modal);
  lucide.createIcons({ nodes: [modal] });

  modal.querySelector('#wallet-modal-bg').addEventListener('click', closeWalletModal);
  modal.querySelector('#wallet-modal-close').addEventListener('click', closeWalletModal);
  modal.querySelector('#modal-connect-btn').addEventListener('click', connectFromModal);
  modal.querySelector('#modal-addr-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') connectFromModal();
  });
  modal.querySelectorAll('.modal-wallet-btn').forEach(btn => {
    btn.addEventListener('click', () => connectWalletFromModal(btn.dataset.wallet));
  });
  modal.querySelectorAll('.modal-demo-btn').forEach(btn => {
    btn.addEventListener('click', () => connectDemoFromModal(Number(btn.dataset.demoIndex)));
  });

  setTimeout(() => modal.querySelector('#modal-addr-input')?.focus(), 80);
}

function closeWalletModal() {
  document.getElementById('wallet-modal')?.remove();
}

function connectFromModal() {
  const raw = document.getElementById('modal-addr-input')?.value.trim();
  if (!raw) { showToast('Please enter an address or ID', 'warning'); return; }

  const stakeAddress = resolveToStakeAddress(raw);
  const record       = state.eligibility[stakeAddress] || null;
  const govId        = (raw.startsWith('drep1') || raw.startsWith('cc_hot1'))
    ? raw
    : (record?.drep_id || record?.cc_credential || null);

  setWallet({
    stakeAddress,
    govId:      govId || stakeAddress,
    type:       record?.type || 'unknown',
    walletName: null,
  });

  closeWalletModal();
  showToast(`Connected as ${truncateForNav(govId || stakeAddress)}`, 'success');
  window.location.hash = '#profile';
}

function connectDemoFromModal(index) {
  const demo = DEMO_ADDRESSES[index];
  if (!demo) {
    showToast('Could not find that demo profile', 'error');
    return;
  }

  const stakeAddress = demo.address;
  const record = state.eligibility[stakeAddress] || null;

  setWallet({
    stakeAddress,
    govId: demo.govId || record?.drep_id || record?.cc_credential || stakeAddress,
    type: record?.type || demo.type || 'unknown',
    walletName: 'demo',
  });

  closeWalletModal();
  showToast(`Connected demo user: ${truncateForNav(demo.govId || stakeAddress)}`, 'success');
  window.location.hash = '#profile';
}

async function connectWalletFromModal(walletId) {
  const btn = document.querySelector(`[data-wallet="${walletId}"]`);
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="text-xl">⏳</span><span class="text-sm">Connecting…</span>`; }

  try {
    const api          = await window.cardano[walletId].enable();
    const hexAddresses = await api.getRewardAddresses();
    if (!hexAddresses?.length) throw new Error('No stake key found');

    const stakeAddress = hexToStakeAddress(hexAddresses[0]) || hexAddresses[0];
    const record       = state.eligibility[stakeAddress] || null;
    const govId        = record?.drep_id || record?.cc_credential || null;
    const w            = WALLET_DEFS.find(x => x.id === walletId);

    setWallet({ stakeAddress, govId: govId || stakeAddress, type: record?.type || 'unknown', walletName: walletId });
    closeWalletModal();
    showToast(`Connected via ${w?.label || walletId}`, 'success');
    window.location.hash = '#profile';
  } catch (err) {
    showToast(`Could not connect: ${err.message || 'user rejected'}`, 'error');
    if (btn) {
      btn.disabled = false;
      const w = WALLET_DEFS.find(x => x.id === walletId);
      btn.innerHTML = `<span class="text-xl">${w?.icon || '💳'}</span><span class="text-sm font-medium">${w?.label || walletId}</span>`;
    }
  }
}

// ─── Dark mode ────────────────────────────────────────────────────────────────
function toggleDark() {
  state.dark = !state.dark;
  document.documentElement.classList.toggle('dark', state.dark);
  localStorage.setItem('dark', state.dark);
  route();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const colors = {
    info:    'bg-slate-800 text-white dark:bg-slate-700',
    success: 'bg-emerald-600 text-white',
    error:   'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
  };
  const icons = { info: 'info', success: 'check-circle', error: 'x-circle', warning: 'alert-triangle' };

  const el = document.createElement('div');
  el.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium toast-enter ${colors[type] || colors.info}`;
  el.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 flex-shrink-0"></i><span>${message}</span>`;
  container.appendChild(el);
  lucide.createIcons({ nodes: [el] });

  setTimeout(() => {
    el.classList.remove('toast-enter');
    el.classList.add('toast-exit');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

window.showToast       = showToast;
window.showWalletModal = showWalletModal;

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  state.dark = localStorage.getItem('dark') === 'true';
  document.documentElement.classList.toggle('dark', state.dark);

  try {
    const savedWallet = localStorage.getItem(SAVED_WALLET_KEY);
    if (savedWallet) state.wallet = JSON.parse(savedWallet);
  } catch {
    localStorage.removeItem(SAVED_WALLET_KEY);
  }

  await loadData();

  window.addEventListener('hashchange', route);
  route();
});
