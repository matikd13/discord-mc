import { REST, Routes } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import "dotenv/config";
// import fs from "node:fs";
// import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const foldersPath = join(__dirname, "commands");

// Grab all the command files from the commands directory you created earlier
const commandFiles = readdirSync(foldersPath).filter((file) =>
  file.endsWith(".js")
);
// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
  const filePath = join(foldersPath, file);
  const command = await import(filePath);
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.BOT_TOKEN);

// and deploy your commands!
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();
