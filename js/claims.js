// Local claim ledger.
//
// The demo has no backend, so a submitted claim is persisted in localStorage and
// read back the way a real portal would read it from its API: keyed by stake
// address, scoped to a claim window, and durable across reloads.

import { STORAGE } from './config.js';

const VERSION = 2;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE.claims);
    if (!raw) return { version: VERSION, claims: {} };
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION) return { version: VERSION, claims: {} };
    return { version: VERSION, claims: parsed.claims || {} };
  } catch {
    return { version: VERSION, claims: {} };
  }
}

function write(store) {
  try {
    localStorage.setItem(STORAGE.claims, JSON.stringify(store));
  } catch {
    /* storage full or blocked — the claim stays in memory for this page view */
  }
}

function key(stakeAddress, windowId) {
  return `${windowId}::${stakeAddress}`;
}

export function getClaim(stakeAddress, windowId) {
  if (!stakeAddress || !windowId) return null;
  return read().claims[key(stakeAddress, windowId)] || null;
}

export function saveClaim(record) {
  const store = read();
  store.claims[key(record.stake_address, record.window_id)] = record;
  write(store);
  return record;
}

export function allClaims() {
  return Object.values(read().claims);
}

export function claimsForAddress(stakeAddress) {
  return allClaims().filter(c => c.stake_address === stakeAddress);
}

export function clearClaims() {
  write({ version: VERSION, claims: {} });
}

/**
 * Claim references are sequential per settlement epoch. The snapshot reports how
 * many have already settled, so a locally-created claim continues that run
 * rather than restarting at one.
 */
export function nextClaimId(epoch, settledCount) {
  const local = allClaims().filter(c => c.epoch === epoch).length;
  return `GRC-${epoch}-${String((settledCount || 0) + local + 1).padStart(5, '0')}`;
}
