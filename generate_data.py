#!/usr/bin/env python3
"""Generate realistic mock data for the Governance Rewards Engine."""
import json, random, math, os

rng  = random.Random(42)
rng2 = random.Random(99)   # for epoch rewards
rng3 = random.Random(7)    # for window stats
rng4 = random.Random(123)  # for actor stake addresses
rng5 = random.Random(314159)  # for per-action vote records

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')

N_DREPS   = 932
N_CC      = 7
MIN_VP    = 2_387
MAX_VP    = 654_875_986
EP_START  = 451
EP_END    = 523
OPEN_EPS  = [521, 522, 523]
N_ACTIONS   = 11
POOL        = 90_000
DREP_PCT    = 94
CC_PCT      = 6
MAX_ELIG    = 200
WINDOW_BASE = 449  # window boundaries: 449,452,...,521,524,... (521-523 = window 24)

DEMO_D_STAKE = 'stake1ux7fe7j9hpuflnnjgmflzf66e83htkfqjulyyg9u9mvs0rcg5qvgp'
DEMO_D_ID    = 'drep1yx7fe7j9hpuflnnjgmflzf66e83htkfqjulyg9u9mvs0rcg5abcd'
DEMO_D_VP    = 8_240_000

# DRep — mid-rank, eligible (rank ~150)
DEMO_D2_STAKE = 'stake1u8fnjkm3pq9xa7wv4l5e6d0strgyc4hz3wp8qv4xd9r5jk2n3p6qs'
DEMO_D2_ID    = 'drep1y8fnjkm3pq9xa7wv4l5e6d0strgyc4hz3wp8qv4xd9r5jk2nabcd'
DEMO_D2_VP    = 380_000   # mid-rank eligible

# DRep — near cutoff, eligible (target rank ~180–195)
DEMO_D3_STAKE = 'stake1uxk3n5d8r7gm2pq9wl4v6zjfahcts5e3y8md4xl7pnqr2w9fk5j8p'
DEMO_D3_ID    = 'drep1yxk3n5d8r7gm2pq9wl4v6zjfahcts5e3y8md4xl7pnqr2w9fabcd'
DEMO_D3_VP    = 32_000    # low enough to land near the 200 boundary

# DRep — voted all actions but just outside top 200 (ineligible by rank)
DEMO_D4_STAKE = 'stake1u4wml9nq7rhx5p3kd8g2a6vj4etsycf3mz7xu5nd8lk4r9p2q6w5t'
DEMO_D4_ID    = 'drep1y4wml9nq7rhx5p3kd8g2a6vj4etsycf3mz7xu5nd8lk4r9p2abcd'
DEMO_D4_VP    = 2_450     # below the rank-200 threshold, landing just outside top 200

# DRep — missed 4 governance actions (ineligible by participation)
DEMO_D5_STAKE = 'stake1uzg9kl5nm4qrwx7p3dv2a0scyft6e3jh5xu9md7k4r8p2n6qw5j3e'
DEMO_D5_ID    = 'drep1yzg9kl5nm4qrwx7p3dv2a0scyft6e3jh5xu9md7k4r8p2n6abcd'

# CC member — missed 2 governance actions (ineligible)
DEMO_C_STAKE = 'stake1uydlj8mhqxjr84mgsgzwf5ljhsyvcrfynaz5zqv4wn4kqxcjtlfcq'
DEMO_C_CRED  = 'cc_hot1q8xntrwl2pnkvr4kxvmqp7ynl35h7fjnap8qx4j7ldyv8c2k01'
DEMO_C2_STAKE = 'stake1u9r3kfg4mn5pq8wl7x2d0vjycts6e4zh3wp9qv5xd8r4jk3n2p7qm'
DEMO_C2_CRED  = 'cc_hot1q9r3kfg4mn5pq8wl7x2d0vjycts6e4zh3wp9qv5xd8r4jk3abcd'

BC = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
HX = '0123456789abcdef'
def rb(n): return ''.join(rng.choices(BC, k=n))
def rh(n): return ''.join(rng.choices(HX, k=n))
def rb2(n): return ''.join(rng2.choices(BC, k=n))
def rh2(n): return ''.join(rng2.choices(HX, k=n))
def rb4(n): return ''.join(rng4.choices(BC, k=n))

# ── Voting powers ─────────────────────────────────────────────────────────────
lmin, lmax = math.log(MIN_VP), math.log(MAX_VP)

vps = []
for i in range(N_DREPS):
    t  = i / (N_DREPS - 1)
    lp = lmax - (lmax - lmin) * (t ** 0.28) + rng.gauss(0, 0.22)
    vps.append(int(math.exp(max(lmin, min(lmax, lp)))))
vps.sort(reverse=True)
vps[0]  = MAX_VP
vps[-1] = MIN_VP

# ── DRep IDs ──────────────────────────────────────────────────────────────────
drep_ids = [f'drep1y{rb(38)}' for _ in range(N_DREPS)]
demo_pos = next(i for i, v in enumerate(vps) if v <= DEMO_D_VP)
drep_ids[demo_pos] = DEMO_D_ID
vps[demo_pos]      = DEMO_D_VP
drep_stakes = [f'stake1u{rb4(50)}' for _ in range(N_DREPS)]
drep_stakes[demo_pos] = DEMO_D_STAKE

# Inject additional demo DReps at their VP-based positions
demo2_pos = next(i for i, v in enumerate(vps) if v <= DEMO_D2_VP)
drep_ids[demo2_pos] = DEMO_D2_ID; vps[demo2_pos] = DEMO_D2_VP; drep_stakes[demo2_pos] = DEMO_D2_STAKE

demo3_pos = next(i for i, v in enumerate(vps) if v <= DEMO_D3_VP)
drep_ids[demo3_pos] = DEMO_D3_ID; vps[demo3_pos] = DEMO_D3_VP; drep_stakes[demo3_pos] = DEMO_D3_STAKE

demo4_pos = next(i for i, v in enumerate(vps) if v <= DEMO_D4_VP)
drep_ids[demo4_pos] = DEMO_D4_ID; vps[demo4_pos] = DEMO_D4_VP; drep_stakes[demo4_pos] = DEMO_D4_STAKE

demo5_pos = next(i for i, v in enumerate(vps) if v <= 50_000)
drep_ids[demo5_pos] = DEMO_D5_ID; drep_stakes[demo5_pos] = DEMO_D5_STAKE

# ── Voted actions in current window ──────────────────────────────────────────
def nvoted(vp):
    vpn = (math.log(vp) - lmin) / (lmax - lmin)
    p   = 0.12 + 0.50 * vpn          # larger DReps vote more
    r   = rng.random()
    if r < p: return 11
    r2 = rng.random()
    if r2 < 0.28: return rng.randint(9, 10)
    if r2 < 0.60: return rng.randint(5, 8)
    if r2 < 0.86: return rng.randint(2, 4)
    return rng.randint(0, 1)

DEMO_VOTED_ALL  = {DEMO_D_ID, DEMO_D2_ID, DEMO_D3_ID, DEMO_D4_ID}
DEMO_VOTED_SOME = {DEMO_D5_ID: 7}
voted = [
    11 if drep_ids[i] in DEMO_VOTED_ALL
    else DEMO_VOTED_SOME.get(drep_ids[i], nvoted(vps[i]))
    for i in range(N_DREPS)
]

# ── CC members ────────────────────────────────────────────────────────────────
cc_creds  = [DEMO_C_CRED, DEMO_C2_CRED] + [f'cc_hot1q{rb(46)}' for _ in range(N_CC - 2)]
cc_stakes = [DEMO_C_STAKE, DEMO_C2_STAKE] + [f'stake1u{rb4(50)}' for _ in range(N_CC - 2)]
# slot 0: eligible (all 11), slot 1: ineligible (missed 2), slots 2-5: eligible, slot 6: sporadic
cc_voted = [11, 9, 11, 11, 11, 11, 8]

# ── governance_actions.json ───────────────────────────────────────────────────
EXISTING_WINDOW = {
    523: [
        {'id':'GA-2026-087','title':'Treasury Withdrawal — Governance Tooling Fund','type':'TreasuryWithdrawal'},
        {'id':'GA-2026-088','title':'Parameter Change — Stake Pool Min Fee Adjustment','type':'ParameterChange'},
        {'id':'GA-2026-089','title':'Info — Community Ratification Signal','type':'Info'},
        {'id':'GA-2026-090','title':'Hard Fork Initiation — Chang+1 Upgrade','type':'HardForkInitiation'},
    ],
    522: [
        {'id':'GA-2026-084','title':'Treasury Withdrawal — DRep Registration Campaign','type':'TreasuryWithdrawal'},
        {'id':'GA-2026-085','title':'Info — Constitutional Committee Term Renewal','type':'Info'},
        {'id':'GA-2026-086','title':'Parameter Change — DRep Activity Window Update','type':'ParameterChange'},
    ],
    521: [
        {'id':'GA-2026-080','title':'Treasury Withdrawal — Catalyst Fund 13 Allocation','type':'TreasuryWithdrawal'},
        {'id':'GA-2026-081','title':'Parameter Change — Pool Pledge Influence Factor','type':'ParameterChange'},
        {'id':'GA-2026-082','title':'Info — Ouroboros Leios Readiness Survey','type':'Info'},
        {'id':'GA-2026-083','title':'Update to the Constitution — Interim Constitution Ratification','type':'UpdateConstitution'},
    ],
}

ATYPES = ['TreasuryWithdrawal','ParameterChange','Info','HardForkInitiation','UpdateConstitution','NoConfidence','NewCommittee']
ATYPE_W = [20, 28, 24, 5, 6, 2, 5]
SHORT = {
    'TreasuryWithdrawal':  'Treasury Withdrawal',
    'ParameterChange':     'Protocol Parameter Change',
    'Info':                'Info',
    'HardForkInitiation':  'Hard Fork Initiation',
    'UpdateConstitution':  'Update to the Constitution',
    'NoConfidence':        'Motion of No-Confidence',
    'NewCommittee':        'New Constitutional Committee',
}
TITLES = {
    'TreasuryWithdrawal': [
        'Governance Tooling Fund','Catalyst Fund 14 Allocation','DRep Campaign Fund',
        'IOG Infrastructure Grant','Open Source Developer Fund','Community Education Initiative',
        'Cardano Foundation Budget','an independent entity MBO Operations','Security Audit Fund',
        'Layer 2 Research Grant','Documentation Working Group','Developer Bootcamp Fund',
        'DeFi Ecosystem Grant','NFT Standards Fund','Stablecoin Research Initiative',
        'Plutus Migration Support','Identity Infrastructure Fund','Governance Bootstrap',
        'Partner Chain Integration','Hydra Development Grant','Mithril Node Subsidy',
        'Atala PRISM Integration','Lace Wallet Maintenance','Community Hub Grants',
    ],
    'ParameterChange': [
        'Stake Pool Min Fee Revision','DRep Activity Window','Block Size Increase',
        'Transaction Fee Policy','Pool Pledge Factor','Min ADA in UTxO',
        'Script Execution Units','Collateral Percentage','Max Transaction Size',
        'Committee Term Length','DRep Deposit Amount','Pool Deposit Amount',
        'Minfee A Parameter','Minfee B Parameter','Treasury Growth Rate',
        'K Parameter Adjustment','D Parameter Update','Plutus V3 Cost Model',
        'Timelock Policy Update','Reference Script Fee','Max Epoch Rollback Depth',
        'Max Block Header Size','Tx Metadata Max Size',
    ],
    'Info': [
        'Community Ratification Signal','DRep Code of Conduct Endorsement',
        'Cardano Vision Statement','Governance Roadmap Acknowledgement',
        'CC Term Renewal Signal','Leios Readiness Survey',
        'CC Charter Endorsement','DRep Working Group Formation',
        'Hard Fork Readiness Poll','Node Upgrade Signal',
        'an independent entity Membership Drive','Community Budget Signal',
        'Cardano Sustainability Signal','Developer Relations Survey',
        'Midnight Integration Readiness','CF Strategy Endorsement',
        'Governance Calendar Endorsement','Annual Report Acknowledgement',
        'Technical Steering Committee Formation',
    ],
    'HardForkInitiation': [
        'Chang Hard Fork','Chang+1 Upgrade','Chang+2 Upgrade',
        'Valentine Hard Fork','Voltaire Phase 2','Node 10.0 Migration',
        'Ouroboros Leios Preview',
    ],
    'UpdateConstitution': [
        'Interim Constitution v1','Amended Constitution v1.1',
        'Constitutional Amendment — Governance Rights','Technical Constitution Addendum',
        'Interim Constitution Ratification','Proposal Policy Update',
        'Constitution Hash Update — Ratification','Voltaire Constitution v2',
    ],
    'NoConfidence': [
        'Motion of No-Confidence — Current CC','No-Confidence Vote — CC Term Expiry',
        'No-Confidence — Quorum Failure',
    ],
    'NewCommittee': [
        'CC Membership Update — New Term','Committee Threshold Change',
        'CC Term Extension — Transitional Period','New CC Election — Post No-Confidence',
        'CC Composition Refresh','Committee Size Adjustment',
    ],
}
tpools = {k: list(v) for k, v in TITLES.items()}

def pick(atype):
    if not tpools.get(atype):
        tpools[atype] = list(TITLES.get(atype, ['General Action']))
    pool = tpools[atype]
    t = pool.pop(rng2.randrange(len(pool)))
    return f'{SHORT[atype]} — {t}'

ACW = [3, 8, 18, 28, 24, 12, 6, 1]

def ep_year(ep):
    if ep < 481: return 2024
    if ep < 511: return 2025
    return 2026

# assign sequential action IDs
seq = {2024: 0, 2025: 0, 2026: 0}
# pre-scan existing to find highest used numbers
for ep, acts in EXISTING_WINDOW.items():
    for a in acts:
        yr = ep_year(ep)
        n  = int(a['id'].split('-')[2])
        seq[yr] = max(seq[yr], n)

gov_actions = {}
for ep in range(EP_START, EP_END + 1):
    if ep in EXISTING_WINDOW:
        gov_actions[str(ep)] = EXISTING_WINDOW[ep]
    else:
        yr = ep_year(ep)
        n  = rng2.choices(range(8), weights=ACW)[0]
        acts = []
        for _ in range(n):
            seq[yr] += 1
            atype = rng2.choices(ATYPES, weights=ATYPE_W)[0]
            acts.append({'id': f'GA-{yr}-{seq[yr]:03d}', 'title': pick(atype), 'type': atype})
        gov_actions[str(ep)] = acts

with open(f'{DATA}/governance_actions.json', 'w') as f:
    json.dump(gov_actions, f, indent=2)
print("Written: governance_actions.json")

# ── epoch reward generation ───────────────────────────────────────────────────
def ep_rewards():
    while True:
        v = int(rng3.gauss(28_000, 5_000))
        if 20_000 <= v <= 42_000:
            return v

open_epoch_rewards = [ep_rewards() for _ in OPEN_EPS]
current_pool = sum(open_epoch_rewards)  # actual yield from the 3 open epochs

# ── votes.json + current-window derived eligibility ──────────────────────────
window_actions = [
    {**action, 'epoch': ep}
    for ep in OPEN_EPS
    for action in gov_actions.get(str(ep), [])
]
window_action_ids = [action['id'] for action in window_actions]
window_action_count = len(window_actions)
if window_action_count != N_ACTIONS:
    raise ValueError(f'Expected {N_ACTIONS} actions in current window, got {window_action_count}')
window_action_map = {action['id']: action for action in window_actions}

VOTE_CHOICES = ['Yes', 'No', 'Abstain']
VOTE_WEIGHTS = [52, 23, 25]

def build_actor_votes(action_ids, vote_total):
    if vote_total <= 0:
        return []
    if vote_total >= len(action_ids):
        chosen = list(action_ids)
    else:
        chosen = sorted(rng5.sample(action_ids, vote_total))
    return [(action_id, rng5.choices(VOTE_CHOICES, weights=VOTE_WEIGHTS)[0]) for action_id in chosen]

vote_records = []
drep_vote_counts = [0] * N_DREPS
for i in range(N_DREPS):
    actor_votes = build_actor_votes(window_action_ids, voted[i])
    drep_vote_counts[i] = len(actor_votes)
    for action_id, choice in actor_votes:
        action = window_action_map[action_id]
        vote_records.append({
            'actor_type': 'drep',
            'stake_address': drep_stakes[i],
            'actor_id': drep_ids[i],
            'epoch': action['epoch'],
            'action_id': action_id,
            'vote': choice,
        })

cc_vote_counts = [0] * N_CC
for i in range(N_CC):
    actor_votes = build_actor_votes(window_action_ids, cc_voted[i])
    cc_vote_counts[i] = len(actor_votes)
    for action_id, choice in actor_votes:
        action = window_action_map[action_id]
        vote_records.append({
            'actor_type': 'cc',
            'stake_address': cc_stakes[i],
            'actor_id': cc_creds[i],
            'epoch': action['epoch'],
            'action_id': action_id,
            'vote': choice,
        })

vote_records.sort(key=lambda v: (v['epoch'], v['action_id'], v['actor_type'], v['actor_id']))

top_voters = sorted(
    [(i, vps[i]) for i in range(N_DREPS) if drep_vote_counts[i] == window_action_count],
    key=lambda x: x[1], reverse=True)
elig_set = {idx for idx, _ in top_voters[:MAX_ELIG]}
n_ed = len(elig_set)

def find_rank(did):
    return next((r + 1 for r, (idx, _) in enumerate(top_voters[:MAX_ELIG]) if drep_ids[idx] == did), None)

demo_er  = find_rank(DEMO_D_ID)
demo2_er = find_rank(DEMO_D2_ID)
demo3_er = find_rank(DEMO_D3_ID)
# demo4 voted all but low VP — find its position in the full top_voters list (may exceed MAX_ELIG)
demo4_full_rank = next((r + 1 for r, (idx, _) in enumerate(top_voters) if drep_ids[idx] == DEMO_D4_ID), None)

drep_pool = round(current_pool * DREP_PCT / 100)
cc_pool   = current_pool - drep_pool
# DRep share is always pool / MAX cap (200), regardless of actual eligible count.
# If fewer than 200 qualify, the unallocated slots go to reserve.
# Tie-breaking: if exactly MAX_ELIG+k tie at the boundary, divide by MAX_ELIG+k.
boundary_vp = top_voters[MAX_ELIG - 1][1] if len(top_voters) >= MAX_ELIG else None
ties = sum(1 for _, vp in top_voters[MAX_ELIG:] if vp == boundary_vp) if boundary_vp else 0
drep_divisor = MAX_ELIG + ties
drep_sh   = drep_pool // drep_divisor if drep_divisor else 0
cc_elig   = [count == window_action_count for count in cc_vote_counts]
n_ec      = sum(cc_elig)
# CC share is always pool / N_CC cap (7), regardless of actual eligible count.
# Unclaimed CC slots go to reserve, same as DReps.
cc_sh     = cc_pool // N_CC

print(f"DReps who voted on all {window_action_count}: {len(top_voters)}")
print(f"Eligible DReps (top {MAX_ELIG}):    {n_ed}")
print(f"Demo DRep eligible rank:            {demo_er}")
print(f"DRep pool: {drep_pool} | Per-DRep:  {drep_sh}")
print(f"CC pool:   {cc_pool}  | Per-CC:     {cc_sh}")

votes = {
    '_note': 'Complete vote ledger for the current rewards snapshot.',
    'window_521_523': {
        'epochs': OPEN_EPS,
        'total_actions': window_action_count,
        'total_pool_ada': current_pool,
        'total_vote_records': len(vote_records),
        'votes': vote_records,
    }
}
with open(f'{DATA}/votes.json', 'w') as f:
    json.dump(votes, f, indent=2)
print("Written: votes.json")

# ── rankings.json ─────────────────────────────────────────────────────────────
dreps_arr = [{
    'rank':          i + 1,
    'drep_id':       drep_ids[i],
    'stake_address': drep_stakes[i],
    'voting_power':  vps[i],
    'voted_actions': drep_vote_counts[i],
    'eligible':      i in elig_set,
    'share_ada':     drep_sh if i in elig_set else 0,
} for i in range(N_DREPS)]

cc_arr = [{
    'credential':    cred,
    'stake_address': stake,
    'voted_actions': count,
    'eligible':      el,
    'share_ada':     cc_sh if el else 0,
} for cred, stake, count, el in zip(cc_creds, cc_stakes, cc_vote_counts, cc_elig)]

rankings = {
    '_note': 'Pool-based equal-share rewards derived from the current vote ledger. Claim window 521-523.',
    'window_521_523': {
        'epochs': OPEN_EPS,
        'total_actions': window_action_count,
        'total_pool_ada': current_pool,
        'drep_pool_ada': drep_pool,
        'cc_pool_ada': cc_pool,
        'eligible_drep_count': n_ed,
        'eligible_cc_count': n_ec,
        'drep_share_ada': drep_sh,
        'cc_share_ada': cc_sh,
        'cc': cc_arr,
        'dreps': dreps_arr,
    }
}
with open(f'{DATA}/rankings.json', 'w') as f:
    json.dump(rankings, f, indent=2)
print("Written: rankings.json")

# ── eligibility.json ──────────────────────────────────────────────────────────
eligibility = {
    '_note': 'Keyed by stake address. eligible=true = voted on ALL actions in the current vote ledger for window 521-523.',
    '_window': {
        'epochs': OPEN_EPS, 'total_actions': window_action_count,
        'total_pool_ada': current_pool, 'drep_pool_ada': drep_pool, 'cc_pool_ada': cc_pool,
        'eligible_dreps': n_ed, 'eligible_cc': n_ec,
        'drep_share_ada': drep_sh, 'cc_share_ada': cc_sh,
    },
    DEMO_D_STAKE: {
        'type': 'drep', 'eligible': True, 'voted_all': True,
        'voted_actions': drep_vote_counts[demo_pos], 'total_actions': window_action_count,
        'voting_power': DEMO_D_VP, 'drep_id': DEMO_D_ID,
        'rank': demo_er, 'amount': drep_sh, 'claimed': False,
    },
    DEMO_C_STAKE: {
        'type': 'cc', 'eligible': True, 'voted_all': True,
        'voted_actions': cc_vote_counts[0], 'total_actions': window_action_count,
        'cc_credential': DEMO_C_CRED, 'amount': cc_sh, 'claimed': False,
    },
    # DRep — mid rank, eligible
    DEMO_D2_STAKE: {
        'type': 'drep', 'eligible': True, 'voted_all': True,
        'voted_actions': 11, 'total_actions': window_action_count,
        'voting_power': DEMO_D2_VP, 'drep_id': DEMO_D2_ID,
        'rank': demo2_er, 'amount': drep_sh, 'claimed': False,
    },
    # DRep — borderline rank, eligible
    DEMO_D3_STAKE: {
        'type': 'drep', 'eligible': True, 'voted_all': True,
        'voted_actions': 11, 'total_actions': window_action_count,
        'voting_power': DEMO_D3_VP, 'drep_id': DEMO_D3_ID,
        'rank': demo3_er, 'amount': drep_sh, 'claimed': False,
    },
    # DRep — voted all actions but outside top 200 by voting power
    DEMO_D4_STAKE: {
        'type': 'drep', 'eligible': demo4_pos in elig_set, 'voted_all': True,
        'voted_actions': 11, 'total_actions': window_action_count,
        'voting_power': DEMO_D4_VP, 'drep_id': DEMO_D4_ID,
        'rank': demo4_full_rank,
        **({'ineligible_reason': 'outside_top_200', 'amount': 0} if demo4_pos not in elig_set else {'amount': drep_sh}),
        'claimed': False,
    },
    # DRep — missed 4 governance actions
    DEMO_D5_STAKE: {
        'type': 'drep', 'eligible': False, 'voted_all': False,
        'voted_actions': 7, 'total_actions': window_action_count,
        'voting_power': vps[demo5_pos], 'drep_id': DEMO_D5_ID,
        'rank': None, 'ineligible_reason': 'incomplete_votes',
        'amount': 0, 'claimed': False,
    },
    # CC member — missed 2 governance actions
    DEMO_C2_STAKE: {
        'type': 'cc', 'eligible': False, 'voted_all': False,
        'voted_actions': cc_vote_counts[1], 'total_actions': window_action_count,
        'cc_credential': DEMO_C2_CRED, 'ineligible_reason': 'incomplete_votes',
        'amount': 0, 'claimed': False,
    },
}
with open(f'{DATA}/eligibility.json', 'w') as f:
    json.dump(eligibility, f, indent=2)
print("Written: eligibility.json")

# Pre-compute per-window pool stats for closed windows
# With WINDOW_BASE=449: window 24 = epochs 521,522,523 (current claim window)
# Previous closed windows: w23=518-520, w22=515-517, ...
# First window containing EP_START: w=(451-449)//3 = 0, epochs 449,450,451
N_CLOSED_WINDOWS = 24  # windows 0-23 are all closed (window 24 is claim window)
window_stats = {}
for w in range(N_CLOSED_WINDOWS):
    rew3 = [ep_rewards() for _ in range(3)]
    total_rew = sum(rew3)
    nd = rng3.randint(140, 200)   # actual eligible DReps this window
    nc = rng3.randint(4, 7)
    dp = round(total_rew * DREP_PCT / 100)
    cp = total_rew - dp
    ds = dp // MAX_ELIG           # always divided by cap (200); fewer eligible = more to reserve
    cs = cp // N_CC               # always divided by cap (7); fewer eligible = more to reserve
    paid = ds * nd + cs * nc      # only nd DReps / nc CC claimed; remainder goes to reserve
    reserve = total_rew - paid
    window_stats[w] = {
        'total_rewards': total_rew,
        'per_ep_rewards': rew3,
        'n_dreps': nd, 'n_cc': nc,
        'drep_share': ds, 'cc_share': cs,
        'distributed': paid, 'reserve': reserve,
    }

# Build epochs list
epochs_data = []
for ep in range(EP_START, EP_END + 1):
    w   = (ep - WINDOW_BASE) // 3
    pos = (ep - WINDOW_BASE) % 3   # 0,1,2 within window
    ws  = window_stats.get(w)
    cnt = len(gov_actions.get(str(ep), []))

    if ep in OPEN_EPS:
        rew = open_epoch_rewards[OPEN_EPS.index(ep)]
        # Store share amounts on the last open epoch (payout epoch of this window)
        ep_pos = (ep - WINDOW_BASE) % 3
        epochs_data.append({
            'epoch': ep, 'action_count': cnt,
            'dreps_rewarded': 0, 'cc_rewarded': 0,
            'ada_distributed': 0, 'reserve_added': 0,
            'drep_share_ada': drep_sh if ep_pos == 2 else 0,
            'cc_share_ada':   cc_sh   if ep_pos == 2 else 0,
            'rewards_generated': rew,
            'status': 'open', 'claim_open': True,
        })
    elif ws:
        rew = ws['per_ep_rewards'][pos]
        # Only show distribution stats on the last epoch of the window
        if pos == 2:
            dist = ws['distributed']
            res  = ws['reserve']
            nd   = ws['n_dreps']
            nc   = ws['n_cc']
            ds   = ws['drep_share']
            cs   = ws['cc_share']
        else:
            dist = 0; res = 0; nd = 0; nc = 0; ds = 0; cs = 0
        epochs_data.append({
            'epoch': ep, 'action_count': cnt,
            'dreps_rewarded': nd, 'cc_rewarded': nc,
            'ada_distributed': dist, 'reserve_added': res,
            'drep_share_ada': ds, 'cc_share_ada': cs,
            'rewards_generated': rew,
            'status': 'closed', 'claim_open': False,
        })
    else:
        rew = ep_rewards()
        epochs_data.append({
            'epoch': ep, 'action_count': cnt,
            'dreps_rewarded': 0, 'cc_rewarded': 0,
            'ada_distributed': 0, 'reserve_added': 0,
            'rewards_generated': rew,
            'status': 'closed', 'claim_open': False,
        })

with open(f'{DATA}/epochs.json', 'w') as f:
    json.dump(epochs_data, f, indent=2)
print("Written: epochs.json")

# ── payouts.json ──────────────────────────────────────────────────────────────
demo_history_by_back = {
    1: [
        (DEMO_D_STAKE,  'drep'),
        (DEMO_D2_STAKE, 'drep'),
        (DEMO_D3_STAKE, 'drep'),
        (DEMO_D4_STAKE, 'drep'),
        (DEMO_C_STAKE,  'cc'),
        (DEMO_C2_STAKE, 'cc'),
    ],
    2: [
        (DEMO_D_STAKE,  'drep'),
        (DEMO_D2_STAKE, 'drep'),
        (DEMO_D3_STAKE, 'drep'),
        (DEMO_D5_STAKE, 'drep'),
        (DEMO_C_STAKE,  'cc'),
    ],
    3: [
        (DEMO_D_STAKE,  'drep'),
        (DEMO_D2_STAKE, 'drep'),
        (DEMO_D4_STAKE, 'drep'),
        (DEMO_C_STAKE,  'cc'),
        (DEMO_C2_STAKE, 'cc'),
    ],
    4: [
        (DEMO_D_STAKE,  'drep'),
        (DEMO_D3_STAKE, 'drep'),
        (DEMO_D5_STAKE, 'drep'),
        (DEMO_C_STAKE,  'cc'),
    ],
    5: [
        (DEMO_D_STAKE,  'drep'),
        (DEMO_D2_STAKE, 'drep'),
        (DEMO_D3_STAKE, 'drep'),
        (DEMO_D4_STAKE, 'drep'),
        (DEMO_C_STAKE,  'cc'),
    ],
}

demo_profiles = {
    DEMO_D_STAKE:  {'type': 'drep', 'label': 'Demo DRep #7'},
    DEMO_D2_STAKE: {'type': 'drep', 'label': 'Demo DRep #45'},
    DEMO_D3_STAKE: {'type': 'drep', 'label': 'Demo DRep #112'},
    DEMO_D4_STAKE: {'type': 'drep', 'label': 'Demo DRep #201'},
    DEMO_D5_STAKE: {'type': 'drep', 'label': 'Demo DRep partial voter'},
    DEMO_C_STAKE:  {'type': 'cc',   'label': 'Demo CC member'},
    DEMO_C2_STAKE: {'type': 'cc',   'label': 'Demo CC partial voter'},
}

def historical_ineligible_summary(stake_address, total_actions):
    if stake_address == DEMO_D4_STAKE:
        return total_actions, 'outside_top_200'
    if stake_address == DEMO_C2_STAKE:
        return max(total_actions - 2, 0), 'incomplete_votes'
    if stake_address == DEMO_D5_STAKE:
        return max(total_actions - 4, 0), 'incomplete_votes'
    if stake_address == DEMO_D3_STAKE:
        return max(total_actions - 2, 0), 'incomplete_votes'
    return max(total_actions - 1, 0), 'incomplete_votes'

payouts = []
for w_back in range(1, 6):   # 5 most recent closed windows
    w  = N_CLOSED_WINDOWS - w_back
    ws = window_stats.get(w)
    if not ws: continue
    ep_last = EP_START + w * 3 + 2

    seeded = demo_history_by_back.get(w_back, [])
    for j, (stake_address, actor_type) in enumerate(seeded):
        amount = ws['cc_share'] if actor_type == 'cc' else ws['drep_share']
        payouts.append({
            'epoch':         ep_last,
            'stake_address': stake_address,
            'type':          actor_type,
            'amount':        amount,
            'tx_hash':       rh2(64),
            'timestamp':     f'2025-{(8 + w_back):02d}-{(1 + j):02d}T12:00:00Z',
        })

    # Keep a representative sample size after the seeded demo rows.
    for j in range(len(seeded), 25):
        is_cc  = j >= 22
        amount = ws['cc_share'] if is_cc else ws['drep_share']
        payouts.append({
            'epoch':         ep_last,
            'stake_address': f'stake1u{rb2(50)}',
            'type':          'cc' if is_cc else 'drep',
            'amount':        amount,
            'tx_hash':       rh2(64),
            'timestamp':     f'2025-{(8 + w_back):02d}-{(1 + j):02d}T12:00:00Z',
        })

with open(f'{DATA}/payouts.json', 'w') as f:
    json.dump(payouts, f, indent=2)
print("Written: payouts.json")

# ── profile_history.json ──────────────────────────────────────────────────────
profile_history = {}
for stake_address, meta in demo_profiles.items():
    rows = []

    for w_back in range(1, 6):
        w = N_CLOSED_WINDOWS - w_back
        ws = window_stats.get(w)
        if not ws:
            continue

        ep_last = EP_START + w * 3 + 2
        epochs = [ep_last - 2, ep_last - 1, ep_last]
        total_actions = sum(len(gov_actions.get(str(ep), [])) for ep in epochs)
        seeded = {addr: actor_type for addr, actor_type in demo_history_by_back.get(w_back, [])}
        paid = seeded.get(stake_address) == meta['type']

        if paid:
            voted_actions = total_actions
            eligible = True
            amount = ws['cc_share'] if meta['type'] == 'cc' else ws['drep_share']
            reason = None
            status = 'paid'
        else:
            voted_actions, reason = historical_ineligible_summary(stake_address, total_actions)
            eligible = False
            amount = 0
            status = 'not_paid'

        rows.append({
            'window_label': f'Closed window ending epoch {ep_last}',
            'epochs': epochs,
            'payout_epoch': ep_last,
            'status': status,
            'eligible': eligible,
            'voted_actions': voted_actions,
            'total_actions': total_actions,
            'amount': amount,
            'ineligible_reason': reason,
            'type': meta['type'],
            'sort_order': ep_last,
        })

    current_record = eligibility.get(stake_address)
    if current_record:
        rows.append({
            'window_label': f'Current window {OPEN_EPS[0]}-{OPEN_EPS[-1]}',
            'epochs': OPEN_EPS,
            'payout_epoch': OPEN_EPS[-1],
            'status': 'current',
            'eligible': current_record.get('eligible', False),
            'voted_actions': current_record.get('voted_actions', 0),
            'total_actions': current_record.get('total_actions', window_action_count),
            'amount': current_record.get('amount', 0),
            'ineligible_reason': current_record.get('ineligible_reason'),
            'type': current_record.get('type', meta['type']),
            'sort_order': OPEN_EPS[-1] + 1000,
        })

    profile_history[stake_address] = rows

with open(f'{DATA}/profile_history.json', 'w') as f:
    json.dump(profile_history, f, indent=2)
print("Written: profile_history.json")

# ── Summary for config.js update ─────────────────────────────────────────────
print()
print("=== UPDATE config.js ===")
print(f"Demo DRep eligible rank : {demo_er}")
print(f"DRep share (amount)     : {drep_sh} ADA")
print(f"CC share (amount)       : {cc_sh} ADA")
print(f"Total eligible DReps    : {n_ed}")
print(f"Total eligible CC       : {n_ec}")
total_dist = sum(e['ada_distributed'] for e in epochs_data)
print(f"Total distributed (all epochs): {total_dist} ADA")
