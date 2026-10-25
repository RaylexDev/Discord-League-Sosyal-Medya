'use strict';

/**
 * Instagram görsel motoru — mobil uygulamanın koyu temasını birebir hedefler.
 * Dışa açılan API eski sürümle aynı: renderProfile / renderFeed (+ renderPostCard, renderStory)
 */

const { milestoneText } = require('../../utils');
const engine = require('../../render/engine');
const C = require('../../render/common');

const { escHtml, icon, avatar, verifiedBadge, artCard, fmt, richText } = C;

const RING = 'conic-gradient(from 210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)';

const CSS =
  '#root{background:#000;color:#f5f5f5;width:100%;position:relative;overflow:hidden}' +
  '.gray{color:#a8a8a8}' +
  '.ring{border-radius:50%;padding:3px;background:' + RING + ';display:inline-flex;flex:0 0 auto}' +
  '.ring.off{background:#363636}' +
  '.ring .gap{border-radius:50%;padding:2.5px;background:#000;display:flex}' +
  '.btn{border-radius:10px;font-weight:600;font-size:14px;height:34px;display:flex;align-items:center;justify-content:center}' +
  '.blue{background:#0095f6;color:#fff}.dark{background:#363636;color:#f5f5f5}' +
  '.topbar{height:52px;display:flex;align-items:center;padding:0 16px;gap:12px}' +
  '.wordmark{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-weight:700;font-size:27px;letter-spacing:-.5px}' +
  '.nav{height:54px;border-top:1px solid #262626;display:flex;align-items:center;justify-content:space-around;background:#000}';

function topMilestone(n) {
  const all = milestoneText(n);
  if (!all) return '';
  const parts = all.split(' \u2022 ');
  return parts[parts.length - 1];
}

function count(v) {
  if (Array.isArray(v)) return v.length;
  return Number(v) || 0;
}

function logoMark() {
  return '<div class="wordmark">Golazo</div>';
}

/* ------------------------------------------------------------ profil */

function highlightCircle(label, hue, ico) {
  return (
    '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:70px">' +
    '<div style="width:62px;height:62px;border-radius:50%;border:1.5px solid #363636;padding:3px"><div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(145deg,hsl(' + hue + ',65%,40%),hsl(' + ((hue + 40) % 360) + ',70%,22%));display:flex;align-items:center;justify-content:center">' +
    icon(ico, { size: 24, color: '#fff', sw: 1.7 }) + '</div></div>' +
    '<span style="font-size:12px;color:#f5f5f5;white-space:nowrap">' + escHtml(label) + '</span></div>'
  );
}

function buildProfileHtml(d) {
  const name = d.displayName || d.username;
  const miles = topMilestone(d.followers);
  const hue = C.hueOf(d.username);
  const posts = d.posts || [];

  const tiles = [];
  const total = Math.max(3, Math.ceil(Math.min(posts.length, 9) / 3) * 3);
  for (let i = 0; i < total; i++) {
    const p = posts[i];
    let inner;
    if (p && p.image) {
      inner = '<img src="' + p.image + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">';
    } else if (p) {
      inner = artCard(p.id || d.username + i, p.text || '', { fontSize: 13, pad: 10, clamp: 5, iconSize: 28 });
    } else {
      inner = '<div style="position:absolute;inset:0;background:#0f0f0f"></div>';
    }
    const pin = i === 0 && p ? '<div style="position:absolute;top:7px;right:7px;z-index:3">' + icon('pin', { size: 17, color: '#fff', fill: true, sw: 1.6, style: 'filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))' }) + '</div>' : '';
    tiles.push('<div style="position:relative;aspect-ratio:3/4;overflow:hidden;background:#0f0f0f">' + inner + pin + '</div>');
  }

  const stat = (v, l) =>
    '<div style="text-align:center"><div style="font-size:17px;font-weight:700">' + escHtml(fmt(v)) + '</div><div style="font-size:13px;margin-top:1px">' + l + '</div></div>';

  return (
    '<div id="root" style="width:480px">' +
    '<div class="topbar"><div style="display:flex;align-items:center;gap:6px;font-size:20px;font-weight:700">' +
    icon('lock', { size: 16, sw: 2.2 }) + escHtml(d.username) + (d.verified ? verifiedBadge(17, '#0095f6') : '') +
    icon('chevronDown', { size: 16, sw: 2.6 }) +
    '</div><div style="flex:1"></div>' + icon('plusSquare', { size: 25, sw: 1.9 }) +
    '<div style="width:22px;display:flex;flex-direction:column;gap:4.5px;padding:3px 0"><i style="height:2px;background:#f5f5f5;border-radius:2px"></i><i style="height:2px;background:#f5f5f5;border-radius:2px"></i><i style="height:2px;background:#f5f5f5;border-radius:2px;width:70%"></i></div></div>' +
    '<div style="padding:6px 16px 0;display:flex;align-items:center;gap:26px">' +
    '<div class="ring"><div class="gap">' + avatar(d.avatar, d.letter, name, 78) + '</div></div>' +
    '<div style="flex:1;display:flex;justify-content:space-between;padding-right:6px">' +
    stat(d.postsCount, 'gönderi') + stat(d.followers, 'takipçi') + stat(d.following, 'takip') + '</div></div>' +
    '<div style="padding:12px 16px 0">' +
    '<div style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:5px">' + escHtml(name) + '</div>' +
    '<div class="gray" style="font-size:13.5px;margin-top:1px">Futbolcu · Golazo League</div>' +
    '<div style="font-size:14px;line-height:1.38;margin-top:3px;white-space:pre-wrap;word-break:break-word">' +
    richText(d.bio || 'Henüz biyografi yok.', '#e0f1ff') + '</div>' +
    (miles
      ? '<div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#feda75;background:rgba(254,218,117,.1);border:1px solid rgba(254,218,117,.28);padding:4px 10px;border-radius:999px">' +
        icon('star', { size: 13, color: '#feda75', fill: true, sw: 1 }) + escHtml(miles) + '</div>'
      : '') +
    '</div>' +
    '<div style="display:flex;gap:6px;padding:14px 16px 0">' +
    '<div class="btn blue" style="flex:1.25">Takip Et</div><div class="btn dark" style="flex:1">Mesaj</div>' +
    '<div class="btn dark" style="width:38px">' + icon('userPlus', { size: 17, sw: 2 }) + '</div></div>' +
    '<div style="display:flex;gap:14px;padding:16px 16px 14px;overflow:hidden">' +
    highlightCircle('Maçlar', hue, 'ball') + highlightCircle('Kupa', (hue + 60) % 360, 'star') +
    highlightCircle('Tribün', (hue + 140) % 360, 'users') + highlightCircle('Antrenman', (hue + 220) % 360, 'flame') +
    '</div>' +
    '<div style="display:flex;border-top:1px solid #262626">' +
    '<div style="flex:1;display:flex;justify-content:center;padding:11px 0;border-bottom:1.5px solid #f5f5f5">' + icon('grid', { size: 23, sw: 2 }) + '</div>' +
    '<div style="flex:1;display:flex;justify-content:center;padding:11px 0;color:#737373">' + icon('film', { size: 23, sw: 1.8 }) + '</div>' +
    '<div style="flex:1;display:flex;justify-content:center;padding:11px 0;color:#737373">' + icon('userSquare', { size: 23, sw: 1.8 }) + '</div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1.5px;padding-top:1.5px">' + tiles.join('') + '</div>' +
    '<div class="nav">' + icon('home', { size: 25, fill: true }) + icon('search', { size: 25 }) + icon('plusSquare', { size: 25 }) + icon('film', { size: 25 }) +
    '<div style="width:26px;height:26px;border-radius:50%;border:1.5px solid #f5f5f5;padding:1.5px">' + avatar(d.avatar, d.letter, name, 20) + '</div></div>' +
    '</div>'
  );
}

/* ------------------------------------------------------- gönderi kartı */

function postBlock(item, opts) {
  const o = opts || {};
  const name = item.displayName || item.username;
  const likes = count(item.likes);
  const comments = count(item.comments);
  const media = item.image
    ? '<img src="' + item.image + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">'
    : artCard(item.id || item.username + item.text, item.text, { fontSize: 26, pad: 34, clamp: 7 });
  const showCaption = !!item.image && item.text;

  const commentLines = (o.comments || [])
    .slice(0, 3)
    .map(
      (c) =>
        '<div style="font-size:14px;line-height:1.35;margin-top:3px"><b>' + escHtml(c.username || 'golazo') + '</b> ' +
        escHtml(String(c.text || '').slice(0, 140)) + '</div>'
    )
    .join('');

  return (
    '<div style="padding-bottom:4px">' +
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px">' +
    '<div class="ring" style="padding:2px"><div class="gap" style="padding:2px">' + avatar(item.avatar, item.letter, name, 30) + '</div></div>' +
    '<div style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:5px">' + escHtml(item.username) +
    (item.verified ? verifiedBadge(14, '#0095f6') : '') +
    '<span class="gray" style="font-weight:400">· ' + escHtml(String(item.time || '').replace(' önce', '')) + '</span></div>' +
    '<div style="flex:1"></div>' + icon('more', { size: 20, sw: 2 }) + '</div>' +
    '<div style="position:relative;width:100%;aspect-ratio:' + (o.ratio || '1/1') + ';overflow:hidden;background:#101010">' + media + '</div>' +
    '<div style="display:flex;align-items:center;gap:16px;padding:11px 12px 6px">' +
    icon('heart', { size: 25, sw: 1.9, color: o.liked ? '#ff3040' : '#f5f5f5', fill: !!o.liked }) +
    '<div style="display:flex;align-items:center;gap:6px">' + icon('comment', { size: 24, sw: 1.9, style: 'transform:scaleX(-1)' }) + '</div>' +
    icon('send', { size: 24, sw: 1.9 }) + '<div style="flex:1"></div>' +
    icon('bookmark', { size: 24, sw: 1.9 }) + '</div>' +
    '<div style="padding:0 12px;font-size:14px;font-weight:700">' + C.groupDots(likes) + ' beğenme</div>' +
    (showCaption
      ? '<div style="padding:4px 12px 0;font-size:14px;line-height:1.38;word-break:break-word"><b>' + escHtml(item.username) + '</b> ' +
        richText(String(item.text).slice(0, 220), '#e0f1ff') + '</div>'
      : '') +
    (comments ? '<div class="gray" style="padding:4px 12px 0;font-size:14px">' + C.groupDots(comments) + ' yorumun tümünü gör</div>' : '') +
    (commentLines ? '<div style="padding:0 12px">' + commentLines + '</div>' : '') +
    '<div class="gray" style="padding:5px 12px 8px;font-size:11.5px;letter-spacing:.2px;text-transform:uppercase">' + escHtml(item.time || '') + '</div>' +
    '</div>'
  );
}

function buildFeedHtml(items) {
  const seen = new Set();
  const stories = [];
  for (const it of items) {
    if (seen.has(it.username)) continue;
    seen.add(it.username);
    stories.push(
      '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;width:70px">' +
      '<div class="ring" style="padding:2.5px"><div class="gap" style="padding:2px">' + avatar(it.avatar, it.letter, it.displayName || it.username, 58) + '</div></div>' +
      '<span style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:68px">' + escHtml(it.username) + '</span></div>'
    );
    if (stories.length >= 6) break;
  }
  const cards = items.map((it) => postBlock(it)).join('<div style="height:6px"></div>');
  return (
    '<div id="root" style="width:470px">' +
    '<div class="topbar" style="height:56px">' + logoMark() + '<div style="flex:1"></div>' + icon('heart', { size: 25, sw: 1.9 }) + icon('send', { size: 24, sw: 1.9 }) + '</div>' +
    (stories.length ? '<div style="display:flex;gap:10px;padding:6px 12px 12px;border-bottom:1px solid #262626">' + stories.join('') + '</div>' : '') +
    (cards || '<div class="gray" style="padding:60px 20px;text-align:center;font-size:15px">Akış boş, ilk gönderiyi sen at!</div>') +
    '<div class="nav">' + icon('home', { size: 25, fill: true }) + icon('search', { size: 25 }) + icon('plusSquare', { size: 25 }) + icon('film', { size: 25 }) + icon('user', { size: 25 }) + '</div>' +
    '</div>'
  );
}

function buildPostHtml(item) {
  return (
    '<div id="root" style="width:470px">' +
    '<div style="display:flex;align-items:center;padding:0 14px;height:48px;border-bottom:1px solid #262626;gap:18px">' +
    icon('back', { size: 24, sw: 2 }) + '<div style="font-size:16px;font-weight:700;flex:1;text-align:center;margin-right:42px">Gönderi</div></div>' +
    postBlock(item, { comments: item.commentList, liked: item.liked, ratio: item.image ? '4/5' : '1/1' }) +
    '</div>'
  );
}

/* ------------------------------------------------------------- hikaye */

function buildStoryHtml(d) {
  const name = d.displayName || d.username;
  const bg = d.image
    ? '<img src="' + d.image + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' +
      '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,transparent 22%,transparent 70%,rgba(0,0,0,.55) 100%)"></div>'
    : artCard(d.username + (d.text || ''), '', { iconSize: 0 }) +
      '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 25%,transparent 75%,rgba(0,0,0,.4) 100%)"></div>';
  const text = d.text
    ? '<div style="position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:0 30px;z-index:4"><div style="background:#fff;color:#111;font-weight:800;font-size:25px;line-height:1.25;padding:12px 18px;border-radius:14px;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.35);max-width:100%;word-break:break-word;transform:rotate(-2deg)">' +
      escHtml(String(d.text).slice(0, 140)) + '</div></div>'
    : '';
  return (
    '<div id="root" style="width:360px;height:640px;border-radius:0;position:relative;overflow:hidden;background:#000">' + bg + text +
    '<div style="position:absolute;left:10px;right:10px;top:10px;height:3px;border-radius:3px;background:rgba(255,255,255,.35);z-index:5"><div style="width:42%;height:100%;border-radius:3px;background:#fff"></div></div>' +
    '<div style="position:absolute;left:12px;right:12px;top:24px;display:flex;align-items:center;gap:9px;z-index:5;color:#fff">' +
    avatar(d.avatar, d.letter, name, 34, 'border:1.5px solid rgba(255,255,255,.6)') +
    '<div style="font-size:14px;font-weight:700;display:flex;align-items:center;gap:5px">' + escHtml(d.username) + (d.verified ? verifiedBadge(14, '#0095f6') : '') +
    '<span style="font-weight:400;opacity:.75">' + escHtml(String(d.time || 'şimdi').replace(' önce', '')) + '</span></div><div style="flex:1"></div>' +
    icon('more', { size: 22, color: '#fff' }) + '</div>' +
    '<div style="position:absolute;left:12px;right:12px;bottom:16px;display:flex;align-items:center;gap:14px;z-index:5;color:#fff">' +
    '<div style="flex:1;height:44px;border-radius:999px;border:1.5px solid rgba(255,255,255,.7);display:flex;align-items:center;padding:0 18px;font-size:14px;opacity:.95">' + escHtml(name) + ' kişisine mesaj gönder...</div>' +
    icon('heart', { size: 27, color: '#fff', sw: 1.9 }) + icon('send', { size: 26, color: '#fff', sw: 1.9 }) + '</div></div>'
  );
}

/* --------------------------------------------------------- hazırlık */

async function prepAvatar(o) {
  return Object.assign({}, o, { avatar: await engine.toDataUri(o.avatar) });
}

async function renderProfile(data) {
  const base = await prepAvatar(data);
  const posts = await Promise.all(
    (Array.isArray(data.posts) ? data.posts : []).slice(0, 9).map(async (p) => Object.assign({}, p, { image: await engine.toDataUri(p.image) }))
  );
  base.posts = posts;
  return engine.renderHtml({ body: buildProfileHtml(base), css: CSS, width: 480, height: 900 });
}

async function renderFeed(items) {
  const list = Array.isArray(items) ? items.slice(0, 6) : [];
  const ready = await Promise.all(
    list.map(async (it) => Object.assign({}, it, { avatar: await engine.toDataUri(it.avatar), image: await engine.toDataUri(it.image) }))
  );
  return engine.renderHtml({ body: buildFeedHtml(ready), css: CSS, width: 470, height: 900 });
}

async function renderPostCard(item) {
  const ready = Object.assign({}, item, { avatar: await engine.toDataUri(item.avatar), image: await engine.toDataUri(item.image) });
  return engine.renderHtml({ body: buildPostHtml(ready), css: CSS, width: 470, height: 700 });
}

async function renderStory(item) {
  const ready = Object.assign({}, item, { avatar: await engine.toDataUri(item.avatar), image: await engine.toDataUri(item.image) });
  return engine.renderHtml({ body: buildStoryHtml(ready), css: CSS, width: 360, height: 640 });
}

async function safeImage(url) {
  return engine.toDataUri(url);
}

module.exports = {
  renderProfile,
  renderFeed,
  renderPostCard,
  renderStory,
  getBrowser: engine.getBrowser,
  closeBrowser: engine.closeBrowser,
  safeImage
};
