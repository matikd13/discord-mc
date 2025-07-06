// Require the necessary discord.js classes
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  EmbedBuilder,
} from "discord.js";
import "dotenv/config";

import { RCONClient } from "@minecraft-js/rcon"; // ES6

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rconClient = new RCONClient("127.0.0.1", process.env.RCON_PASSWORD);

var serverOnline = false;
var onlineUsers = [0, 0];
var admins = 0;

rconClient.on("authenticated", async () => {
  console.log("RCON OK");
  updateServerStatus();
});

rconClient.on("error", () => {
  console.log("RCON ERROR");
});

const discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
discordClient.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  printServerStatus();
});

discordClient.commands = new Collection();
const foldersPath = path.join(__dirname, "commands");

const commandFiles = fs
  .readdirSync(foldersPath)
  .filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const filePath = path.join(foldersPath, file);
  const command = await import(filePath);
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ("data" in command && "execute" in command) {
    discordClient.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

discordClient.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

discordClient.login(process.env.BOT_TOKEN);
rconClient.connect();

async function updateServerStatus() {
  if (!rconClient.authenticated || !rconClient.connected) {
    serverOnline = false;
    setTimeout(() => {
      rconClient.connect();
    }, 1000);
    return;
  }

  serverOnline = true;

  let listOutput = await rconClient.executeCommandAsync("list");
  listOutput = listOutput.replace(/Â§./g, "");

  const adminsCount = listOutput.match(/\[root\]|\[Admin\]/g);
  admins = adminsCount ? adminsCount.length : 0;

  const lines = listOutput.trim().split("\n");
  const firstLine = lines[0];
  onlineUsers = firstLine.match(/\d+/g);
}

async function printServerStatus() {
  const channel = await discordClient.channels.fetch(
    process.env.STATUS_CHANNEL_ID
  );

  const exampleEmbed = new EmbedBuilder()
    .setColor(serverOnline ? 0x00ff00 : 0xff0000)
    .setTitle("Status Serwera Minecraft")
    .setDescription(`Serwer ${!serverOnline ? "nie " : ""}żyje`)
    .addFields(
      { name: "Adres IP:", value: `${process.env.SERVER_IP}` },
      { name: "Ilość graczy:", value: `${onlineUsers[0]}/${onlineUsers[1]}` },
      { name: "Ilość adminów:", value: admins.toString() }
    )
    .setTimestamp();

  const messages = await channel.messages.fetch({ limit: 100 });

  let targetMessage = messages.find(
    (m) => m.author.id == discordClient.user.id
  );

  if (targetMessage) {
    targetMessage.edit({ embeds: [exampleEmbed] });
  } else {
    channel.send({ embeds: [exampleEmbed] });
  }
}

setInterval(async () => {
  await updateServerStatus();
  await printServerStatus();
}, 10000);
