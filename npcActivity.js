'use strict';

const {
  config,
  loadJSON,
  saveJSON,
  generateId,
  buildSuccessPanel,
  payloadV2,
  formatCount,
  emo,
  truncate
} = require('./utils');

const DB_FILES = {
  instagram: 'instagram.json',
  twitter: 'twitter.json',
  tiktok: 'tiktok.json'
};

const NPC_ACCOUNTS = [
  { handle: 'golazo.resmi', name: 'Golazo League', bio: 'Resmi Golazo League hesab\u0131. Futbolun kalbi burada at\u0131yor.' },
  { handle: 'taktiktahtasi', name: 'Taktik Tahtas\u0131', bio: '4-3-3 m\u00fc, 3-5-2 sen. Her hafta yeni taktik analiz.' },
  { handle: 'transferpenceresi', name: 'Transfer Penceresi', bio: 'S\u00f6ylentiler, dedikodular ve ger\u00e7ek transferler.' },
  { handle: 'tribunsesi', name: 'Trib\u00fcn Sesi', bio: 'Tezah\u00fcratlar, koreografiler ve trib\u00fcn kült\u00fcr\u00fc.' },
  { handle: 'macgunlugu', name: 'Ma\u00e7 G\u00fcnl\u00fc\u011f\u00fc', bio: 'Her ma\u00e7\u0131n \u00f6yk\u00fcs\u00fc, her gol\u00fcn izi.' }
];

const TWEET_POOL = [
  'Golazo League\'de bu hafta muhte\u015fem goller var! \u26bd Haftan\u0131n 11\'i a\u00e7\u0131kland\u0131.',
  'Derbi g\u00fcn\u00fc yakla\u015f\u0131yor. Stadyumda yerinizi al\u0131n, atmosfer muhte\u015fem olacak!',
  'Gen\u00e7 yetenekler parlamaya devam ediyor. Gelece\u011fin y\u0131ld\u0131zlar\u0131 Golazo League\'de.',
  'Son dakika golleri bu sezon rekor k\u0131rd\u0131. Lig adeta nefes kesiyor.',
  'Taktiksel \u00f6zet: Bu haftan\u0131n en etkili pressing yapan tak\u0131m\u0131 kim? Analizlerimiz yay\u0131nda.',
  'Kupa heyecan\u0131 ba\u015fl\u0131yor! Elenme turu ma\u00e7lar\u0131nda \u00e7ekili\u015f yar\u0131\u015f\u0131.',
  'Taraftar oylamas\u0131yla haftan\u0131n gol\u00fc se\u00e7ildi. Oy kullanmay\u0131 unutma!'
];

const POST_POOL = [
  'Kupa gecesinden kareler \u2014 \u015fu atmosferi bir g\u00f6r!\nGolazo League resmi galerisinde.',
  'Antrenmandan kareler yay\u0131nda. Hazarl\u0131k tam gaz devam ediyor.',
  'Tak\u0131m otob\u00fcs\u00fcnden \u26bd Keyifli yolculuk, ma\u00e7a tam gaz!',
  'Stadyum \u00f6ncesi son dokunu\u015flar. Bu g\u00f6r\u00fcnt\u00fc muhte\u015fem!',
  'Kupa seremonisinden unutulmaz anlar. G\u00f6zlerinizi ay\u0131ramayacaks\u0131n\u0131z.',
  'Gen\u00e7 yetenek kamp\u0131ndan geli\u015ftirme notlar\u0131. Gelecek parlad\u0131k\u00e7a parlad\u0131yor.'
];

const VIDEO_POOL = [
  'S\u00f6yele\u015ftirme golleri \u2014 izlerken nefesinizi tutacaks\u0131n\u0131z!',
  'Kalecinin m\u00fcc\u00e7\u00fcl kurtar\u0131\u015f\u0131! Bu pozisyona inanamayacaks\u0131n\u0131z.',
  'Trib\u00fcn \u00f6zel koreografi g\u00f6r\u00fcnt\u00fcleri. Atmosfer tavan yapt\u0131.',
  'Antrenmanda \u00f6zel \u00e7al\u0131\u015fma \u2014 refleksler \u00fcr\u00fct\u00fcc\u00fc seviyede.',
  'Haftan\u0131n en iyisi: Kafa vuru\u015f\u0131yla gelen \u00f6zel gol!',
  'Tak\u0131m \u015fe\u011finin sevinci. Bu anlar \u015fampiyonluk sinyalleri!'
];

const SOUNDS = [
  'Golazo Original Sound',
  'Stadyum \u00d6zel Ses',
  'Kupa Gecesi',
  'Trib\u00fcn Vurmayan',
  'Derbi Ritmi'
];

let timer = null;
let started = false;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function ensureAccounts() {
  const created = [];

  const ig = loadJSON(DB_FILES.instagram, { accounts: {}, index: {} });
  if (!ig.accounts) ig.accounts = {};
  if (!ig.index) ig.index = {};
  for (const spec of NPC_ACCOUNTS) {
    const key = spec.handle.toLowerCase();
    if (!ig.index[key]) {
      const account = {
        id: generateId('igusr'),
        userId: 'npc_' + key,
        username: spec.handle,
        displayName: spec.name,
        avatar: '',
        bio: spec.bio,
        verified: spec.handle === 'golazo.resmi',
        followers: [],
        following: [],
        posts: [],
        stories: [],
        earnings: 0,
        joinDate: Date.now(),
        notifications: [],
        npc: true
      };
      ig.accounts[account.userId] = account;
      ig.index[key] = account.userId;
      created.push({ platform: 'instagram', account });
    }
  }
  saveJSON(DB_FILES.instagram, ig);

  const tw = loadJSON(DB_FILES.twitter, { accounts: {}, index: {} });
  if (!tw.accounts) tw.accounts = {};
  if (!tw.index) tw.index = {};
  for (const spec of NPC_ACCOUNTS) {
    const key = spec.handle.toLowerCase();
    if (!tw.index[key]) {
      const account = {
        id: generateId('twusr'),
        userId: 'npc_' + key,
        username: spec.handle,
        displayName: spec.name,
        avatar: '',
        bio: spec.bio,
        verified: spec.handle === 'golazo.resmi',
        followers: [],
        following: [],
        tweets: [],
        earnings: 0,
        joinDate: Date.now(),
        notifications: [],
        npc: true
      };
      tw.accounts[account.userId] = account;
      tw.index[key] = account.userId;
      created.push({ platform: 'twitter', account });
    }
  }
  saveJSON(DB_FILES.twitter, tw);

  const tt = loadJSON(DB_FILES.tiktok, { accounts: {}, index: {} });
  if (!tt.accounts) tt.accounts = {};
  if (!tt.index) tt.index = {};
  for (const spec of NPC_ACCOUNTS) {
    const key = spec.handle.toLowerCase();
    if (!tt.index[key]) {
      const account = {
        id: generateId('ttusr'),
        userId: 'npc_' + key,
        username: spec.handle,
        displayName: spec.name,
        avatar: '',
        bio: spec.bio,
        verified: spec.handle === 'golazo.resmi',
        followers: [],
        following: [],
        videos: [],
        earnings: 0,
        joinDate: Date.now(),
        notifications: [],
        npc: true
      };
      tt.accounts[account.userId] = account;
      tt.index[key] = account.userId;
      created.push({ platform: 'tiktok', account });
    }
  }
  saveJSON(DB_FILES.tiktok, tt);

  return created;
}

function interconnect() {
  const ig = loadJSON(DB_FILES.instagram, { accounts: {}, index: {} });
  const npcIds = Object.keys(ig.accounts || {}).filter((id) => String(id).startsWith('npc_'));
  if (npcIds.length < 2) return;
  let changed = false;
  for (const id of npcIds) {
    const acc = ig.accounts[id];
    if (!acc) continue;
    for (const otherId of npcIds) {
      if (otherId === id) continue;
      if (acc.following.indexOf(otherId) === -1) {
        acc.following.push(otherId);
        changed = true;
      }
      if (acc.followers.indexOf(otherId) === -1) {
        acc.followers.push(otherId);
        changed = true;
      }
    }
  }
  if (changed) saveJSON(DB_FILES.instagram, ig);
}

async function postTwitter() {
  const db = loadJSON(DB_FILES.twitter, { accounts: {}, index: {} });
  if (!db.accounts) return null;
  const npcs = Object.values(db.accounts).filter((a) => a.npc);
  if (!npcs.length) return null;
  const account = pick(npcs);
  const tweet = {
    id: generateId('twt'),
    authorId: account.userId,
    text: pick(TWEET_POOL),
    image: null,
    likes: [],
    retweets: [],
    replies: [],
    quoteOf: null,
    replyTo: null,
    createdAt: Date.now()
  };
  account.tweets.push(tweet);
  saveJSON(DB_FILES.twitter, db);
  return { account, tweet };
}

async function postInstagram() {
  const db = loadJSON(DB_FILES.instagram, { accounts: {}, index: {} });
  if (!db.accounts) return null;
  const npcs = Object.values(db.accounts).filter((a) => a.npc);
  if (!npcs.length) return null;
  const account = pick(npcs);
  const post = {
    id: generateId('igp'),
    authorId: account.userId,
    text: pick(POST_POOL),
    image: null,
    likes: [],
    comments: [],
    saves: [],
    createdAt: Date.now()
  };
  account.posts.push(post);
  saveJSON(DB_FILES.instagram, db);
  return { account, post };
}

async function postTikTok() {
  const db = loadJSON(DB_FILES.tiktok, { accounts: {}, index: {} });
  if (!db.accounts) return null;
  const npcs = Object.values(db.accounts).filter((a) => a.npc);
  if (!npcs.length) return null;
  const account = pick(npcs);
  const video = {
    id: generateId('ttv'),
    authorId: account.userId,
    caption: pick(VIDEO_POOL),
    mediaUrl: null,
    likes: [],
    views: Math.floor(Math.random() * 400),
    viewUsers: [],
    comments: [],
    shares: [],
    sound: pick(SOUNDS),
    trending: Math.random() > 0.5 ? 1 : 0,
    timestamp: Date.now()
  };
  account.videos.push(video);
  saveJSON(DB_FILES.tiktok, db);
  return { account, video };
}

async function broadcast(client, platform, payload) {
  if (!config.npc.channelId) return;
  try {
    const channel = await client.channels.fetch(config.npc.channelId).catch(() => null);
    if (!channel || typeof channel.send !== 'function') return;
    if (platform === 'twitter') {
      const lines = [
        emo('twitter') + ' **@' + payload.account.username + '** tweet att\u0131',
        truncate(payload.tweet.text, 500)
      ];
      const container = buildSuccessPanel('Golazo League Twitter Ak\u0131\u015f\u0131', lines.join('\n'), {
        color: config.colors.twitter,
        emojiKey: 'twitter',
        thumbnailKey: 'twitter',
        footer: 'Golazo League \u2022 Twitter'
      });
      await channel.send(payloadV2(container));
    } else if (platform === 'instagram') {
      const lines = [
        emo('instagram') + ' **@' + payload.account.username + '** g\u00f6nderi payla\u015ft\u0131',
        truncate(payload.post.text, 500)
      ];
      const container = buildSuccessPanel('Golazo League Instagram Ak\u0131\u015f\u0131', lines.join('\n'), {
        color: config.colors.instagram,
        emojiKey: 'instagram',
        thumbnailKey: 'instagram',
        footer: 'Golazo League \u2022 Instagram'
      });
      await channel.send(payloadV2(container));
    } else {
      const lines = [
        emo('tiktok') + ' **@' + payload.account.username + '** video y\u00fckledi',
        truncate(payload.video.caption, 400),
        emo('sound') + ' ' + payload.video.sound
      ];
      const container = buildSuccessPanel('Golazo League TikTok Ak\u0131\u015f\u0131', lines.join('\n'), {
        color: config.colors.tiktok,
        emojiKey: 'tiktok',
        thumbnailKey: 'tiktok',
        footer: 'Golazo League \u2022 TikTok'
      });
      await channel.send(payloadV2(container));
    }
  } catch (err) {
    console.error('[Golazo] NPC yay\u0131n hatas\u0131:', err.message);
  }
}

async function tick(client) {
  try {
    const roll = Math.random();
    if (roll < 0.4) {
      const result = await postTwitter();
      if (result) await broadcast(client, 'twitter', result);
    } else if (roll < 0.7) {
      const result = await postInstagram();
      if (result) await broadcast(client, 'instagram', result);
    } else {
      const result = await postTikTok();
      if (result) await broadcast(client, 'tiktok', result);
    }
  } catch (err) {
    console.error('[Golazo] NPC tick hatas\u0131:', err.message);
  } finally {
    schedule(client);
  }
}

function schedule(client) {
  if (timer) clearTimeout(timer);
  const min = Math.max(1, config.npc.intervalMin) * 60 * 1000;
  const max = Math.max(min, config.npc.intervalMax) * 60 * 1000;
  const delay = Math.floor(min + Math.random() * (max - min));
  timer = setTimeout(() => tick(client), delay);
}

function start(client) {
  if (started) return;
  if (!config.npc.enabled) {
    console.log('[Golazo] NPC sistemi devre d\u0131\u015f\u0131.');
    return;
  }
  started = true;
  const created = ensureAccounts();
  interconnect();
  console.log(
    '[Golazo] NPC sistemi aktif. ' +
      created.length +
      ' sanal hesap olu\u015fturuldu' +
      (config.npc.channelId ? ' (kanal: ' + config.npc.channelId + ')' : ' (kanal ayar\u0131 yok, sadece veri)') +
      '.'
  );
  schedule(client);
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
}

module.exports = { start, stop, ensureAccounts, interconnect };
