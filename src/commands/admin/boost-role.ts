import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js"
import { eq, and } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { boostConfig } from "../../database/schema.js"
import { cache, cacheKeys } from "../../cache/manager.js"
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Command } from "../index.js"

export const boostRoleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("boost-role")
    .setDescription("Manage XP boost roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set XP multiplier for a role")
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to boost").setRequired(true))
        .addNumberOption((opt) =>
          opt
            .setName("multiplier")
            .setDescription("XP multiplier (e.g., 1.5 = 50% bonus)")
            .setRequired(true)
            .setMinValue(1.1)
            .setMaxValue(5)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove XP boost from a role")
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to remove boost from").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("View all boost roles")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guildId!

    if (subcommand === "set") {
      const role = interaction.options.getRole("role", true)
      const multiplier = interaction.options.getNumber("multiplier", true)

      await db
        .insert(boostConfig)
        .values({ guildId, targetId: role.id, targetType: "role", multiplier })
        .onConflictDoUpdate({
          target: [boostConfig.guildId, boostConfig.targetId],
          set: { multiplier },
        })

      cache.boostConfig.delete(cacheKeys.boostRoles(guildId))

      await interaction.reply({
        embeds: [
          createSuccessEmbed("Boost Role Set", `${role} now grants **${multiplier}x** XP multiplier`),
        ],
      })
      return
    }

    if (subcommand === "remove") {
      const role = interaction.options.getRole("role", true)

      await db
        .delete(boostConfig)
        .where(and(eq(boostConfig.guildId, guildId), eq(boostConfig.targetId, role.id)))

      cache.boostConfig.delete(cacheKeys.boostRoles(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Boost Removed", `${role} no longer grants XP boost`)],
      })
      return
    }

    if (subcommand === "list") {
      const boosts = await db
        .select()
        .from(boostConfig)
        .where(and(eq(boostConfig.guildId, guildId), eq(boostConfig.targetType, "role")))

      if (boosts.length === 0) {
        await interaction.reply({
          embeds: [createInfoEmbed("Boost Roles", "No boost roles configured")],
        })
        return
      }

      const boostList = boosts.map((b) => `<@&${b.targetId}> — **${b.multiplier}x**`).join("\n")

      await interaction.reply({
        embeds: [
          createInfoEmbed("Boost Roles", boostList).setFooter({ text: `${boosts.length} boost role(s)` }),
        ],
      })
    }
  },
}