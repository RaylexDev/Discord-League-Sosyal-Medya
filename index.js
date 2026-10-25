'use strict';

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const {
  FLAGS_V2,
  FLAGS_V2_EPHEMERAL,
  config,
  buildErrorPanel,
  buildSuccessPanel,
  sendV2,
  payloadV2,
  checkCooldown,
  emo,
  truncate,
  norm,
  setActiveGuild,
  refreshEmojisFromGuild
} = require('./utils');

const COMMANDS_DIR = path.join(__dirname, 'commands');
const commands = new Collection();
const aliasMap = new Map();

function registerCommand(cmd) {
  if (!cmd || !cmd.name || typeof cmd.execute !== 'function') return;
  commands.set(cmd.name, cmd);
  for (const alias of cmd.aliases || []) {
    aliasMap.set(norm(alias), cmd.name);
  }
}

function loadCommands(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(full);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    if (/renderer\.js$/i.test(entry.name)) continue;
    try {
      delete require.cache[require.resolve(full)];
      registerCommand(require(full));
    } catch (err) {
      console.error('[Golazo] Komut y\u00fcklenemedi: ' + full + ' -> ' + err.message);
    }
  }
}

loadCommands(COMMANDS_DIR);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

client.commands = commands;

function resolveCommand(name) {
  const key = norm(name);
  if (commands.has(key)) return commands.get(key);
  if (aliasMap.has(key)) return commands.get(aliasMap.get(key));
  for (const cmd of commands.values()) {
    if (norm(cmd.name) === key) return cmd;
    for (const alias of cmd.aliases || []) {
      if (norm(alias) === key) return cmd;
    }
  }
  return null;
}

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    const prefix = config.prefix;
    if (!message.content.startsWith(prefix)) return;

    const body = message.content.slice(prefix.length).trim();
    if (!body) return;
    const parts = body.split(/\s+/);
    const name = parts.shift();
    const args = parts;

    const cmd = resolveCommand(name);
    if (!cmd) return;

    const cd = checkCooldown(message.author.id, 'cmd:' + cmd.name, 1000);
    if (!cd.ok) return;

    setActiveGuild(message.guild);
    await cmd.execute(message, args, client);
  } catch (err) {
    console.error('[Golazo] MessageCreate hatas\u0131:', err);
    try {
      await sendV2(
        message,
        buildErrorPanel('Komut \u00e7al\u0131\u015ft\u0131r\u0131l\u0131rken hata olu\u015ftu: ' + truncate(err.message, 200), {
          title: 'Sistem Hatas\u0131',
          emojiKey: 'error',
          footer: 'Golazo League'
        })
      );
    } catch (err2) { }
  }
});

function routeInteraction(interaction) {
  const customId = interaction.customId || '';
  if (customId.startsWith('insta_')) return commands.get('insta');
  if (customId.startsWith('tw_')) return commands.get('tw');
  if (customId.startsWith('tt_')) return commands.get('tt');
  return null;
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isButton()) return;
    const cmd = routeInteraction(interaction);
    if (!cmd || typeof cmd.handleInteraction !== 'function') return;
    if (interaction.guild) setActiveGuild(interaction.guild);
    await cmd.handleInteraction(interaction, client);
  } catch (err) {
    console.error('[Golazo] Interaction hatas\u0131:', err);
    try {
      const payload = payloadV2(
        buildErrorPanel('Etkile\u015fim i\u015flenirken hata olu\u015ftu: ' + truncate(err.message, 200), {
          title: 'Sistem Hatas\u0131',
          emojiKey: 'error',
          footer: 'Golazo League'
        }),
        { ephemeral: true }
      );
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch (err2) { }
  }
});

client.once(Events.ClientReady, (ready) => {
  console.log('[Golazo] ' + ready.user.tag + ' \u00e7evrimi\u00e7i \u2014 Golazo League sosyal medya sistemi aktif.');
  console.log('[Golazo] Y\u00fcklenen komutlar: ' + Array.from(commands.keys()).join(', '));
  try {
    const guilds = Array.from(ready.guilds.cache.values());
    for (const guild of guilds) {
      const map = refreshEmojisFromGuild(guild);
      const count = Object.keys(map).length;
      console.log('[Golazo] ' + guild.name + ' emojisinden ' + count + ' adet golazo_ emojisi y\u00fcklendi.');
    }
    if (guilds[0]) setActiveGuild(guilds[0]);
  } catch (err) {
    console.error('[Golazo] Emoji haritas\u0131 olu\u015fturulamad\u0131: ' + err.message);
  }
  try {
    const npc = require('./npcActivity');
    npc.start(client);
  } catch (err) {
    console.error('[Golazo] NPC sistemi ba\u015flat\u0131lamad\u0131: ' + err.message);
  }
});

process.on('unhandledRejection', (err) => {
  console.error('[Golazo] Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Golazo] Uncaught exception:', err);
});

if (!config.token) {
  console.error('[Golazo] DISCORD_TOKEN tan\u0131ml\u0131 de\u011fil.');
  process.exitCode = 1;
} else {
  client.login(config.token).catch((err) => {
    console.error('[Golazo] Login hatas\u0131:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { client, commands };
