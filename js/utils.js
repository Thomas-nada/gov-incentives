// ─── Bech32 (CIP-30 hex reward address → stake1… ) ───────────────────────────
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
    return bech32Encode('stake', convertBits(Array.from(bytes), 8, 5, true));
  } catch {
    return null;
  }
}

// ─── Money ────────────────────────────────────────────────────────────────────
// Every amount in the dataset is an integer number of lovelace, as it would be
// coming off-chain. Formatting is the only place ADA decimals appear.
export const LOVELACE = 1_000_000;

export function toAda(lovelace) {
  return (Number(lovelace) || 0) / LOVELACE;
}

/** Two-decimal display amount, e.g. "426.96 ₳". */
export function ada(lovelace, { symbol = true } = {}) {
  const n = toAda(lovelace);
  const s = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${s} ₳` : s;
}

/** Full lovelace precision, e.g. "426.957948 ₳" — used on receipts and ledgers. */
export function adaExact(lovelace, { symbol = true } = {}) {
  const n = toAda(lovelace);
  const s = n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  return symbol ? `${s} ₳` : s;
}

/** Whole ADA, no decimals — for totals in stat tiles. */
export function adaRound(lovelace, { symbol = true } = {}) {
  const s = Math.round(toAda(lovelace)).toLocaleString('en-US');
  return symbol ? `${s} ₳` : s;
}

/** Compact form for large balances, e.g. "2.06M ₳". */
export function adaCompact(lovelace, { symbol = true } = {}) {
  const n = toAda(lovelace);
  let s;
  if (Math.abs(n) >= 1_000_000_000) s = (n / 1_000_000_000).toFixed(2) + 'B';
  else if (Math.abs(n) >= 1_000_000) s = (n / 1_000_000).toFixed(2) + 'M';
  else if (Math.abs(n) >= 1_000) s = (n / 1_000).toFixed(1) + 'K';
  else s = n.toFixed(0);
  return symbol ? `${s} ₳` : s;
}

export function formatInt(n) {
  return (Number(n) || 0).toLocaleString('en-US');
}

export function formatPct(n, decimals = 1) {
  return `${(Number(n) || 0).toFixed(decimals)}%`;
}

// ─── Identifiers ──────────────────────────────────────────────────────────────
export function shortId(value, head = 12, tail = 6) {
  if (!value) return '—';
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function truncateAddress(addr, start = 10, end = 6) {
  return shortId(addr, start, end);
}

export function randomHex(length = 64) {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

export function isValidPaymentAddress(value) {
  const v = (value || '').trim();
  return /^addr1[02-9ac-hj-np-z]{50,}$/.test(v);
}

export function isStakeAddress(value) {
  return /^stake1[02-9ac-hj-np-z]{40,}$/.test((value || '').trim());
}

// ─── Dates ────────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parse(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = parse(value);
  if (!d) return '—';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateTime(value) {
  const d = parse(value);
  if (!d) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(d)}, ${hh}:${mm} UTC`;
}

export function relativeTime(value, now = Date.now()) {
  const d = parse(value);
  if (!d) return '—';
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  const min = 60_000, hour = 3_600_000, day = 86_400_000;

  let text;
  if (abs < 45_000) text = 'moments';
  else if (abs < hour) text = `${Math.round(abs / min)} min`;
  else if (abs < day) {
    const h = Math.floor(abs / hour);
    text = `${h} hour${h === 1 ? '' : 's'}`;
  } else {
    const dd = Math.floor(abs / day);
    text = `${dd} day${dd === 1 ? '' : 's'}`;
  }
  return diff < 0 ? `${text} ago` : `in ${text}`;
}

/** Breaks a duration into a countdown, clamped at zero. */
export function countdownParts(target, now = Date.now()) {
  const d = parse(target);
  const ms = d ? Math.max(0, d.getTime() - now) : 0;
  return {
    expired: ms <= 0,
    totalMs: ms,
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

export function formatCountdown(target, { withSeconds = false, now = Date.now() } = {}) {
  const c = countdownParts(target, now);
  if (c.expired) return 'expired';
  if (c.days > 0) return `${c.days}d ${c.hours}h`;
  if (c.hours > 0) return withSeconds ? `${c.hours}h ${c.minutes}m ${c.seconds}s` : `${c.hours}h ${c.minutes}m`;
  return withSeconds ? `${c.minutes}m ${c.seconds}s` : `${c.minutes}m`;
}

/** Fraction of an epoch elapsed, 0–1, for the progress ring in the header. */
export function progressBetween(startIso, endIso, now = Date.now()) {
  const s = parse(startIso), e = parse(endIso);
  if (!s || !e || e <= s) return 0;
  return Math.min(1, Math.max(0, (now - s.getTime()) / (e.getTime() - s.getTime())));
}

// ─── Chain explorer links ─────────────────────────────────────────────────────
const EXPLORER = 'https://cardanoscan.io';
export const explorer = {
  tx:        h => `${EXPLORER}/transaction/${h}`,
  block:     h => `${EXPLORER}/block/${h}`,
  address:   a => `${EXPLORER}/address/${a}`,
  stakeKey:  a => `${EXPLORER}/stakekey/${a}`,
  drep:      d => `${EXPLORER}/drep/${d}`,
  govAction: g => `${EXPLORER}/govAction/${g}`,
  pool:      p => `${EXPLORER}/pool/${p}`,
};

// ─── DOM helpers ──────────────────────────────────────────────────────────────
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Renders a monospace identifier with a click-to-copy affordance. */
export function copyable(value, { display = null, className = '', title = 'Copy' } = {}) {
  if (!value) return '<span class="text-slate-400">—</span>';
  const shown = display || value;
  return `<button type="button" class="copy-chip ${className}" data-copy="${escapeHtml(value)}" title="${escapeHtml(title)}">
    <span class="addr-chip">${escapeHtml(shown)}</span>
    <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  </button>`;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context; fall back to a hidden textarea.
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(headers, rows) {
  const cell = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\n');
}

// ─── Data loading ─────────────────────────────────────────────────────────────
export async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} — HTTP ${res.status}`);
  return res.json();
}
