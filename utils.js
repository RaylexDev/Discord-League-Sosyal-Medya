'use strict';

const fs = require('fs');
const path = require('path');
const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');

const FLAGS_V2 = 32768;
const FLAGS_V2_EPHEMERAL = 32832;

const DATA_DIR = path.join(__dirname, 'data');
const ASSETS_DIR = path.join(__dirname, 'assets');

const config = {
  prefix: '.',
  brand: 'Golazo League',
  footer: 'Golazo League Sosyal Medya',
  token: process.env.DISCORD_TOKEN || '',
  cooldownMs: 3000,
  colors: {
    background: '#0a0a14',
    card: '#12121f',
    border: '#2a2a4a',
    text: '#ffffff',
    muted: '#9aa0b4',
    instagram: 0xe1306c,
    twitter: 0x1da1f2,
    tiktok: 0x00f2fe,
    success: 0x2ecc71,
    error: 0xe74c3c,
    gold: 0xffd166,
    purple: 0x833ab4
  },
  themes: {
    instagram: ['#833ab4', '#e1306c', '#fd1d1d'],
    twitter: ['#1da1f2', '#0f7dc2', '#0a0a14'],
    tiktok: ['#00f2fe', '#fe0979'],
    golazo: ['#0a0a14', '#12121f']
  },
  emojis: {
    success: '<:golazo_success:1234567890123456001>',
    error: '<:golazo_error:1234567890123456002>',
    info: '<:golazo_info:1234567890123456003>',
    instagram: '<:golazo_instagram:1234567890123456004>',
    twitter: '<:golazo_twitter:1234567890123456005>',
    tiktok: '<:golazo_tiktok:1234567890123456006>',
    like: '<:golazo_like:1234567890123456007>',
    comment: '<:golazo_comment:1234567890123456008>',
    share: '<:golazo_share:1234567890123456009>',
    save: '<:golazo_save:1234567890123456010>',
    follow: '<:golazo_follow:1234567890123456011>',
    verified: '<:golazo_verified:1234567890123456012>',
    view: '<:golazo_view:1234567890123456013>',
    money: '<:golazo_money:1234567890123456014>',
    trend: '<:golazo_trend:1234567890123456015>',
    search: '<:golazo_search:1234567890123456016>',
    bell: '<:golazo_bell:1234567890123456017>',
    crown: '<:golazo_crown:1234567890123456018>',
    fire: '<:golazo_fire:1234567890123456019>',
    star: '<:golazo_star:1234567890123456020>',
    clock: '<:golazo_clock:1234567890123456021>',
    user: '<:golazo_user:1234567890123456022>',
    image: '<:golazo_image:1234567890123456023>',
    video: '<:golazo_video:1234567890123456024>',
    sound: '<:golazo_sound:1234567890123456025>',
    check: '<:golazo_check:1234567890123456026>',
    close: '<:golazo_close:1234567890123456027>',
    chart: '<:golazo_chart:1234567890123456028>',
    lock: '<:golazo_lock:1234567890123456029>',
    link: '<:golazo_link:1234567890123456030>',
    rocket: '<:golazo_rocket:1234567890123456031>'
  },
  thumbnails: {
    instagram: '',
    twitter: '',
    tiktok: '',
    golazo: ''
  },
  economy: {
    instagramLike: 100,
    twitterLike: 50,
    twitterRetweet: 75,
    tiktokLike: 150,
    tiktokView: 5,
    tiktokShare: 50,
    verifyInstagram: 500000,
    verifyTwitter: 500000,
    verifyTiktok: 750000
  },
  milestones: [100, 500, 1000, 5000, 10000],
  npc: {
    enabled: true,
    channelId: process.env.NPC_CHANNEL_ID || '',
    intervalMin: 4,
    intervalMax: 12
  }
};

const MILESTONE_LABELS = {
  100: 'Çaylak',
  500: 'Yükselen',
  1000: 'Yıldız',
  5000: 'Elit',
  10000: 'Efsane'
};

const cooldowns = new Map();

const EMOJIS_DIR = path.join(__dirname, 'emojis');
const emojiMaps = {};
let activeGuildId = '';

function loadEmojiMap(guildId) {
  const key = String(guildId || '');
  if (!key) return {};
  if (emojiMaps[key]) return emojiMaps[key];
  const all = loadJSON('emojimap.json', {});
  emojiMaps[key] = (all && all[key] && typeof all[key] === 'object') ? all[key] : {};
  return emojiMaps[key];
}

function saveEmojiMap(guildId, map) {
  const key = String(guildId || '');
  if (!key) return false;
  emojiMaps[key] = map || {};
  const all = loadJSON('emojimap.json', {});
  if (!all || typeof all !== 'object') return false;
  all[key] = emojiMaps[key];
  return saveJSON('emojimap.json', all);
}

function setActiveGuild(guild) {
  if (!guild) return;
  activeGuildId = String(guild.id || '');
  loadEmojiMap(activeGuildId);
}

function getActiveGuildId() {
  return activeGuildId;
}

function formatEmojiEntry(entry) {
  if (!entry || !entry.id) return '';
  const name = String(entry.name || 'emoji');
  return (entry.animated ? '<a:' : '<:') + name + ':' + entry.id + '>';
}

function refreshEmojisFromGuild(guild) {
  if (!guild || !guild.emojis || !guild.emojis.cache) return {};
  const key = String(guild.id || activeGuildId || '');
  if (!key) return {};
  const map = {};
  for (const emoji of guild.emojis.cache.values()) {
    const name = String(emoji.name || '');
    const match = /^golazo_([a-z0-9_]+)$/.exec(name);
    if (!match) continue;
    map[match[1]] = {
      id: String(emoji.id),
      name,
      animated: Boolean(emoji.animated)
    };
  }
  emojiMaps[key] = map;
  saveEmojiMap(key, map);
  if (!activeGuildId) activeGuildId = key;
  return map;
}

function listLocalEmojiFiles() {
  try {
    if (!fs.existsSync(EMOJIS_DIR)) return [];
    return fs
      .readdirSync(EMOJIS_DIR)
      .filter((file) => /^golazo_[a-z0-9_]+\.(png|jpg|jpeg|gif|webp)$/i.test(file))
      .map((file) => {
        const match = /^golazo_([a-z0-9_]+)\.[^.]+$/i.exec(file);
        return {
          file,
          key: match ? match[1] : '',
          full: path.join(EMOJIS_DIR, file)
        };
      })
      .filter((item) => item.key);
  } catch (err) {
    return [];
  }
}

function loadJSON(file, fallback) {
  const full = path.isAbsolute(file) ? file : path.join(DATA_DIR, file);
  try {
    if (!fs.existsSync(full)) {
      saveJSON(file, fallback);
      return fallback;
    }
    const raw = fs.readFileSync(full, 'utf8');
    if (!raw.trim()) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (err) {
    try {
      if (fs.existsSync(full)) fs.copyFileSync(full, full + '.corrupt.' + Date.now());
    } catch (_) { }
    return fallback;
  }
}

function saveJSON(file, data) {
  const full = path.isAbsolute(file) ? file : path.join(DATA_DIR, file);
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const tmp = full + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, full);
    return true;
  } catch (err) {
    try {
      fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (err2) {
      return false;
    }
  }
}

function generateId(prefix) {
  const base = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  return (prefix || 'id') + '_' + base;
}

function checkCooldown(userId, key, ms) {
  const limit = typeof ms === 'number' ? ms : config.cooldownMs;
  const id = String(userId) + ':' + String(key);
  const now = Date.now();
  const expires = cooldowns.get(id);
  if (expires && now < expires) {
    return { ok: false, remaining: Math.ceil((expires - now) / 100) / 10 };
  }
  cooldowns.set(id, now + limit);
  if (cooldowns.size > 5000) {
    for (const [k, v] of cooldowns) {
      if (v <= now) cooldowns.delete(k);
    }
  }
  return { ok: true, remaining: 0 };
}

function escHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCount(n) {
  let num = Number(n);
  if (!Number.isFinite(num) || num < 0) num = 0;
  const trim = (x) => {
    const s = x.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (num >= 1e9) return trim(num / 1e9) + 'B';
  if (num >= 1e6) return trim(num / 1e6) + 'M';
  if (num >= 1e3) return trim(num / 1e3) + 'K';
  return String(Math.round(num));
}

function groupThousands(n) {
  const num = Math.max(0, Math.round(Number(n) || 0));
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatMoney(n) {
  return '\u20BA' + groupThousands(n);
}

function truncate(str, max) {
  const s = String(str === null || str === undefined ? '' : str);
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '\u2026';
}

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - (Number(ts) || 0));
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec + ' sn';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + ' dk';
  const hour = Math.floor(min / 60);
  if (hour < 24) return hour + ' sa';
  const day = Math.floor(hour / 24);
  if (day < 7) return day + ' g';
  const week = Math.floor(day / 7);
  if (week < 5) return week + ' ha';
  const month = Math.floor(day / 30);
  if (month < 12) return month + ' ay';
  return Math.floor(day / 365) + ' y';
}

function norm(value) {
  return String(value === null || value === undefined ? '' : value)
    .toLocaleLowerCase('tr-TR')
    .replace(/\u0131/g, 'i')
    .replace(/\u011f/g, 'g')
    .replace(/\u00fc/g, 'u')
    .replace(/\u015f/g, 's')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00e7/g, 'c')
    .replace(/\u00e2/g, 'a');
}

function parseAmount(value) {
  const cleaned = String(value === null || value === undefined ? '' : value).replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  return parseInt(cleaned, 10);
}

function getPlayersData() {
  const data = loadJSON('players.json', { players: {} });
  if (Array.isArray(data)) {
    const map = {};
    for (const entry of data) {
      if (entry && entry.id) map[entry.id] = entry;
    }
    return { players: map };
  }
  if (data && typeof data === 'object') {
    if (data.players && typeof data.players === 'object' && !Array.isArray(data.players)) return data;
    return { players: data };
  }
  return { players: {} };
}

function savePlayersData(data) {
  return saveJSON('players.json', data);
}

function getPlayer(userId, username) {
  const data = getPlayersData();
  const id = String(userId);
  if (!data.players[id]) {
    data.players[id] = {
      id,
      name: username || '',
      username: username || '',
      value: 0,
      createdAt: Date.now()
    };
  } else {
    if (username) {
      data.players[id].name = username;
      data.players[id].username = username;
    }
    if (typeof data.players[id].value !== 'number') data.players[id].value = 0;
  }
  savePlayersData(data);
  return data.players[id];
}

function getBalance(userId) {
  const data = getPlayersData();
  const entry = data.players[String(userId)];
  return entry && typeof entry.value === 'number' ? entry.value : 0;
}

function addMoney(userId, amount, username) {
  const data = getPlayersData();
  const id = String(userId);
  if (!data.players[id]) {
    data.players[id] = { id, name: username || '', username: username || '', value: 0, createdAt: Date.now() };
  }
  const add = Math.max(0, Math.round(Number(amount) || 0));
  data.players[id].value = Math.max(0, Math.round((data.players[id].value || 0) + add));
  savePlayersData(data);
  return data.players[id].value;
}

function spendMoney(userId, amount, username) {
  const cost = Math.max(0, Math.round(Number(amount) || 0));
  const data = getPlayersData();
  const id = String(userId);
  if (!data.players[id]) {
    data.players[id] = { id, name: username || '', username: username || '', value: 0, createdAt: Date.now() };
  }
  if ((data.players[id].value || 0) < cost) return false;
  data.players[id].value -= cost;
  savePlayersData(data);
  return true;
}

function pushNotification(user, type, text, limit) {
  if (!user || typeof user !== 'object') return;
  if (!Array.isArray(user.notifications)) user.notifications = [];
  user.notifications.unshift({
    id: generateId('nt'),
    type: type || 'info',
    text: truncate(text, 180),
    createdAt: Date.now(),
    read: false
  });
  const cap = limit || 5;
  if (user.notifications.length > 20) user.notifications.length = 20;
}

function getMilestones(count) {
  const n = Number(count) || 0;
  return config.milestones
    .filter((m) => n >= m)
    .map((m) => ({ value: m, label: MILESTONE_LABELS[m] || '' }));
}

function milestoneText(count) {
  const list = getMilestones(count);
  if (!list.length) return '';
  return list.map((m) => formatCount(m.value) + ' ' + m.label).join(' \u2022 ');
}

function emo(key, guild) {
  const k = String(key || '');
  const guildId = guild && guild.id ? String(guild.id) : activeGuildId;
  const map = guildId ? loadEmojiMap(guildId) : {};
  const local = formatEmojiEntry(map[k]);
  if (local) return local;
  const cached = guild && guild.emojis && guild.emojis.cache
    ? guild.emojis.cache.find((e) => e.name === 'golazo_' + k)
    : null;
  if (cached) return formatEmojiEntry({ id: cached.id, name: cached.name, animated: cached.animated });
  return (config.emojis && config.emojis[k]) || '';
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function brandAsset(key) {
  const nameMap = {
    instagram: 'brand_instagram.png',
    twitter: 'brand_twitter.png',
    tiktok: 'brand_tiktok.png',
    golazo: 'brand_golazo.png'
  };
  const glyphMap = {
    instagram: 'IG',
    twitter: 'X',
    tiktok: 'TT',
    golazo: 'GZ'
  };
  const file = nameMap[key];
  if (!file) return null;
  const full = path.join(ASSETS_DIR, file);
  try {
    if (fs.existsSync(full) && fs.statSync(full).size > 0) return full;
  } catch (_) { }
  try {
    const { createCanvas } = require('@napi-rs/canvas');
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    const size = 256;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const stops = config.themes[key] || config.themes.golazo;
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(1, stops[stops.length - 1]);
    roundRect(ctx, 4, 4, size - 8, size - 8, 48);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 96px "Segoe UI", Arial, sans-serif';
    ctx.fillText(glyphMap[key] || 'GZ', size / 2, size / 2 - 12);
    ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('GOLAZO', size / 2, size / 2 + 58);
    fs.writeFileSync(full, canvas.encodeSync('png'));
    return full;
  } catch (err) {
    return null;
  }
}

function resolveThumb(key, files, override) {
  if (override) return override;
  if (!key) return null;
  const custom = config.thumbnails && config.thumbnails[key];
  if (custom) return custom;
  const asset = brandAsset(key);
  if (!asset) return null;
  const fileName = path.basename(asset);
  if (Array.isArray(files)) {
    files.push(new AttachmentBuilder(asset, { name: fileName }));
  }
  return 'attachment://' + fileName;
}

function buildPanel(opts) {
  const options = opts || {};
  const files = Array.isArray(options.files) ? options.files : [];
  const container = new ContainerBuilder();
  const accent = typeof options.color === 'number' ? options.color : config.colors.instagram;
  container.setAccentColor(accent);

  const emojiPrefix = options.emojiKey ? emo(options.emojiKey) : '';
  const title = options.title ? (emojiPrefix ? emojiPrefix + ' ' + options.title : options.title) : '';

  if (title) {
    const titleDisplay = new TextDisplayBuilder().setContent(truncate(title, 3800));
    const thumbUrl = resolveThumb(options.thumbnailKey, files, options.thumbnail);
    if (thumbUrl) {
      const section = new SectionBuilder();
      section.addTextDisplayComponents([titleDisplay]);
      section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl));
      container.addSectionComponents([section]);
    } else {
      container.addTextDisplayComponents([titleDisplay]);
    }
  }

  container.addSeparatorComponents([new SeparatorBuilder().setDivider(true).setSpacing(1)]);

  if (options.description) {
    container.addTextDisplayComponents([
      new TextDisplayBuilder().setContent(truncate(String(options.description), 3900))
    ]);
  }

  if (Array.isArray(options.fields) && options.fields.length) {
    container.addTextDisplayComponents([
      new TextDisplayBuilder().setContent(truncate(options.fields.join('\n'), 3900))
    ]);
  }

  if (Array.isArray(options.media) && options.media.length) {
    const gallery = new MediaGalleryBuilder();
    gallery.addItems(
      options.media.slice(0, 10).map((item) =>
        typeof item === 'string' ? { media: { url: item } } : item
      )
    );
    container.addMediaGalleryComponents([gallery]);
  }

  if (Array.isArray(options.rows)) {
    for (const row of options.rows) {
      if (row) container.addActionRowComponents([row]);
    }
  }

  container.addSeparatorComponents([new SeparatorBuilder().setDivider(true).setSpacing(1)]);
  container.addTextDisplayComponents([
    new TextDisplayBuilder().setContent('**' + (options.footer || config.footer) + '**')
  ]);

  container.__files = files;
  return container;
}

function buildSuccessPanel(title, description, opts) {
  const options = Object.assign({}, opts || {});
  if (typeof options.color !== 'number') options.color = config.colors.success;
  if (!options.emojiKey) options.emojiKey = 'success';
  options.title = title;
  options.description = description;
  return buildPanel(options);
}

function buildErrorPanel(description, opts) {
  const options = Object.assign({}, opts || {});
  if (typeof options.color !== 'number') options.color = config.colors.error;
  if (!options.emojiKey) options.emojiKey = 'error';
  if (!options.title) options.title = 'Bir \u015feyler ters gitti';
  options.description = description;
  return buildPanel(options);
}

function collectFiles(container) {
  const list = container && Array.isArray(container.__files) ? container.__files.slice() : [];
  return list;
}

function pushMediaGallery(payload, url) {
  if (!payload || !payload.components || !payload.components[0]) return payload;
  const container = payload.components[0];
  const gallery = new MediaGalleryBuilder();
  gallery.addItems([{ media: { url: String(url) } }]);
  container.addMediaGalleryComponents([gallery]);
  return payload;
}

function payloadV2(container, opts) {
  const options = opts || {};
  const payload = {
    components: [container],
    flags: options.ephemeral ? FLAGS_V2_EPHEMERAL : FLAGS_V2,
    allowedMentions: { parse: [], repliedUser: false }
  };
  const files = collectFiles(container);
  if (Array.isArray(options.files)) {
    for (const f of options.files) files.push(f);
  }
  if (files.length) payload.files = files;
  return payload;
}

async function sendV2(target, container, opts) {
  const options = opts || {};
  const payload = payloadV2(container, options);
  const base = {
    components: payload.components,
    files: payload.files,
    allowedMentions: payload.allowedMentions
  };
  if (target && (target.deferred || target.replied)) {
    return target.editReply(base);
  }
  base.flags = payload.flags;
  return target.reply(base);
}

async function sendError(target, err, opts) {
  const options = Object.assign({}, opts || {});
  const message = err && err.message ? err.message : String(err);
  return sendV2(target, buildErrorPanel(message, options), options);
}

function makeButton(opts) {
  const options = opts || {};
  const builder = new ButtonBuilder();
  builder.setStyle(typeof options.style === 'number' ? options.style : ButtonStyle.Secondary);
  builder.setLabel(truncate(options.label || 'Buton', 80));
  if (options.url) {
    builder.setURL(options.url);
  } else {
    builder.setCustomId(options.id || 'noop');
  }
  const emoji = options.emojiKey ? emo(options.emojiKey) : '';
  if (emoji) {
    try {
      builder.setEmoji(emoji);
    } catch (err) { }
  }
  if (options.disabled) builder.setDisabled(true);
  return builder;
}

function rowOf() {
  const buttons = Array.prototype.slice.call(arguments).filter(Boolean);
  return new ActionRowBuilder().addComponents(buttons);
}

function resolveTargetUser(message, arg) {
  try {
    const mentioned = message.mentions && message.mentions.users && message.mentions.users.first();
    if (mentioned) return mentioned;
  } catch (err) { }
  if (!arg) return message.author;
  const clean = String(arg).replace(/[<@!>]/g, '');
  if (/^\d{15,25}$/.test(clean)) {
    try {
      const cached = message.client && message.client.users ? message.client.users.cache.get(clean) : null;
      if (cached) return cached;
      return { id: clean, username: clean, tag: clean, displayAvatarURL: () => '' };
    } catch (err) { }
  }
  return null;
}

module.exports = {
  FLAGS_V2,
  FLAGS_V2_EPHEMERAL,
  AttachmentBuilder,
  config,
  MILESTONE_LABELS,
  loadJSON,
  saveJSON,
  generateId,
  checkCooldown,
  buildSuccessPanel,
  buildErrorPanel,
  buildPanel,
  payloadV2,
  pushMediaGallery,
  sendV2,
  sendError,
  collectFiles,
  makeButton,
  rowOf,
  escHtml,
  formatCount,
  formatMoney,
  groupThousands,
  truncate,
  timeAgo,
  norm,
  parseAmount,
  getPlayer,
  getBalance,
  addMoney,
  spendMoney,
  pushNotification,
  getMilestones,
  milestoneText,
  emo,
  setActiveGuild,
  getActiveGuildId,
  refreshEmojisFromGuild,
  listLocalEmojiFiles,
  saveEmojiMap,
  withTimeout,
  roundRect,
  brandAsset,
  resolveTargetUser
};
