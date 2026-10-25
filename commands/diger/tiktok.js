'use strict';

const {
  FLAGS_V2,
  FLAGS_V2_EPHEMERAL,
  config,
  loadJSON,
  saveJSON,
  generateId,
  checkCooldown,
  buildSuccessPanel,
  buildErrorPanel,
  sendV2,
  payloadV2,
  pushMediaGallery,
  makeButton,
  rowOf,
  AttachmentBuilder,
  formatCount,
  formatMoney,
  timeAgo,
  norm,
  parseAmount,
  getPlayer,
  getBalance,
  addMoney,
  spendMoney,
  pushNotification,
  milestoneText,
  emo,
  truncate,
  resolveTargetUser
} = require('../../utils');

const DB_FILE = 'tiktok.json';
const LIKE_REWARD = config.economy.tiktokLike;
const VIEW_REWARD = config.economy.tiktokView;
const SHARE_REWARD = config.economy.tiktokShare;
const DEFAULT_SOUND = 'Golazo Original Sound';

function loadDb() {
  const data = loadJSON(DB_FILE, { accounts: {}, index: {} });
  if (!data.accounts) data.accounts = {};
  if (!data.index) data.index = {};
  return data;
}

function saveDb(data) {
  return saveJSON(DB_FILE, data);
}

function getAccount(data, userId) {
  return data.accounts[String(userId)] || null;
}

function findByHandle(data, handle) {
  const key = String(handle || '').toLowerCase();
  const userId = data.index[key];
  return userId ? data.accounts[userId] || null : null;
}

function indexAccount(data, account) {
  data.index[String(account.username).toLowerCase()] = account.userId;
}

function profileAvatar(user) {
  try {
    if (user && typeof user.displayAvatarURL === 'function') {
      return user.displayAvatarURL({ extension: 'png', size: 256 });
    }
  } catch (err) { }
  return '';
}

function firstName(user, fallback) {
  const name = (user && (user.displayName || user.username)) || fallback || 'Golazo';
  return name.split(/\s+/)[0] || name;
}

function createAccount(data, user, handle) {
  const account = {
    id: generateId('ttusr'),
    userId: String(user.id),
    username: handle,
    displayName: firstName(user, handle),
    avatar: profileAvatar(user),
    bio: '',
    verified: false,
    followers: [],
    following: [],
    videos: [],
    earnings: 0,
    joinDate: Date.now(),
    notifications: []
  };
  data.accounts[account.userId] = account;
  indexAccount(data, account);
  return account;
}

function deleteAccount(data, userId) {
  const account = data.accounts[String(userId)];
  if (!account) return false;
  delete data.index[String(account.username).toLowerCase()];
  delete data.accounts[String(userId)];
  for (const other of Object.values(data.accounts)) {
    const fIdx = other.followers.indexOf(String(userId));
    if (fIdx > -1) other.followers.splice(fIdx, 1);
    const fgIdx = other.following.indexOf(String(userId));
    if (fgIdx > -1) other.following.splice(fgIdx, 1);
  }
  return true;
}

function allVideos(data) {
  const out = [];
  for (const account of Object.values(data.accounts)) {
    for (const video of account.videos) out.push({ video, account });
  }
  return out;
}

function findVideo(data, videoId) {
  for (const account of Object.values(data.accounts)) {
    const video = account.videos.find((v) => v.id === videoId);
    if (video) return { video, account };
  }
  return null;
}

function totalLikes(account) {
  return account.videos.reduce((sum, v) => sum + v.likes.length, 0);
}

function totalViews(account) {
  return account.videos.reduce((sum, v) => sum + (v.views || 0), 0);
}

function notifyFollowers(data, sourceId, text) {
  const source = data.accounts[String(sourceId)];
  if (!source) return;
  for (const followerId of source.followers) {
    const target = data.accounts[String(followerId)];
    if (target) pushNotification(target, 'follow', text, 5);
  }
}

function buildVideoCard(data, account, video, state) {
  const flags = state || {};
  const rows = [
    rowOf(
      makeButton({
        id: 'tt_like_' + video.id,
        label: 'Be\u011fen ' + formatCount(video.likes.length),
        style: flags.liked ? 3 : 2,
        emojiKey: 'like'
      }),
      makeButton({
        id: 'tt_share_' + video.id,
        label: 'Payla\u015f ' + formatCount(video.shares ? video.shares.length : 0),
        style: flags.shared ? 3 : 2,
        emojiKey: 'share'
      }),
      makeButton({
        id: 'tt_open_' + video.id,
        label: '\u0130zle',
        style: 2,
        emojiKey: 'view'
      })
    )
  ];

  const lines = [
    emo('user') + ' **@' + account.username + '**' + (account.verified ? ' ' + emo('verified') : '') + ' \u2022 ' + timeAgo(video.timestamp) + ' \u00f6nce',
    emo('video') + ' ' + truncate(video.caption, 700),
    emo('sound') + ' ' + (video.sound || DEFAULT_SOUND),
    emo('view') + ' ' + formatCount(video.views || 0) +
      '  ' + emo('like') + ' ' + formatCount(video.likes.length) +
      '  ' + emo('comment') + ' ' + formatCount(video.comments.length) +
      '  ' + emo('share') + ' ' + formatCount(video.shares ? video.shares.length : 0)
  ];

  if (video.comments && video.comments.length) {
    const last = video.comments.slice(-2);
    lines.push(emo('comment') + ' **Yorumlar**\n' + last.map((c) => '\u2022 ' + truncate(c.text, 110)).join('\n'));
  }

  const media = video.mediaUrl ? [video.mediaUrl] : [];

  return buildSuccessPanel('Video \u2022 ' + video.id, lines.join('\n'), {
    color: config.colors.tiktok,
    emojiKey: 'tiktok',
    thumbnailKey: 'tiktok',
    thumbnail: account.avatar || undefined,
    media: media,
    rows: rows,
    footer: 'Golazo League \u2022 TikTok'
  });
}

function accountPanel(account) {
  const fields = [
    (account.verified ? emo('verified') + ' **Do\u011frulanm\u0131\u015f**\n' : '') +
      (account.bio ? truncate(account.bio, 200) + '\n' : '') +
      (milestoneText(account.followers.length)
        ? emo('star') + ' ' + milestoneText(account.followers.length) + '\n'
        : ''),
    emo('video') + ' **' + formatCount(account.videos.length) + '** video  ' +
      emo('follow') + ' **' + formatCount(account.followers.length) + '** takip\u00e7i  ' +
      emo('user') + ' **' + formatCount(account.following.length) + '** takip',
    emo('view') + ' Toplam izlenme: **' + formatCount(totalViews(account)) + '**  ' +
      emo('like') + ' Be\u011feni: **' + formatCount(totalLikes(account)) + '**',
    emo('money') + ' Creator Fund: **' + formatMoney(account.earnings) + '**'
  ].filter((f) => f && f.trim());

  return buildSuccessPanel('@' + account.username, 'Golazo League TikTok hesab\u0131', {
    color: config.colors.tiktok,
    emojiKey: 'tiktok',
    thumbnailKey: 'tiktok',
    thumbnail: account.avatar || undefined,
    fields: fields,
    footer: 'Golazo League \u2022 TikTok'
  });
}

function errPanel(text, title) {
  return buildErrorPanel(text, {
    color: config.colors.tiktok,
    title: title || 'TikTok Hatas\u0131',
    emojiKey: 'tiktok'
  });
}

function helpPanel() {
  const lines = [
    emo('tiktok') + ' **TikTok Alt Komutlar\u0131**',
    '`.tt ac <kullan\u0131c\u0131_adi>` \u2022 `.tt kapat` \u2022 `.tt profil [@kullan\u0131c\u0131]`',
    '`.tt bio <metin>` \u2022 `.tt takip @kullan\u0131c\u0131` \u2022 `.tt fyp`',
    '`.tt yukle <ba\u015fl\u0131k> [video/ek]` \u2022 `.tt begen <id>` \u2022 `.tt yorum <id> <metin>`',
    '`.tt izlenme <id>` \u2022 `.tt ses <ses_adi>` \u2022 `.tt bildirim`',
    '`.tt dogrulanmis @kullan\u0131c\u0131` (admin) \u2022 `.tt kazanc` \u2022 `.tt cek <miktar>`'
  ];
  return buildSuccessPanel('TikTok Sim\u00fclasyonu', lines.join('\n'), {
    color: config.colors.tiktok,
    emojiKey: 'tiktok',
    thumbnailKey: 'tiktok',
    footer: 'Golazo League \u2022 TikTok'
  });
}

function isAdmin(message) {
  try {
    return Boolean(message.member && message.member.permissions && message.member.permissions.has('Administrator'));
  } catch (err) {
    return false;
  }
}

async function renderProfileImage(account) {
  const renderer = require('./tiktokRenderer');
  return renderer.renderProfile({
    username: account.username,
    displayName: account.displayName,
    avatar: account.avatar,
    bio: account.bio,
    verified: account.verified,
    letter: firstName({ displayName: account.displayName }, account.username).charAt(0).toUpperCase(),
    followers: account.followers.length,
    following: account.following.length,
    likesTotal: totalLikes(account),
    videos: account.videos.slice(-9).reverse().map((v) => ({
      image: v.mediaUrl,
      views: v.views || 0
    }))
  });
}

async function execute(message, args, client) {
  try {
    const data = loadDb();
    const sub = norm(args[0] || 'yardim');
    const me = getAccount(data, message.author.id);

    if (sub === 'yardim' || sub === 'help' || sub === '') {
      return sendV2(message, helpPanel());
    }

    if (sub === 'ac') {
      const handle = (args[1] || '').replace(/[^a-zA-Z0-9._]/g, '');
      if (!handle || handle.length < 3 || handle.length > 20) {
        return sendV2(
          message,
          errPanel('Kullan\u0131c\u0131 ad\u0131 3-20 karakter olmal\u0131.\n\u00d6rnek: `.tt ac golazo.tiktok`')
        );
      }
      if (me) return sendV2(message, errPanel('Zaten hesab\u0131n var: **@' + me.username + '**. Silmek i\u00e7in `.tt kapat`.'));
      if (findByHandle(data, handle)) return sendV2(message, errPanel('**@' + handle + '** zaten al\u0131nm\u0131\u015f.'));
      const account = createAccount(data, message.author, handle);
      saveDb(data);
      getPlayer(message.author.id, message.author.username);
      return sendV2(
        message,
        buildSuccessPanel(
          'Hesab\u0131n A\u00e7\u0131ld\u0131',
          emo('success') + ' **@' + account.username + '** TikTok hesab\u0131 olu\u015fturuldu!\n\u0130lk video: `.tt yukle <ba\u015fl\u0131k>`',
          {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            thumbnail: account.avatar || undefined,
            footer: 'Golazo League \u2022 TikTok'
          }
        )
      );
    }

    if (sub === 'kapat' || sub === 'sil') {
      if (!me) return sendV2(message, errPanel('Silinecek hesab\u0131n yok. \u00d6nce `.tt ac <kullan\u0131c\u0131_adi>`.'));
      const rows = [
        rowOf(
          makeButton({ id: 'tt_kapat_onay', label: 'Evet, sil', style: 4, emojiKey: 'close' }),
          makeButton({ id: 'tt_kapat_iptal', label: 'Vazge\u00e7', style: 2, emojiKey: 'check' })
        )
      ];
      return sendV2(
        message,
        buildErrorPanel('**@' + me.username + '** hesab\u0131 kal\u0131c\u0131 olarak silinecek. Emin misin?', {
          color: config.colors.error,
          title: 'Hesab\u0131 Kapat',
          emojiKey: 'lock',
          rows: rows,
          footer: 'Golazo League \u2022 TikTok'
        })
      );
    }

    if (!me) {
      return sendV2(message, errPanel('\u00d6nce hesap a\u00e7: `.tt ac <kullan\u0131c\u0131_adi>`'));
    }

    if (sub === 'profil' || sub === 'profile') {
      const targetUser = resolveTargetUser(message, args[1]);
      let target = me;
      if (args[1] && !targetUser) {
        target = findByHandle(data, String(args[1]).replace(/^@/, ''));
      } else if (targetUser && targetUser.id !== message.author.id) {
        target = getAccount(data, targetUser.id) || findByHandle(data, String(args[1] || '').replace(/^@/, ''));
      }
      if (!target) return sendV2(message, errPanel('B\u00f6yle bir TikTok hesab\u0131 bulunamad\u0131.'));
      const cd = checkCooldown(message.author.id, 'tt:profil', 3000);
      if (!cd.ok) return sendV2(message, errPanel('L\u00fctfen ' + cd.remaining + ' sn bekle.', 'Rate Limit'));
      try {
        const buffer = await renderProfileImage(target);
        if (buffer) {
          const files = [new AttachmentBuilder(buffer, { name: 'tt_profile.png' })];
          const container = accountPanel(target);
          const payload = payloadV2(container, { files });
          pushMediaGallery(payload, 'attachment://tt_profile.png');
          return message.reply({
            components: payload.components,
            files: payload.files,
            flags: FLAGS_V2,
            allowedMentions: { parse: [] }
          });
        }
      } catch (err) { }
      return sendV2(message, accountPanel(target));
    }

    if (sub === 'bio') {
      const text = args.slice(1).join(' ').trim();
      if (!text) return sendV2(message, errPanel('Kullan\u0131m: `.tt bio <metin>` (en fazla 80 karakter)'));
      if (text.length > 80) return sendV2(message, errPanel('Bio en fazla 80 karakter olabilir. (Senin: ' + text.length + ')'));
      me.bio = text;
      saveDb(data);
      return sendV2(
        message,
        buildSuccessPanel('Bio G\u00fcncellendi', emo('check') + ' ' + truncate(text, 300), {
          color: config.colors.tiktok,
          emojiKey: 'tiktok',
          thumbnailKey: 'tiktok',
          thumbnail: me.avatar || undefined,
          footer: 'Golazo League \u2022 TikTok'
        })
      );
    }

    if (sub === 'takip' || sub === 'follow') {
      const targetUser = resolveTargetUser(message, args[1]);
      if (!targetUser || targetUser.id === message.author.id) {
        return sendV2(message, errPanel('Kendini takip edemezs\u0131n. Kullan\u0131m: `.tt takip @kullan\u0131c\u0131`'));
      }
      const target = getAccount(data, targetUser.id);
      if (!target) return sendV2(message, errPanel('Bu kullan\u0131c\u0131n\u0131n TikTok hesab\u0131 yok.'));
      const myId = String(message.author.id);
      const targetId = String(target.userId);
      const iFollow = me.following.indexOf(targetId);
      if (iFollow > -1) {
        me.following.splice(iFollow, 1);
        const fIdx = target.followers.indexOf(myId);
        if (fIdx > -1) target.followers.splice(fIdx, 1);
        saveDb(data);
        return sendV2(
          message,
          buildSuccessPanel('Takipten \u00c7\u0131k\u0131ld\u0131', emo('follow') + ' **@' + target.username + '** takip edilmiyor.', {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            footer: 'Golazo League \u2022 TikTok'
          })
        );
      }
      me.following.push(targetId);
      target.followers.push(myId);
      pushNotification(target, 'follow', '@' + me.username + ' seni takip etti.', 5);
      const before = target.followers.length - 1;
      const crossed = config.milestones.some((m) => before < m && target.followers.length >= m);
      if (crossed) {
        pushNotification(target, 'milestone', 'Takip\u00e7in ' + formatCount(target.followers.length) + ' oldu!', 5);
      }
      saveDb(data);
      return sendV2(
        message,
        buildSuccessPanel(
          'Takip Edildi',
          emo('follow') + ' **@' + target.username + '** takip edildi.\n' +
            emo('user') + ' Toplam: **' + formatCount(target.followers.length) + '**' +
            (crossed ? '\n' + emo('star') + ' Milestone: **' + milestoneText(target.followers.length) + '**' : ''),
          {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            thumbnail: target.avatar || undefined,
            footer: 'Golazo League \u2022 TikTok'
          }
        )
      );
    }

    if (sub === 'yukle' || sub === 'video' || sub === 'paylas') {
      const cd = checkCooldown(message.author.id, 'tt:yukle', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const text = args.slice(1).join(' ').trim();
      const attachment = message.attachments && message.attachments.first ? message.attachments.first() : null;
      if (!text && !attachment) return sendV2(message, errPanel('Kullan\u0131m: `.tt yukle <ba\u015fl\u0131k/a\u00e7\u0131klama> [video/g\u00f6rsel]`'));
      const video = {
        id: generateId('ttv'),
        authorId: String(me.userId),
        caption: truncate(text || 'Yeni video', 400),
        mediaUrl: attachment ? attachment.url : null,
        likes: [],
        views: 0,
        viewUsers: [],
        comments: [],
        shares: [],
        sound: DEFAULT_SOUND,
        trending: 0,
        timestamp: Date.now()
      };
      me.videos.push(video);
      saveDb(data);
      notifyFollowers(data, me.userId, '@' + me.username + ' yeni video y\u00fckledi: ' + truncate(video.caption, 70));
      return sendV2(message, buildVideoCard(data, me, video, { liked: false, shared: false }));
    }

    if (sub === 'ses' || sub === 'sound') {
      const cd = checkCooldown(message.author.id, 'tt:ses', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const soundName = args.slice(1).join(' ').trim();
      if (!soundName) return sendV2(message, errPanel('Kullan\u0131m: `.tt ses <ses_adi>`'));
      const attachment = message.attachments && message.attachments.first ? message.attachments.first() : null;
      const video = {
        id: generateId('ttv'),
        authorId: String(me.userId),
        caption: truncate('\u2018' + soundName + '\u2019 trend sesiyle \u00e7ekilen video', 400),
        mediaUrl: attachment ? attachment.url : null,
        likes: [],
        views: 0,
        viewUsers: [],
        comments: [],
        shares: [],
        sound: truncate(soundName, 80),
        trending: 1,
        timestamp: Date.now()
      };
      me.videos.push(video);
      saveDb(data);
      notifyFollowers(data, me.userId, '@' + me.username + ' trend sesle video \u00e7ekti.');
      return sendV2(
        message,
        buildVideoCard(data, me, video, { liked: false, shared: false })
      );
    }

    if (sub === 'begen' || sub === 'like') {
      const cd = checkCooldown(message.author.id, 'tt:begen', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const found = findVideo(data, args[1] || '');
      if (!found) return sendV2(message, errPanel('Video bulunamad\u0131. Do\u011fru video_id kullan.'));
      const myId = String(message.author.id);
      const idx = found.video.likes.indexOf(myId);
      if (idx > -1) {
        found.video.likes.splice(idx, 1);
        saveDb(data);
        return sendV2(message, buildVideoCard(data, found.account, found.video, { shared: false }));
      }
      found.video.likes.push(myId);
      if (String(found.account.userId) !== myId) {
        found.account.earnings += LIKE_REWARD;
        pushNotification(found.account, 'like', '@' + me.username + ' videonu be\u011fendi (+' + formatMoney(LIKE_REWARD) + ')', 5);
      }
      saveDb(data);
      return sendV2(message, buildVideoCard(data, found.account, found.video, { liked: true, shared: false }));
    }

    if (sub === 'yorum' || sub === 'comment') {
      const cd = checkCooldown(message.author.id, 'tt:yorum', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const found = findVideo(data, args[1] || '');
      const text = args.slice(2).join(' ').trim();
      if (!found || !text) return sendV2(message, errPanel('Kullan\u0131m: `.tt yorum <video_id> <metin>`'));
      const comment = {
        id: generateId('ttc'),
        authorId: String(me.userId),
        authorHandle: me.username,
        text: truncate(text, 300),
        createdAt: Date.now()
      };
      found.video.comments.push(comment);
      if (String(found.account.userId) !== String(me.userId)) {
        pushNotification(found.account, 'comment', '@' + me.username + ' yorum yapt\u0131: ' + truncate(text, 80), 5);
      }
      saveDb(data);
      return sendV2(
        message,
        buildSuccessPanel('Yorum Yap\u0131ld\u0131', emo('comment') + ' **@' + me.username + '** \u2192 ' + found.video.id + '\n' + truncate(comment.text, 300), {
          color: config.colors.tiktok,
          emojiKey: 'tiktok',
          thumbnailKey: 'tiktok',
          footer: 'Golazo League \u2022 TikTok'
        })
      );
    }

    if (sub === 'izlenme' || sub === 'izle' || sub === 'view') {
      const cd = checkCooldown(message.author.id, 'tt:izlenme', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const found = findVideo(data, args[1] || '');
      if (!found) return sendV2(message, errPanel('Video bulunamad\u0131.'));
      const myId = String(message.author.id);
      found.video.views = (found.video.views || 0) + 1;
      if (!Array.isArray(found.video.viewUsers)) found.video.viewUsers = [];
      let rewardText = '';
      if (String(found.account.userId) !== myId) {
        found.account.earnings += VIEW_REWARD;
        rewardText = '\n' + emo('money') + ' Yazar **' + formatMoney(VIEW_REWARD) + '** kazand\u0131.';
        if (found.video.views % 10 === 0) {
          pushNotification(found.account, 'milestone', 'Video ' + formatCount(found.video.views) + ' izlenmeye ula\u015ft\u0131!', 5);
        }
      }
      if (found.video.viewUsers.indexOf(myId) === -1) found.video.viewUsers.push(myId);
      saveDb(data);
      return sendV2(
        message,
        buildVideoCard(data, found.account, found.video, {
          liked: found.video.likes.indexOf(myId) > -1,
          shared: Boolean(found.video.shares && found.video.shares.indexOf(myId) > -1)
        })
      );
    }

    if (sub === 'fyp' || sub === 'kesfet' || sub === 'discover') {
      const cd = checkCooldown(message.author.id, 'tt:fyp', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const pool = allVideos(data);
      if (!pool.length) {
        return sendV2(
          message,
          buildErrorPanel('Hen\u00fcz hi\u00e7 video yok. \u0130lk trendi sen ba\u015flat: `.tt yukle <ba\u015fl\u0131k>`', {
            color: config.colors.tiktok,
            title: 'FYP Bo\u015f',
            emojiKey: 'tiktok'
          })
        );
      }
      const byViews = pool.slice().sort((a, b) => (b.video.views || 0) - (a.video.views || 0)).slice(0, 3);
      const rest = pool.filter((entry) => byViews.indexOf(entry) === -1).sort(() => Math.random() - 0.5).slice(0, 3);
      const picks = byViews.concat(rest).slice(0, 5);
      try {
        const renderer = require('./tiktokRenderer');
        const buffer = await renderer.renderFyp(
          picks.map((entry) => ({
            caption: entry.video.caption,
            username: entry.account.username,
            displayName: entry.account.displayName,
            avatar: entry.account.avatar,
            verified: entry.account.verified,
            image: entry.video.mediaUrl,
            sound: entry.video.sound || DEFAULT_SOUND,
            views: entry.video.views || 0,
            likes: entry.video.likes.length,
            comments: (entry.video.comments || []).length
          }))
        );
        if (buffer) {
          const files = [new AttachmentBuilder(buffer, { name: 'tt_fyp.png' })];
          const container = buildSuccessPanel('Senin \u0130\u00e7in \u2022 FYP', emo('fire') + ' En \u00e7ok izlenen ve trend videolar', {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            footer: 'Golazo League \u2022 TikTok'
          });
          const payload = payloadV2(container, { files });
          pushMediaGallery(payload, 'attachment://tt_fyp.png');
          return message.reply({
            components: payload.components,
            files: payload.files,
            flags: FLAGS_V2,
            allowedMentions: { parse: [] }
          });
        }
      } catch (err) { }
      const lines = picks.map(
        (entry, i) =>
          (i < 3 ? emo('fire') : emo('video')) +
          ' **@' + entry.account.username + '** \u2013 ' + truncate(entry.video.caption, 140) +
          '\n' + emo('view') + ' ' + formatCount(entry.video.views || 0) +
          '  ' + emo('like') + ' ' + formatCount(entry.video.likes.length) +
          '  ' + emo('sound') + ' ' + truncate(entry.video.sound || DEFAULT_SOUND, 40)
      );
      return sendV2(
        message,
        buildSuccessPanel('Senin \u0130\u00e7in \u2022 FYP', lines.join('\n\n'), {
          color: config.colors.tiktok,
          emojiKey: 'tiktok',
          thumbnailKey: 'tiktok',
          footer: 'Golazo League \u2022 TikTok'
        })
      );
    }

    if (sub === 'dogrulanmis' || sub === 'verified' || sub === 'onay') {
      if (!isAdmin(message)) {
        return sendV2(
          message,
          buildErrorPanel('Bu komutu yaln\u0131zca y\u00f6neticiler kullanabilir.', {
            color: config.colors.error,
            title: 'Yetki Hatas\u0131',
            emojiKey: 'lock'
          })
        );
      }
      const targetUser = resolveTargetUser(message, args[1]);
      if (!targetUser) return sendV2(message, errPanel('Kullan\u0131m: `.tt dogrulanmis @kullan\u0131c\u0131`'));
      const target = getAccount(data, targetUser.id);
      if (!target) return sendV2(message, errPanel('Bu kullan\u0131c\u0131n\u0131n TikTok hesab\u0131 yok.'));
      if (target.verified) return sendV2(message, errPanel('**@' + target.username + '** zaten do\u011frulanm\u0131\u015f.'));
      const cost = config.economy.verifyTiktok;
      if (!spendMoney(target.userId, cost)) {
        return sendV2(
          message,
          errPanel(
            'Hedefin bakiyesi yetersiz. Gerekli: **' + formatMoney(cost) + '**, mevcut: **' + formatMoney(getBalance(target.userId)) + '**',
            'Bakiye Yetersiz'
          )
        );
      }
      target.verified = true;
      pushNotification(target, 'verified', 'TikTok hesab\u0131na do\u011frulama rozeti verildi!', 5);
      saveDb(data);
      return sendV2(
        message,
        buildSuccessPanel(
          'Do\u011frulama Rozeti',
          emo('verified') + ' **@' + target.username + '** do\u011frulanm\u0131\u015f hesap oldu.\n' + emo('money') + ' Hekesten **' + formatMoney(cost) + '** kesildi.',
          {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            thumbnail: target.avatar || undefined,
            footer: 'Golazo League \u2022 TikTok'
          }
        )
      );
    }

    if (sub === 'kazanc' || sub === 'earnings' || sub === 'creator') {
      return sendV2(
        message,
        buildSuccessPanel(
          'Creator Fund',
          emo('money') + ' Bekleyen kazan\u00e7: **' + formatMoney(me.earnings) + '**\n' +
            emo('chart') + ' C\u00fck bakiye: **' + formatMoney(getBalance(me.userId)) + '**\n' +
            emo('info') + ' \u00c7ekmek i\u00e7in: `.tt cek <miktar>`',
          {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            thumbnail: me.avatar || undefined,
            footer: 'Golazo League \u2022 TikTok'
          }
        )
      );
    }

    if (sub === 'cek' || sub === 'withdraw') {
      const amount = parseAmount(args[1]);
      if (!amount) return sendV2(message, errPanel('Kullan\u0131m: `.tt cek <miktar>` \u2013 mevcut: **' + formatMoney(me.earnings) + '**'));
      if (amount > me.earnings) return sendV2(message, errPanel('Yetersiz kazan\u00e7. Mevcut: **' + formatMoney(me.earnings) + '**', 'Bakiye Yetersiz'));
      me.earnings -= amount;
      const newBalance = addMoney(me.userId, amount, me.username);
      saveDb(data);
      return sendV2(
        message,
        buildSuccessPanel(
          'Kazan\u00e7 \u00c7ekildi',
          emo('money') + ' **' + formatMoney(amount) + '** ekonomiye aktar\u0131ld\u0131.\n' + emo('chart') + ' Yeni bakiye: **' + formatMoney(newBalance) + '**',
          {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            footer: 'Golazo League \u2022 TikTok'
          }
        )
      );
    }

    if (sub === 'bildirim' || sub === 'bildirimler' || sub === 'notifications') {
      const list = (me.notifications || []).slice(0, 5);
      if (!list.length) {
        return sendV2(
          message,
          buildSuccessPanel('Bildirimler', emo('bell') + ' Hen\u00fcz bildirimin yok.', {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            footer: 'Golazo League \u2022 TikTok'
          })
        );
      }
      const lines = list.map(
        (n) => emo('bell') + ' ' + (n.read ? '' : '**') + truncate(n.text, 120) + (n.read ? '' : '**') + ' \u2013 ' + timeAgo(n.createdAt) + ' \u00f6nce'
      );
      for (const n of me.notifications) n.read = true;
      saveDb(data);
      return sendV2(
        message,
        buildSuccessPanel('Son Bildirimler', lines.join('\n'), {
          color: config.colors.tiktok,
          emojiKey: 'tiktok',
          thumbnailKey: 'tiktok',
          footer: 'Golazo League \u2022 TikTok'
        })
      );
    }

    return sendV2(message, helpPanel());
  } catch (err) {
    try {
      return sendV2(message, errPanel('Beklenmeyen hata: ' + truncate(err.message, 200)));
    } catch (err2) {
      return null;
    }
  }
}

const cardMessages = new Set();

function trackCard(id) {
  cardMessages.add(id);
  if (cardMessages.size > 300) {
    const first = cardMessages.values().next();
    if (!first.done) cardMessages.delete(first.value);
  }
}

async function handleInteraction(interaction, client) {
  try {
    const customId = interaction.customId || '';
    const data = loadDb();
    const me = getAccount(data, interaction.user.id);

    if (customId === 'tt_kapat_iptal') {
      return interaction.update({ components: payloadV2(
          buildSuccessPanel('Vazge\u00e7ildi', emo('check') + ' Hesab\u0131n silinmedi.', {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            footer: 'Golazo League \u2022 TikTok'
          })
        ).components });
    }

    if (customId === 'tt_kapat_onay') {
      if (!me) {
        return interaction.update({ components: payloadV2(errPanel('Silinecek hesab\u0131n yok.')).components });
      }
      if (String(interaction.user.id) !== String(me.userId)) {
        return interaction.update({ components: payloadV2(errPanel('Bu i\u015flemi sadece hesab\u0131n sahibi yapabilir.', 'Yetki Hatas\u0131')).components });
      }
      deleteAccount(data, me.userId);
      saveDb(data);
      return interaction.update({ components: payloadV2(
          buildSuccessPanel('Hesap Silindi', emo('success') + ' **@' + me.username + '** silindi.', {
            color: config.colors.tiktok,
            emojiKey: 'tiktok',
            thumbnailKey: 'tiktok',
            footer: 'Golazo League \u2022 TikTok'
          })
        ).components });
    }

    const likeMatch = customId.match(/^tt_like_(.+)$/);
    const shareMatch = customId.match(/^tt_share_(.+)$/);
    const openMatch = customId.match(/^tt_open_(.+)$/);

    if (!likeMatch && !shareMatch && !openMatch) return null;

    const videoId = (likeMatch || shareMatch || openMatch)[1];
    const found = findVideo(data, videoId);

    const respond = async (container) => {
      const payload = payloadV2(container, { ephemeral: true });
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    };

    if (!found) return respond(errPanel('Video art\u0131k mevcut de\u011fil.'));

    if (openMatch) {
      try {
        const renderer = require('./tiktokRenderer');
        const buffer = await renderer.renderVideoCard({
          caption: found.video.caption,
          username: found.account.username,
          displayName: found.account.displayName,
          avatar: found.account.avatar,
          image: found.video.mediaUrl,
          verified: found.account.verified,
          sound: found.video.sound || DEFAULT_SOUND,
          views: found.video.views || 0,
          likes: found.video.likes.length,
          comments: found.video.comments.length
        });
        if (buffer) {
          const files = [new AttachmentBuilder(buffer, { name: 'tt_video.png' })];
          const container = buildVideoCard(data, found.account, found.video, {});
          const payload = payloadV2(container, { ephemeral: true, files });
          pushMediaGallery(payload, 'attachment://tt_video.png');
          if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
          return interaction.reply(payload);
        }
      } catch (err) { }
      return respond(buildVideoCard(data, found.account, found.video, {}));
    }

    if (!me) return respond(errPanel('\u00d6nce `.tt ac <kullan\u0131c\u0131_adi>` ile hesap a\u00e7.'));

    const cd = checkCooldown(interaction.user.id, 'tt:button', 3000);
    if (!cd.ok) return respond(errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));

    const myId = String(me.userId);

    if (likeMatch) {
      const idx = found.video.likes.indexOf(myId);
      if (idx > -1) {
        found.video.likes.splice(idx, 1);
      } else {
        found.video.likes.push(myId);
        if (String(found.account.userId) !== myId) {
          found.account.earnings += LIKE_REWARD;
          pushNotification(found.account, 'like', '@' + me.username + ' videonu be\u011fendi (+' + formatMoney(LIKE_REWARD) + ')', 5);
        }
      }
    } else if (shareMatch) {
      if (!Array.isArray(found.video.shares)) found.video.shares = [];
      const idx = found.video.shares.indexOf(myId);
      if (idx > -1) {
        found.video.shares.splice(idx, 1);
      } else {
        found.video.shares.push(myId);
        if (String(found.account.userId) !== myId) {
          found.account.earnings += SHARE_REWARD;
          pushNotification(found.account, 'share', '@' + me.username + ' videonu payla\u015ft\u0131 (+' + formatMoney(SHARE_REWARD) + ')', 5);
        }
      }
    }

    saveDb(data);

    const container = buildVideoCard(data, found.account, found.video, {
      liked: found.video.likes.indexOf(myId) > -1,
      shared: Boolean(found.video.shares && found.video.shares.indexOf(myId) > -1)
    });
    const payload = payloadV2(container, { files: [] });

    if (cardMessages.has(interaction.message.id)) {
      return interaction.update({
        components: payload.components,
        files: payload.files
      });
    }

    const result = await interaction.reply(payloadV2(container, { ephemeral: true }));
    try {
      if (result && result.id) trackCard(result.id);
    } catch (err) { }
    return result;
  } catch (err) {
    try {
      const payload = payloadV2(errPanel('Beklenmeyen hata: ' + truncate(err.message, 200)), { ephemeral: true });
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    } catch (err2) {
      return null;
    }
  }
}

module.exports = {
  name: 'tt',
  aliases: ['tiktok'],
  description: 'Golazo League TikTok sim\u00fclasyonu',
  usage: '.tt <alt komut>',
  execute,
  handleInteraction
};
