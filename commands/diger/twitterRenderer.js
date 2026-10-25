'use strict';

/**
 * X / Twitter görsel motoru — koyu ("Karanlık") tema.
 * API: renderProfile / renderFeed / renderTweetCard
 */

const { milestoneText } = require('../../utils');
const engine = require('../../render/engine');
const C = require('../../render/common');

const { escHtml, icon, avatar, verifiedBadge, fmt, richText } = C;

const BLUE = '#1d9bf0';
const GRAY = '#71767b';
const LINE = '#2f3336';

const CSS =
  '#root{background:#000;color:#e7e9ea;position:relative;overflow:hidden}' +
  '.g{color:' + GRAY + '}' +
  '.tab{flex:1;text-align:center;font-size:15px;font-weight:500;color:' + GRAY + ';padding:16px 0 0;position:relative}' +
  '.tab.on{color:#e7e9ea;font-weight:700}' +
  '.tab i{display:block;height:4px;width:56px;border-radius:4px;margin:13px auto 0;background:transparent}' +
  '.tab.on i{background:' + BLUE + '}';

function count(v) {
  return Array.isArray(v) ? v.length : Number(v) || 0;
}

/** Görüntülenme: veri yoksa etkileşimden deterministik tahmin */
function estViews(t) {
  if (t.views) return Number(t.views);
  const eng = count(t.likes) + count(t.retweets) * 2 + count(t.replies);
  const salt = C.hashStr((t.username || '') + (t.text || '')) % 40;
  return Math.round(eng * (14 + salt / 4) + 40 + salt * 3);
}

function act(name, n, color, hover) {
  return (
    '<div style="display:flex;align-items:center;gap:7px;color:' + (color || GRAY) + ';min-width:62px">' +
    icon(name, { size: 18.5, sw: 1.8, color: color || GRAY }) +
    '<span style="font-size:13px">' + (n === null ? '' : escHtml(fmt(n))) + '</span></div>'
  );
}

function actionRow(t) {
  return (
    '<div style="display:flex;justify-content:space-between;margin-top:12px;max-width:440px">' +
    act('comment', count(t.replies)) + act('repeat', count(t.retweets)) + act('heart', count(t.likes)) + act('chart', estViews(t)) +
    '<div style="display:flex;gap:16px;color:' + GRAY + '">' + icon('bookmark', { size: 18.5, sw: 1.8, color: GRAY }) + icon('share', { size: 18.5, sw: 1.8, color: GRAY }) + '</div></div>'
  );
}

function tweetRow(t, o) {
  const opts = o || {};
  const name = t.displayName || t.username;
  const media = t.image
    ? '<div style="margin-top:12px;border-radius:16px;overflow:hidden;border:1px solid ' + LINE + ';max-height:300px"><img src="' + t.image + '" style="width:100%;max-height:300px;object-fit:cover;display:block"></div>'
    : '';
  const head = opts.pinned
    ? '<div style="display:flex;align-items:center;gap:8px;margin:0 0 6px 40px;font-size:13px;font-weight:700" class="g">' + icon('pin', { size: 14, color: GRAY, fill: true, sw: 1.4 }) + 'Sabitlenmiş</div>'
    : '';
  return (
    '<div style="padding:12px 16px 12px;border-bottom:1px solid ' + LINE + '">' + head +
    '<div style="display:flex;gap:12px">' + avatar(t.avatar, t.letter, name, 40) +
    '<div style="min-width:0;flex:1">' +
    '<div style="display:flex;align-items:center;gap:4px;font-size:15px;line-height:20px;white-space:nowrap">' +
    '<b style="overflow:hidden;text-overflow:ellipsis;max-width:230px">' + escHtml(name) + '</b>' + (t.verified ? verifiedBadge(18, BLUE) : '') +
    '<span class="g" style="overflow:hidden;text-overflow:ellipsis">@' + escHtml(t.username) + '</span>' +
    '<span class="g">·</span><span class="g">' + escHtml(String(t.time || '').replace(' önce', '')) + '</span><div style="flex:1"></div>' +
    icon('more', { size: 18, color: GRAY }) + '</div>' +
    '<div style="font-size:15px;line-height:20px;margin-top:2px;white-space:pre-wrap;word-break:break-word">' + richText(t.text || '', BLUE) + '</div>' +
    media + actionRow(t) + '</div></div></div>'
  );
}

/* ------------------------------------------------------------ profil */

function buildProfileHtml(d) {
  const name = d.displayName || d.username;
  const miles = (milestoneText(d.followers).split(' \u2022 ').pop()) || '';
  const hue = C.hueOf(d.username);
  const tweets = (d.tweets || []).slice(0, 3);
  const rows = tweets.map((t, i) =>
    tweetRow(Object.assign({}, t, { username: d.username, displayName: name, avatar: d.avatar, letter: d.letter, verified: d.verified }), { pinned: i === 0 && tweets.length > 1 && false })
  ).join('');

  return (
    '<div id="root" style="width:600px">' +
    '<div style="display:flex;align-items:center;gap:26px;height:53px;padding:0 16px;border-bottom:0">' + icon('back', { size: 20, sw: 2.1 }) +
    '<div><div style="font-size:19px;font-weight:800;display:flex;align-items:center;gap:4px;line-height:22px">' + escHtml(name) + (d.verified ? verifiedBadge(19, BLUE) : '') + '</div>' +
    '<div class="g" style="font-size:13px;line-height:15px">' + escHtml(fmt(d.tweetsCount, true)) + ' gönderi</div></div></div>' +
    '<div style="height:200px;position:relative;overflow:hidden">' + C.bannerPattern(hue) + '</div>' +
    '<div style="padding:0 16px;position:relative">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
    '<div style="margin-top:-68px;border:4px solid #000;border-radius:50%;background:#000">' + avatar(d.avatar, d.letter, name, 132) + '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-top:12px">' +
    '<div style="width:36px;height:36px;border:1px solid #536471;border-radius:50%;display:flex;align-items:center;justify-content:center">' + icon('more', { size: 18 }) + '</div>' +
    '<div style="width:36px;height:36px;border:1px solid #536471;border-radius:50%;display:flex;align-items:center;justify-content:center">' + icon('bell', { size: 17, sw: 1.8 }) + '</div>' +
    '<div style="background:#eff3f4;color:#0f1419;font-weight:700;font-size:15px;height:36px;padding:0 18px;border-radius:999px;display:flex;align-items:center">Takip et</div></div></div>' +
    '<div style="margin-top:10px;display:flex;align-items:center;gap:4px;font-size:20px;font-weight:800;line-height:24px">' + escHtml(name) + (d.verified ? verifiedBadge(22, BLUE) : '') + '</div>' +
    '<div class="g" style="font-size:15px;line-height:20px">@' + escHtml(d.username) + '</div>' +
    '<div style="margin-top:12px;font-size:15px;line-height:20px;white-space:pre-wrap;word-break:break-word">' + richText(d.bio || 'Henüz biyografi yok.', BLUE) + '</div>' +
    '<div class="g" style="display:flex;gap:16px;margin-top:12px;font-size:15px;align-items:center">' +
    '<span style="display:flex;gap:5px;align-items:center">' + icon('ball', { size: 18, color: GRAY, sw: 1.6 }) + 'Golazo League</span>' +
    '<span style="display:flex;gap:5px;align-items:center">' + icon('calendar', { size: 18, color: GRAY, sw: 1.7 }) + escHtml(C.formatDateTr(d.joinDate)) + ' tarihinde katıldı</span></div>' +
    (miles
      ? '<div style="margin-top:11px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#ffd166;background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.3);padding:4px 11px;border-radius:999px">' + icon('star', { size: 13, color: '#ffd166', fill: true, sw: 1 }) + escHtml(miles) + '</div>'
      : '') +
    '<div style="display:flex;gap:20px;margin-top:12px;font-size:15px;padding-bottom:4px">' +
    '<span><b>' + escHtml(fmt(d.following)) + '</b> <span class="g">Takip edilen</span></span>' +
    '<span><b>' + escHtml(fmt(d.followers)) + '</b> <span class="g">Takipçi</span></span></div></div>' +
    '<div style="display:flex;border-bottom:1px solid ' + LINE + ';margin-top:6px">' +
    '<div class="tab on">Gönderiler<i></i></div><div class="tab">Yanıtlar<i></i></div><div class="tab">Medya<i></i></div><div class="tab">Beğeniler<i></i></div></div>' +
    (rows || '<div class="g" style="padding:46px 20px;text-align:center;font-size:15px">Henüz gönderi yok.</div>') +
    '</div>'
  );
}

/* -------------------------------------------------------------- feed */

function buildFeedHtml(items) {
  return (
    '<div id="root" style="width:600px">' +
    '<div style="display:flex;border-bottom:1px solid ' + LINE + ';background:#000">' +
    '<div class="tab on" style="padding-top:18px">Sana özel<i></i></div><div class="tab" style="padding-top:18px">Takip edilenler<i></i></div></div>' +
    (items.length
      ? items.map((t) => tweetRow(t)).join('')
      : '<div class="g" style="padding:60px 20px;text-align:center;font-size:15px">Zaman çizelgesi boş, ilk tweeti sen at!</div>') +
    '<div style="height:56px;display:flex;align-items:center;justify-content:space-around;border-top:1px solid ' + LINE + '">' +
    icon('home', { size: 25, fill: true, sw: 1.6 }) + icon('search', { size: 25 }) + icon('bell', { size: 25 }) + icon('mail', { size: 25 }) + '</div>' +
    '</div>'
  );
}

/* ------------------------------------------------------- tekil tweet */

function buildTweetHtml(t) {
  const name = t.displayName || t.username;
  const rt = count(t.retweets);
  const lk = count(t.likes);
  const rp = count(t.replies);
  const stat = (n, l) => '<span style="margin-right:20px"><b style="color:#e7e9ea">' + escHtml(fmt(n)) + '</b> <span class="g">' + l + '</span></span>';
  const media = t.image
    ? '<div style="margin-top:14px;border-radius:16px;overflow:hidden;border:1px solid ' + LINE + '"><img src="' + t.image + '" style="width:100%;max-height:360px;object-fit:cover;display:block"></div>'
    : '';
  return (
    '<div id="root" style="width:600px;padding:14px 16px 4px">' +
    '<div style="display:flex;align-items:center;gap:12px">' + avatar(t.avatar, t.letter, name, 44) +
    '<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px;font-size:15px;font-weight:700;line-height:20px">' + escHtml(name) + (t.verified ? verifiedBadge(18, BLUE) : '') + '</div>' +
    '<div class="g" style="font-size:15px;line-height:20px">@' + escHtml(t.username) + '</div></div>' + icon('more', { size: 20, color: GRAY }) + '</div>' +
    '<div style="font-size:23px;line-height:30px;margin-top:14px;white-space:pre-wrap;word-break:break-word">' + richText(t.text || '', BLUE) + '</div>' + media +
    '<div class="g" style="font-size:15px;margin-top:14px;padding-bottom:14px;border-bottom:1px solid ' + LINE + '">' + escHtml(C.formatFullTr(t.createdAt)) + ' · <b style="color:#e7e9ea">' + escHtml(fmt(estViews(t), true)) + '</b> Görüntülenme</div>' +
    '<div style="font-size:15px;padding:14px 0;border-bottom:1px solid ' + LINE + '">' + stat(rt, 'Yeniden gönderi') + stat(lk, 'Beğeni') + stat(rp, 'Yanıt') + '</div>' +
    '<div style="display:flex;justify-content:space-around;padding:13px 0;border-bottom:1px solid ' + LINE + '">' +
    icon('comment', { size: 22, color: GRAY, sw: 1.7 }) + icon('repeat', { size: 22, color: GRAY, sw: 1.7 }) + icon('heart', { size: 22, color: GRAY, sw: 1.7 }) + icon('bookmark', { size: 22, color: GRAY, sw: 1.7 }) + icon('share', { size: 22, color: GRAY, sw: 1.7 }) + '</div>' +
    '</div>'
  );
}

/* --------------------------------------------------------- hazırlık */

async function withImages(o) {
  return Object.assign({}, o, { avatar: await engine.toDataUri(o.avatar), image: await engine.toDataUri(o.image) });
}

async function renderProfile(data) {
  const base = await withImages(data);
  base.image = '';
  const tw = await Promise.all((data.tweets || []).slice(0, 3).map((t) => engine.toDataUri(t.image).then((image) => Object.assign({}, t, { image }))));
  base.tweets = tw;
  return engine.renderHtml({ body: buildProfileHtml(base), css: CSS, width: 600, height: 900 });
}

async function renderFeed(items) {
  const list = (Array.isArray(items) ? items : []).slice(0, 5);
  const ready = await Promise.all(list.map(withImages));
  return engine.renderHtml({ body: buildFeedHtml(ready), css: CSS, width: 600, height: 900 });
}

async function renderTweetCard(data) {
  const ready = await withImages(data);
  return engine.renderHtml({ body: buildTweetHtml(ready), css: CSS, width: 600, height: 400 });
}

module.exports = {
  renderProfile,
  renderFeed,
  renderTweetCard,
  getBrowser: engine.getBrowser,
  closeBrowser: engine.closeBrowser
};
