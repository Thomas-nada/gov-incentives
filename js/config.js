// Static programme configuration.
//
// Everything that varies per snapshot — pool sizes, share amounts, epoch
// numbers, deadlines — is read at runtime from data/snapshot.json. Only values
// that are properties of the app itself live here.

export const APP_NAME = 'Cardano Governance Rewards';
export const APP_SHORT_NAME = 'Gov Rewards';
export const SUPPORT_EMAIL = 'support@govrewards.example';

/** Wallets the connect dialog will offer if the extension exposes a CIP-30 API. */
export const WALLET_DEFS = [
  { id: 'lace',    label: 'Lace',    accent: '#0F1114' },
  { id: 'eternl',  label: 'Eternl',  accent: '#2A6ADE' },
  { id: 'vespr',   label: 'Vespr',   accent: '#7C3AED' },
  { id: 'typhoncip30', label: 'Typhon', accent: '#0EA5E9' },
  { id: 'begin',   label: 'Begin',   accent: '#F59E0B' },
  { id: 'yoroi',   label: 'Yoroi',   accent: '#3154CF' },
];

/** Storage keys. Versioned so a schema change does not resurrect stale state. */
export const STORAGE = {
  wallet: 'govrewards.wallet.v2',
  claims: 'govrewards.claims.v2',
  theme:  'govrewards.theme.v1',
  banner: 'govrewards.banner-dismissed.v1',
  addressBook: 'govrewards.payout-address.v1',
  simulation: 'govrewards.treasury-sim.v1',
};

/** Human labels and palette for each CIP-1694 governance action type. */
export const ACTION_TYPES = {
  TreasuryWithdrawal: { label: 'Treasury Withdrawal', short: 'Treasury', tone: 'amber' },
  ParameterChange:    { label: 'Protocol Parameter Change', short: 'Parameter', tone: 'blue' },
  Info:               { label: 'Info Action', short: 'Info', tone: 'slate' },
  HardForkInitiation: { label: 'Hard Fork Initiation', short: 'Hard Fork', tone: 'red' },
  UpdateConstitution: { label: 'Update to the Constitution', short: 'Constitution', tone: 'violet' },
  NewConstitution:    { label: 'Update to the Constitution', short: 'Constitution', tone: 'violet' },
  NoConfidence:       { label: 'Motion of No-Confidence', short: 'No-Confidence', tone: 'rose' },
  NewCommittee:       { label: 'New Constitutional Committee', short: 'Committee', tone: 'orange' },
};

export const TONE_CLASSES = {
  amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  blue:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  slate:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  red:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  violet:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  rose:    'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  orange:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

/**
 * Test identities. A real portal reaches these through a wallet; the demo
 * environment exposes them directly so every eligibility path is reachable.
 */
export const DEMO_ACCOUNTS = [
  {
    name: 'Ledger Commons',
    role: 'drep',
    summary: 'Large DRep · voted 11 of 11 · eligible',
    outcome: 'eligible',
    address: 'stake1ux7fe7j9hpuflnnjgmflzf66e83htkfqjulyyg9u9mvs0rcg5qvgp',
    govId: 'drep1yx7fe7j9hpuflnnjgmflzf66e83htkfqjulyg9u9mvs0rcg5qhx7n2vm4e',
  },
  {
    name: 'Stake & Signal',
    role: 'drep',
    summary: 'Mid-table DRep · voted 11 of 11 · eligible',
    outcome: 'eligible',
    address: 'stake1u8fnjkm3pq9xa7wv4l5e6d0strgyc4hz3wp8qv4xd9r5jk2n3p6qs',
    govId: 'drep1y8fnjkm3pq9xa7wv4l5e6d0strgyc4hz3wp8qv4xd9r5jk2nq7wl0ekxp',
  },
  {
    name: 'Ouroboros Guild',
    role: 'drep',
    summary: 'Just inside the cut-off · voted 11 of 11',
    outcome: 'eligible',
    address: 'stake1uxk3n5d8r7gm2pq9wl4v6zjfahcts5e3y8md4xl7pnqr2w9fk5j8p',
    govId: 'drep1yxk3n5d8r7gm2pq9wl4v6zjfahcts5e3y8md4xl7pnqr2w9fqm2v8dlrz',
  },
  {
    name: 'Nightfall Delegate',
    role: 'drep',
    summary: 'Voted 11 of 11 but below the cut-off',
    outcome: 'ineligible',
    address: 'stake1u4wml9nq7rhx5p3kd8g2a6vj4etsycf3mz7xu5nd8lk4r9p2q6w5t',
    govId: 'drep1y4wml9nq7rhx5p3kd8g2a6vj4etsycf3mz7xu5nd8lk4r9p2qs6dgx4vh',
  },
  {
    name: 'Quorum Watch',
    role: 'drep',
    summary: 'Missed 4 governance actions',
    outcome: 'ineligible',
    address: 'stake1uzg9kl5nm4qrwx7p3dv2a0scyft6e3jh5xu9md7k4r8p2n6qw5j3e',
    govId: 'drep1yzg9kl5nm4qrwx7p3dv2a0scyft6e3jh5xu9md7k4r8p2n6q0f8vzmrt',
  },
  {
    name: 'Northern Ledger Council',
    role: 'cc',
    summary: 'Committee member · voted 11 of 11 · eligible',
    outcome: 'eligible',
    address: 'stake1uydlj8mhqxjr84mgsgzwf5ljhsyvcrfynaz5zqv4wn4kqxcjtlfcq',
    govId: 'cc_hot1q8xntrwl2pnkvr4kxvmqp7ynl35h7fjnap8qx4j7ldyv8c2kq9m04t',
  },
  {
    name: 'Cardano Civic Trust',
    role: 'cc',
    summary: 'Committee member · missed 2 actions',
    outcome: 'ineligible',
    address: 'stake1u9r3kfg4mn5pq8wl7x2d0vjycts6e4zh3wp9qv5xd8r4jk3n2p7qm',
    govId: 'cc_hot1q9r3kfg4mn5pq8wl7x2d0vjycts6e4zh3wp9qv5xd8r4jk3q7v2ynz',
  },
  {
    name: 'Unregistered stake key',
    role: 'none',
    summary: 'Not present in the snapshot',
    outcome: 'not-found',
    address: 'stake1u95yvz9v9mnlwvujnxt5lyjn9gy3ey6phf6fvkrfxd6gvyqr8x8cv',
    govId: null,
  },
];
