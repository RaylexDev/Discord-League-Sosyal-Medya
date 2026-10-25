'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');

function resetData() {
  fs.writeFileSync(path.join(DATA, 'instagram.json'), JSON.stringify({ accounts: {}, index: {} }, null, 2));
  fs.writeFileSync(path.join(DATA, 'twitter.json'), JSON.stringify({ accounts: {}, index: {} }, null, 2));
  fs.writeFileSync(path.join(DATA, 'tiktok.json'), JSON.stringify({ accounts: {}, index: {} }, null, 2));
  fs.writeFileSync(path.join(DATA, 'players.json'), JSON.stringify({ players: {} }, null, 2));
}

const sent = [];

function makeUser(id, username, displayName) {
  return {
    id,
    username,
    displayName: displayName || username,
    bot: false,
    displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/' + id + '/x.png?size=256'
  };
}

function makeMessage(author, content, extras) {
  const message = {
    author,
    content,
    guild: { id: 'g1' },
    member: {
      permissions: {
        has: (flag) => Boolean(extras && extras.admin)
      }
    },
    mentions: {
      users: {
        first: () => (extras && extras.mention) || null
      }
    },
    attachments: {
      first: () => (extras && extras.attachment) || null
    },
    client: { users: { cache: new Map() } },
    reply: async (payload) => {
      sent.push({ where: 'message', payload });
      return { id: 'msg_' + sent.length };
    }
  };
  return message;
}

function makeButtonInteraction(user, customId, messageId) {
  const interaction = {
    user,
    customId,
    message: { id: messageId || 'orig_msg' },
    deferred: false,
    replied: false,
    reply: async (payload) => {
      sent.push({ where: 'interaction.reply', payload });
      interaction.replied = true;
      return { id: 'int_' + sent.length };
    },
    followUp: async (payload) => {
      sent.push({ where: 'interaction.followUp', payload });
      return { id: 'intf_' + sent.length };
    },
    update: async (payload) => {
      sent.push({ where: 'interaction.update', payload });
      return { id: 'intu_' + sent.length };
    },
    deferUpdate: async () => {
      interaction.deferred = true;
    }
  };
  return interaction;
}

function lastPayload() {
  if (!sent.length) throw new Error('hi\u015f mesaj g\u00f6nderilmedi');
  return sent[sent.length - 1].payload;
}

function validatePayload(payload, label, isUpdate) {
  assert(Array.isArray(payload.components), label + ': components array olmal\u0131');
  assert(payload.components.length > 0, label + ': components bo\u015f olamaz');
  const flags = payload.flags;
  if (isUpdate) {
    assert(flags === undefined, label + ': update payload\u0131nda flags olmamal\u0131, al\u0131nd\u0131: ' + flags);
  } else {
    assert(typeof flags === 'number', label + ': flags say\u0131 olmal\u0131');
    assert(flags === 32768 || flags === 32832, label + ': flags 32768 veya 32832 olmal\u0131, al\u0131nd\u0131: ' + flags);
  }
  const container = payload.components[0];
  const json = typeof container.toJSON === 'function' ? container.toJSON() : container;
  assert(json.type === 17, label + ': container type 17 olmal\u0131');
  assert(Array.isArray(json.components), label + ': container i\u00e7 components olmal\u0131');
  const text = JSON.stringify(json);
  assert(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text.replace(/\\u2713|\\u2665|\\u21ba|\\u2535|\\u26bd|\\u266a|\\u2665|\\u9654|\\u9835|\\u9825|\\u2764/g, '')), label + ': unicode emoji bulunamaz');
  for (const id of payload.files || []) {
    assert(id && (id.attachment || typeof id === 'string'), label + ': ge\u00e7erli dosya');
  }
  return true;
}

async function run() {
  resetData();

  const u = require('./utils');
  assert.strictEqual(u.FLAGS_V2, 32768, 'FLAGS_V2');
  assert.strictEqual(u.FLAGS_V2_EPHEMERAL, 32832, 'FLAGS_V2_EPHEMERAL');
  console.log('OK  utils: FLAGS');

  const instagram = require('./commands/diger/instagram');
  const twitter = require('./commands/diger/twitter');
  const tiktok = require('./commands/diger/tiktok');
  assert(instagram.name === 'insta' && instagram.aliases.includes('instagram'));
  assert(twitter.name === 'tw' && twitter.aliases.includes('x'));
  assert(tiktok.name === 'tt' && tiktok.aliases.includes('tiktok'));
  console.log('OK  komut y\u00fckleme ve aliaslar');

  const alice = makeUser('111111111111111111', 'alice', 'Alice Golazo');
  const bob = makeUser('222222222222222222', 'bob', 'Bob Striker');
  const admin = makeUser('333333333333333333', 'admin', 'Admin');

  const step = async (label, fn) => {
    const before = sent.length;
    await fn();
    assert(sent.length > before, label + ' yan\u0131t \u00fcretmedi');
    const entry = sent[sent.length - 1];
    validatePayload(entry.payload, label, entry.where === 'interaction.update');
  };

  await step('insta yardim', () => instagram.execute(makeMessage(alice, '.insta'), [], {}));
  console.log('OK  insta yardim');

  await step('insta ac gecersiz', () => instagram.execute(makeMessage(alice, '.insta ac x'), ['ac', 'x'], {}));
  await step('insta ac', () => instagram.execute(makeMessage(alice, '.insta ac golazo.kral'), ['ac', 'golazo.kral'], {}));
  await step('insta ac tekrar', () => instagram.execute(makeMessage(alice, '.insta ac golazo.kral'), ['ac', 'golazo.kral'], {}));
  await step('insta bio fazla', () => instagram.execute(makeMessage(alice, '.insta bio'), ['bio', 'x'.repeat(200)], {}));
  await step('insta bio', () => instagram.execute(makeMessage(alice, '.insta bio Merhaba'), ['bio', 'Merhaba'], {}));
  console.log('OK  insta ac/bio');

  await step('insta paylas cooldown', async () => {
    await instagram.execute(makeMessage(alice, '.insta paylas deneme1'), ['paylas', 'deneme1'], {});
    await instagram.execute(makeMessage(alice, '.insta paylas deneme2'), ['paylas', 'deneme2'], {});
  });
  console.log('OK  insta paylas + cooldown');

  await new Promise((r) => setTimeout(r, 3100));

  let db = JSON.parse(fs.readFileSync(path.join(DATA, 'instagram.json'), 'utf8'));
  const aliceAcc = db.accounts[alice.id];
  assert(aliceAcc, 'alice hesab\u0131 olu\u015ftu');
  assert.strictEqual(aliceAcc.posts.length, 1, '1 g\u00f6nderi olmal\u0131');
  const postId = aliceAcc.posts[0].id;

  await step('insta begen (bob hesapsiz)', () =>
    instagram.execute(makeMessage(bob, '.insta begen ' + postId), ['begen', postId], {})
  );
  await step('insta bob ac', () => instagram.execute(makeMessage(bob, '.insta ac bob.futbol'), ['ac', 'bob.futbol'], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('insta begen', () =>
    instagram.execute(makeMessage(bob, '.insta begen ' + postId), ['begen', postId], {})
  );

  db = JSON.parse(fs.readFileSync(path.join(DATA, 'instagram.json'), 'utf8'));
  const bobAcc = db.accounts[bob.id];
  assert(bobAcc, 'bob hesab\u0131 olmal\u0131 (begen icin)');
  const likedBefore = db.accounts[alice.id].posts[0].likes.includes(bob.id);
  assert(likedBefore, 'komut ile begen kaydedildi');
  console.log('OK  insta begen');

  await step('insta yorum', () =>
    instagram.execute(makeMessage(bob, '.insta yorum ' + postId + ' guzel gol'), ['yorum', postId, 'guzel', 'gol'], {})
  );
  await step('insta kaydet', () =>
    instagram.execute(makeMessage(bob, '.insta kaydet ' + postId), ['kaydet', postId], {})
  );
  await step('insta kesfet', () => instagram.execute(makeMessage(bob, '.insta kesfet'), ['kesfet'], {}));
  await step('insta takipci', () => instagram.execute(makeMessage(bob, '.insta takipci'), ['takipci'], {}));
  await step('insta hikaye', () => instagram.execute(makeMessage(alice, '.insta hikaye deneme'), ['hikaye', 'deneme'], {}));
  await step('insta bildirim', () => instagram.execute(makeMessage(alice, '.insta bildirim'), ['bildirim'], {}));
  await step('insta kazanc', () => instagram.execute(makeMessage(alice, '.insta kazanc'), ['kazanc'], {}));
  await step('insta cek yetersiz', () => instagram.execute(makeMessage(alice, '.insta cek 999999'), ['cek', '999999'], {}));
  console.log('OK  insta alt komutlar');

  const mentionBob = { id: bob.id, username: bob.username, displayName: bob.displayName, displayAvatarURL: bob.displayAvatarURL };
  await step('insta takip', () =>
    instagram.execute(makeMessage(alice, '.insta takip @bob'), ['takip'], { mention: mentionBob })
  );
  await step('insta takip toggle', () =>
    instagram.execute(makeMessage(alice, '.insta takip @bob'), ['takip'], { mention: mentionBob })
  );
  console.log('OK  insta takip toggle');

  await new Promise((r) => setTimeout(r, 3100));
  await step('insta mavi yetkisiz', () =>
    instagram.execute(makeMessage(alice, '.insta mavi @bob'), ['mavi'], { mention: mentionBob })
  );
  await step('insta mavi bakiye yetersiz', () =>
    instagram.execute(makeMessage(admin, '.insta mavi @bob'), ['mavi'], { mention: mentionBob, admin: true })
  );
  console.log('OK  insta mavi yetki/bakiye kontrolu');

  await step('insta profil render', () =>
    instagram.execute(makeMessage(alice, '.insta profil'), ['profil'], {})
  );
  console.log('OK  insta profil (puppeteer render)');
  const profPayload = lastPayload();
  assert(JSON.stringify(profPayload.components[0].toJSON()).includes('insta_profile.png'), 'profil gorseli ekli olmali');

  await new Promise((r) => setTimeout(r, 3100));
  await step('insta feed render', () => instagram.execute(makeMessage(alice, '.insta feed'), ['feed'], {}));
  console.log('OK  insta feed (puppeteer render)');

  await new Promise((r) => setTimeout(r, 3100));
  await step('insta like button', () => {
    const inter = makeButtonInteraction(bob, 'insta_like_' + postId);
    return instagram.handleInteraction(inter, {});
  });
  console.log('OK  insta_like butonu');

  db = JSON.parse(fs.readFileSync(path.join(DATA, 'instagram.json'), 'utf8'));
  const likedPost = db.accounts[alice.id].posts.find((p) => p.id === postId);
  assert.strictEqual(likedPost.likes.includes(bob.id), !likedBefore, 'buton begen toggle yapmali');

  await new Promise((r) => setTimeout(r, 3100));
  await step('insta save button', () => {
    const inter = makeButtonInteraction(bob, 'insta_save_' + postId);
    return instagram.handleInteraction(inter, {});
  });
  console.log('OK  insta_save butonu');

  await step('insta kapat onay yetkisiz', () => {
    const inter = makeButtonInteraction(bob, 'insta_kapat_onay');
    return instagram.handleInteraction(inter, {});
  });
  console.log('OK  insta_kapat_onay yetki kontrolu');

  await new Promise((r) => setTimeout(r, 3100));
  await step('insta kapat onay', () => {
    const inter = makeButtonInteraction(bob, 'insta_kapat_onay');
    return instagram.handleInteraction(inter, {});
  });
  db = JSON.parse(fs.readFileSync(path.join(DATA, 'instagram.json'), 'utf8'));
  assert(!db.accounts[bob.id], 'bob hesabi silindi');
  console.log('OK  insta_kapat_onay silme');

  console.log('--- INSTAGRAM TAMAM ---');

  await step('tw yardim', () => twitter.execute(makeMessage(alice, '.tw'), [], {}));
  await step('tw ac gecersiz', () => twitter.execute(makeMessage(alice, '.tw ac a-b'), ['ac', 'a-b'], {}));
  await step('tw ac', () => twitter.execute(makeMessage(alice, '.tw ac golazo_kral'), ['ac', 'golazo_kral'], {}));
  await step('tw bio', () => twitter.execute(makeMessage(alice, '.tw bio Golazo tutkunu'), ['bio', 'Golazo', 'tutkunu'], {}));
  await step('tw paylas', () => twitter.execute(makeMessage(alice, '.tw paylas Ilk tweetim'), ['paylas', 'Ilk', 'tweetim'], {}));
  console.log('OK  tw ac/bio/paylas');

  await new Promise((r) => setTimeout(r, 3100));
  let twdb = JSON.parse(fs.readFileSync(path.join(DATA, 'twitter.json'), 'utf8'));
  const twAlice = twdb.accounts[alice.id];
  assert(twAlice && twAlice.tweets.length === 1, 'tweet olustu');
  const tweetId = twAlice.tweets[0].id;

  await step('tw begen', () => twitter.execute(makeMessage(bob, '.tw begen ' + tweetId), ['begen', tweetId], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('tw retweet', () => twitter.execute(makeMessage(bob, '.tw retweet ' + tweetId), ['retweet', tweetId], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('tw kes', () => twitter.execute(makeMessage(bob, '.tw kes ' + tweetId + ' harika'), ['kes', tweetId, 'harika'], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('tw yanit', () => twitter.execute(makeMessage(bob, '.tw yanit ' + tweetId + ' katiliyorum'), ['yanit', tweetId, 'katiliyorum'], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('tw arama', () => twitter.execute(makeMessage(bob, '.tw arama tweetim'), ['arama', 'tweetim'], {}));
  await step('tw trend', () => twitter.execute(makeMessage(bob, '.tw trend'), ['trend'], {}));
  await step('tw feed render', () => twitter.execute(makeMessage(alice, '.tw feed'), ['feed'], {}));
  console.log('OK  tw alt komutlar + canvas render');
  assert(lastPayload().files && lastPayload().files.length > 0, 'tw feed dosyasi ekli');

  await new Promise((r) => setTimeout(r, 3100));
  await step('tw like button', () => {
    const inter = makeButtonInteraction(bob, 'tw_like_' + tweetId);
    return twitter.handleInteraction(inter, {});
  });
  await new Promise((r) => setTimeout(r, 3100));
  await step('tw rt button', () => {
    const inter = makeButtonInteraction(bob, 'tw_rt_' + tweetId);
    return twitter.handleInteraction(inter, {});
  });
  await new Promise((r) => setTimeout(r, 3100));
  await step('tw open button', () => {
    const inter = makeButtonInteraction(bob, 'tw_open_' + tweetId);
    return twitter.handleInteraction(inter, {});
  });
  console.log('OK  tw butonlari');

  await step('tw mavi bakiye yetersiz', () =>
    twitter.execute(makeMessage(admin, '.tw mavi @bob'), ['mavi'], { mention: mentionBob, admin: true })
  );
  await new Promise((r) => setTimeout(r, 3100));
  await step('tw profil render', () => twitter.execute(makeMessage(alice, '.tw profil'), ['profil'], {}));
  console.log('OK  tw mavi + profil render');

  console.log('--- TWITTER TAMAM ---');

  await step('tt yardim', () => tiktok.execute(makeMessage(alice, '.tt'), [], {}));
  await step('tt ac', () => tiktok.execute(makeMessage(alice, '.tt ac golazo.tik'), ['ac', 'golazo.tik'], {}));
  await step('tt bio kisa', () => tiktok.execute(makeMessage(alice, '.tt bio kisa bio'), ['bio', 'kisa', 'bio'], {}));
  await step('tt yukle', () => tiktok.execute(makeMessage(alice, '.tt yukle ilk video'), ['yukle', 'ilk', 'video'], {}));
  console.log('OK  tt ac/bio/yukle');

  await new Promise((r) => setTimeout(r, 3100));
  let ttdb = JSON.parse(fs.readFileSync(path.join(DATA, 'tiktok.json'), 'utf8'));
  const ttAlice = ttdb.accounts[alice.id];
  assert(ttAlice && ttAlice.videos.length === 1, 'video olustu');
  const videoId = ttAlice.videos[0].id;

  await step('tt begen', () => tiktok.execute(makeMessage(bob, '.tt begen ' + videoId), ['begen', videoId], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('tt yorum', () => tiktok.execute(makeMessage(bob, '.tt yorum ' + videoId + ' efsane'), ['yorum', videoId, 'efsane'], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('tt izlenme', () => tiktok.execute(makeMessage(bob, '.tt izlenme ' + videoId), ['izlenme', videoId], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('tt ses', () => tiktok.execute(makeMessage(alice, '.tt ses Derbi Ritmi'), ['ses', 'Derbi', 'Ritmi'], {}));
  await new Promise((r) => setTimeout(r, 3100));
  await step('tt fyp render', () => tiktok.execute(makeMessage(alice, '.tt fyp'), ['fyp'], {}));
  console.log('OK  tt alt komutlar + fyp render');
  assert(lastPayload().files && lastPayload().files.length > 0, 'tt fyp dosyasi ekli');

  await new Promise((r) => setTimeout(r, 3100));
  await step('tt profil render', () => tiktok.execute(makeMessage(alice, '.tt profil'), ['profil'], {}));
  console.log('OK  tt profil (dikey puppeteer render)');

  await new Promise((r) => setTimeout(r, 3100));
  await step('tt like button', () => {
    const inter = makeButtonInteraction(bob, 'tt_like_' + videoId);
    return tiktok.handleInteraction(inter, {});
  });
  await new Promise((r) => setTimeout(r, 3100));
  await step('tt share button', () => {
    const inter = makeButtonInteraction(bob, 'tt_share_' + videoId);
    return tiktok.handleInteraction(inter, {});
  });
  await new Promise((r) => setTimeout(r, 3100));
  await step('tt open button', () => {
    const inter = makeButtonInteraction(bob, 'tt_open_' + videoId);
    return tiktok.handleInteraction(inter, {});
  });
  console.log('OK  tt butonlari');

  await new Promise((r) => setTimeout(r, 3100));
  await step('tt dogrulanmis bakiye yetersiz', () =>
    tiktok.execute(makeMessage(admin, '.tt dogrulanmis @bob'), ['dogrulanmis'], { mention: mentionBob, admin: true })
  );
  await new Promise((r) => setTimeout(r, 3100));
  await step('tt kazanc', () => tiktok.execute(makeMessage(alice, '.tt kazanc'), ['kazanc'], {}));
  await step('tt cek', () => tiktok.execute(makeMessage(alice, '.tt cek 100'), ['cek', '100'], {}));
  console.log('OK  tt dogrulanmis/kazanc/cek');

  console.log('--- TIKTOK TAMAM ---');

  const npc = require('./npcActivity');
  const created = npc.ensureAccounts();
  npc.interconnect();
  assert(created.length === 15, '15 NPC hesap bekleniyordu, olustu: ' + created.length);
  const igFinal = JSON.parse(fs.readFileSync(path.join(DATA, 'instagram.json'), 'utf8'));
  const npcIds = Object.keys(igFinal.accounts).filter((k) => k.startsWith('npc_'));
  assert(npcIds.length === 5, '5 NPC instagram hesabi');
  const one = igFinal.accounts[npcIds[0]];
  assert(one.following.length === 4, 'NPC karşilikli takip');
  console.log('OK  NPC sistemi (' + created.length + ' hesap, karsilikli takip)');

  const players = JSON.parse(fs.readFileSync(path.join(DATA, 'players.json'), 'utf8'));
  assert(players.players && typeof players.players === 'object', 'players.json yapisi');
  console.log('OK  players.json -> ' + JSON.stringify(Object.keys(players.players)));

  const emojiKeys = Object.keys(require('./utils').config.emojis);
  for (const key of emojiKeys) {
    const val = require('./utils').config.emojis[key];
    assert(/^<:[a-z0-9_]+:\d+>$/.test(val), 'emoji formati hatali: ' + key + ' = ' + val);
  }
  console.log('OK  tum emojiler custom format (' + emojiKeys.length + ' adet)');

  console.log('\n===== TUM TESTLER GECTI =====');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nTEST BASARISIZ:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
