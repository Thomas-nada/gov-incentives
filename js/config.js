// Reward pool split
export const DREP_POOL_PCT      = 94;   // % of total pool going to DReps
export const CC_POOL_PCT        = 6;    // % of total pool going to CC members
export const MAX_ELIGIBLE_DREPS = 200;  // cap on eligible DReps (top N by voting power)

// Pool = sum of actual staking yields across the 3 open epochs × split %
// Current window (521–523): 26,720 + 30,557 + 26,869 = 84,146 ₳ total
export const TOTAL_POOL_ADA     = 84_146;
export const DREP_POOL_ADA      = 79_097;  // 84,146 × 94%
export const CC_POOL_ADA        = 5_049;   // 84,146 × 6%

// Per-participant shares — DRep always divided by cap (200), not actual eligible count
export const DREP_SHARE_ADA     = 395;
export const CC_SHARE_ADA       = 721;

export const CLAIM_WINDOW_EPOCHS = 3;
export const PRINCIPAL_ADA      = 75_000_000;
export const CURRENT_EPOCH      = 524;
export const OPEN_EPOCH         = 523;   // latest epoch of claim window
export const OPEN_EPOCHS        = [521, 522, 523]; // all epochs with claim_open: true
export const RESERVE_BALANCE_ADA = 68_402; // accumulated surplus

export const DEMO_ADDRESSES = [
  {
    label: 'DRep — rank #7 · voted all 11 actions · eligible · 395 ₳',
    address: 'stake1ux7fe7j9hpuflnnjgmflzf66e83htkfqjulyyg9u9mvs0rcg5qvgp',
    govId:   'drep1yx7fe7j9hpuflnnjgmflzf66e83htkfqjulyg9u9mvs0rcg5abcd',
    type: 'drep'
  },
  {
    label: 'DRep — rank #45 · voted all 11 actions · eligible · 395 ₳',
    address: 'stake1u8fnjkm3pq9xa7wv4l5e6d0strgyc4hz3wp8qv4xd9r5jk2n3p6qs',
    govId:   'drep1y8fnjkm3pq9xa7wv4l5e6d0strgyc4hz3wp8qv4xd9r5jk2nabcd',
    type: 'drep'
  },
  {
    label: 'DRep — rank #112 · voted all 11 actions · eligible · 395 ₳',
    address: 'stake1uxk3n5d8r7gm2pq9wl4v6zjfahcts5e3y8md4xl7pnqr2w9fk5j8p',
    govId:   'drep1yxk3n5d8r7gm2pq9wl4v6zjfahcts5e3y8md4xl7pnqr2w9fabcd',
    type: 'drep'
  },
  {
    label: 'DRep — rank #201 · voted all 11 actions · ineligible (outside top 200)',
    address: 'stake1u4wml9nq7rhx5p3kd8g2a6vj4etsycf3mz7xu5nd8lk4r9p2q6w5t',
    govId:   'drep1y4wml9nq7rhx5p3kd8g2a6vj4etsycf3mz7xu5nd8lk4r9p2abcd',
    type: 'drep'
  },
  {
    label: 'DRep — voted 7 of 11 actions · ineligible (incomplete participation)',
    address: 'stake1uzg9kl5nm4qrwx7p3dv2a0scyft6e3jh5xu9md7k4r8p2n6qw5j3e',
    govId:   'drep1yzg9kl5nm4qrwx7p3dv2a0scyft6e3jh5xu9md7k4r8p2n6abcd',
    type: 'drep'
  },
  {
    label: 'CC Member — voted all 11 actions · eligible · 721 ₳',
    address: 'stake1uydlj8mhqxjr84mgsgzwf5ljhsyvcrfynaz5zqv4wn4kqxcjtlfcq',
    govId:   'cc_hot1q8xntrwl2pnkvr4kxvmqp7ynl35h7fjnap8qx4j7ldyv8c2k01',
    type: 'cc'
  },
  {
    label: 'CC Member — voted 9 of 11 actions · ineligible (incomplete participation)',
    address: 'stake1u9r3kfg4mn5pq8wl7x2d0vjycts6e4zh3wp9qv5xd8r4jk3n2p7qm',
    govId:   'cc_hot1q9r3kfg4mn5pq8wl7x2d0vjycts6e4zh3wp9qv5xd8r4jk3abcd',
    type: 'cc'
  },
  {
    label: 'Not in governance — address not found in snapshot',
    address: 'stake1u95yvz9v9mnlwvujnxt5lyjn9gy3ey6phf6fvkrfxd6gvyqr8x8cv',
    govId:   null,
    type: 'none'
  }
];
