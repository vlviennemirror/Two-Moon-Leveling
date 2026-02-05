import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { guildConfig } from "../../database/schema.js"
import { cache, cacheKeys } from "../../cache/manager.js"
import { getGuildConfig } from "../../services/xp.service.js"
import { createSuccessEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Command } from "../index.js"

export const swapRoleConfigCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("swap-role-config")
    .setDescription("Configure the role required to use branch swap")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the role required to swap branches")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role that can use swap command").setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("remove").setDescription("Remove swap role requirement (disable swap)"))
    .addSubcommand((sub) => sub.setName("view").setDescription("View current swap role configuration")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guildId!

    await getGuildConfig(guildId)

    if (subcommand === "set") {
      const role = interaction.options.getRole("role", true)

      await db
        .update(guildConfig)
        .set({ swapRoleId: role.id, updatedAt: new Date() })
        .where(eq(guildConfig.guildId, guildId))

      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [
          createSuccessEmbed("Swap Role Set", `Users with ${role} can now use \`/swap-branch\` command`),
        ],
      })
      return
    }

    if (subcommand === "remove") {
      await db
        .update(guildConfig)
        .set({ swapRoleId: null, updatedAt: new Date() })
        .where(eq(guildConfig.guildId, guildId))

      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Swap Role Removed", "Branch swap command is now disabled")],
      })
      return
    }

    if (subcommand === "view") {
      const config = await getGuildConfig(guildId)

      await interaction.reply({
        embeds: [
          createInfoEmbed(
            "Swap Role Configuration",
            config.swapRoleId
              ? `Users with <@&${config.swapRoleId}> can use \`/swap-branch\``
              : "Branch swap is currently disabled"
          ),
        ],
      })
    }
  },
}