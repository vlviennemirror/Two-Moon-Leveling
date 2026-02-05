import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, type ChatInputCommandInteraction } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { guildConfig } from "../../database/schema.js"
import { cache, cacheKeys } from "../../cache/manager.js"
import { getGuildConfig } from "../../services/xp.service.js"
import { createSuccessEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Command } from "../index.js"

export const logChannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("log-channel")
    .setDescription("Configure logging channels")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("log")
        .setDescription("Set level-up log channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for logs (leave empty to disable)")
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("announce")
        .setDescription("Set level-up announcement channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel for announcements (leave empty to disable)")
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle-announce")
        .setDescription("Toggle level-up announcements")
        .addBooleanOption((opt) =>
          opt.setName("enabled").setDescription("Enable announcements").setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("view").setDescription("View current channel configuration")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guildId!

    await getGuildConfig(guildId)

    if (subcommand === "log") {
      const channel = interaction.options.getChannel("channel")

      await db
        .update(guildConfig)
        .set({ logChannel: channel?.id ?? null, updatedAt: new Date() })
        .where(eq(guildConfig.guildId, guildId))

      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [
          createSuccessEmbed(
            "Log Channel Updated",
            channel ? `Level-up logs will be sent to ${channel}` : "Level-up logging disabled"
          ),
        ],
      })
      return
    }

    if (subcommand === "announce") {
      const channel = interaction.options.getChannel("channel")

      await db
        .update(guildConfig)
        .set({ announceChannel: channel?.id ?? null, updatedAt: new Date() })
        .where(eq(guildConfig.guildId, guildId))

      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [
          createSuccessEmbed(
            "Announce Channel Updated",
            channel ? `Level-up announcements will be sent to ${channel}` : "Level-up announcements disabled"
          ),
        ],
      })
      return
    }

    if (subcommand === "toggle-announce") {
      const enabled = interaction.options.getBoolean("enabled", true)

      await db
        .update(guildConfig)
        .set({ announceEnabled: enabled, updatedAt: new Date() })
        .where(eq(guildConfig.guildId, guildId))

      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [
          createSuccessEmbed(
            "Announcements Updated",
            enabled ? "Level-up announcements enabled" : "Level-up announcements disabled"
          ),
        ],
      })
      return
    }

    if (subcommand === "view") {
      const config = await getGuildConfig(guildId)

      await interaction.reply({
        embeds: [
          createInfoEmbed("Channel Configuration")
            .addFields(
              {
                name: "Log Channel",
                value: config.logChannel ? `<#${config.logChannel}>` : "Not set",
                inline: true,
              },
              {
                name: "Announce Channel",
                value: config.announceChannel ? `<#${config.announceChannel}>` : "Not set",
                inline: true,
              },
              {
                name: "Announcements",
                value: config.announceEnabled ? "✅ Enabled" : "❌ Disabled",
                inline: true,
              }
            ),
        ],
      })
    }
  },
}