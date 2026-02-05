import { REST, Routes } from "discord.js"
import { config } from "./config.js"
import { getCommandsData } from "./commands/index.js"

async function deploy(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN)

  const commands = getCommandsData()

  console.log(`Deploying ${commands.length} commands to guild ${config.GUILD_ID}...`)

  try {
    await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.GUILD_ID), {
      body: commands,
    })

    console.log("Commands deployed successfully")
  } catch (error) {
    console.error("Failed to deploy commands:", error)
    process.exit(1)
  }
}

deploy()