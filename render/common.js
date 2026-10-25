'use strict';

const { escHtml } = require('../utils');

/* ------------------------------------------------------------ sayılar */

function groupDots(n) {
  return String(Math.max(0, Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function trNum(x) {
  const s = x.toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s).replace('.', ',');
}

/** 1.234 • 12,5 B • 3,4 Mn  (Türkçe platform biçimi) */
function fmt(n, full) {
  const num = Math.max(0, Number(n) || 0);
  if (full && num < 1e6) return groupDots(num);
  if (num >= 1e9) return trNum(num / 1e9) + ' Mr';
  if (num >= 1e6) return trNum(num / 1e6) + ' Mn';
  if (num >= 1e4) return trNum(num / 1e3) + ' B';
  return groupDots(num);
}

/** Kompakt (TikTok tarzı): 1,2K  3,4M */
function fmtK(n) {
  const num = Math.max(0, Number(n) || 0);
  if (num >= 1e9) return trNum(num / 1e9) + 'B';
  if (num >= 1e6) return trNum(num / 1e6) + 'M';
  if (num >= 1e3) return trNum(num / 1e3) + 'K';
  return String(Math.round(num));
}

/* ------------------------------------------------------------- rastgele */

function hashStr(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hueOf(seed) {
  return hashStr(seed) % 360;
}

/* --------------------------------------------------------------- ikonlar */

const PATHS = {
  heart:
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  comment:
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  repeat:
    '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  share:
    '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  chart: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  plusSquare: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 9h18"/><path d="M9 3l3 6"/><path d="M15 3l3 6"/><path d="M10 13.5l5 2.5-5 2.5z"/>',
  userSquare: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="10" r="3"/><path d="M6.2 19.5a6 6 0 0 1 11.6 0"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-3.99 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 7 3 3v2H7v-2l3-3z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="M12 7l4.5 3.3-1.7 5.3H9.2l-1.7-5.3z"/><path d="M12 2v5"/><path d="M16.5 10.3l5-1.6"/><path d="M14.8 15.6l3.1 4.1"/><path d="M9.2 15.6l-3.1 4.1"/><path d="M7.5 10.3l-5-1.6"/>'
};

/**
 * ikon(name, {size, color, fill, sw})
 * fill: true -> içi dolu (kalp / yer imi aktif durumu)
 */
function icon(name, opts) {
  const o = opts || {};
  const size = o.size || 24;
  const color = o.color || 'currentColor';
  const fill = o.fill ? color : 'none';
  const sw = o.sw || 2;
  const inner = PATHS[name] || '';
  const st = o.style ? ' style="' + o.style + '"' : '';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 24 24" fill="' + fill + '" stroke="' + color + '" stroke-width="' + sw +
    '" stroke-linecap="round" stroke-linejoin="round"' + st + '>' + inner + '</svg>'
  );
}

/** Dolu oynat üçgeni */
function playIcon(size, color) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + (size || 14) + '" height="' + (size || 14) +
    '" viewBox="0 0 24 24" fill="' + (color || '#fff') + '"><path d="M6 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 6 3.5z"/></svg>'
  );
}

/* ------------------------------------------------------- onay rozeti */

let badgePathCache = null;
function scallopPath() {
  if (badgePathCache) return badgePathCache;
  const lobes = 8;
  const pts = [];
  const steps = 96;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 10.2 + 1.55 * Math.cos(t * lobes);
    pts.push((12 + r * Math.sin(t)).toFixed(2) + ' ' + (12 - r * Math.cos(t)).toFixed(2));
  }
  badgePathCache = 'M' + pts.join('L') + 'Z';
  return badgePathCache;
}

/** Tırtıklı onay rozeti (Instagram / X tarzı) */
function verifiedBadge(size, color, ring) {
  const s = size || 18;
  const c = color || '#1d9bf0';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s +
    '" viewBox="0 0 24 24" style="flex:0 0 auto"><path d="' + scallopPath() + '" fill="' + c + '"' +
    (ring ? ' stroke="' + ring + '" stroke-width="0.6"' : '') +
    '/><path d="M7.4 12.4l3 3 6.2-6.4" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  );
}

/** TikTok tarzı yuvarlak onay */
function verifiedRound(size, color) {
  const s = size || 16;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s +
    '" viewBox="0 0 24 24" style="flex:0 0 auto"><circle cx="12" cy="12" r="11" fill="' + (color || '#20d5ec') +
    '"/><path d="M7.2 12.4l3.2 3.1 6.4-6.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  );
}

/* ----------------------------------------------------------- avatar */

function initialOf(letter, name) {
  const raw = letter || (name ? String(name).trim().charAt(0) : '') || 'G';
  return raw.toLocaleUpperCase('tr-TR');
}

/**
 * Daire avatar. img = data-URI veya ''. Yoksa isimden üretilmiş renkli yedek.
 */
function avatar(img, letter, name, size, extraStyle) {
  const h = hueOf(name || letter);
  const bg = 'linear-gradient(135deg,hsl(' + h + ',68%,52%),hsl(' + ((h + 40) % 360) + ',70%,38%))';
  const base =
    'width:' + size + 'px;height:' + size + 'px;border-radius:50%;overflow:hidden;position:relative;flex:0 0 auto;' +
    (extraStyle ? extraStyle.replace(/;?$/, ';') : '');
  if (img) {
    return '<div style="' + base + 'background:#222"><img src="' + img + '" style="width:100%;height:100%;object-fit:cover;display:block"></div>';
  }
  return (
    '<div style="' + base + 'background:' + bg + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:' +
    Math.round(size * 0.42) + 'px;text-shadow:0 1px 3px rgba(0,0,0,.3)">' + escHtml(initialOf(letter, name)) + '</div>'
  );
}

/* --------------------------------------------- futbol temalı yedek görsel */

function pitchLines(color, op) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" ' +
    'style="position:absolute;inset:0;width:100%;height:100%" fill="none" stroke="' + color + '" stroke-opacity="' + op + '" stroke-width="2">' +
    '<rect x="14" y="14" width="272" height="372" rx="4"/><path d="M14 200h272"/><circle cx="150" cy="200" r="42"/><circle cx="150" cy="200" r="3" fill="' + color + '"/>' +
    '<rect x="75" y="14" width="150" height="62"/><rect x="75" y="324" width="150" height="62"/>' +
    '<rect x="112" y="14" width="76" height="26"/><rect x="112" y="360" width="76" height="26"/>' +
    '<path d="M110 76a42 42 0 0 0 80 0"/><path d="M110 324a42 42 0 0 1 80 0"/></svg>'
  );
}

/**
 * Görseli olmayan gönderiler için "yazı kartı". Gradient + saha çizgileri + metin.
 */
function artCard(seed, text, opts) {
  const o = opts || {};
  const h = hueOf(seed);
  const h2 = (h + 52) % 360;
  const size = o.fontSize || 22;
  const lines = text
    ? '<div style="position:relative;z-index:2;padding:' + (o.pad || 18) + 'px;font-weight:800;line-height:1.25;font-size:' + size +
      'px;color:#fff;text-align:center;text-shadow:0 2px 14px rgba(0,0,0,.35);word-break:break-word;display:-webkit-box;-webkit-line-clamp:' +
      (o.clamp || 5) + ';-webkit-box-orient:vertical;overflow:hidden">' + escHtml(text) + '</div>'
    : '<div style="position:relative;z-index:2;opacity:.9">' + icon('ball', { size: o.iconSize || 44, color: '#fff', sw: 1.6 }) + '</div>';
  return (
    '<div style="position:absolute;inset:0;background:linear-gradient(160deg,hsl(' + h + ',70%,38%),hsl(' + h2 + ',72%,20%));display:flex;align-items:center;justify-content:center;overflow:hidden">' +
    '<div style="position:absolute;width:140%;height:140%;left:-20%;top:-40%;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.22),transparent 55%)"></div>' +
    pitchLines('#ffffff', 0.18) + lines + '</div>'
  );
}

/* --------------------------------------------------------- zengin metin */

/** #etiket @bahsetme ve bağlantıları renklendirir. */
function richText(text, color) {
  const safe = escHtml(text);
  return safe.replace(/(^|[\s(])([#@][\p{L}\p{N}_]+|https?:\/\/[^\s<]+)/gu, (m, pre, tag) => {
    return pre + '<span style="color:' + color + '">' + tag + '</span>';
  });
}

function bannerPattern(seedHue) {
  return (
    '<div style="position:absolute;inset:0;background:linear-gradient(120deg,hsl(' + seedHue + ',78%,32%) 0%,hsl(' + ((seedHue + 35) % 360) + ',80%,20%) 55%,#070b14 100%)"></div>' +
    '<div style="position:absolute;inset:0;opacity:.55">' + pitchLines('#ffffff', 0.22).replace('xMidYMid slice', 'xMidYMid slice') + '</div>' +
    '<div style="position:absolute;inset:0;background:radial-gradient(circle at 85% 20%,rgba(255,255,255,.22),transparent 45%)"></div>'
  );
}

function formatDateTr(ts) {
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const d = new Date(Number(ts) || Date.now());
  return months[d.getMonth()] + ' ' + d.getFullYear();
}

function formatFullTr(ts) {
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const d = new Date(Number(ts) || Date.now());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return hh + ':' + mm + ' · ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

module.exports = {
  escHtml,
  fmt,
  fmtK,
  groupDots,
  hashStr,
  hueOf,
  icon,
  playIcon,
  verifiedBadge,
  verifiedRound,
  avatar,
  initialOf,
  artCard,
  pitchLines,
  richText,
  bannerPattern,
  formatDateTr,
  formatFullTr
};
