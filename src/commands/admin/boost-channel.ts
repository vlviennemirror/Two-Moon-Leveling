import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, type ChatInputCommandInteraction } from "discord.js"
import { eq, and } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { boostConfig } from "../../database/schema.js"
import { cache, cacheKeys } from "../../cache/manager.js"
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Command } from "../index.js"

export const boostChannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("boost-channel")
    .setDescription("Manage XP boost channels")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set XP multiplier for a channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to boost")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
        )
        .addNumberOption((opt) =>
          opt
            .setName("multiplier")
            .setDescription("XP multiplier (e.g., 2 = 100% bonus)")
            .setRequired(true)
            .setMinValue(1.1)
            .setMaxValue(5)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove XP boost from a channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to remove boost from")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
        )
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("View all boost channels")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guildId!

    if (subcommand === "set") {
      const channel = interaction.options.getChannel("channel", true)
      const multiplier = interaction.options.getNumber("multiplier", true)

      await db
        .insert(boostConfig)
        .values({ guildId, targetId: channel.id, targetType: "channel", multiplier })
        .onConflictDoUpdate({
          target: [boostConfig.guildId, boostConfig.targetId],
          set: { multiplier },
        })

      cache.boostConfig.delete(cacheKeys.boostChannels(guildId))

      await interaction.reply({
        embeds: [
          createSuccessEmbed("Boost Channel Set", `${channel} now grants **${multiplier}x** XP multiplier`),
        ],
      })
      return
    }

    if (subcommand === "remove") {
      const channel = interaction.options.getChannel("channel", true)

      await db
        .delete(boostConfig)
        .where(and(eq(boostConfig.guildId, guildId), eq(boostConfig.targetId, channel.id)))

      cache.boostConfig.delete(cacheKeys.boostChannels(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Boost Removed", `${channel} no longer grants XP boost`)],
      })
      return
    }

    if (subcommand === "list") {
      const boosts = await db
        .select()
        .from(boostConfig)
        .where(and(eq(boostConfig.guildId, guildId), eq(boostConfig.targetType, "channel")))

      if (boosts.length === 0) {
        await interaction.reply({
          embeds: [createInfoEmbed("Boost Channels", "No boost channels configured")],
        })
        return
      }

      const boostList = boosts.map((b) => `<#${b.targetId}> — **${b.multiplier}x**`).join("\n")

      await interaction.reply({
        embeds: [
          createInfoEmbed("Boost Channels", boostList).setFooter({ text: `${boosts.length} boost channel(s)` }),
        ],
      })
    }
  },
}