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
} from "discord.js";
import "dotenv/config";

import { RCONClient } from "@minecraft-js/rcon"; // ES6

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rconClient = new RCONClient("127.0.0.1", process.env.RCON_PAASSWORD);

rconClient.on("authenticated", () => {
  console.log("RCON OK");
});

rconClient.on("error", () => {
  console.log("RCON ERROR");
});

rconClient.on("response", (requestId, packet) => {
  console.log(requestId);
  console.log(packet);
  console.log(packet.payload);
  // Access the command response by `packet.payload`
});

const discordClient = new Client({ intents: [GatewayIntentBits.Guilds] });
discordClient.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
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
