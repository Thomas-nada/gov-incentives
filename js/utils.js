// Bech32 encoder (for converting CIP-30 hex reward addresses to stake1u... format)
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = (chk & 0x1ffffff) << 5 ^ v;
    for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function hrpExpand(hrp) {
  const rv = [];
  for (const c of hrp) rv.push(c.charCodeAt(0) >> 5);
  rv.push(0);
  for (const c of hrp) rv.push(c.charCodeAt(0) & 31);
  return rv;
}

function convertBits(data, from, to, pad) {
  let acc = 0, bits = 0;
  const result = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) { bits -= to; result.push((acc >> bits) & maxv); }
  }
  if (pad && bits > 0) result.push((acc << (to - bits)) & maxv);
  return result;
}

function bech32Encode(hrp, data) {
  const combined = [...data];
  const checkValues = [...hrpExpand(hrp), ...combined, 0, 0, 0, 0, 0, 0];
  const pm = polymod(checkValues) ^ 1;
  const checksum = [];
  for (let p = 0; p < 6; p++) checksum.push((pm >> (5 * (5 - p))) & 31);
  return hrp + '1' + [...combined, ...checksum].map(d => CHARSET[d]).join('');
}

export function hexToStakeAddress(hex) {
  try {
    const bytes = new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const converted = convertBits(Array.from(bytes), 8, 5, true);
    return bech32Encode('stake', converted);
  } catch {
    return null;
  }
}

export function formatAda(lovelace, decimals = 0) {
  if (lovelace === undefined || lovelace === null) return '—';
  const ada = typeof lovelace === 'number' && lovelace > 1_000_000
    ? lovelace / 1_000_000
    : lovelace;
  return Math.max(0, ada).toLocaleString('en-US', { maximumFractionDigits: decimals }) + ' ₳';
}

export function formatVotingPower(ada) {
  if (ada >= 1_000_000) return (ada / 1_000_000).toFixed(1) + 'M ₳';
  if (ada >= 1_000) return (ada / 1_000).toFixed(0) + 'K ₳';
  return ada.toLocaleString() + ' ₳';
}

export function truncateAddress(addr, start = 10, end = 6) {
  if (!addr || addr.length <= start + end + 3) return addr;
  return addr.slice(0, start) + '…' + addr.slice(-end);
}

export function truncateDrepId(id, start = 12, end = 6) {
  if (!id || id.length <= start + end + 3) return id;
  return id.slice(0, start) + '…' + id.slice(-end);
}

export function fakeTxHash() {
  const chars = '0123456789abcdef';
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

export async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}
