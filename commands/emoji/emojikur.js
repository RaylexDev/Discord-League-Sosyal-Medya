'use strict';

const path = require('path');
const fs = require('fs');
const {
  PermissionFlagsBits
} = require('discord.js');
const {
  buildSuccessPanel,
  buildErrorPanel,
  sendV2,
  emo,
  truncate,
  refreshEmojisFromGuild,
  listLocalEmojiFiles,
  saveEmojiMap,
  setActiveGuild
} = require('../../utils');

function canManage(message) {
  try {
    const member = message.member;
    if (!member) return false;
    if (member.permissions && typeof member.permissions.has === 'function') {
      if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
      if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
      if (member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) return true;
    }
  } catch (err) { }
  try {
    return message.author.id === message.guild.ownerId;
  } catch (err) {
    return false;
  }
}

function formatEmoji(entry) {
  if (!entry || !entry.id) return '';
  return (entry.animated ? '<a:' : '<:') + entry.name + ':' + entry.id + '>';
}

module.exports = {
  name: 'emojikur',
  aliases: ['emoji kur', 'emojikurkur', 'emojiyukle'],
  description: 'Sunucuya golazo emojilerini kurar ve botu bu emojilere baglar.',
  usage: '.emojikur',
  async execute(message, args, client) {
    const guild = message.guild;
    if (!guild) {
      return sendV2(message, buildErrorPanel('Bu komut sadece sunucularda \u00e7al\u0131\u015f\u0131r.', {
        title: 'Emoji Kurulumu',
        emojiKey: 'error'
      }), { ephemeral: true });
    }

    if (!canManage(message)) {
      return sendV2(message, buildErrorPanel('Bu komutu kullanmak i\u00e7in **Sunucuyu Y\u00f6net** veya **Emoji & Sticker Y\u00f6net** yetkisine ihtiyac\u0131n var.', {
        title: 'Yetki Yok',
        emojiKey: 'lock'
      }), { ephemeral: true });
    }

    setActiveGuild(guild);

    const files = listLocalEmojiFiles();
    if (!files.length) {
      return sendV2(message, buildErrorPanel('Yerel `emojis/` klas\u00f6r\u00fcnde kurulacak emoji dosyas\u0131 bulunamad\u0131.', {
        title: 'Emoji Kurulumu',
        emojiKey: 'error'
      }), { ephemeral: true });
    }

    const existing = {};
    try {
      for (const emoji of guild.emojis.cache.values()) {
        existing[String(emoji.name || '').toLowerCase()] = emoji;
      }
    } catch (err) { }

    const created = [];
    const reused = [];
    const failed = [];
    const map = {};

    for (const item of files) {
      const name = 'golazo_' + item.key;
      const cached = existing[name];
      if (cached) {
        reused.push(name);
        map[item.key] = { id: String(cached.id), name: cached.name, animated: Boolean(cached.animated) };
        continue;
      }
      try {
        const stat = fs.statSync(item.full);
        if (!stat.size) throw new Error('bos dosya');
        const emoji = await guild.emojis.create({ attachment: item.full, name });
        created.push(name);
        map[item.key] = { id: String(emoji.id), name: emoji.name, animated: Boolean(emoji.animated) };
      } catch (err) {
        failed.push(name + ' \u2014 ' + truncate(err.message, 80));
      }
    }

    saveEmojiMap(guild.id, map);
    refreshEmojisFromGuild(guild);

    const total = files.length;
    const lines = [];
    lines.push(emo('success', guild) + ' **Olu\u015fturulan:** ' + created.length + '/' + total);
    if (reused.length) lines.push(emo('check', guild) + ' **Zaten mevcut:** ' + reused.length);
    if (failed.length) lines.push(emo('error', guild) + ' **Ba\u015far\u0131s\u0131z:** ' + failed.length);
    lines.push('');
    if (created.length) {
      lines.push('\u015eimdiye kadar eklenenler: ' + created.slice(0, 20).map((n) => '`' + n + '`').join(', ') + (created.length > 20 ? ' ...' : ''));
    }
    if (failed.length) {
      lines.push('');
      lines.push('**Hatalar:**');
      for (const f of failed.slice(0, 10)) lines.push('\u2022 ' + truncate(f, 120));
      if (failed.length > 10) lines.push('\u2022 ... ve ' + (failed.length - 10) + ' tane daha');
      if (failed.some((f) => /limit|full|maximum/i.test(f))) {
        lines.push('');
        lines.push(emo('info', guild) + ' Sunucu emoji limiti dolmu\u015f olabilir; beberapa emojiler eklenemedi.');
      }
    }
    lines.push('');
    lines.push(emo('info', guild) + ' Bot art\u0131k bu emojileri sunucudan \u00e7ekerek kullan\u0131yor.');
    lines.push(emo('rocket', guild) + ' \u00d6rnek: ' + (formatEmoji(map.success) || '(kurulum sonras\u0131)') + ' ' + (formatEmoji(map.error) || ''));

    return sendV2(message, buildSuccessPanel('Emoji Kurulumu Tamamland\u0131', lines.join('\n'), {
      emojiKey: 'success',
      footer: 'Golazo League \u2022 .emojikur'
    }));
  }
};
