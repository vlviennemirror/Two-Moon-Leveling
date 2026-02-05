import type { Interaction } from "discord.js"
import { isAllowedGuild } from "../client.js"
import { commands } from "../commands/index.js"

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return
  if (!interaction.guild) return
  if (!isAllowedGuild(interaction.guild.id)) return

  const command = commands.get(interaction.commandName)
  if (!command) {
    await interaction.reply({ content: "Unknown command", ephemeral: true })
    return
  }

  try {
    await command.execute(interaction)
  } catch (error) {
    console.error(`Command ${interaction.commandName} failed:`, (error as Error).message)

    const errorMessage = { content: "Command execution failed", ephemeral: true }

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage)
    } else {
      await interaction.reply(errorMessage)
    }
  }
}