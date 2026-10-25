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
  makeButton,
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
  resolveTargetUser,
  rowOf,
  AttachmentBuilder
} = require('../../utils');

const DB_FILE = 'instagram.json';
const REWARD = config.economy.instagramLike;
const HANDLE_RE = /^[a-zA-Z0-9._]{3,20}$/;

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
    id: generateId('igusr'),
    userId: String(user.id),
    username: handle,
    displayName: firstName(user, handle),
    avatar: profileAvatar(user),
    bio: '',
    verified: false,
    followers: [],
    following: [],
    posts: [],
    stories: [],
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

function allPosts(data) {
  const out = [];
  for (const account of Object.values(data.accounts)) {
    for (const post of account.posts) {
      out.push({ post, account });
    }
  }
  return out;
}

function findPost(data, postId) {
  for (const account of Object.values(data.accounts)) {
    const post = account.posts.find((p) => p.id === postId);
    if (post) return { post, account };
  }
  return null;
}

function activeStories(account) {
  const now = Date.now();
  return (account.stories || []).filter((s) => s.expiresAt > now);
}

function postSummary(post, account) {
  return (
    emo('instagram') +
    ' **' +
    post.id +
    '** \u2022 @' +
    account.username +
    '\n' +
    truncate(post.text, 180) +
    '\n' +
    emo('like') +
    ' ' +
    formatCount(post.likes.length) +
    '  ' +
    emo('comment') +
    ' ' +
    formatCount(post.comments.length) +
    '  ' +
    emo('save') +
    ' ' +
    formatCount(post.saves.length) +
    '  ' +
    emo('clock') +
    ' ' +
    timeAgo(post.createdAt)
  );
}

function accountPanel(account, extra) {
  const fields = [
    (account.verified ? emo('verified') + ' **Do\u011frulanm\u0131\u015f**\n' : '') +
      (account.bio ? truncate(account.bio, 300) + '\n' : '') +
      (milestoneText(account.followers.length)
        ? emo('star') + ' ' + milestoneText(account.followers.length) + '\n'
        : ''),
    emo('image') + ' **' + formatCount(account.posts.length) + '** g\u00f6nderi  ' +
      emo('follow') + ' **' + formatCount(account.followers.length) + '** takip\u00e7i  ' +
      emo('user') + ' **' + formatCount(account.following.length) + '** takip',
    emo('money') + ' Kazan\u00e7: **' + formatMoney(account.earnings) + '**'
  ].filter((f) => f && f.trim());

  return buildSuccessPanel(
    (account.verified ? emo('verified') + ' ' : '') + '@' + account.username,
    'Golazo League Instagram hesab\u0131',
    Object.assign(
      {
        color: config.colors.instagram,
        emojiKey: 'instagram',
        thumbnailKey: 'instagram',
        thumbnail: account.avatar || undefined,
        fields: fields,
        footer: 'Golazo League \u2022 Instagram'
      },
      extra || {}
    )
  );
}

function buildPostCard(account, post, opts) {
  const options = opts || {};
  const liked = options.liked || false;
  const saved = options.saved || false;
  const rows = [
    rowOf(
      makeButton({
        id: 'insta_like_' + post.id,
        label: 'Be\u011fen ' + formatCount(post.likes.length),
        style: liked ? 3 : 2,
        emojiKey: 'like'
      }),
      makeButton({
        id: 'insta_save_' + post.id,
        label: 'Kaydet ' + formatCount(post.saves.length),
        style: saved ? 3 : 2,
        emojiKey: 'save'
      })
    )
  ];

  let media = post.image ? [post.image] : [];
  if (options.rendered) media = [options.rendered];
  const lines = [
    emo('user') + ' **@' + account.username + '**' + (account.verified ? ' ' + emo('verified') : ''),
    truncate(post.text, 900),
    emo('like') + ' ' + formatCount(post.likes.length) +
      '  ' + emo('comment') + ' ' + formatCount(post.comments.length) +
      '  ' + emo('save') + ' ' + formatCount(post.saves.length) +
      '  ' + emo('clock') + ' ' + timeAgo(post.createdAt)
  ];

  if (post.comments.length) {
    const last = post.comments.slice(-2);
    lines.push(
      emo('comment') + ' **Yorumlar**\n' +
        last.map((c) => '\u2022 ' + truncate(c.text, 120)).join('\n')
    );
  }

  return buildSuccessPanel('G\u00f6nderi \u2022 ' + post.id, options.rendered ? '`' + post.id + '`' : lines.join('\n'), {
    color: config.colors.instagram,
    emojiKey: 'instagram',
    thumbnailKey: 'instagram',
    thumbnail: account.avatar || undefined,
    media: media,
    rows: rows,
    footer: 'Golazo League \u2022 Instagram'
  });
}

function notifyFollowers(data, sourceId, text) {
  const source = data.accounts[String(sourceId)];
  if (!source) return;
  for (const followerId of source.followers) {
    const target = data.accounts[String(followerId)];
    if (target) pushNotification(target, 'follow', text, 5);
  }
}

function helpPanel() {
  const lines = [
    emo('instagram') + ' **Instagram Alt Komutlar\u0131**',
    '`.insta ac <kullan\u0131c\u0131_adi>` \u2022 `.insta kapat` \u2022 `.insta profil [@kullan\u0131c\u0131]`',
    '`.insta bio <metin>` \u2022 `.insta takip @kullan\u0131c\u0131` \u2022 `.insta takipci`',
    '`.insta paylas <metin> [ek]` \u2022 `.insta begen <post_id>` \u2022 `.insta yorum <post_id> <metin>`',
    '`.insta hikaye <metin> [ek]` \u2022 `.insta kaydet <post_id>` \u2022 `.insta kesfet`',
    '`.insta feed` \u2022 `.insta mavi @kullan\u0131c\u0131` (admin) \u2022 `.insta bildirim`',
    '`.insta kazanc` \u2022 `.insta cek <miktar>`'
  ];
  return buildSuccessPanel('Instagram Sim\u00fclasyonu', lines.join('\n'), {
    color: config.colors.instagram,
    emojiKey: 'instagram',
    thumbnailKey: 'instagram',
    footer: 'Golazo League \u2022 Instagram'
  });
}

function isAdmin(message) {
  try {
    return Boolean(message.member && message.member.permissions && message.member.permissions.has('Administrator'));
  } catch (err) {
    return false;
  }
}

function reply(message, container) {
  return sendV2(message, container);
}

async function renderProfileImage(account) {
  try {
    const renderer = require('./instagramRenderer');
    return await renderer.renderProfile({
      username: account.username,
      displayName: account.displayName,
      avatar: account.avatar,
      bio: account.bio,
      verified: account.verified,
      followers: account.followers.length,
      following: account.following.length,
      postsCount: account.posts.length,
      letter: firstName({ displayName: account.displayName }, account.username).charAt(0).toUpperCase(),
      posts: account.posts.slice(-9).reverse()
    });
  } catch (err) {
    return null;
  }
}

async function execute(message, args, client) {
  try {
    const data = loadDb();
    const sub = norm(args[0] || 'yardim');
    const me = getAccount(data, message.author.id);

    if (sub === 'yardim' || sub === 'help' || sub === '') {
      return reply(message, helpPanel());
    }

    if (sub === 'ac' || sub === 'ac' || sub === 'olustur') {
      const handle = args[1] || '';
      if (!HANDLE_RE.test(handle)) {
        return reply(
          message,
          buildErrorPanel(
            'Kullan\u0131c\u0131 ad\u0131 3-20 karakter olmal\u0131 ve sadece harf, rakam, `.` ve `_` i\u00e7erebilir.\n\u00d6rnek: `.insta ac golazo.kral`',
            { color: config.colors.instagram, title: 'Instagram Hatas\u0131', emojiKey: 'instagram' }
          )
        );
      }
      if (me) {
        return reply(
          message,
          buildErrorPanel('Zaten bir Instagram hesab\u0131n var: **@' + me.username + '**. Silmek i\u00e7in `.insta kapat`.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      if (findByHandle(data, handle)) {
        return reply(
          message,
          buildErrorPanel('**@' + handle + '** zaten kullan\u0131l\u0131yor, ba\u015fka bir isim se\u00e7.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const account = createAccount(data, message.author, handle);
      saveDb(data);
      getPlayer(message.author.id, message.author.username);
      return reply(
        message,
        buildSuccessPanel(
          'Hesab\u0131n A\u00e7\u0131ld\u0131',
          emo('success') + ' **@' + account.username + '** Instagram hesab\u0131 olu\u015fturuldu!\n\u0130lk ad\u0131m: `.insta bio <metin>` ve `.insta paylas <metin>`',
          {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            thumbnail: account.avatar || undefined,
            footer: 'Golazo League \u2022 Instagram'
          }
        )
      );
    }

    if (sub === 'kapat' || sub === 'sil') {
      if (!me) {
        return reply(
          message,
          buildErrorPanel('Silinecek bir hesab\u0131n yok. \u00d6nce `.insta ac <kullan\u0131c\u0131_adi>`.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const rows = [
        rowOf(
          makeButton({ id: 'insta_kapat_onay', label: 'Evet, sil', style: 4, emojiKey: 'close' }),
          makeButton({ id: 'insta_kapat_iptal', label: 'Vazge\u00e7', style: 2, emojiKey: 'check' })
        )
      ];
      return reply(
        message,
        buildErrorPanel(
          '**@' + me.username + '** hesab\u0131 kal\u0131c\u0131 olarak silinecek. T\u00fcm g\u00f6nderilerin, takip\u00e7ilerin ve kazan\u00e7lar\u0131n gidecek. Emin misin?',
          {
            color: config.colors.error,
            title: 'Hesab\u0131 Kapat',
            emojiKey: 'lock',
            rows: rows,
            footer: 'Golazo League \u2022 Instagram'
          }
        )
      );
    }

    if (!me) {
      return reply(
        message,
        buildErrorPanel('\u00d6nce bir hesap a\u00e7man gerekiyor: `.insta ac <kullan\u0131c\u0131_adi>`', {
          color: config.colors.instagram,
          title: 'Instagram Hatas\u0131',
          emojiKey: 'instagram'
        })
      );
    }

    if (sub === 'profil' || sub === 'profile') {
      const targetUser = resolveTargetUser(message, args[1]);
      let target = me;
      if (args[1] && !targetUser) target = findByHandle(data, args[1].replace(/^@/, ''));
      else if (targetUser && targetUser.id !== message.author.id) {
        target = getAccount(data, targetUser.id) || findByHandle(data, String(args[1] || '').replace(/^@/, ''));
      }
      if (!target) {
        return reply(
          message,
          buildErrorPanel('B\u00f6yle bir Instagram hesab\u0131 bulunamad\u0131.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const cd = checkCooldown(message.author.id, 'insta:profil', 3000);
      if (!cd.ok) {
        return reply(
          message,
          buildErrorPanel('L\u00fctfen ' + cd.remaining + ' sn bekle.', {
            color: config.colors.instagram,
            title: 'Rate Limit',
            emojiKey: 'clock'
          })
        );
      }
      const buffer = await renderProfileImage(target);
      if (buffer) {
        const files = [new AttachmentBuilder(buffer, { name: 'insta_profile.png' })];
        const container = accountPanel(target, {
          media: ['attachment://insta_profile.png'],
          description: emo('instagram') + ' **@' + target.username + '** profil g\u00f6rseli'
        });
        return sendV2(message, container, { files });
      }
      return reply(message, accountPanel(target));
    }

    if (sub === 'bio') {
      const text = args.slice(1).join(' ').trim();
      if (!text) {
        return reply(
          message,
          buildErrorPanel('Kullan\u0131m: `.insta bio <metin>` (en fazla 150 karakter)', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      if (text.length > 150) {
        return reply(
          message,
          buildErrorPanel('Biyografi en fazla 150 karakter olabilir. (Senin: ' + text.length + ')', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      me.bio = text;
      saveDb(data);
      return reply(
        message,
        buildSuccessPanel('Biyografi G\u00fcncellendi', emo('check') + ' ' + truncate(text, 400), {
          color: config.colors.instagram,
          emojiKey: 'instagram',
          thumbnailKey: 'instagram',
          thumbnail: me.avatar || undefined,
          footer: 'Golazo League \u2022 Instagram'
        })
      );
    }

    if (sub === 'takip' || sub === 'follow') {
      const targetUser = resolveTargetUser(message, args[1]);
      if (!targetUser || targetUser.id === message.author.id) {
        return reply(
          message,
          buildErrorPanel('Kendini takip edemezs\u0131n. Kullan\u0131m: `.insta takip @kullan\u0131c\u0131`', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const target = getAccount(data, targetUser.id);
      if (!target) {
        return reply(
          message,
          buildErrorPanel('Bu kullan\u0131c\u0131n\u0131n Instagram hesab\u0131 yok.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const myId = String(message.author.id);
      const targetId = String(target.userId);
      const iFollow = me.following.indexOf(targetId);
      const wasFollowing = iFollow > -1;
      if (wasFollowing) {
        me.following.splice(iFollow, 1);
        const fIdx = target.followers.indexOf(myId);
        if (fIdx > -1) target.followers.splice(fIdx, 1);
        saveDb(data);
        return reply(
          message,
          buildSuccessPanel('Takipten \u00c7\u0131k\u0131ld\u0131', emo('follow') + ' **@' + target.username + '** art\u0131k takip edilmiyor.', {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            footer: 'Golazo League \u2022 Instagram'
          })
        );
      }
      me.following.push(targetId);
      target.followers.push(myId);
      pushNotification(target, 'follow', '@' + me.username + ' seni takip etti.', 5);
      const before = target.followers.length - 1;
      const crossed = config.milestones.some((m) => before < m && target.followers.length >= m);
      if (crossed) {
        pushNotification(target, 'milestone', 'Takip\u00e7i say\u0131n ' + formatCount(target.followers.length) + ' oldu!', 5);
      }
      saveDb(data);
      return reply(
        message,
        buildSuccessPanel(
          'Takip Edildi',
          emo('follow') + ' **@' + target.username + '** takip edildi.\n' +
            emo('user') + ' Toplam takip\u00e7i: **' + formatCount(target.followers.length) + '**' +
            (crossed ? '\n' + emo('star') + ' Milestone a\u015f\u0131ld\u0131: **' + milestoneText(target.followers.length) + '**' : ''),
          {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            thumbnail: target.avatar || undefined,
            footer: 'Golazo League \u2022 Instagram'
          }
        )
      );
    }

    if (sub === 'paylas' || sub === 'post') {
      const cd = checkCooldown(message.author.id, 'insta:paylas', 3000);
      if (!cd.ok) {
        return reply(
          message,
          buildErrorPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'clock'
          })
        );
      }
      const text = args.slice(1).join(' ').trim();
      const attachment = message.attachments && message.attachments.first ? message.attachments.first() : null;
      if (!text && !attachment) {
        return reply(
          message,
          buildErrorPanel('Kullan\u0131m: `.insta paylas <metin> [g\u00f6rsel]`', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const post = {
        id: generateId('igp'),
        authorId: String(me.userId),
        text: text || '(g\u00f6rsel payla\u015f\u0131m\u0131)',
        image: attachment ? attachment.url : null,
        likes: [],
        comments: [],
        saves: [],
        createdAt: Date.now()
      };
      me.posts.push(post);
      saveDb(data);
      notifyFollowers(data, me.userId, '@' + me.username + ' yeni g\u00f6nderi payla\u015ft\u0131: ' + truncate(post.text, 90));
      try {
        const buffer = await require('./instagramRenderer').renderPostCard({
          id: post.id,
          username: me.username,
          displayName: me.displayName,
          avatar: me.avatar,
          verified: me.verified,
          letter: String(me.displayName || me.username).charAt(0).toUpperCase(),
          text: post.image ? text : post.text,
          image: post.image,
          likes: 0,
          comments: 0,
          time: 'şimdi'
        });
        if (buffer) {
          const files = [new AttachmentBuilder(buffer, { name: 'insta_post.png' })];
          return sendV2(message, buildPostCard(me, post, { liked: false, saved: false, rendered: 'attachment://insta_post.png' }), { files });
        }
      } catch (err) { }
      return reply(message, buildPostCard(me, post, { liked: false, saved: false }));
    }

    if (sub === 'begen' || sub === 'like') {
      const cd = checkCooldown(message.author.id, 'insta:begen', 3000);
      if (!cd.ok) {
        return reply(
          message,
          buildErrorPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'clock'
          })
        );
      }
      const found = findPost(data, args[1] || '');
      if (!found) {
        return reply(
          message,
          buildErrorPanel('G\u00f6nderi bulunamad\u0131. Do\u011fru post_id kullan.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const myId = String(message.author.id);
      const idx = found.post.likes.indexOf(myId);
      if (idx > -1) {
        found.post.likes.splice(idx, 1);
        saveDb(data);
        return reply(message, buildPostCard(found.account, found.post, { saved: false }));
      }
      found.post.likes.push(myId);
      if (String(found.account.userId) !== myId) {
        found.account.earnings += REWARD;
        pushNotification(
          found.account,
          'like',
          '@' + me.username + ' g\u00f6nderini be\u011fendi (+' + formatMoney(REWARD) + ')',
          5
        );
      }
      saveDb(data);
      return reply(message, buildPostCard(found.account, found.post, { liked: true, saved: false }));
    }

    if (sub === 'yorum' || sub === 'comment') {
      const cd = checkCooldown(message.author.id, 'insta:yorum', 3000);
      if (!cd.ok) {
        return reply(
          message,
          buildErrorPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'clock'
          })
        );
      }
      const found = findPost(data, args[1] || '');
      const text = args.slice(2).join(' ').trim();
      if (!found || !text) {
        return reply(
          message,
          buildErrorPanel('Kullan\u0131m: `.insta yorum <post_id> <metin>`', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const comment = {
        id: generateId('igc'),
        authorId: String(me.userId),
        authorHandle: me.username,
        text: truncate(text, 500),
        createdAt: Date.now()
      };
      found.post.comments.push(comment);
      if (String(found.account.userId) !== String(me.userId)) {
        pushNotification(found.account, 'comment', '@' + me.username + ' yorum yapt\u0131: ' + truncate(text, 90), 5);
      }
      saveDb(data);
      return reply(
        message,
        buildSuccessPanel(
          'Yorum Eklendi',
          emo('comment') + ' **@' + me.username + '** \u2192 ' + found.post.id + '\n' + truncate(comment.text, 400),
          {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            footer: 'Golazo League \u2022 Instagram'
          }
        )
      );
    }

    if (sub === 'hikaye' || sub === 'story') {
      const cd = checkCooldown(message.author.id, 'insta:hikaye', 3000);
      if (!cd.ok) {
        return reply(
          message,
          buildErrorPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'clock'
          })
        );
      }
      const text = args.slice(1).join(' ').trim();
      const attachment = message.attachments && message.attachments.first ? message.attachments.first() : null;
      if (!text && !attachment) {
        return reply(
          message,
          buildErrorPanel('Kullan\u0131m: `.insta hikaye <metin> [g\u00f6rsel]`', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const story = {
        id: generateId('igs'),
        authorId: String(me.userId),
        text: text || '(hikaye)',
        image: attachment ? attachment.url : null,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      };
      me.stories.push(story);
      if (me.stories.length > 30) me.stories.shift();
      saveDb(data);
      notifyFollowers(data, me.userId, '@' + me.username + ' hikaye payla\u015ft\u0131.');
      let media = story.image ? [story.image] : [];
      let storyFiles = null;
      try {
        const buffer = await require('./instagramRenderer').renderStory({
          username: me.username,
          displayName: me.displayName,
          avatar: me.avatar,
          verified: me.verified,
          letter: String(me.displayName || me.username).charAt(0).toUpperCase(),
          text: story.image ? (text || '') : story.text,
          image: story.image,
          time: 'şimdi'
        });
        if (buffer) {
          storyFiles = [new AttachmentBuilder(buffer, { name: 'insta_story.png' })];
          media = ['attachment://insta_story.png'];
        }
      } catch (err) { }
      if (storyFiles) {
        return sendV2(
          message,
          buildSuccessPanel('Hikaye Payla\u015f\u0131ld\u0131', emo('image') + ' Hikayen **24 saat** boyunca aktif olacak.', {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            media: media,
            footer: 'Golazo League \u2022 Instagram'
          }),
          { files: storyFiles }
        );
      }
      return reply(
        message,
        buildSuccessPanel(
          'Hikaye Payla\u015f\u0131ld\u0131',
          emo('image') + ' Hikayen **24 saat** boyunca aktif olacak.\n' + truncate(story.text, 400),
          {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            media: media,
            footer: 'Golazo League \u2022 Instagram'
          }
        )
      );
    }

    if (sub === 'kaydet' || sub === 'save') {
      const cd = checkCooldown(message.author.id, 'insta:kaydet', 3000);
      if (!cd.ok) {
        return reply(
          message,
          buildErrorPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'clock'
          })
        );
      }
      const found = findPost(data, args[1] || '');
      if (!found) {
        return reply(
          message,
          buildErrorPanel('G\u00f6nderi bulunamad\u0131.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const myId = String(message.author.id);
      const idx = found.post.saves.indexOf(myId);
      if (idx > -1) {
        found.post.saves.splice(idx, 1);
        saveDb(data);
        return reply(message, buildPostCard(found.account, found.post, { saved: false }));
      }
      found.post.saves.push(myId);
      saveDb(data);
      return reply(message, buildPostCard(found.account, found.post, { saved: true }));
    }

    if (sub === 'kesfet' || sub === 'discover') {
      const cd = checkCooldown(message.author.id, 'insta:kesfet', 3000);
      if (!cd.ok) {
        return reply(
          message,
          buildErrorPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'clock'
          })
        );
      }
      const pool = allPosts(data).filter((entry) => entry.account.userId !== me.userId);
      pool.sort((a, b) => b.post.likes.length - a.post.likes.length);
      const head = pool.slice(0, Math.min(pool.length, 10));
      const shuffled = head.sort(() => Math.random() - 0.5).slice(0, 5);
      if (!shuffled.length) {
        return reply(
          message,
          buildErrorPanel('Ke\u015fif i\u00e7in hen\u00fcz ba\u015fka g\u00f6nderi yok. Daha fazla kullan\u0131c\u0131 payla\u015f\u0131m yapm\u0131\u015f olmal\u0131.', {
            color: config.colors.instagram,
            title: 'Ke\u015fif',
            emojiKey: 'search'
          })
        );
      }
      const lines = shuffled.map((entry, i) => '**' + (i + 1) + '.** ' + postSummary(entry.post, entry.account));
      const media = shuffled.filter((e) => e.post.image).slice(0, 4).map((e) => e.post.image);
      return reply(
        message,
        buildSuccessPanel('Ke\u015fif Et', lines.join('\n\n'), {
          color: config.colors.instagram,
          emojiKey: 'instagram',
          thumbnailKey: 'instagram',
          media: media,
          footer: 'Golazo League \u2022 Instagram'
        })
      );
    }

    if (sub === 'takipci' || sub === 'followers') {
      const list = Object.values(data.accounts)
        .sort((a, b) => b.followers.length - a.followers.length)
        .slice(0, 10);
      if (!list.length) {
        return reply(
          message,
          buildErrorPanel('Hen\u00fcz hi\u00e7 hesap yok.', {
            color: config.colors.instagram,
            title: 'Takip\u00e7i S\u0131ralamas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const medals = [emo('crown'), emo('star'), emo('fire')];
      const lines = list.map(
        (acc, i) =>
          (medals[i] || (emo('chart') + ' **#' + (i + 1) + '**')) +
          ' **@' +
          acc.username +
          '** \u2013 ' +
          formatCount(acc.followers.length) +
          ' takip\u00e7i' +
          (acc.verified ? ' ' + emo('verified') : '')
      );
      return reply(
        message,
        buildSuccessPanel('En \u00c7ok Takip\u00e7ili 10 Hesap', lines.join('\n'), {
          color: config.colors.instagram,
          emojiKey: 'instagram',
          thumbnailKey: 'instagram',
          footer: 'Golazo League \u2022 Instagram'
        })
      );
    }

    if (sub === 'feed') {
      const cd = checkCooldown(message.author.id, 'insta:feed', 3000);
      if (!cd.ok) {
        return reply(
          message,
          buildErrorPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'clock'
          })
        );
      }
      const allowed = [me.userId].concat(me.following);
      const pool = allPosts(data).filter((entry) => allowed.indexOf(entry.account.userId) > -1);
      pool.sort((a, b) => b.post.createdAt - a.post.createdAt);
      const top = pool.slice(0, 6);
      if (!top.length) {
        return reply(
          message,
          buildErrorPanel('Feed bo\u015f. Takip etti\u011fin ki\u015filerin ya da senin g\u00f6nderilerin yok.', {
            color: config.colors.instagram,
            title: 'Instagram Feed',
            emojiKey: 'instagram'
          })
        );
      }
      try {
        const renderer = require('./instagramRenderer');
        const buffer = await renderer.renderFeed(
          top.map((entry) => ({
            username: entry.account.username,
            displayName: entry.account.displayName,
            avatar: entry.account.avatar,
            verified: entry.account.verified,
            letter: entry.account.displayName.charAt(0).toUpperCase(),
            text: entry.post.text,
            image: entry.post.image,
            likes: entry.post.likes.length,
            comments: entry.post.comments.length,
            saves: entry.post.saves.length,
            time: timeAgo(entry.post.createdAt) + ' \u00f6nce'
          }))
        );
        if (buffer) {
          const files = [new AttachmentBuilder(buffer, { name: 'insta_feed.png' })];
          const container = buildSuccessPanel('Instagram Feed', emo('image') + ' Takip etti\u011fin hesaplardan son 6 g\u00f6nderi', {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            media: ['attachment://insta_feed.png'],
            footer: 'Golazo League \u2022 Instagram'
          });
          return sendV2(message, container, { files });
        }
      } catch (err) { }
      const lines = top.map((entry) => postSummary(entry.post, entry.account));
      return reply(
        message,
        buildSuccessPanel('Instagram Feed', lines.join('\n\n'), {
          color: config.colors.instagram,
          emojiKey: 'instagram',
          thumbnailKey: 'instagram',
          footer: 'Golazo League \u2022 Instagram'
        })
      );
    }

    if (sub === 'mavi' || sub === 'verified') {
      if (!isAdmin(message)) {
        return reply(
          message,
          buildErrorPanel('Bu komutu yaln\u0131zca y\u00f6neticiler kullanabilir.', {
            color: config.colors.error,
            title: 'Yetki Hatas\u0131',
            emojiKey: 'lock'
          })
        );
      }
      const targetUser = resolveTargetUser(message, args[1]);
      if (!targetUser) {
        return reply(
          message,
          buildErrorPanel('Kullan\u0131m: `.insta mavi @kullan\u0131c\u0131`', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const target = getAccount(data, targetUser.id);
      if (!target) {
        return reply(
          message,
          buildErrorPanel('Bu kullan\u0131c\u0131n\u0131n Instagram hesab\u0131 yok.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      if (target.verified) {
        return reply(
          message,
          buildErrorPanel('**@' + target.username + '** zaten do\u011frulanm\u0131\u015f.', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      const cost = config.economy.verifyInstagram;
      if (!spendMoney(target.userId, cost)) {
        return reply(
          message,
          buildErrorPanel(
            'Hedefin bakiyesi yetersiz. Mavi tik i\u00e7in hedeften **' + formatMoney(cost) + '** kesilmeli, mevcut: **' + formatMoney(getBalance(target.userId)) + '**',
            { color: config.colors.instagram, title: 'Instagram Hatas\u0131', emojiKey: 'money' }
          )
        );
      }
      target.verified = true;
      pushNotification(target, 'verified', 'Instagram hesab\u0131na mavi tik verildi!', 5);
      saveDb(data);
      return reply(
        message,
        buildSuccessPanel(
          'Mavi Tik Verildi',
          emo('verified') + ' **@' + target.username + '** do\u011frulanm\u0131\u015f hesap oldu.\n' +
            emo('money') + ' Hekesten **' + formatMoney(cost) + '** kesildi.',
          {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            thumbnail: target.avatar || undefined,
            footer: 'Golazo League \u2022 Instagram'
          }
        )
      );
    }

    if (sub === 'kazanc' || sub === 'earnings') {
      return reply(
        message,
        buildSuccessPanel(
          'Instagram Kazan\u00e7lar\u0131',
          emo('money') + ' Bekleyen kazan\u00e7: **' + formatMoney(me.earnings) + '**\n' +
            emo('chart') + ' C\u00fck bakiye: **' + formatMoney(getBalance(me.userId)) + '**\n' +
            emo('info') + ' \u00c7ekmek i\u00e7in: `.insta cek <miktar>`',
          {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            thumbnail: me.avatar || undefined,
            footer: 'Golazo League \u2022 Instagram'
          }
        )
      );
    }

    if (sub === 'cek' || sub === 'cek' || sub === 'cek' || sub === 'withdraw') {
      const amount = parseAmount(args[1]);
      if (!amount) {
        return reply(
          message,
          buildErrorPanel('Kullan\u0131m: `.insta cek <miktar>` \u2013 mevcut: **' + formatMoney(me.earnings) + '**', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'instagram'
          })
        );
      }
      if (amount > me.earnings) {
        return reply(
          message,
          buildErrorPanel('Yetersiz kazan\u00e7. Mevcut: **' + formatMoney(me.earnings) + '**', {
            color: config.colors.instagram,
            title: 'Instagram Hatas\u0131',
            emojiKey: 'money'
          })
        );
      }
      me.earnings -= amount;
      const newBalance = addMoney(me.userId, amount, me.username);
      saveDb(data);
      return reply(
        message,
        buildSuccessPanel(
          'Kazan\u00e7 \u00c7ekildi',
          emo('money') + ' **' + formatMoney(amount) + '** ekonomi hesab\u0131na aktar\u0131ld\u0131.\n' +
            emo('chart') + ' Yeni bakiye: **' + formatMoney(newBalance) + '**',
          {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            footer: 'Golazo League \u2022 Instagram'
          }
        )
      );
    }

    if (sub === 'bildirim' || sub === 'bildirimler' || sub === 'notifications') {
      const list = (me.notifications || []).slice(0, 5);
      if (!list.length) {
        return reply(
          message,
          buildSuccessPanel('Bildirimler', emo('bell') + ' Hen\u00fcz bildirimin yok.', {
            color: config.colors.instagram,
            emojiKey: 'instagram',
            thumbnailKey: 'instagram',
            footer: 'Golazo League \u2022 Instagram'
          })
        );
      }
      const lines = list.map(
        (n) =>
          emo('bell') +
          ' ' +
          (n.read ? '' : '**') +
          truncate(n.text, 120) +
          (n.read ? '' : '**') +
          ' \u2013 ' +
          timeAgo(n.createdAt) +
          ' \u00f6nce'
      );
      for (const n of me.notifications) n.read = true;
      saveDb(data);
      return reply(
        message,
        buildSuccessPanel('Son Bildirimler', lines.join('\n'), {
          color: config.colors.instagram,
          emojiKey: 'instagram',
          thumbnailKey: 'instagram',
          footer: 'Golazo League \u2022 Instagram'
        })
      );
    }

    return reply(message, helpPanel());
  } catch (err) {
    try {
      return sendV2(
        message,
        buildErrorPanel('Instagram sisteminde beklenmeyen bir hata olu\u015ftu: ' + truncate(err.message, 200), {
          color: config.colors.instagram,
          title: 'Instagram Hatas\u0131',
          emojiKey: 'instagram'
        })
      );
    } catch (err2) {
      return null;
    }
  }
}

const cardMessages = new Set();

function postCardMessageId(id) {
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

    if (customId === 'insta_kapat_iptal') {
      return interaction.update({ components: payloadV2(
            buildSuccessPanel('Vazge\u00e7ildi', emo('check') + ' Hesab\u0131n silinmedi, yerinde duruyor.', {
              color: config.colors.instagram,
              emojiKey: 'instagram',
              thumbnailKey: 'instagram',
              footer: 'Golazo League \u2022 Instagram'
            })
          ).components });
    }

    if (customId === 'insta_kapat_onay') {
      if (!me) {
        return interaction.update({ components: payloadV2(
              buildErrorPanel('Silinecek bir hesab\u0131n yok.', {
                color: config.colors.instagram,
                title: 'Instagram Hatas\u0131',
                emojiKey: 'instagram'
              })
            ).components });
      }
      if (String(interaction.user.id) !== String(me.userId)) {
        return interaction.update({ components: payloadV2(
              buildErrorPanel('Bu i\u015flemi sadece hesab\u0131n sahibi yapabilir.', {
                color: config.colors.error,
                title: 'Instagram Hatas\u0131',
                emojiKey: 'lock'
              })
            ).components });
      }
      deleteAccount(data, me.userId);
      saveDb(data);
      return interaction.update({ components: payloadV2(
            buildSuccessPanel('Hesap Silindi', emo('success') + ' **@' + me.username + '** kal\u0131c\u0131 olarak silindi.', {
              color: config.colors.instagram,
              emojiKey: 'instagram',
              thumbnailKey: 'instagram',
              footer: 'Golazo League \u2022 Instagram'
            })
          ).components });
    }

    const likeMatch = customId.match(/^insta_like_(.+)$/);
    const saveMatch = customId.match(/^insta_save_(.+)$/);

    if (!likeMatch && !saveMatch) {
      return null;
    }

    const postId = (likeMatch || saveMatch)[1];
    const found = findPost(data, postId);
    if (!found) {
      const payload = payloadV2(
        buildErrorPanel('G\u00f6nderi art\u0131k mevcut de\u011fil.', {
          color: config.colors.instagram,
          title: 'Instagram Hatas\u0131',
          emojiKey: 'instagram'
        }),
        { ephemeral: true }
      );
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    }

    if (!me) {
      const payload = payloadV2(
        buildErrorPanel('\u00d6nce `.insta ac <kullan\u0131c\u0131_adi>` ile hesap a\u00e7.', {
          color: config.colors.instagram,
          title: 'Instagram Hatas\u0131',
          emojiKey: 'instagram'
        }),
        { ephemeral: true }
      );
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    }

    const cd = checkCooldown(interaction.user.id, 'insta:button', 3000);
    if (!cd.ok) {
      const payload = payloadV2(
        buildErrorPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', {
          color: config.colors.instagram,
          title: 'Rate Limit',
          emojiKey: 'clock'
        }),
        { ephemeral: true }
      );
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    }

    const myId = String(me.userId);
    let liked = false;
    let saved = false;

    if (likeMatch) {
      const idx = found.post.likes.indexOf(myId);
      if (idx > -1) {
        found.post.likes.splice(idx, 1);
      } else {
        found.post.likes.push(myId);
        if (String(found.account.userId) !== myId) {
          found.account.earnings += REWARD;
          pushNotification(
            found.account,
            'like',
            '@' + me.username + ' g\u00f6nderini be\u011fendi (+' + formatMoney(REWARD) + ')',
            5
          );
        }
      }
      liked = found.post.likes.indexOf(myId) > -1;
      saved = found.post.saves.indexOf(myId) > -1;
    } else {
      const idx = found.post.saves.indexOf(myId);
      if (idx > -1) {
        found.post.saves.splice(idx, 1);
      } else {
        found.post.saves.push(myId);
      }
      saved = found.post.saves.indexOf(myId) > -1;
      liked = found.post.likes.indexOf(myId) > -1;
    }

    saveDb(data);

    const container = buildPostCard(found.account, found.post, { liked, saved });
    const payload = payloadV2(container, { files: [] });

    if (cardMessages.has(interaction.message.id)) {
      return interaction.update({
        components: payload.components,
        files: payload.files
      });
    }

    const replyPayload = payloadV2(container, { ephemeral: true });
    const result = await interaction.reply(replyPayload);
    try {
      if (result && result.id) postCardMessageId(result.id);
    } catch (err) { }
    return result;
  } catch (err) {
    try {
      const payload = payloadV2(
        buildErrorPanel('Beklenmeyen hata: ' + truncate(err.message, 200), {
          color: config.colors.instagram,
          title: 'Instagram Hatas\u0131',
          emojiKey: 'instagram'
        }),
        { ephemeral: true }
      );
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    } catch (err2) {
      return null;
    }
  }
}

module.exports = {
  name: 'insta',
  aliases: ['instagram'],
  description: 'Golazo League Instagram sim\u00fclasyonu',
  usage: '.insta <alt komut>',
  execute,
  handleInteraction
};
