console.log("index.js loaded");
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  Events
} = require("discord.js");

// ---------------- ENV ----------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!DISCORD_TOKEN || !OWNER_ID || !GUILD_ID) {
  console.error("Missing .env values. Make sure DISCORD_TOKEN, OWNER_ID, and GUILD_ID are set.");
  process.exit(1);
}

// ---------------- CONFIG (read/write safe) ----------------
const CONFIG_PATH = path.join(__dirname, "config.json");

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("CONFIG ERROR: config.json missing or invalid JSON.", e);
    process.exit(1);
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ---------------- DISCORD CLIENT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ---------------- OWNER DM ----------------
async function dmOwner(text) {
  const user = await client.users.fetch(OWNER_ID);
  await user.send(text);
}

// ---------------- OLLAMA ----------------
async function ollamaGenerate(prompt, model) {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.7 }
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama API error ${res.status}: ${t}`);
  }

  const data = await res.json();
  return (data.response || "").trim();
}

// ---------------- PROMPTS ----------------
function personaStyle(persona) {
  if (persona === "builder") return "builder vibe, practical, helpful, light technical clarity";
  if (persona === "collector") return "NFT collector vibe, curious, community-first, light opinions";
  return "degen Web3 Discord vibe, casual, sharp, not cringe, not salesy";
}

function makeDraftPrompt(convo, persona) {
  return `
You are helping a real human stay active in Web3/NFT Discord servers.

Style:
- ${personaStyle(persona)}
- short replies (1–2 sentences)
- no numbering
- no long dashes
- avoid shilling and overconfidence
- include at least 2 replies that ask smart follow-up questions

Return ONLY reply options, each on its own line.

Conversation:
${convo}
`;
}

function makeStarterPrompt(convo, persona) {
  return `
Generate 6 natural conversation starters for a Web3/NFT Discord channel.

Style:
- ${personaStyle(persona)}
- one-liners only
- no numbering
- no long dashes
- no generic greetings
- feel native to crypto Discord

Return ONLY starters, each on its own line.

Context:
${convo}
`;
}

// ---------------- MESSAGE UTILS ----------------
async function getRecentMessages(channel, limit) {
  const msgs = await channel.messages.fetch({ limit: Math.min(limit, 50) });
  return [...msgs.values()]
    .reverse()
    .map(m => `${m.author.username}: ${m.content}`)
    .filter(Boolean)
    .join("\n")
    .slice(0, 7000);
}

function hasKeyword(text, keywords) {
  const t = (text || "").toLowerCase();
  return keywords.some(k => t.includes(k.toLowerCase()));
}

function looksLikeQuestion(text) {
  if (!text) return false;
  const t = text.trim();
  return (
    t.endsWith("?") ||
    /\bhow\b|\bwhy\b|\bwhat\b|\bwen\b|\banyone know\b|\bhelp\b|\bwhere\b|\bwhen\b/i.test(t)
  );
}

function scoreMessage(text, cfg) {
  let score = 0;
  if (looksLikeQuestion(text)) score += 3;
  if (hasKeyword(text, cfg.watch.keywords || [])) score += 2;
  if ((text || "").length > 120) score += 1;
  return score;
}

// ---------------- DIGEST QUEUE ----------------
const digestQueue = [];
let digestTimer = null;
const lastNotifyByChannel = new Map();

function startDigestLoop() {
  if (digestTimer) return;

  digestTimer = setInterval(async () => {
    const cfg = loadConfig();
    if (!cfg.digest?.enabled) return;
    if (digestQueue.length === 0) return;

    const maxItems = cfg.digest.maxItems ?? 10;
    const items = digestQueue.splice(0, maxItems);

    const grouped = {};
    for (const it of items) {
      grouped[it.channelName] = grouped[it.channelName] || [];
      grouped[it.channelName].push(it);
    }

    let msg = `Digest (${items.length}):\n\n`;
    for (const [chName, arr] of Object.entries(grouped)) {
      msg += `#${chName}\n`;
      for (const a of arr) {
        msg += `- ${a.author}: ${(a.content || "").replace(/\s+/g, " ").slice(0, 180)}\n`;
      }
      msg += `\n`;
    }

    msg += `Use /draft in the channel for full reply options.\nOr use /paste draft to generate from copied messages.\n`;

    await dmOwner(msg.trim());
  }, 60 * 1000);
}

// ---------------- SLASH COMMANDS ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("draft")
    .setDescription("Get AI reply suggestions for this channel"),

  new SlashCommandBuilder()
    .setName("starter")
    .setDescription("Get conversation starters for this channel"),

  new SlashCommandBuilder()
    .setName("paste")
    .setDescription("Paste convo from any server and get drafts/starters")
    .addSubcommand(sub =>
      sub
        .setName("draft")
        .setDescription("Generate reply suggestions from pasted text")
        .addStringOption(opt =>
          opt.setName("text").setDescription("Paste the conversation here").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("starter")
        .setDescription("Generate starters from pasted text")
        .addStringOption(opt =>
          opt.setName("text").setDescription("Paste the conversation here").setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("set")
    .setDescription("Set bot preferences")
    .addSubcommand(sub =>
      sub
        .setName("persona")
        .setDescription("Set persona tone")
        .addStringOption(opt =>
          opt
            .setName("value")
            .setDescription("degen, builder, collector")
            .setRequired(true)
            .addChoices(
              { name: "degen", value: "degen" },
              { name: "builder", value: "builder" },
              { name: "collector", value: "collector" }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("digest")
        .setDescription("Turn digest on/off and set interval minutes")
        .addStringOption(opt =>
          opt
            .setName("enabled")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
        )
        .addIntegerOption(opt =>
          opt
            .setName("interval")
            .setDescription("Minutes between digests (5–60)")
            .setMinValue(5)
            .setMaxValue(60)
            .setRequired(false)
        )
    ),

  new SlashCommandBuilder()
    .setName("watch")
    .setDescription("Watch channels for reply opportunities (bot DMs you)")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Add a channel to watch")
        .addChannelOption(opt => opt.setName("channel").setDescription("Channel").setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove a watched channel")
        .addChannelOption(opt => opt.setName("channel").setDescription("Channel").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("List watched channels"))
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
}

// ---------------- READY (warning-free) ----------------
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  console.log("Commands registered");
  startDigestLoop();
});

// ---------------- INTERACTIONS ----------------
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const cfg = loadConfig();

    if (interaction.commandName === "draft") {
      const convo = await getRecentMessages(interaction.channel, cfg.defaultContextMessages || 20);
      const out = await ollamaGenerate(makeDraftPrompt(convo, cfg.persona), cfg.ollamaModel);
      await dmOwner(`Reply ideas for #${interaction.channel.name}:\n\n${out}`);
      return interaction.editReply("Reply suggestions sent to your DMs.");
    }

    if (interaction.commandName === "starter") {
      const convo = await getRecentMessages(interaction.channel, cfg.defaultContextMessages || 20);
      const out = await ollamaGenerate(makeStarterPrompt(convo, cfg.persona), cfg.ollamaModel);
      await dmOwner(`Starters for #${interaction.channel.name}:\n\n${out}`);
      return interaction.editReply("Starters sent to your DMs.");
    }

    if (interaction.commandName === "paste") {
      const sub = interaction.options.getSubcommand();
      const text = interaction.options.getString("text");

      if (!text || text.trim().length < 10) {
        return interaction.editReply("Paste a bit more context.");
      }

      if (sub === "draft") {
        const out = await ollamaGenerate(makeDraftPrompt(text, cfg.persona), cfg.ollamaModel);
        await dmOwner(`Reply ideas from pasted convo:\n\n${out}`);
        return interaction.editReply("Reply suggestions sent to your DMs.");
      }

      if (sub === "starter") {
        const out = await ollamaGenerate(makeStarterPrompt(text, cfg.persona), cfg.ollamaModel);
        await dmOwner(`Starters from pasted convo:\n\n${out}`);
        return interaction.editReply("Starters sent to your DMs.");
      }
    }

    if (interaction.commandName === "set") {
      const sub = interaction.options.getSubcommand();

      if (sub === "persona") {
        cfg.persona = interaction.options.getString("value");
        saveConfig(cfg);
        return interaction.editReply(`Persona set to: ${cfg.persona}`);
      }

      if (sub === "digest") {
        const enabled = interaction.options.getString("enabled");
        const interval = interaction.options.getInteger("interval");

        cfg.digest = cfg.digest || {};
        cfg.digest.enabled = enabled === "on";
        if (interval) cfg.digest.intervalMinutes = interval;

        saveConfig(cfg);
        return interaction.editReply(
          `Digest is ${cfg.digest.enabled ? "ON" : "OFF"}${interval ? `, interval set to ${interval} mins` : ""}.`
        );
      }
    }

    if (interaction.commandName === "watch") {
      const sub = interaction.options.getSubcommand();

      cfg.watch = cfg.watch || { enabled: true, channelIds: [], keywords: [] };

      if (sub === "add") {
        const ch = interaction.options.getChannel("channel");
        if (!cfg.watch.channelIds.includes(ch.id)) cfg.watch.channelIds.push(ch.id);
        saveConfig(cfg);
        return interaction.editReply(`Watching ${ch}. I’ll DM you when there’s a good chance to reply.`);
      }

      if (sub === "remove") {
        const ch = interaction.options.getChannel("channel");
        cfg.watch.channelIds = cfg.watch.channelIds.filter(id => id !== ch.id);
        saveConfig(cfg);
        return interaction.editReply(`Stopped watching ${ch}.`);
      }

      if (sub === "list") {
        const list = (cfg.watch.channelIds || []).length
          ? cfg.watch.channelIds.map(id => `<#${id}>`).join("\n")
          : "No watched channels yet.";
        return interaction.editReply(list);
      }
    }

    return interaction.editReply("Unknown command.");
  } catch (err) {
    console.error("INTERACTION ERROR:", err);
    return interaction.editReply("Something went wrong. Check terminal logs.");
  }
});

// ---------------- WATCHER (digest notifications) ----------------
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const cfg = loadConfig();
  if (!cfg.watch?.enabled) return;

  const channelIds = cfg.watch.channelIds || [];
  if (!channelIds.includes(message.channel.id)) return;

  const score = scoreMessage(message.content, cfg);
  const threshold = cfg.watch.minScoreToNotify ?? 2;
  if (score < threshold) return;

  const cooldown = cfg.watch.cooldownSecondsPerChannel ?? 60;
  const last = lastNotifyByChannel.get(message.channel.id) || 0;
  if ((Date.now() - last) / 1000 < cooldown) return;

  lastNotifyByChannel.set(message.channel.id, Date.now());

  const item = {
    channelName: message.channel.name,
    author: message.author.username,
    content: message.content
  };

  if (cfg.digest?.enabled) {
    digestQueue.push(item);
    const maxQueue = 50;
    if (digestQueue.length > maxQueue) digestQueue.splice(0, digestQueue.length - maxQueue);
  } else {
    await dmOwner(
      `Reply opportunity in #${message.channel.name}:\n${message.author.username}: ${message.content.slice(0, 250)}\n\nRun /draft in that channel.`
    );
  }
});

// ---------------- START ----------------
client.login(DISCORD_TOKEN);