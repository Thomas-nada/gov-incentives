# Cardano Governance Rewards — claim portal

A working front end for a governance reward programme: DReps and Constitutional
Committee members who vote on **every** governance action in a three-epoch window
take an equal share of the staking yield produced by a 75M ₳ treasury delegation.

Everything the portal displays is simulated. No wallet is charged, no transaction
is submitted, and the identifiers, DRep names and vote records are fabricated.
The data is *shaped* like chain data — lovelace integers, bech32-length IDs,
CIP-119 metadata, five-day epochs — so the portal behaves the way the real one
would.

## Running it

```bash
python dev-server.py
```

Then open <http://localhost:8000>. On Windows, `start.bat` does the same and opens
a browser. Any static file server works; a threaded one is required because the
app fetches eight JSON files and a dozen ES modules in parallel.

## What is in here

```
index.html              Shell: meta, theme bootstrap, Tailwind config
styles.css              Component layer (buttons, cards, tables, wizard, pills)
js/
  app.js                State, data loading, router, header/status strip/footer,
                        wallet dialog, toasts, live countdowns
  config.js             Static programme config and test accounts
  utils.js              Lovelace/date/identifier formatting, CSV, clipboard, bech32
  claims.js             Local claim ledger (localStorage), claim reference numbering
  components/
    shared.js           Metric tiles, pills, identity cells, eligibility checklist
    home.js             Overview dashboard
    claim.js            Four-step claim wizard
    epochs.js           Epoch and window history
    explorer.js         Snapshot explorer (actions, DReps, committee, votes, claims)
    docs.js             Programme documentation, FAQ, glossary
    profile.js          Connected account: record, eligibility, reward history
data/                   Generated snapshot (see below)
generate_data.py        Regenerates everything in data/
```

## Regenerating the data

```bash
python generate_data.py
```

Writes eight files into `data/`:

| File | Contents |
| --- | --- |
| `snapshot.json` | Programme config, chain tip, window manifest, totals. The app reads its runtime numbers from here. |
| `epochs.json` | 73 epochs with start/end times, slots, blocks, yield and pool ROA |
| `governance_actions.json` | Actions per epoch with proposer, deposit, anchor, tally and outcome |
| `rankings.json` | 932 DReps and 7 committee members with metadata and computed shares |
| `votes.json` | The full vote ledger for the open window (~6,600 records) |
| `eligibility.json` | Per-stake-key eligibility for the test accounts |
| `payouts.json` | Settled claims, historical and for the open window |
| `profile_history.json` | Per-account results across the five most recent windows |

The generator is deterministic apart from its epoch anchor, which is pinned to the
date it runs so the "current" epoch is always in progress. Re-run it if the
countdowns drift into the past.

## Programme rules

- **Window** — three epochs, roughly fifteen days. Eligibility is decided at the
  block that closes the third epoch.
- **Participation** — all-or-nothing. Every governance action in the window must
  be voted on. Yes, No and Abstain all count; a missing vote does not.
- **DRep cut-off** — among DReps with full participation, the top 200 by delegated
  voting power qualify. The cut-off is applied *after* participation, so the rank
  that matters is the position among full participants, not the overall one.
- **Shares** — the pool splits 94% DRep / 6% committee, then divides by the caps
  (200 and 7) rather than by the number that actually qualified. Unfilled slots
  and unclaimed shares go to the reserve.
- **Claiming** — one claim per account per window, open for four epochs after the
  window closes. Authorisation is a CIP-8 message signature, not a transaction.

## Demo behaviour worth knowing

- The claim wizard simulates signing, submission and confirmation, then writes a
  receipt to `localStorage` under `govrewards.claims.v2`. Clearing site data
  resets it and the account becomes claimable again.
- The connect dialog lists real CIP-30 wallets if any extension is installed, and
  will read your reward address from one. That address almost certainly is not in
  the snapshot, which is the intended "not found" path — use a test account to
  see the eligible flow.
- Explorer tables export to CSV, and the snapshot manifest downloads as JSON.
