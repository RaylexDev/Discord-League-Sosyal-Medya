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

const DB_FILE = 'twitter.json';
const LIKE_REWARD = config.economy.twitterLike;
const RT_REWARD = config.economy.twitterRetweet;
const HANDLE_RE = /^[a-zA-Z0-9_]{3,20}$/;

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
    id: generateId('twusr'),
    userId: String(user.id),
    username: handle,
    displayName: firstName(user, handle),
    avatar: profileAvatar(user),
    bio: '',
    verified: false,
    followers: [],
    following: [],
    tweets: [],
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

function allTweets(data) {
  const out = [];
  for (const account of Object.values(data.accounts)) {
    for (const tweet of account.tweets) out.push({ tweet, account });
  }
  return out;
}

function findTweet(data, tweetId) {
  for (const account of Object.values(data.accounts)) {
    const tweet = account.tweets.find((t) => t.id === tweetId);
    if (tweet) return { tweet, account };
  }
  return null;
}

function tweetLine(data, tweet, account) {
  const parts = [
    emo('twitter') + ' **' + tweet.id + '** \u2022 @' + account.username + (account.verified ? ' ' + emo('verified') : ''),
    truncate(tweet.text, 300)
  ];
  if (tweet.quoteOf) {
    const quoted = findTweet(data, tweet.quoteOf);
    parts.push(
      emo('link') +
        ' Al\u0131nt\u0131: @' +
        (quoted ? quoted.account.username : '?') +
        ' \u2013 ' +
        truncate(quoted ? quoted.tweet.text : tweet.quoteOf, 160)
    );
  }
  if (tweet.replyTo) parts.push(emo('comment') + ' Yan\u0131t: `' + tweet.replyTo + '`');
  parts.push(
    emo('like') + ' ' + formatCount(tweet.likes.length) +
      '  ' + emo('share') + ' ' + formatCount(tweet.retweets.length) +
      '  ' + emo('comment') + ' ' + formatCount(tweet.replies.length) +
      '  ' + emo('clock') + ' ' + timeAgo(tweet.createdAt)
  );
  return parts.join('\n');
}

function buildTweetCard(data, account, tweet, state) {
  const flags = state || {};
  const rows = [
    rowOf(
      makeButton({
        id: 'tw_like_' + tweet.id,
        label: 'Be\u011fen ' + formatCount(tweet.likes.length),
        style: flags.liked ? 3 : 2,
        emojiKey: 'like'
      }),
      makeButton({
        id: 'tw_rt_' + tweet.id,
        label: 'Retweet ' + formatCount(tweet.retweets.length),
        style: flags.retweeted ? 3 : 2,
        emojiKey: 'share'
      }),
      makeButton({
        id: 'tw_open_' + tweet.id,
        label: 'A\u00e7\u0131kla',
        style: 2,
        emojiKey: 'link'
      })
    )
  ];

  let quoted = '';
  if (tweet.quoteOf) {
    const found = findTweet(data, tweet.quoteOf);
    if (found) {
      quoted = '\n' + emo('link') + ' **Al\u0131nt\u0131lanan:** @' + found.account.username + ' \u2013 ' + truncate(found.tweet.text, 220);
    } else {
      quoted = '\n' + emo('link') + ' **Al\u0131nt\u0131:** `' + tweet.quoteOf + '`';
    }
  }

  const lines = [
    emo('user') + ' **@' + account.username + '**' + (account.verified ? ' ' + emo('verified') : '') + ' \u2022 ' + timeAgo(tweet.createdAt) + ' \u00f6nce',
    truncate(tweet.text, 900) + quoted,
    emo('like') + ' ' + formatCount(tweet.likes.length) +
      '  ' + emo('share') + ' ' + formatCount(tweet.retweets.length) +
      '  ' + emo('comment') + ' ' + formatCount(tweet.replies.length)
  ];

  let media = tweet.image ? [tweet.image] : [];
  if (flags.rendered) media = [flags.rendered];

  return buildSuccessPanel('Tweet \u2022 ' + tweet.id, flags.rendered ? '`' + tweet.id + '`' : lines.join('\n'), {
    color: config.colors.twitter,
    emojiKey: 'twitter',
    thumbnailKey: 'twitter',
    thumbnail: account.avatar || undefined,
    media: media,
    rows: rows,
    footer: 'Golazo League \u2022 Twitter'
  });
}

function accountPanel(account) {
  const fields = [
    (account.verified ? emo('verified') + ' **Do\u011frulanm\u0131\u015f**\n' : '') +
      (account.bio ? truncate(account.bio, 300) + '\n' : '') +
      (milestoneText(account.followers.length)
        ? emo('star') + ' ' + milestoneText(account.followers.length) + '\n'
        : ''),
    emo('twitter') + ' **' + formatCount(account.tweets.length) + '** tweet  ' +
      emo('follow') + ' **' + formatCount(account.followers.length) + '** takip\u00e7i  ' +
      emo('user') + ' **' + formatCount(account.following.length) + '** takip',
    emo('money') + ' Kazan\u00e7: **' + formatMoney(account.earnings) + '**'
  ].filter((f) => f && f.trim());

  return buildSuccessPanel(
    '@' + account.username,
    'Golazo League Twitter / X hesab\u0131',
    {
      color: config.colors.twitter,
      emojiKey: 'twitter',
      thumbnailKey: 'twitter',
      thumbnail: account.avatar || undefined,
      fields: fields,
      footer: 'Golazo League \u2022 Twitter'
    }
  );
}

function notifyFollowers(data, sourceId, text) {
  const source = data.accounts[String(sourceId)];
  if (!source) return;
  for (const followerId of source.followers) {
    const target = data.accounts[String(followerId)];
    if (target) pushNotification(target, 'follow', text, 5);
  }
}

function isAdmin(message) {
  try {
    return Boolean(message.member && message.member.permissions && message.member.permissions.has('Administrator'));
  } catch (err) {
    return false;
  }
}

function helpPanel() {
  const lines = [
    emo('twitter') + ' **Twitter / X Alt Komutlar\u0131**',
    '`.tw ac <kullan\u0131c\u0131_adi>` \u2022 `.tw kapat` \u2022 `.tw profil [@kullan\u0131c\u0131]`',
    '`.tw bio <metin>` \u2022 `.tw takip @kullan\u0131c\u0131` \u2022 `.tw feed`',
    '`.tw paylas <metin>` \u2022 `.tw begen <id>` \u2022 `.tw retweet <id>`',
    '`.tw kes <id> <metin>` \u2022 `.tw yanit <id> <metin>` \u2022 `.tw arama <kelime>`',
    '`.tw trend` \u2022 `.tw mavi @kullan\u0131c\u0131` (admin) \u2022 `.tw bildirim`',
    '`.tw kazanc` \u2022 `.tw cek <miktar>`'
  ];
  return buildSuccessPanel('Twitter Sim\u00fclasyonu', lines.join('\n'), {
    color: config.colors.twitter,
    emojiKey: 'twitter',
    thumbnailKey: 'twitter',
    footer: 'Golazo League \u2022 Twitter'
  });
}

function errPanel(text, title) {
  return buildErrorPanel(text, {
    color: config.colors.twitter,
    title: title || 'Twitter Hatas\u0131',
    emojiKey: 'twitter'
  });
}

async function renderProfileImage(account) {
  const renderer = require('./twitterRenderer');
  return renderer.renderProfile({
    username: account.username,
    displayName: account.displayName,
    avatar: account.avatar,
    bio: account.bio,
    verified: account.verified,
    letter: firstName({ displayName: account.displayName }, account.username).charAt(0).toUpperCase(),
    followers: account.followers.length,
    following: account.following.length,
    tweetsCount: account.tweets.length,
    joinDate: account.joinDate,
    tweets: account.tweets.slice(-3).reverse().map((t) => ({
      text: t.text,
      image: t.image,
      likes: t.likes.length,
      retweets: t.retweets.length,
      replies: (t.replies || []).length,
      time: timeAgo(t.createdAt) + ' önce'
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
      const handle = args[1] || '';
      if (!HANDLE_RE.test(handle)) {
        return sendV2(
          message,
          errPanel('Kullan\u0131c\u0131 ad\u0131 3-20 karakter; sadece harf, rakam ve `_` i\u00e7erebilir.\n\u00d6rnek: `.tw ac golazo_kral`')
        );
      }
      if (me) {
        return sendV2(message, errPanel('Zaten hesab\u0131n var: **@' + me.username + '**. Silmek i\u00e7in `.tw kapat`.'));
      }
      if (findByHandle(data, handle)) {
        return sendV2(message, errPanel('**@' + handle + '** zaten al\u0131nm\u0131\u015f.'));
      }
      const account = createAccount(data, message.author, handle);
      saveDb(data);
      getPlayer(message.author.id, message.author.username);
      return sendV2(
        message,
        buildSuccessPanel(
          'Hesab\u0131n A\u00e7\u0131ld\u0131',
          emo('success') + ' **@' + account.username + '** Twitter hesab\u0131 olu\u015fturuldu!\n\u0130lk tweet: `.tw paylas <metin>`',
          {
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            thumbnail: account.avatar || undefined,
            footer: 'Golazo League \u2022 Twitter'
          }
        )
      );
    }

    if (sub === 'kapat' || sub === 'sil') {
      if (!me) return sendV2(message, errPanel('Silinecek hesab\u0131n yok. \u00d6nce `.tw ac <kullan\u0131c\u0131_adi>`.'));
      const rows = [
        rowOf(
          makeButton({ id: 'tw_kapat_onay', label: 'Evet, sil', style: 4, emojiKey: 'close' }),
          makeButton({ id: 'tw_kapat_iptal', label: 'Vazge\u00e7', style: 2, emojiKey: 'check' })
        )
      ];
      return sendV2(
        message,
        buildErrorPanel('**@' + me.username + '** hesab\u0131 kal\u0131c\u0131 olarak silinecek. Emin misin?', {
          color: config.colors.error,
          title: 'Hesab\u0131 Kapat',
          emojiKey: 'lock',
          rows: rows,
          footer: 'Golazo League \u2022 Twitter'
        })
      );
    }

    if (!me) {
      return sendV2(message, errPanel('\u00d6nce hesap a\u00e7: `.tw ac <kullan\u0131c\u0131_adi>`'));
    }

    if (sub === 'profil' || sub === 'profile') {
      const targetUser = resolveTargetUser(message, args[1]);
      let target = me;
      if (args[1] && !targetUser) {
        target = findByHandle(data, String(args[1]).replace(/^@/, ''));
      } else if (targetUser && targetUser.id !== message.author.id) {
        target = getAccount(data, targetUser.id) || findByHandle(data, String(args[1] || '').replace(/^@/, ''));
      }
      if (!target) return sendV2(message, errPanel('B\u00f6yle bir Twitter hesab\u0131 bulunamad\u0131.'));
      const cd = checkCooldown(message.author.id, 'tw:profil', 3000);
      if (!cd.ok) return sendV2(message, errPanel('L\u00fctfen ' + cd.remaining + ' sn bekle.', 'Rate Limit'));
      try {
        const buffer = await renderProfileImage(target);
        if (buffer) {
          const files = [new AttachmentBuilder(buffer, { name: 'tw_profile.png' })];
          const container = accountPanel(target);
          const payload = payloadV2(container, { files });
          pushMediaGallery(payload, 'attachment://tw_profile.png');
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
      if (!text) return sendV2(message, errPanel('Kullan\u0131m: `.tw bio <metin>` (en fazla 160 karakter)'));
      if (text.length > 160) {
        return sendV2(message, errPanel('Biyografi en fazla 160 karakter olabilir. (Senin: ' + text.length + ')'));
      }
      me.bio = text;
      saveDb(data);
      return sendV2(
        message,
        buildSuccessPanel('Biyografi G\u00fcncellendi', emo('check') + ' ' + truncate(text, 400), {
          color: config.colors.twitter,
          emojiKey: 'twitter',
          thumbnailKey: 'twitter',
          thumbnail: me.avatar || undefined,
          footer: 'Golazo League \u2022 Twitter'
        })
      );
    }

    if (sub === 'takip' || sub === 'follow') {
      const targetUser = resolveTargetUser(message, args[1]);
      if (!targetUser || targetUser.id === message.author.id) {
        return sendV2(message, errPanel('Kendini takip edemezs\u0131n. Kullan\u0131m: `.tw takip @kullan\u0131c\u0131`'));
      }
      const target = getAccount(data, targetUser.id);
      if (!target) return sendV2(message, errPanel('Bu kullan\u0131c\u0131n\u0131n Twitter hesab\u0131 yok.'));
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
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            footer: 'Golazo League \u2022 Twitter'
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
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            thumbnail: target.avatar || undefined,
            footer: 'Golazo League \u2022 Twitter'
          }
        )
      );
    }

    if (sub === 'paylas' || sub === 'tweet') {
      const cd = checkCooldown(message.author.id, 'tw:paylas', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const text = args.slice(1).join(' ').trim();
      const attachment = message.attachments && message.attachments.first ? message.attachments.first() : null;
      if (!text && !attachment) return sendV2(message, errPanel('Kullan\u0131m: `.tw paylas <metin> [g\u00f6rsel]`'));
      if (text.length > 500) return sendV2(message, errPanel('Tweet en fazla 500 karakter olabilir. (Senin: ' + text.length + ')'));
      const tweet = {
        id: generateId('twt'),
        authorId: String(me.userId),
        text: text || '(g\u00f6rsel payla\u015f\u0131m\u0131)',
        image: attachment ? attachment.url : null,
        likes: [],
        retweets: [],
        replies: [],
        quoteOf: null,
        replyTo: null,
        createdAt: Date.now()
      };
      me.tweets.push(tweet);
      saveDb(data);
      notifyFollowers(data, me.userId, '@' + me.username + ' tweet att\u0131: ' + truncate(tweet.text, 90));
      try {
        const buffer = await require('./twitterRenderer').renderTweetCard({
          username: me.username,
          displayName: me.displayName,
          avatar: me.avatar,
          verified: me.verified,
          letter: String(me.displayName || me.username).charAt(0).toUpperCase(),
          text: tweet.text,
          image: tweet.image,
          likes: 0,
          retweets: 0,
          replies: 0,
          createdAt: tweet.createdAt
        });
        if (buffer) {
          const files = [new AttachmentBuilder(buffer, { name: 'tw_tweet.png' })];
          return sendV2(message, buildTweetCard(data, me, tweet, { liked: false, retweeted: false, rendered: 'attachment://tw_tweet.png' }), { files });
        }
      } catch (err) { }
      return sendV2(message, buildTweetCard(data, me, tweet, { liked: false, retweeted: false }));
    }

    if (sub === 'begen' || sub === 'like') {
      const cd = checkCooldown(message.author.id, 'tw:begen', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const found = findTweet(data, args[1] || '');
      if (!found) return sendV2(message, errPanel('Tweet bulunamad\u0131. Do\u011fru id kullan.'));
      const myId = String(message.author.id);
      const idx = found.tweet.likes.indexOf(myId);
      if (idx > -1) {
        found.tweet.likes.splice(idx, 1);
        saveDb(data);
        return sendV2(message, buildTweetCard(data, found.account, found.tweet, { retweeted: false }));
      }
      found.tweet.likes.push(myId);
      if (String(found.account.userId) !== myId) {
        found.account.earnings += LIKE_REWARD;
        pushNotification(found.account, 'like', '@' + me.username + ' tweetini be\u011fendi (+' + formatMoney(LIKE_REWARD) + ')', 5);
      }
      saveDb(data);
      return sendV2(message, buildTweetCard(data, found.account, found.tweet, { liked: true, retweeted: false }));
    }

    if (sub === 'retweet' || sub === 'rt' || sub === 'repost') {
      const cd = checkCooldown(message.author.id, 'tw:retweet', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const found = findTweet(data, args[1] || '');
      if (!found) return sendV2(message, errPanel('Tweet bulunamad\u0131.'));
      const myId = String(message.author.id);
      const idx = found.tweet.retweets.indexOf(myId);
      if (idx > -1) {
        found.tweet.retweets.splice(idx, 1);
        saveDb(data);
        return sendV2(message, buildTweetCard(data, found.account, found.tweet, { liked: false }));
      }
      found.tweet.retweets.push(myId);
      if (String(found.account.userId) !== myId) {
        found.account.earnings += RT_REWARD;
        pushNotification(found.account, 'retweet', '@' + me.username + ' tweetini retweetledi (+' + formatMoney(RT_REWARD) + ')', 5);
      }
      saveDb(data);
      return sendV2(message, buildTweetCard(data, found.account, found.tweet, { liked: true, retweeted: true }));
    }

    if (sub === 'kes' || sub === 'quote') {
      const cd = checkCooldown(message.author.id, 'tw:kes', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const found = findTweet(data, args[1] || '');
      const text = args.slice(2).join(' ').trim();
      if (!found || !text) return sendV2(message, errPanel('Kullan\u0131m: `.tw kes <tweet_id> <metin>`'));
      const tweet = {
        id: generateId('twt'),
        authorId: String(me.userId),
        text: truncate(text, 500),
        image: null,
        likes: [],
        retweets: [],
        replies: [],
        quoteOf: found.tweet.id,
        replyTo: null,
        createdAt: Date.now()
      };
      me.tweets.push(tweet);
      pushNotification(found.account, 'quote', '@' + me.username + ' tweetini al\u0131nt\u0131lad\u0131.', 5);
      saveDb(data);
      return sendV2(message, buildTweetCard(data, me, tweet, { liked: false, retweeted: false }));
    }

    if (sub === 'yanit' || sub === 'reply') {
      const cd = checkCooldown(message.author.id, 'tw:yanit', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const found = findTweet(data, args[1] || '');
      const text = args.slice(2).join(' ').trim();
      if (!found || !text) return sendV2(message, errPanel('Kullan\u0131m: `.tw yanit <tweet_id> <metin>`'));
      const tweet = {
        id: generateId('twt'),
        authorId: String(me.userId),
        text: truncate(text, 500),
        image: null,
        likes: [],
        retweets: [],
        replies: [],
        quoteOf: null,
        replyTo: found.tweet.id,
        createdAt: Date.now()
      };
      me.tweets.push(tweet);
      found.tweet.replies.push(tweet.id);
      pushNotification(found.account, 'reply', '@' + me.username + ' tweetine yan\u0131t verdi: ' + truncate(text, 80), 5);
      saveDb(data);
      return sendV2(message, buildTweetCard(data, me, tweet, { liked: false, retweeted: false }));
    }

    if (sub === 'arama' || sub === 'search') {
      const query = args.slice(1).join(' ').trim();
      if (!query) return sendV2(message, errPanel('Kullan\u0131m: `.tw arama <kelime>`'));
      const lower = query.toLocaleLowerCase('tr-TR');
      const hits = allTweets(data)
        .filter((entry) => entry.tweet.text.toLocaleLowerCase('tr-TR').includes(lower))
        .sort((a, b) => b.tweet.createdAt - a.tweet.createdAt)
        .slice(0, 5);
      if (!hits.length) {
        return sendV2(
          message,
          buildErrorPanel('**' + truncate(query, 40) + '** i\u00e7in tweet bulunamad\u0131.', {
            color: config.colors.twitter,
            title: 'Arama',
            emojiKey: 'search'
          })
        );
      }
      const lines = hits.map((entry, i) => '**' + (i + 1) + '.** ' + tweetLine(data, entry.tweet, entry.account));
      return sendV2(
        message,
        buildSuccessPanel('Arama: ' + truncate(query, 40), lines.join('\n\n'), {
          color: config.colors.twitter,
          emojiKey: 'twitter',
          thumbnailKey: 'twitter',
          footer: 'Golazo League \u2022 Twitter'
        })
      );
    }

    if (sub === 'trend' || sub === 'popular') {
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recent = allTweets(data).filter((entry) => entry.tweet.createdAt >= dayAgo);
      recent.sort(
        (a, b) =>
          b.tweet.likes.length * 1 + b.tweet.retweets.length * 2 - (a.tweet.likes.length * 1 + a.tweet.retweets.length * 2)
      );
      const top = recent.slice(0, 5);
      if (!top.length) {
        return sendV2(
          message,
          buildErrorPanel('Son 24 saatte trend tweet yok.', {
            color: config.colors.twitter,
            title: 'Trendler',
            emojiKey: 'trend'
          })
        );
      }
      const medals = [emo('crown'), emo('star'), emo('fire'), emo('chart'), emo('rocket')];
      const lines = top.map((entry, i) => (medals[i] || emo('chart')) + ' ' + tweetLine(data, entry.tweet, entry.account));
      return sendV2(
        message,
        buildSuccessPanel('Son 24 Saatin Trendleri', lines.join('\n\n'), {
          color: config.colors.twitter,
          emojiKey: 'twitter',
          thumbnailKey: 'twitter',
          footer: 'Golazo League \u2022 Twitter'
        })
      );
    }

    if (sub === 'feed') {
      const cd = checkCooldown(message.author.id, 'tw:feed', 3000);
      if (!cd.ok) return sendV2(message, errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));
      const allowed = [me.userId].concat(me.following);
      const pool = allTweets(data).filter((entry) => allowed.indexOf(entry.account.userId) > -1);
      pool.sort((a, b) => b.tweet.createdAt - a.tweet.createdAt);
      const top = pool.slice(0, 5);
      if (!top.length) return sendV2(message, errPanel('Zaman \u00e7izelgesi bo\u015f. \u0130lk tweeti sen at!', 'Feed'));
      try {
        const renderer = require('./twitterRenderer');
        const buffer = await renderer.renderFeed(
          top.map((entry) => ({
            username: entry.account.username,
            displayName: entry.account.displayName,
            avatar: entry.account.avatar,
            verified: entry.account.verified,
            letter: entry.account.displayName.charAt(0).toUpperCase(),
            text: entry.tweet.text,
            likes: entry.tweet.likes.length,
            retweets: entry.tweet.retweets.length,
            replies: entry.tweet.replies.length,
            image: entry.tweet.image,
            time: timeAgo(entry.tweet.createdAt) + ' \u00f6nce'
          }))
        );
        if (buffer) {
          const files = [new AttachmentBuilder(buffer, { name: 'tw_feed.png' })];
          const container = buildSuccessPanel('Zaman \u00c7izelgesi', emo('image') + ' Takip ettiklerinden son 5 tweet', {
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            footer: 'Golazo League \u2022 Twitter'
          });
          const payload = payloadV2(container, { files });
          pushMediaGallery(payload, 'attachment://tw_feed.png');
          return message.reply({
            components: payload.components,
            files: payload.files,
            flags: FLAGS_V2,
            allowedMentions: { parse: [] }
          });
        }
      } catch (err) { }
      const lines = top.map((entry) => tweetLine(data, entry.tweet, entry.account));
      return sendV2(
        message,
        buildSuccessPanel('Zaman \u00c7izelgesi', lines.join('\n\n'), {
          color: config.colors.twitter,
          emojiKey: 'twitter',
          thumbnailKey: 'twitter',
          footer: 'Golazo League \u2022 Twitter'
        })
      );
    }

    if (sub === 'mavi' || sub === 'verified') {
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
      if (!targetUser) return sendV2(message, errPanel('Kullan\u0131m: `.tw mavi @kullan\u0131c\u0131`'));
      const target = getAccount(data, targetUser.id);
      if (!target) return sendV2(message, errPanel('Bu kullan\u0131c\u0131n\u0131n Twitter hesab\u0131 yok.'));
      if (target.verified) return sendV2(message, errPanel('**@' + target.username + '** zaten do\u011frulanm\u0131\u015f.'));
      const cost = config.economy.verifyTwitter;
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
      pushNotification(target, 'verified', 'Twitter hesab\u0131na mavi tik verildi!', 5);
      saveDb(data);
      return sendV2(
        message,
        buildSuccessPanel(
          'Mavi Tik Verildi',
          emo('verified') + ' **@' + target.username + '** onayl\u0131 hesap oldu.\n' + emo('money') + ' Hekesten **' + formatMoney(cost) + '** kesildi.',
          {
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            thumbnail: target.avatar || undefined,
            footer: 'Golazo League \u2022 Twitter'
          }
        )
      );
    }

    if (sub === 'kazanc' || sub === 'earnings') {
      return sendV2(
        message,
        buildSuccessPanel(
          'Twitter Kazan\u00e7lar\u0131',
          emo('money') + ' Bekleyen: **' + formatMoney(me.earnings) + '**\n' +
            emo('chart') + ' C\u00fck bakiye: **' + formatMoney(getBalance(me.userId)) + '**\n' +
            emo('info') + ' \u00c7ekmek i\u00e7in: `.tw cek <miktar>`',
          {
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            thumbnail: me.avatar || undefined,
            footer: 'Golazo League \u2022 Twitter'
          }
        )
      );
    }

    if (sub === 'cek' || sub === 'withdraw') {
      const amount = parseAmount(args[1]);
      if (!amount) return sendV2(message, errPanel('Kullan\u0131m: `.tw cek <miktar>` \u2013 mevcut: **' + formatMoney(me.earnings) + '**'));
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
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            footer: 'Golazo League \u2022 Twitter'
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
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            footer: 'Golazo League \u2022 Twitter'
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
          color: config.colors.twitter,
          emojiKey: 'twitter',
          thumbnailKey: 'twitter',
          footer: 'Golazo League \u2022 Twitter'
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

    if (customId === 'tw_kapat_iptal') {
      return interaction.update({ components: payloadV2(
          buildSuccessPanel('Vazge\u00e7ildi', emo('check') + ' Hesab\u0131n silinmedi.', {
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            footer: 'Golazo League \u2022 Twitter'
          })
        ).components });
    }

    if (customId === 'tw_kapat_onay') {
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
            color: config.colors.twitter,
            emojiKey: 'twitter',
            thumbnailKey: 'twitter',
            footer: 'Golazo League \u2022 Twitter'
          })
        ).components });
    }

    const likeMatch = customId.match(/^tw_like_(.+)$/);
    const rtMatch = customId.match(/^tw_rt_(.+)$/);
    const openMatch = customId.match(/^tw_open_(.+)$/);

    if (!likeMatch && !rtMatch && !openMatch) return null;

    const tweetId = (likeMatch || rtMatch || openMatch)[1];
    const found = findTweet(data, tweetId);

    const ephemeral = (container) => payloadV2(container, { ephemeral: true });
    const respond = async (container) => {
      const payload = ephemeral(container);
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
      return interaction.reply(payload);
    };

    if (!found) {
      return respond(errPanel('Tweet art\u0131k mevcut de\u011fil.'));
    }

    if (openMatch) {
      return respond(buildTweetCard(data, found.account, found.tweet, {}));
    }

    if (!me) return respond(errPanel('\u00d6nce `.tw ac <kullan\u0131c\u0131_adi>` ile hesap a\u00e7.'));

    const cd = checkCooldown(interaction.user.id, 'tw:button', 3000);
    if (!cd.ok) return respond(errPanel('Rate limit: ' + cd.remaining + ' sn sonra tekrar dene.', 'Rate Limit'));

    const myId = String(me.userId);
    let liked = false;
    let retweeted = false;

    if (likeMatch) {
      const idx = found.tweet.likes.indexOf(myId);
      if (idx > -1) {
        found.tweet.likes.splice(idx, 1);
      } else {
        found.tweet.likes.push(myId);
        if (String(found.account.userId) !== myId) {
          found.account.earnings += LIKE_REWARD;
          pushNotification(found.account, 'like', '@' + me.username + ' tweetini be\u011fendi (+' + formatMoney(LIKE_REWARD) + ')', 5);
        }
      }
    } else if (rtMatch) {
      const idx = found.tweet.retweets.indexOf(myId);
      if (idx > -1) {
        found.tweet.retweets.splice(idx, 1);
      } else {
        found.tweet.retweets.push(myId);
        if (String(found.account.userId) !== myId) {
          found.account.earnings += RT_REWARD;
          pushNotification(found.account, 'retweet', '@' + me.username + ' tweetini retweetledi (+' + formatMoney(RT_REWARD) + ')', 5);
        }
      }
    }

    liked = found.tweet.likes.indexOf(myId) > -1;
    retweeted = found.tweet.retweets.indexOf(myId) > -1;
    saveDb(data);

    const container = buildTweetCard(data, found.account, found.tweet, { liked, retweeted });
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
  name: 'tw',
  aliases: ['twitter', 'x'],
  description: 'Golazo League Twitter / X sim\u00fclasyonu',
  usage: '.tw <alt komut>',
  execute,
  handleInteraction
};
