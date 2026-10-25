'use strict';

/**
 * TikTok görsel motoru — mobil uygulamanın koyu teması.
 * API: renderProfile / renderFyp / renderVideoCard
 */

const { milestoneText } = require('../../utils');
const engine = require('../../render/engine');
const C = require('../../render/common');

const { escHtml, icon, playIcon, avatar, verifiedRound, artCard, fmtK, richText } = C;

const RED = '#fe2c55';
const CYAN = '#25f4ee';

const CSS =
  '#root{background:#000;color:#fff;position:relative;overflow:hidden}' +
  '.m{color:rgba(255,255,255,.58)}' +
  '.shadow{text-shadow:0 1px 4px rgba(0,0,0,.55)}' +
  '@keyframes x{from{}to{}}';

function count(v) {
  return Array.isArray(v) ? v.length : Number(v) || 0;
}

/* ------------------------------------------------------------ profil */

function buildProfileHtml(d) {
  const name = d.displayName || d.username;
  const miles = (milestoneText(d.followers).split(' \u2022 ').pop()) || '';
  const videos = d.videos || [];
  const tiles = [];
  const total = Math.max(3, Math.ceil(Math.min(videos.length, 9) / 3) * 3);
  for (let i = 0; i < total; i++) {
    const v = videos[i];
    let inner;
    if (v && v.image) inner = '<img src="' + v.image + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">';
    else if (v) inner = artCard(d.username + i + (v.caption || ''), v.caption || '', { fontSize: 12, pad: 10, clamp: 5, iconSize: 28 });
    else inner = '<div style="position:absolute;inset:0;background:#0d0d0d"></div>';
    const pinned = i === 0 && v
      ? '<div style="position:absolute;top:6px;left:6px;background:' + RED + ';font-size:10.5px;font-weight:700;padding:2px 6px;border-radius:3px;z-index:3">Sabitlendi</div>'
      : '';
    const views = v
      ? '<div class="shadow" style="position:absolute;left:7px;bottom:6px;display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600;z-index:3">' + playIcon(12) + escHtml(fmtK(v.views || 0)) + '</div>' +
        '<div style="position:absolute;left:0;right:0;bottom:0;height:46px;background:linear-gradient(0deg,rgba(0,0,0,.5),transparent);z-index:2"></div>'
      : '';
    tiles.push('<div style="position:relative;aspect-ratio:3/4.1;overflow:hidden;background:#0d0d0d">' + inner + pinned + views + '</div>');
  }
  const stat = (v, l) =>
    '<div style="text-align:center;min-width:78px"><div style="font-size:18px;font-weight:700">' + escHtml(fmtK(v)) + '</div><div class="m" style="font-size:13px;margin-top:2px">' + l + '</div></div>';

  return (
    '<div id="root" style="width:430px">' +
    '<div style="height:50px;display:flex;align-items:center;padding:0 16px">' + icon('userPlus', { size: 22, sw: 1.9 }) +
    '<div style="flex:1;text-align:center;font-size:17px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px">' + escHtml(name) + (d.verified ? verifiedRound(16) : '') + icon('chevronDown', { size: 15, sw: 2.6 }) + '</div>' +
    icon('more', { size: 22 }) + '</div>' +
    '<div style="display:flex;flex-direction:column;align-items:center;padding:6px 20px 0">' +
    avatar(d.avatar, d.letter, name, 96) +
    '<div style="margin-top:12px;font-size:17px;font-weight:700;display:flex;align-items:center;gap:5px">@' + escHtml(d.username) + '</div>' +
    '<div style="display:flex;gap:10px;margin-top:16px">' + stat(d.following, 'Takip edilen') + stat(d.followers, 'Takipçi') + stat(d.likesTotal, 'Beğeni') + '</div>' +
    '<div style="display:flex;gap:6px;margin-top:16px;width:100%;justify-content:center">' +
    '<div style="background:' + RED + ';font-weight:700;font-size:15px;height:44px;flex:0 0 190px;border-radius:5px;display:flex;align-items:center;justify-content:center">Takip et</div>' +
    '<div style="background:#2a2a2d;font-weight:700;font-size:15px;height:44px;flex:0 0 100px;border-radius:5px;display:flex;align-items:center;justify-content:center">Mesaj</div>' +
    '<div style="background:#2a2a2d;height:44px;width:44px;border-radius:5px;display:flex;align-items:center;justify-content:center">' + icon('chevronDown', { size: 18, sw: 2.4 }) + '</div></div>' +
    '<div style="margin-top:14px;font-size:14.5px;line-height:1.4;text-align:center;white-space:pre-wrap;word-break:break-word;max-width:360px">' + richText(d.bio || 'Henüz bio yok.', '#fff') + '</div>' +
    (miles
      ? '<div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#ffd166;background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.3);padding:4px 11px;border-radius:999px">' + icon('star', { size: 12, color: '#ffd166', fill: true, sw: 1 }) + escHtml(miles) + '</div>'
      : '') +
    '</div>' +
    '<div style="display:flex;margin-top:16px;border-bottom:1px solid #1f1f22">' +
    '<div style="flex:1;display:flex;justify-content:center;padding:12px 0;border-bottom:2px solid #fff">' + icon('grid', { size: 22, sw: 2.2 }) + '</div>' +
    '<div style="flex:1;display:flex;justify-content:center;padding:12px 0;color:#6b6b6f">' + icon('lock', { size: 21 }) + '</div>' +
    '<div style="flex:1;display:flex;justify-content:center;padding:12px 0;color:#6b6b6f">' + icon('heart', { size: 21 }) + '</div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1.5px;padding-top:1.5px">' + tiles.join('') + '</div></div>'
  );
}

/* ----------------------------------------------------- video yüzeyi */

function rail(v, size) {
  const s = size || 1;
  const item = (ico, n, fill, color) =>
    '<div style="display:flex;flex-direction:column;align-items:center;gap:' + 3 * s + 'px">' +
    icon(ico, { size: 30 * s, color: color || '#fff', fill: !!fill, sw: fill ? 1 : 1.9, style: 'filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))' }) +
    '<span class="shadow" style="font-size:' + 12 * s + 'px;font-weight:600">' + escHtml(n) + '</span></div>';
  const name = v.displayName || v.username;
  return (
    '<div style="position:absolute;right:' + 9 * s + 'px;bottom:' + 78 * s + 'px;display:flex;flex-direction:column;align-items:center;gap:' + 17 * s + 'px;z-index:6">' +
    '<div style="position:relative;margin-bottom:' + 6 * s + 'px">' + avatar(v.avatar, v.letter, name, 46 * s, 'border:1.5px solid #fff') +
    '<div style="position:absolute;left:50%;bottom:' + -9 * s + 'px;margin-left:' + -10 * s + 'px;width:' + 20 * s + 'px;height:' + 20 * s + 'px;border-radius:50%;background:' + RED + ';display:flex;align-items:center;justify-content:center">' + icon('plus', { size: 13 * s, color: '#fff', sw: 3.2 }) + '</div></div>' +
    item('heart', fmtK(v.likes), true, '#fff') + item('comment', fmtK(v.comments), true, '#fff') +
    item('bookmark', fmtK(v.saves !== undefined ? v.saves : Math.round(count(v.likes) * 0.12)), true, '#fff') +
    item('share', fmtK(v.shares !== undefined ? v.shares : Math.round(count(v.likes) * 0.07)), false, '#fff') +
    '<div style="width:' + 40 * s + 'px;height:' + 40 * s + 'px;border-radius:50%;background:radial-gradient(circle,#333 30%,#111 31%,#111 60%,#222 61%);border:' + 5 * s + 'px solid #1b1b1d;display:flex;align-items:center;justify-content:center;margin-top:' + 2 * s + 'px">' +
    '<div style="width:' + 18 * s + 'px;height:' + 18 * s + 'px;border-radius:50%;overflow:hidden">' + avatar(v.avatar, v.letter, name, 18 * s) + '</div></div></div>'
  );
}

function captionBlock(v, s) {
  const sc = s || 1;
  return (
    '<div style="position:absolute;left:' + 12 * sc + 'px;right:' + 76 * sc + 'px;bottom:' + 18 * sc + 'px;z-index:6">' +
    '<div class="shadow" style="font-size:' + 16 * sc + 'px;font-weight:700;display:flex;align-items:center;gap:5px">@' + escHtml(v.username) + (v.verified ? verifiedRound(15 * sc) : '') + '</div>' +
    '<div class="shadow" style="font-size:' + 14 * sc + 'px;line-height:1.35;margin-top:' + 6 * sc + 'px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word">' +
    richText(v.caption || '', '#fff') + '</div>' +
    '<div class="shadow" style="margin-top:' + 9 * sc + 'px;display:flex;align-items:center;gap:6px;font-size:' + 13 * sc + 'px;white-space:nowrap;overflow:hidden">' +
    icon('music', { size: 14 * sc, color: '#fff', sw: 2.2 }) + '<span style="overflow:hidden;text-overflow:ellipsis">' + escHtml(v.sound || 'Golazo Original Sound') + '</span></div></div>'
  );
}

function videoSurface(v, w, h, s, extra) {
  const bg = v.image
    ? '<img src="' + v.image + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">'
    : artCard(v.username + (v.caption || ''), '', { iconSize: 0 });
  return (
    '<div style="position:relative;width:' + w + 'px;height:' + h + 'px;overflow:hidden;background:#000;' + (extra || '') + '">' + bg +
    '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.4) 0%,transparent 20%,transparent 55%,rgba(0,0,0,.72) 100%);z-index:3"></div>' +
    rail(v, s) + captionBlock(v, s) + '</div>'
  );
}

function topTabs(s) {
  const sc = s || 1;
  return (
    '<div style="position:absolute;left:0;right:0;top:' + 14 * sc + 'px;display:flex;justify-content:center;gap:' + 18 * sc + 'px;z-index:7;font-size:' + 16 * sc + 'px;font-weight:700" class="shadow">' +
    '<span class="m">Takip edilen</span><span style="position:relative">Senin için<i style="position:absolute;left:25%;right:25%;bottom:' + -6 * sc + 'px;height:' + 2.5 * sc + 'px;background:#fff;border-radius:2px"></i></span></div>' +
    '<div style="position:absolute;right:' + 14 * sc + 'px;top:' + 13 * sc + 'px;z-index:7">' + icon('search', { size: 24 * sc, color: '#fff', sw: 2.2 }) + '</div>'
  );
}

function bottomNav() {
  const it = (ico, label, on) =>
    '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;font-weight:' + (on ? 700 : 500) + ';color:' + (on ? '#fff' : 'rgba(255,255,255,.6)') + '">' + icon(ico, { size: 22, fill: on && ico === 'home', sw: 1.9 }) + label + '</div>';
  return (
    '<div style="height:56px;background:#000;display:flex;align-items:center;justify-content:space-around;padding:0 6px">' +
    it('home', 'Ana sayfa', true) + it('users', 'Arkadaşlar') +
    '<div style="width:46px;height:30px;border-radius:9px;background:' + CYAN + ';position:relative"><div style="position:absolute;inset:0;left:4px;right:-4px;border-radius:9px;background:' + RED + ';z-index:1;transform:translateX(-4px)"></div><div style="position:absolute;inset:0;background:#fff;border-radius:8px;z-index:2;display:flex;align-items:center;justify-content:center">' + icon('plus', { size: 20, color: '#000', sw: 3 }) + '</div></div>' +
    it('inbox', 'Gelen kutusu') + it('user', 'Profil') + '</div>'
  );
}

/* ---------------------------------------------------------- video kartı */

function buildVideoHtml(v) {
  const W = 360;
  const H = 640;
  return (
    '<div id="root" style="width:' + W + 'px;border-radius:0">' +
    '<div style="position:relative;height:' + H + 'px">' + videoSurface(v, W, H, 1) + topTabs(1) +
    '<div style="position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.25);z-index:8"><div style="width:38%;height:100%;background:#fff"></div></div></div>' +
    bottomNav() + '</div>'
  );
}

/* ----------------------------------------------------------------- FYP */

function buildFypHtml(items) {
  const W = 250;
  const H = 444;
  const s = 0.74;
  const cards = items.map((v, i) =>
    '<div style="position:relative;border-radius:16px;overflow:hidden;border:1px solid #232326">' + videoSurface(v, W, H, s) +
    '<div style="position:absolute;left:10px;top:10px;z-index:8;display:flex;align-items:center;gap:5px;background:rgba(0,0,0,.55);border:1px solid ' + (i < 3 ? RED : 'rgba(255,255,255,.25)') + ';padding:4px 9px;border-radius:999px;font-size:12px;font-weight:800">' +
    (i < 3 ? icon('flame', { size: 13, color: '#ff7a45', fill: true, sw: 1.2 }) : '') + '#' + (i + 1) + (i < 3 ? ' Trend' : '') + '</div>' +
    '<div style="position:absolute;right:10px;top:10px;z-index:8;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700" class="shadow">' + playIcon(11) + escHtml(fmtK(v.views)) + '</div></div>'
  ).join('');
  return (
    '<div id="root" style="width:' + (W * 3 + 14 * 4) + 'px;padding:14px;background:#000">' +
    '<div style="display:flex;align-items:center;justify-content:center;gap:22px;height:46px;font-size:17px;font-weight:700;position:relative;margin-bottom:6px">' +
    '<span class="m">Takip edilen</span><span style="position:relative">Senin için<i style="position:absolute;left:20%;right:20%;bottom:-8px;height:3px;background:#fff;border-radius:2px"></i></span>' +
    '<div style="position:absolute;right:6px;top:11px">' + icon('search', { size: 24, sw: 2.2 }) + '</div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,' + W + 'px);gap:14px;justify-content:center;margin-top:8px">' + (cards ||
      '<div class="m" style="grid-column:1/-1;text-align:center;padding:60px 0;font-size:16px">Henüz video yok, ilk trendi sen başlat!</div>') + '</div></div>'
  );
}

/* --------------------------------------------------------- hazırlık */

async function prep(o) {
  return Object.assign({}, o, { avatar: await engine.toDataUri(o.avatar), image: await engine.toDataUri(o.image || o.mediaUrl) });
}

async function renderProfile(data) {
  const base = Object.assign({}, data, { avatar: await engine.toDataUri(data.avatar) });
  base.videos = await Promise.all((data.videos || []).slice(0, 9).map(async (v) => Object.assign({}, v, { image: await engine.toDataUri(v.image || v.mediaUrl) })));
  return engine.renderHtml({ body: buildProfileHtml(base), css: CSS, width: 430, height: 900 });
}

async function renderFyp(items) {
  const list = (Array.isArray(items) ? items : []).slice(0, 6);
  const ready = await Promise.all(list.map(prep));
  return engine.renderHtml({ body: buildFypHtml(ready), css: CSS, width: 810, height: 900 });
}

async function renderVideoCard(data) {
  const ready = await prep(data);
  return engine.renderHtml({ body: buildVideoHtml(ready), css: CSS, width: 360, height: 700 });
}

async function safeImage(url) {
  return engine.toDataUri(url);
}

module.exports = {
  renderProfile,
  renderFyp,
  renderVideoCard,
  getBrowser: engine.getBrowser,
  closeBrowser: engine.closeBrowser,
  safeImage
};
