#!/usr/bin/env python3
"""Generate the simulated chain snapshot the Governance Rewards portal reads.

Everything here is fabricated, but it is shaped the way the real thing would be:
lovelace integers, bech32-length identifiers, CIP-119 DRep metadata, epoch
boundaries five days apart, and a signed-looking snapshot manifest.

    python generate_data.py

Writes data/*.json. Deterministic apart from the epoch anchor, which is pinned to
the generation date so the "current" epoch is always in progress.
"""
import hashlib
import json
import math
import os
import random
from datetime import datetime, timedelta, timezone

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')

rng = random.Random(42)       # dreps / structure
rng2 = random.Random(99)      # actions / payouts
rng3 = random.Random(7)       # epoch yields
rng4 = random.Random(123)     # addresses
rng5 = random.Random(314159)  # vote ledger
rng6 = random.Random(2718)    # metadata

LOVELACE = 1_000_000

# --- Programme parameters ---------------------------------------------------
N_DREPS = 932
N_CC = 7
MIN_VP = 2_387
MAX_VP = 654_875_986
EP_START = 451
EP_END = 523
CURRENT_EP = 524
OPEN_EPS = [521, 522, 523]
N_ACTIONS = 11
DREP_PCT = 94
CC_PCT = 6
MAX_ELIG = 200
WINDOW_BASE = 449              # window boundaries: 449, 452, ... 521 (521-523 = window 24)
EPOCH_DAYS = 5
PRINCIPAL_LOVELACE = 75_000_000 * LOVELACE
CLAIM_GRACE = 4                # epochs after the window closes before claims expire
PROGRAMME_VERSION = '1.4.2'

# The anchor is chosen so CURRENT_EP is in progress on the day this runs.
_today = datetime.now(timezone.utc).replace(hour=21, minute=44, second=51, microsecond=0)
EPOCH_CURRENT_START = _today - timedelta(days=2)

SLOTS_PER_EPOCH = 432_000
SLOT_AT_CURRENT = 168_912_000
BLOCK_AT_CURRENT = 11_842_366
BLOCKS_PER_EPOCH = 21_600


def epoch_start(ep):
    return EPOCH_CURRENT_START + timedelta(days=(ep - CURRENT_EP) * EPOCH_DAYS)


def epoch_end(ep):
    return epoch_start(ep + 1)


def iso(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


def epoch_first_slot(ep):
    return SLOT_AT_CURRENT + (ep - CURRENT_EP) * SLOTS_PER_EPOCH


def epoch_first_block(ep):
    return BLOCK_AT_CURRENT + (ep - CURRENT_EP) * BLOCKS_PER_EPOCH


# --- Identifier helpers -----------------------------------------------------
BC = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
HX = '0123456789abcdef'


def rb(n, r=rng):
    return ''.join(r.choices(BC, k=n))


def rh(n, r=rng):
    return ''.join(r.choices(HX, k=n))


def drep_id(r=rng):
    return 'drep1y' + rb(51, r)


def cc_hot_id(r=rng):
    return 'cc_hot1q' + rb(50, r)


def stake_addr(r=rng4):
    return 'stake1u' + rb(51, r)


def payment_addr(r=rng4):
    return 'addr1q' + rb(92, r)


def gov_action_id(r=rng2):
    return 'gov_action1' + rb(55, r)


def pool_id(r=rng):
    return 'pool1' + rb(51, r)


# --- Fixed demo identities --------------------------------------------------
DEMO_D_STAKE = 'stake1ux7fe7j9hpuflnnjgmflzf66e83htkfqjulyyg9u9mvs0rcg5qvgp'
DEMO_D_ID = 'drep1yx7fe7j9hpuflnnjgmflzf66e83htkfqjulyg9u9mvs0rcg5qhx7n2vm4e'
DEMO_D_VP = 8_240_000

DEMO_D2_STAKE = 'stake1u8fnjkm3pq9xa7wv4l5e6d0strgyc4hz3wp8qv4xd9r5jk2n3p6qs'
DEMO_D2_ID = 'drep1y8fnjkm3pq9xa7wv4l5e6d0strgyc4hz3wp8qv4xd9r5jk2nq7wl0ekxp'
DEMO_D2_VP = 380_000

DEMO_D3_STAKE = 'stake1uxk3n5d8r7gm2pq9wl4v6zjfahcts5e3y8md4xl7pnqr2w9fk5j8p'
DEMO_D3_ID = 'drep1yxk3n5d8r7gm2pq9wl4v6zjfahcts5e3y8md4xl7pnqr2w9fqm2v8dlrz'
DEMO_D3_VP = 32_000

DEMO_D4_STAKE = 'stake1u4wml9nq7rhx5p3kd8g2a6vj4etsycf3mz7xu5nd8lk4r9p2q6w5t'
DEMO_D4_ID = 'drep1y4wml9nq7rhx5p3kd8g2a6vj4etsycf3mz7xu5nd8lk4r9p2qs6dgx4vh'
DEMO_D4_VP = 2_450

DEMO_D5_STAKE = 'stake1uzg9kl5nm4qrwx7p3dv2a0scyft6e3jh5xu9md7k4r8p2n6qw5j3e'
DEMO_D5_ID = 'drep1yzg9kl5nm4qrwx7p3dv2a0scyft6e3jh5xu9md7k4r8p2n6q0f8vzmrt'

DEMO_C_STAKE = 'stake1uydlj8mhqxjr84mgsgzwf5ljhsyvcrfynaz5zqv4wn4kqxcjtlfcq'
DEMO_C_CRED = 'cc_hot1q8xntrwl2pnkvr4kxvmqp7ynl35h7fjnap8qx4j7ldyv8c2kq9m04t'
DEMO_C2_STAKE = 'stake1u9r3kfg4mn5pq8wl7x2d0vjycts6e4zh3wp9qv5xd8r4jk3n2p7qm'
DEMO_C2_CRED = 'cc_hot1q9r3kfg4mn5pq8wl7x2d0vjycts6e4zh3wp9qv5xd8r4jk3q7v2ynz'

DEMO_D_NAME = 'Ledger Commons'
DEMO_D2_NAME = 'Stake & Signal'
DEMO_D3_NAME = 'Ouroboros Guild'
DEMO_D4_NAME = 'Nightfall Delegate'
DEMO_D5_NAME = 'Quorum Watch'

print('Anchor: epoch %d started %s' % (CURRENT_EP, iso(EPOCH_CURRENT_START)))

# --- Voting power distribution ----------------------------------------------
lmin, lmax = math.log(MIN_VP), math.log(MAX_VP)
vps = []
for i in range(N_DREPS):
    t = i / (N_DREPS - 1)
    lp = lmax - (lmax - lmin) * (t ** 0.28) + rng.gauss(0, 0.22)
    vps.append(int(math.exp(max(lmin, min(lmax, lp)))))
vps.sort(reverse=True)
vps[0], vps[-1] = MAX_VP, MIN_VP

drep_ids = [drep_id() for _ in range(N_DREPS)]
drep_stakes = [stake_addr() for _ in range(N_DREPS)]

for did, dstake, dvp in [
    (DEMO_D_ID, DEMO_D_STAKE, DEMO_D_VP),
    (DEMO_D2_ID, DEMO_D2_STAKE, DEMO_D2_VP),
    (DEMO_D3_ID, DEMO_D3_STAKE, DEMO_D3_VP),
    (DEMO_D4_ID, DEMO_D4_STAKE, DEMO_D4_VP),
    (DEMO_D5_ID, DEMO_D5_STAKE, 49_403),
]:
    pos = next(i for i, v in enumerate(vps) if v <= dvp)
    drep_ids[pos], drep_stakes[pos], vps[pos] = did, dstake, dvp

pos_of = {did: i for i, did in enumerate(drep_ids)}
demo_pos = pos_of[DEMO_D_ID]
demo2_pos = pos_of[DEMO_D2_ID]
demo3_pos = pos_of[DEMO_D3_ID]
demo4_pos = pos_of[DEMO_D4_ID]
demo5_pos = pos_of[DEMO_D5_ID]

# --- DRep metadata (CIP-119) ------------------------------------------------
NAME_A = ['Ada', 'Ouroboros', 'Hydra', 'Midnight', 'Voltaire', 'Shelley', 'Basho', 'Cardano',
          'Northern', 'Southern', 'Atlantic', 'Pacific', 'Alpine', 'Nordic', 'Iberian', 'Baltic',
          'Open', 'Civic', 'Public', 'Commons', 'Digital', 'Distributed', 'Sovereign', 'Emergent',
          'Lantern', 'Beacon', 'Compass', 'Anchor', 'Keystone', 'Cornerstone', 'Meridian',
          'Solstice', 'Quorum', 'Ledger', 'Stake', 'Epoch', 'Genesis', 'Plutus', 'Marlowe',
          'Mithril', 'Harbour', 'Foundry', 'Orchard', 'Meadow', 'Summit', 'Ridge', 'Delta']
NAME_B = ['Collective', 'Guild', 'Council', 'Alliance', 'Assembly', 'Coalition', 'Cooperative',
          'Trust', 'Partners', 'Labs', 'Works', 'Group', 'Network', 'Chapter', 'Circle', 'Forum',
          'Institute', 'Foundation', 'Syndicate', 'Union', 'Society', 'Bureau', 'Registry',
          'Delegates', 'Stewards', 'Advocates', 'Voices', 'Watch', 'Signal', 'Commons']
SOLO = ['ada.whale', 'blockwarden', 'chainkeeper', 'coldstaker', 'epochwatcher', 'governor.ada',
        'lovelace.dev', 'nodeoperator', 'onchainoracle', 'protocolnerd', 'quietvoter',
        'slotleader', 'stakepoolguy', 'utxo.maxi', 'votingpower', 'yellowpaper']

OBJECTIVES = [
    'Votes for proposals that measurably reduce the cost of building on Cardano.',
    'Long-term holder representing small delegators. Reads every proposal, abstains when unconvinced.',
    'Focused on treasury discipline: no withdrawal without a published budget and reporting plan.',
    'Prioritises protocol security and conservative parameter changes.',
    'Represents the developer community. Bias towards tooling, documentation and audits.',
    'Community-run collective. Publishes a rationale for every vote within 48 hours.',
    'Supports open-source infrastructure and reproducible builds.',
    'Regional delegate. Votes in line with a monthly community call.',
    'Independent. No affiliation with any funded entity.',
    'Advocates for stake pool operator interests in governance decisions.',
    'Research-led. Publishes analysis before each voting deadline.',
    'Votes Abstain on anything without a verifiable off-chain anchor.',
]

used_names = set()


def make_drep_name(r):
    for _ in range(40):
        if r.random() < 0.18:
            n = r.choice(SOLO)
        else:
            n = '%s %s' % (r.choice(NAME_A), r.choice(NAME_B))
        if n not in used_names:
            used_names.add(n)
            return n
    n = '%s %s %d' % (r.choice(NAME_A), r.choice(NAME_B), r.randint(2, 99))
    used_names.add(n)
    return n


for _n in (DEMO_D_NAME, DEMO_D2_NAME, DEMO_D3_NAME, DEMO_D4_NAME, DEMO_D5_NAME):
    used_names.add(_n)

FIXED_NAMES = {
    DEMO_D_ID: DEMO_D_NAME, DEMO_D2_ID: DEMO_D2_NAME, DEMO_D3_ID: DEMO_D3_NAME,
    DEMO_D4_ID: DEMO_D4_NAME, DEMO_D5_ID: DEMO_D5_NAME,
}

drep_meta = []
for i in range(N_DREPS):
    did = drep_ids[i]
    # Large DReps almost always register metadata; the long tail often does not.
    vpn = (math.log(max(vps[i], MIN_VP)) - lmin) / (lmax - lmin)
    has_meta = did in FIXED_NAMES or rng6.random() < (0.30 + 0.62 * vpn)
    name = FIXED_NAMES.get(did) or (make_drep_name(rng6) if has_meta else None)
    drep_meta.append({
        'name': name,
        'objectives': rng6.choice(OBJECTIVES) if name else None,
        'anchor_url': ('https://metadata.%s.io/drep.jsonld' % rb(8, rng6)) if name else None,
        'anchor_hash': rh(64, rng6) if name else None,
        # Delegator counts scale sub-linearly with stake: a few large holders
        # back the biggest DReps, while small ones have a long retail tail.
        'delegators': max(1, int((vps[i] ** 0.42) / rng6.uniform(0.8, 2.6))),
        'registered_epoch': rng6.randint(440, 470) if did in FIXED_NAMES else rng6.randint(440, 515),
    })

# --- Participation in the current window ------------------------------------


def nvoted(vp):
    vpn = (math.log(vp) - lmin) / (lmax - lmin)
    p = 0.12 + 0.50 * vpn
    if rng.random() < p:
        return N_ACTIONS
    r2 = rng.random()
    if r2 < 0.28:
        return rng.randint(9, 10)
    if r2 < 0.60:
        return rng.randint(5, 8)
    if r2 < 0.86:
        return rng.randint(2, 4)
    return rng.randint(0, 1)


VOTED_ALL = {DEMO_D_ID, DEMO_D2_ID, DEMO_D3_ID, DEMO_D4_ID}
VOTED_SOME = {DEMO_D5_ID: 7}
voted = [
    N_ACTIONS if drep_ids[i] in VOTED_ALL
    else VOTED_SOME.get(drep_ids[i], nvoted(vps[i]))
    for i in range(N_DREPS)
]

# --- Constitutional Committee -----------------------------------------------
CC_ORGS = [
    ('Northern Ledger Council', 'Nordic'),
    ('Cardano Civic Trust', 'Global'),
    ('Meridian Committee Group', 'Americas'),
    ('Harbour Governance Board', 'APAC'),
    ('Iberian Constitution Body', 'Europe'),
    ('Keystone Oversight', 'Africa'),
    ('Solstice Assembly', 'Global'),
]
cc_creds = [DEMO_C_CRED, DEMO_C2_CRED] + [cc_hot_id() for _ in range(N_CC - 2)]
cc_stakes = [DEMO_C_STAKE, DEMO_C2_STAKE] + [stake_addr() for _ in range(N_CC - 2)]
cc_voted = [11, 9, 11, 11, 11, 11, 8]
cc_names = [CC_ORGS[i][0] for i in range(N_CC)]
cc_region = [CC_ORGS[i][1] for i in range(N_CC)]
cc_term = [rng6.randint(560, 620) for _ in range(N_CC)]

# --- Governance actions -----------------------------------------------------
CURRENT_WINDOW_ACTIONS = {
    523: [
        ('TreasuryWithdrawal', 'Governance tooling fund, Q3 2026',
         'Withdraws 1,250,000 ADA to fund four independent governance tooling teams for two '
         'quarters, with milestone reporting published on-chain.'),
        ('ParameterChange', 'Stake pool minimum fee reduction to 170 ADA',
         'Lowers minPoolCost from 340 ADA to 170 ADA to improve the viability of small stake '
         'pools. No other parameters are affected.'),
        ('Info', 'Community signal on Leios rollout sequencing',
         'A non-binding poll asking DReps whether Leios should ship ahead of or after the next '
         'ledger era upgrade.'),
        ('HardForkInitiation', 'Chang+2, protocol version 11.0',
         'Initiates the hard fork to protocol major version 11. Requires node 10.4.0 or later on '
         'at least 90% of block-producing stake.'),
    ],
    522: [
        ('TreasuryWithdrawal', 'DRep onboarding and registration campaign',
         'Requests 420,000 ADA for a twelve-week campaign to grow registered DRep participation, '
         'including translated materials for six regions.'),
        ('Info', 'Constitutional Committee term renewal signal',
         'Seeks a community signal on whether the interim committee term should be extended by '
         'one epoch cycle.'),
        ('ParameterChange', 'DRep activity window extension to 30 epochs',
         'Raises drepActivity from 20 to 30 epochs so infrequent but engaged DReps are not '
         'automatically marked inactive.'),
    ],
    521: [
        ('TreasuryWithdrawal', 'Catalyst Fund 14 allocation',
         'Withdraws 22,000,000 ADA to the Catalyst escrow contract for Fund 14, released across '
         'three tranches against published milestones.'),
        ('ParameterChange', 'Pool pledge influence factor (a0) to 0.5',
         'Increases a0 from 0.3 to 0.5, strengthening the reward advantage of pledged stake.'),
        ('Info', 'Ouroboros Leios readiness survey',
         'Collects DRep sentiment on infrastructure readiness ahead of the Leios testnet.'),
        ('UpdateConstitution', 'Constitution v1.1, amendment procedure',
         'Adopts an amended Constitution that adds an explicit procedure for future amendments '
         'and clarifies the guardrails script.'),
    ],
}

ATYPES = ['TreasuryWithdrawal', 'ParameterChange', 'Info', 'HardForkInitiation',
          'UpdateConstitution', 'NoConfidence', 'NewCommittee']
ATYPE_W = [20, 28, 24, 5, 6, 2, 5]

SHORT = {
    'TreasuryWithdrawal': 'Treasury Withdrawal',
    'ParameterChange': 'Protocol Parameter Change',
    'Info': 'Info',
    'HardForkInitiation': 'Hard Fork Initiation',
    'UpdateConstitution': 'Update to the Constitution',
    'NoConfidence': 'Motion of No-Confidence',
    'NewCommittee': 'New Constitutional Committee',
}

TITLES = {
    'TreasuryWithdrawal': [
        'Governance tooling fund', 'Catalyst Fund 13 allocation', 'DRep campaign fund',
        'Core infrastructure grant', 'Open source developer fund', 'Community education initiative',
        'Foundation operating budget', 'Independent entity operations', 'Security audit fund',
        'Layer 2 research grant', 'Documentation working group', 'Developer bootcamp fund',
        'DeFi ecosystem grant', 'Token standards fund', 'Stablecoin research initiative',
        'Plutus migration support', 'Identity infrastructure fund', 'Governance bootstrap',
        'Partner chain integration', 'Hydra development grant', 'Mithril node subsidy',
        'Wallet maintenance grant', 'Community hub grants', 'Translation programme',
        'Node performance research', 'Bug bounty replenishment', 'Legal review retainer',
    ],
    'ParameterChange': [
        'Stake pool minimum fee revision', 'DRep activity window', 'Block body size increase',
        'Transaction fee policy', 'Pool pledge influence factor', 'Minimum ADA per UTxO',
        'Script execution unit limits', 'Collateral percentage', 'Maximum transaction size',
        'Committee term length', 'DRep deposit amount', 'Pool deposit amount',
        'minFeeA coefficient', 'minFeeB constant', 'Treasury growth rate',
        'Desired pool count (k)', 'Decentralisation parameter', 'Plutus V3 cost model',
        'Reference script fee scaling', 'Governance action deposit', 'Maximum block header size',
        'Transaction metadata size cap', 'Voting thresholds for treasury actions',
    ],
    'Info': [
        'Community ratification signal', 'DRep code of conduct endorsement',
        'Ecosystem vision statement', 'Governance roadmap acknowledgement',
        'Committee term renewal signal', 'Leios readiness survey',
        'Committee charter endorsement', 'DRep working group formation',
        'Hard fork readiness poll', 'Node upgrade signal',
        'Independent entity membership drive', 'Community budget signal',
        'Sustainability reporting signal', 'Developer relations survey',
        'Sidechain integration readiness', 'Annual report acknowledgement',
        'Governance calendar endorsement', 'Technical steering committee formation',
        'Treasury policy consultation',
    ],
    'HardForkInitiation': [
        'Chang hard fork', 'Chang+1 upgrade', 'Chang+2 upgrade', 'Protocol version 11.0',
        'Node 10.0 migration', 'Leios preview activation', 'Plomin hard fork',
    ],
    'UpdateConstitution': [
        'Interim Constitution v1', 'Amended Constitution v1.1', 'Guardrails script update',
        'Technical Constitution addendum', 'Proposal policy adoption',
        'Constitution hash ratification', 'Amendment procedure clause',
    ],
    'NoConfidence': [
        'Motion of no-confidence in the interim committee', 'No-confidence after quorum failure',
        'No-confidence over a reporting breach',
    ],
    'NewCommittee': [
        'Committee membership update for a new term', 'Committee threshold change',
        'Committee term extension', 'Committee election after no-confidence',
        'Committee composition refresh', 'Committee size adjustment',
    ],
}
_pools = {k: list(v) for k, v in TITLES.items()}


def pick_title(atype):
    if not _pools.get(atype):
        _pools[atype] = list(TITLES.get(atype, ['General action']))
    return _pools[atype].pop(rng2.randrange(len(_pools[atype])))


ABSTRACTS = [
    'The proposer argues the change is needed to keep the network competitive without affecting '
    'security assumptions.',
    'Funds are released against published milestones and reclaimed if reporting deadlines are missed.',
    'The rationale references the guardrails script and confirms the change stays inside its '
    'permitted range.',
    'An earlier version of this proposal was withdrawn after community feedback; this revision '
    'narrows the scope.',
    'Supporting analysis, budgets and a risk register are published at the anchor URL.',
    'The action is non-binding and records community sentiment only. Nothing on-chain changes if '
    'it ratifies.',
]

ACTION_COUNT_W = [3, 8, 18, 28, 24, 12, 6, 1]
PROPOSER_ORGS = ['Cardano Foundation', 'Intersect', 'Catalyst Circle', 'SPO Working Group',
                 'Civics Committee', 'Independent proposer', 'Technical Steering Committee',
                 'Ecosystem Budget Committee', 'Open Source Office']


def make_action(ep, atype, title, abstract=None):
    txh = rh(64, rng2)
    idx = rng2.randint(0, 2)
    ratified = rng2.random() < 0.46
    enacted = ratified and atype != 'Info' and rng2.random() < 0.72
    if ep in OPEN_EPS:
        outcome = 'Voting'
    elif enacted:
        outcome = 'Enacted'
    elif ratified:
        outcome = 'Ratified'
    else:
        outcome = 'Expired'
    yes = round(rng2.uniform(18, 88), 1)
    no = round(rng2.uniform(3, max(4.0, min(60.0, 99.0 - yes))), 1)
    abstain = round(max(0.0, 100.0 - yes - no), 1)
    return {
        'id': gov_action_id(),
        'tx': '%s#%d' % (txh, idx),
        'title': '%s: %s' % (SHORT[atype], title),
        'short_title': title,
        'type': atype,
        'proposed_epoch': ep,
        'expires_epoch': ep + rng2.randint(5, 8),
        'deposit_lovelace': 100_000 * LOVELACE,
        'proposer': rng2.choice(PROPOSER_ORGS),
        'proposer_stake': stake_addr(rng2),
        'abstract': abstract or rng2.choice(ABSTRACTS),
        'anchor_url': 'https://gov.%s.io/actions/%s.jsonld' % (rb(7, rng2), rb(10, rng2)),
        'anchor_hash': rh(64, rng2),
        'tally': {'yes_pct': yes, 'no_pct': no, 'abstain_pct': abstain},
        'outcome': outcome,
    }


gov_actions = {}
for ep in range(EP_START, EP_END + 1):
    if ep in CURRENT_WINDOW_ACTIONS:
        gov_actions[str(ep)] = [
            make_action(ep, atype, title, abstract)
            for atype, title, abstract in CURRENT_WINDOW_ACTIONS[ep]
        ]
        continue
    n = rng2.choices(range(8), weights=ACTION_COUNT_W)[0]
    acts = []
    for _ in range(n):
        atype = rng2.choices(ATYPES, weights=ATYPE_W)[0]
        acts.append(make_action(ep, atype, pick_title(atype)))
    gov_actions[str(ep)] = acts

with open(os.path.join(DATA, 'governance_actions.json'), 'w') as f:
    json.dump(gov_actions, f, indent=2)
print('Written: governance_actions.json')

# --- Epoch yields -----------------------------------------------------------


def ep_reward_lovelace():
    while True:
        v = int(rng3.gauss(28_000, 5_000))
        if 20_000 <= v <= 42_000:
            return v * LOVELACE + rng3.randint(0, LOVELACE - 1)


open_epoch_rewards = [ep_reward_lovelace() for _ in OPEN_EPS]
current_pool = sum(open_epoch_rewards)

# --- Vote ledger ------------------------------------------------------------
window_actions = [
    {**action, 'epoch': ep}
    for ep in OPEN_EPS
    for action in gov_actions.get(str(ep), [])
]
window_action_ids = [a['id'] for a in window_actions]
window_action_count = len(window_actions)
if window_action_count != N_ACTIONS:
    raise ValueError('Expected %d actions in the window, got %d' % (N_ACTIONS, window_action_count))
window_action_map = {a['id']: a for a in window_actions}

VOTE_CHOICES = ['Yes', 'No', 'Abstain']
VOTE_WEIGHTS = [52, 23, 25]


def build_actor_votes(action_ids, vote_total):
    if vote_total <= 0:
        return []
    chosen = list(action_ids) if vote_total >= len(action_ids) else sorted(
        rng5.sample(action_ids, vote_total))
    return [(aid, rng5.choices(VOTE_CHOICES, weights=VOTE_WEIGHTS)[0]) for aid in chosen]


def vote_time(ep):
    start = epoch_start(ep)
    return iso(start + timedelta(seconds=rng5.randint(3_600, EPOCH_DAYS * 86_400 - 3_600)))


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
            'actor_name': drep_meta[i]['name'],
            'epoch': action['epoch'],
            'action_id': action_id,
            'vote': choice,
            'voted_at': vote_time(action['epoch']),
            'tx_hash': rh(64, rng5),
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
            'actor_name': cc_names[i],
            'epoch': action['epoch'],
            'action_id': action_id,
            'vote': choice,
            'voted_at': vote_time(action['epoch']),
            'tx_hash': rh(64, rng5),
        })

vote_records.sort(key=lambda v: (v['epoch'], v['action_id'], v['actor_type'], v['actor_id']))

# --- Eligibility ------------------------------------------------------------
top_voters = sorted(
    [(i, vps[i]) for i in range(N_DREPS) if drep_vote_counts[i] == window_action_count],
    key=lambda x: x[1], reverse=True)
elig_set = {idx for idx, _ in top_voters[:MAX_ELIG]}
n_ed = len(elig_set)

full_rank = {drep_ids[idx]: r + 1 for r, (idx, _) in enumerate(top_voters)}

drep_pool = round(current_pool * DREP_PCT / 100)
cc_pool = current_pool - drep_pool

boundary_vp = top_voters[MAX_ELIG - 1][1] if len(top_voters) >= MAX_ELIG else None
ties = sum(1 for _, vp in top_voters[MAX_ELIG:] if vp == boundary_vp) if boundary_vp else 0
drep_divisor = MAX_ELIG + ties
drep_sh = drep_pool // drep_divisor if drep_divisor else 0
cc_elig = [count == window_action_count for count in cc_vote_counts]
n_ec = sum(cc_elig)
cc_sh = cc_pool // N_CC

print('DReps who voted on all %d: %d' % (window_action_count, len(top_voters)))
print('Eligible DReps (top %d):   %d' % (MAX_ELIG, n_ed))
print('DRep share: %.6f ADA | CC share: %.6f ADA' % (drep_sh / LOVELACE, cc_sh / LOVELACE))

votes = {
    '_note': 'Complete vote ledger for the current rewards snapshot.',
    'window_521_523': {
        'epochs': OPEN_EPS,
        'total_actions': window_action_count,
        'total_pool_lovelace': current_pool,
        'total_vote_records': len(vote_records),
        'votes': vote_records,
    },
}
with open(os.path.join(DATA, 'votes.json'), 'w') as f:
    json.dump(votes, f, separators=(',', ':'))
print('Written: votes.json (%d records)' % len(vote_records))

# --- rankings.json ----------------------------------------------------------
dreps_arr = [{
    'rank': i + 1,
    'drep_id': drep_ids[i],
    'name': drep_meta[i]['name'],
    'stake_address': drep_stakes[i],
    'voting_power_lovelace': vps[i] * LOVELACE,
    'delegators': drep_meta[i]['delegators'],
    'registered_epoch': drep_meta[i]['registered_epoch'],
    'voted_actions': drep_vote_counts[i],
    'participation_rank': full_rank.get(drep_ids[i]),
    'eligible': i in elig_set,
    'share_lovelace': drep_sh if i in elig_set else 0,
} for i in range(N_DREPS)]

cc_arr = [{
    'credential': cc_creds[i],
    'name': cc_names[i],
    'region': cc_region[i],
    'term_end_epoch': cc_term[i],
    'stake_address': cc_stakes[i],
    'voted_actions': cc_vote_counts[i],
    'eligible': cc_elig[i],
    'share_lovelace': cc_sh if cc_elig[i] else 0,
} for i in range(N_CC)]

rankings = {
    '_note': 'Equal-share rewards derived from the vote ledger for claim window 521-523.',
    'window_521_523': {
        'epochs': OPEN_EPS,
        'total_actions': window_action_count,
        'total_pool_lovelace': current_pool,
        'drep_pool_lovelace': drep_pool,
        'cc_pool_lovelace': cc_pool,
        'drep_registered_count': N_DREPS,
        'eligible_drep_count': n_ed,
        'eligible_cc_count': n_ec,
        'drep_share_lovelace': drep_sh,
        'cc_share_lovelace': cc_sh,
        'cc': cc_arr,
        'dreps': dreps_arr,
    },
}
with open(os.path.join(DATA, 'rankings.json'), 'w') as f:
    json.dump(rankings, f, separators=(',', ':'))
print('Written: rankings.json')

# --- eligibility.json -------------------------------------------------------


def drep_record(stake, did, vp, pos, voted_actions, reason=None):
    eligible = reason is None
    return {
        'type': 'drep',
        'eligible': eligible,
        'voted_all': voted_actions == window_action_count,
        'voted_actions': voted_actions,
        'total_actions': window_action_count,
        'voting_power_lovelace': vp * LOVELACE,
        'delegators': drep_meta[pos]['delegators'],
        'registered_epoch': drep_meta[pos]['registered_epoch'],
        'name': drep_meta[pos]['name'],
        'drep_id': did,
        'rank': pos + 1,
        'participation_rank': full_rank.get(did),
        'eligible_pool_size': n_ed,
        'ineligible_reason': reason,
        'amount_lovelace': drep_sh if eligible else 0,
    }


eligibility = {
    '_note': 'Keyed by stake address. eligible=true means the actor voted on every action in the window.',
    '_window': {
        'epochs': OPEN_EPS,
        'total_actions': window_action_count,
        'total_pool_lovelace': current_pool,
        'drep_pool_lovelace': drep_pool,
        'cc_pool_lovelace': cc_pool,
        'eligible_dreps': n_ed,
        'eligible_cc': n_ec,
        'drep_share_lovelace': drep_sh,
        'cc_share_lovelace': cc_sh,
    },
    DEMO_D_STAKE: drep_record(DEMO_D_STAKE, DEMO_D_ID, DEMO_D_VP, demo_pos,
                              drep_vote_counts[demo_pos]),
    DEMO_D2_STAKE: drep_record(DEMO_D2_STAKE, DEMO_D2_ID, DEMO_D2_VP, demo2_pos,
                               window_action_count),
    DEMO_D3_STAKE: drep_record(DEMO_D3_STAKE, DEMO_D3_ID, DEMO_D3_VP, demo3_pos,
                               window_action_count),
    DEMO_D4_STAKE: drep_record(
        DEMO_D4_STAKE, DEMO_D4_ID, DEMO_D4_VP, demo4_pos, window_action_count,
        None if demo4_pos in elig_set else 'outside_top_200'),
    DEMO_D5_STAKE: drep_record(DEMO_D5_STAKE, DEMO_D5_ID, vps[demo5_pos], demo5_pos, 7,
                               'incomplete_votes'),
    DEMO_C_STAKE: {
        'type': 'cc', 'eligible': True, 'voted_all': True,
        'voted_actions': cc_vote_counts[0], 'total_actions': window_action_count,
        'name': cc_names[0], 'region': cc_region[0], 'term_end_epoch': cc_term[0],
        'cc_credential': DEMO_C_CRED, 'ineligible_reason': None,
        'eligible_pool_size': n_ec, 'amount_lovelace': cc_sh,
    },
    DEMO_C2_STAKE: {
        'type': 'cc', 'eligible': False, 'voted_all': False,
        'voted_actions': cc_vote_counts[1], 'total_actions': window_action_count,
        'name': cc_names[1], 'region': cc_region[1], 'term_end_epoch': cc_term[1],
        'cc_credential': DEMO_C2_CRED, 'ineligible_reason': 'incomplete_votes',
        'eligible_pool_size': n_ec, 'amount_lovelace': 0,
    },
}
with open(os.path.join(DATA, 'eligibility.json'), 'w') as f:
    json.dump(eligibility, f, indent=2)
print('Written: eligibility.json')

# --- Closed window statistics ----------------------------------------------
N_CLOSED_WINDOWS = 24
window_stats = {}
for w in range(N_CLOSED_WINDOWS):
    rew3 = [ep_reward_lovelace() for _ in range(3)]
    total_rew = sum(rew3)
    nd = rng3.randint(140, 200)
    nc = rng3.randint(4, 7)
    dp = round(total_rew * DREP_PCT / 100)
    cp = total_rew - dp
    ds = dp // MAX_ELIG
    cs = cp // N_CC
    paid = ds * nd + cs * nc
    window_stats[w] = {
        'total_rewards': total_rew,
        'per_ep_rewards': rew3,
        'n_dreps': nd, 'n_cc': nc,
        'drep_share': ds, 'cc_share': cs,
        'distributed': paid, 'reserve': total_rew - paid,
    }

# --- epochs.json ------------------------------------------------------------
epochs_data = []
for ep in range(EP_START, EP_END + 1):
    w = (ep - WINDOW_BASE) // 3
    pos = (ep - WINDOW_BASE) % 3
    ws = window_stats.get(w)
    cnt = len(gov_actions.get(str(ep), []))
    active_stake = int(rng3.uniform(21.4, 23.1) * 1_000_000_000) * LOVELACE
    blocks = rng3.randint(20_900, 21_700)

    base = {
        'epoch': ep,
        'window': w,
        'start_time': iso(epoch_start(ep)),
        'end_time': iso(epoch_end(ep)),
        'first_slot': epoch_first_slot(ep),
        'first_block': epoch_first_block(ep),
        'blocks_minted': blocks,
        'active_stake_lovelace': active_stake,
        'pool_blocks': rng3.randint(9, 26),
        'pool_roa_pct': round(rng3.uniform(2.61, 3.28), 2),
        'action_count': cnt,
    }

    if ep in OPEN_EPS:
        base.update({
            'dreps_rewarded': 0, 'cc_rewarded': 0,
            'distributed_lovelace': 0, 'reserve_added_lovelace': 0,
            'drep_share_lovelace': drep_sh if pos == 2 else 0,
            'cc_share_lovelace': cc_sh if pos == 2 else 0,
            'rewards_generated_lovelace': open_epoch_rewards[OPEN_EPS.index(ep)],
            'status': 'open', 'claim_open': True,
        })
    elif ws:
        payout = pos == 2
        base.update({
            'dreps_rewarded': ws['n_dreps'] if payout else 0,
            'cc_rewarded': ws['n_cc'] if payout else 0,
            'distributed_lovelace': ws['distributed'] if payout else 0,
            'reserve_added_lovelace': ws['reserve'] if payout else 0,
            'drep_share_lovelace': ws['drep_share'] if payout else 0,
            'cc_share_lovelace': ws['cc_share'] if payout else 0,
            'rewards_generated_lovelace': ws['per_ep_rewards'][pos],
            'status': 'closed', 'claim_open': False,
        })
    else:
        base.update({
            'dreps_rewarded': 0, 'cc_rewarded': 0,
            'distributed_lovelace': 0, 'reserve_added_lovelace': 0,
            'drep_share_lovelace': 0, 'cc_share_lovelace': 0,
            'rewards_generated_lovelace': ep_reward_lovelace(),
            'status': 'closed', 'claim_open': False,
        })
    epochs_data.append(base)

with open(os.path.join(DATA, 'epochs.json'), 'w') as f:
    json.dump(epochs_data, f, indent=2)
print('Written: epochs.json')

# --- payouts.json -----------------------------------------------------------
demo_history_by_back = {
    1: [(DEMO_D_STAKE, 'drep'), (DEMO_D2_STAKE, 'drep'), (DEMO_D3_STAKE, 'drep'),
        (DEMO_D4_STAKE, 'drep'), (DEMO_C_STAKE, 'cc'), (DEMO_C2_STAKE, 'cc')],
    2: [(DEMO_D_STAKE, 'drep'), (DEMO_D2_STAKE, 'drep'), (DEMO_D3_STAKE, 'drep'),
        (DEMO_D5_STAKE, 'drep'), (DEMO_C_STAKE, 'cc')],
    3: [(DEMO_D_STAKE, 'drep'), (DEMO_D2_STAKE, 'drep'), (DEMO_D4_STAKE, 'drep'),
        (DEMO_C_STAKE, 'cc'), (DEMO_C2_STAKE, 'cc')],
    4: [(DEMO_D_STAKE, 'drep'), (DEMO_D3_STAKE, 'drep'), (DEMO_D5_STAKE, 'drep'),
        (DEMO_C_STAKE, 'cc')],
    5: [(DEMO_D_STAKE, 'drep'), (DEMO_D2_STAKE, 'drep'), (DEMO_D3_STAKE, 'drep'),
        (DEMO_D4_STAKE, 'drep'), (DEMO_C_STAKE, 'cc')],
}

demo_profiles = {
    DEMO_D_STAKE: {'type': 'drep', 'name': DEMO_D_NAME},
    DEMO_D2_STAKE: {'type': 'drep', 'name': DEMO_D2_NAME},
    DEMO_D3_STAKE: {'type': 'drep', 'name': DEMO_D3_NAME},
    DEMO_D4_STAKE: {'type': 'drep', 'name': DEMO_D4_NAME},
    DEMO_D5_STAKE: {'type': 'drep', 'name': DEMO_D5_NAME},
    DEMO_C_STAKE: {'type': 'cc', 'name': cc_names[0]},
    DEMO_C2_STAKE: {'type': 'cc', 'name': cc_names[1]},
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


claim_seq = 0


def next_claim_id(ep):
    global claim_seq
    claim_seq += 1
    return 'GRC-%d-%05d' % (ep, claim_seq)


payouts = []
for w_back in range(1, 6):
    w = N_CLOSED_WINDOWS - w_back
    ws = window_stats.get(w)
    if not ws:
        continue
    ep_last = EP_START + w * 3 + 2
    settle_base = epoch_end(ep_last)

    rows = list(demo_history_by_back.get(w_back, []))
    seeded = len(rows)
    rows += [(stake_addr(rng2), 'cc' if j >= 22 else 'drep') for j in range(seeded, 25)]

    for j, (stake_address, actor_type) in enumerate(rows):
        amount = ws['cc_share'] if actor_type == 'cc' else ws['drep_share']
        submitted = settle_base + timedelta(hours=rng2.randint(2, 96),
                                            minutes=rng2.randint(0, 59))
        confirmed = submitted + timedelta(seconds=rng2.randint(22, 190))
        payouts.append({
            'claim_id': next_claim_id(ep_last),
            'epoch': ep_last,
            'window': [ep_last - 2, ep_last - 1, ep_last],
            'stake_address': stake_address,
            'destination_address': payment_addr(rng2),
            'type': actor_type,
            'amount_lovelace': amount,
            'fee_lovelace': rng2.randint(168_009, 191_405),
            'tx_hash': rh(64, rng2),
            'block_height': epoch_first_block(ep_last + 1) + rng2.randint(40, 18_000),
            'status': 'confirmed',
            'submitted_at': iso(submitted),
            'confirmed_at': iso(confirmed),
        })

# Claims already settled for the OPEN window. Eligible actors claim at their own
# pace once the window closes, so the portal shows a partially-drained pool. The
# demo identities are deliberately left unclaimed so they can still be claimed.
open_window_epoch = OPEN_EPS[-1]
demo_stakes = set(demo_profiles) if 'demo_profiles' in dir() else set()
claim_open_at = epoch_end(open_window_epoch)
now_utc = datetime.now(timezone.utc)
elapsed_hours = max(1.0, (now_utc - claim_open_at).total_seconds() / 3600.0)

DEMO_STAKES = {DEMO_D_STAKE, DEMO_D2_STAKE, DEMO_D3_STAKE, DEMO_D4_STAKE,
               DEMO_D5_STAKE, DEMO_C_STAKE, DEMO_C2_STAKE}

eligible_drep_rows = [d for d in dreps_arr if d['eligible']
                      and d['stake_address'] not in DEMO_STAKES]
eligible_cc_rows = [c for c in cc_arr if c['eligible']
                    and c['stake_address'] not in DEMO_STAKES]

# Claim uptake curve: brisk in the first hours, then a long tail.
drep_claimed = min(len(eligible_drep_rows), int(len(eligible_drep_rows) * 0.71))
cc_claimed = min(len(eligible_cc_rows), 3)

open_claims = []
for row in rng2.sample(eligible_drep_rows, drep_claimed) if drep_claimed else []:
    open_claims.append((row['stake_address'], 'drep', row['share_lovelace']))
for row in rng2.sample(eligible_cc_rows, cc_claimed) if cc_claimed else []:
    open_claims.append((row['stake_address'], 'cc', row['share_lovelace']))

for stake_address, actor_type, amount in open_claims:
    offset = elapsed_hours * (rng2.random() ** 1.9)
    submitted = claim_open_at + timedelta(seconds=int(offset * 3600))
    confirmed = submitted + timedelta(seconds=rng2.randint(22, 190))
    payouts.append({
        'claim_id': next_claim_id(open_window_epoch),
        'epoch': open_window_epoch,
        'window': list(OPEN_EPS),
        'stake_address': stake_address,
        'destination_address': payment_addr(rng2),
        'type': actor_type,
        'amount_lovelace': amount,
        'fee_lovelace': rng2.randint(168_009, 191_405),
        'tx_hash': rh(64, rng2),
        'block_height': epoch_first_block(open_window_epoch + 1) + rng2.randint(40, 18_000),
        'status': 'confirmed',
        'submitted_at': iso(submitted),
        'confirmed_at': iso(confirmed),
    })

payouts.sort(key=lambda p: (p['epoch'], p['confirmed_at']))
with open(os.path.join(DATA, 'payouts.json'), 'w') as f:
    json.dump(payouts, f, indent=2)
print('Written: payouts.json (%d records)' % len(payouts))

# --- profile_history.json ---------------------------------------------------
payout_by_stake = {}
for p in payouts:
    payout_by_stake.setdefault((p['stake_address'], p['epoch']), p)

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
        seeded = {a: t for a, t in demo_history_by_back.get(w_back, [])}
        paid = seeded.get(stake_address) == meta['type']

        if paid:
            voted_actions, reason, eligible, status = total_actions, None, True, 'paid'
            amount = ws['cc_share'] if meta['type'] == 'cc' else ws['drep_share']
        else:
            voted_actions, reason = historical_ineligible_summary(stake_address, total_actions)
            eligible, status, amount = False, 'not_paid', 0

        record = payout_by_stake.get((stake_address, ep_last))
        rows.append({
            'window_label': 'Window %d-%d' % (epochs[0], epochs[-1]),
            'epochs': epochs,
            'payout_epoch': ep_last,
            'status': status,
            'eligible': eligible,
            'voted_actions': voted_actions,
            'total_actions': total_actions,
            'amount_lovelace': amount,
            'ineligible_reason': reason,
            'type': meta['type'],
            'claim_id': record['claim_id'] if record else None,
            'tx_hash': record['tx_hash'] if record else None,
            'settled_at': record['confirmed_at'] if record else None,
            'sort_order': ep_last,
        })

    current = eligibility.get(stake_address)
    if current:
        rows.append({
            'window_label': 'Window %d-%d' % (OPEN_EPS[0], OPEN_EPS[-1]),
            'epochs': OPEN_EPS,
            'payout_epoch': OPEN_EPS[-1],
            'status': 'current',
            'eligible': current.get('eligible', False),
            'voted_actions': current.get('voted_actions', 0),
            'total_actions': current.get('total_actions', window_action_count),
            'amount_lovelace': current.get('amount_lovelace', 0),
            'ineligible_reason': current.get('ineligible_reason'),
            'type': current.get('type', meta['type']),
            'claim_id': None,
            'tx_hash': None,
            'settled_at': None,
            'sort_order': OPEN_EPS[-1] + 1000,
        })

    profile_history[stake_address] = rows

with open(os.path.join(DATA, 'profile_history.json'), 'w') as f:
    json.dump(profile_history, f, indent=2)
print('Written: profile_history.json')

# --- snapshot.json ----------------------------------------------------------
total_distributed = sum(e['distributed_lovelace'] for e in epochs_data)
total_generated = sum(e['rewards_generated_lovelace'] for e in epochs_data)
reserve_balance = sum(e['reserve_added_lovelace'] for e in epochs_data)

snapshot_payload = json.dumps(
    {'w': OPEN_EPS, 'd': drep_sh, 'c': cc_sh, 'n': len(vote_records)}, sort_keys=True)
snapshot_hash = hashlib.sha256(snapshot_payload.encode()).hexdigest()

snapshot = {
    'programme': {
        'name': 'Cardano Governance Rewards',
        'version': PROGRAMME_VERSION,
        'network': 'mainnet',
        'environment': 'demo',
        'principal_lovelace': PRINCIPAL_LOVELACE,
        'drep_pool_pct': DREP_PCT,
        'cc_pool_pct': CC_PCT,
        'max_eligible_dreps': MAX_ELIG,
        'committee_size': N_CC,
        'window_length_epochs': 3,
        'claim_grace_epochs': CLAIM_GRACE,
        'stake_pool': {
            'ticker': 'GOVR',
            'name': 'Governance Rewards Treasury Pool',
            'pool_id': pool_id(),
            'delegated_lovelace': PRINCIPAL_LOVELACE,
            'saturation_pct': 32.4,
            'lifetime_roa_pct': 2.94,
            'blocks_lifetime': 1_284,
        },
        'payout_script_address': payment_addr(),
        'support_email': 'support@govrewards.example',
        'status_url': 'https://status.govrewards.example',
        'docs_url': 'https://docs.govrewards.example',
    },
    'chain': {
        'current_epoch': CURRENT_EP,
        'current_epoch_start': iso(epoch_start(CURRENT_EP)),
        'current_epoch_end': iso(epoch_end(CURRENT_EP)),
        'epoch_length_days': EPOCH_DAYS,
        'tip_block': epoch_first_block(CURRENT_EP) + 8_640,
        'tip_slot': epoch_first_slot(CURRENT_EP) + 172_800,
    },
    'window': {
        'id': 'window_521_523',
        'label': 'Window %d-%d' % (OPEN_EPS[0], OPEN_EPS[-1]),
        'epochs': OPEN_EPS,
        'opened_at': iso(epoch_start(OPEN_EPS[0])),
        'closed_at': iso(epoch_end(OPEN_EPS[-1])),
        'claim_opens_at': iso(epoch_end(OPEN_EPS[-1])),
        'claim_deadline_epoch': OPEN_EPS[-1] + CLAIM_GRACE,
        'claim_deadline_at': iso(epoch_end(OPEN_EPS[-1] + CLAIM_GRACE)),
        'total_actions': window_action_count,
        'total_pool_lovelace': current_pool,
        'drep_pool_lovelace': drep_pool,
        'cc_pool_lovelace': cc_pool,
        'drep_share_lovelace': drep_sh,
        'cc_share_lovelace': cc_sh,
        'eligible_dreps': n_ed,
        'eligible_cc': n_ec,
        'registered_dreps': N_DREPS,
        'full_participation_dreps': len(top_voters),
        'vote_records': len(vote_records),
        'snapshot_taken_at': iso(epoch_end(OPEN_EPS[-1])),
        'snapshot_block': epoch_first_block(OPEN_EPS[-1] + 1),
        'snapshot_slot': epoch_first_slot(OPEN_EPS[-1] + 1),
        'snapshot_hash': snapshot_hash,
        'claims_settled': len(open_claims),
        'claims_settled_lovelace': sum(a for _, _, a in open_claims),
        'claims_outstanding': (n_ed + n_ec) - len(open_claims),
    },
    'totals': {
        'epochs_recorded': len(epochs_data),
        'generated_lovelace': total_generated,
        'distributed_lovelace': total_distributed,
        'reserve_balance_lovelace': reserve_balance,
        'payout_records': len(payouts),
    },
    'generated_at': iso(datetime.now(timezone.utc)),
}
with open(os.path.join(DATA, 'snapshot.json'), 'w') as f:
    json.dump(snapshot, f, indent=2)
print('Written: snapshot.json')

print()
print('Window %d-%d' % (OPEN_EPS[0], OPEN_EPS[-1]))
print('  pool            %.6f ADA' % (current_pool / LOVELACE))
print('  DRep share      %.6f ADA x %d eligible' % (drep_sh / LOVELACE, n_ed))
print('  CC share        %.6f ADA x %d eligible' % (cc_sh / LOVELACE, n_ec))
print('  reserve balance %.6f ADA' % (reserve_balance / LOVELACE))
print('  snapshot hash   %s' % snapshot_hash)
