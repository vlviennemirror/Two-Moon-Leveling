import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, type ChatInputCommandInteraction } from "discord.js"
import { eq, and } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { blockedChannels } from "../../database/schema.js"
import { cache, cacheKeys } from "../../cache/manager.js"
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Command } from "../index.js"

export const blockedChannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("blocked-channel")
    .setDescription("Manage channels blocked from earning XP")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Block a channel from earning XP")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to block")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Unblock a channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to unblock")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
        )
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("View all blocked channels")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guildId!

    if (subcommand === "add") {
      const channel = interaction.options.getChannel("channel", true)

      const [existing] = await db
        .select()
        .from(blockedChannels)
        .where(and(eq(blockedChannels.guildId, guildId), eq(blockedChannels.channelId, channel.id)))
        .limit(1)

      if (existing) {
        await interaction.reply({
          embeds: [createErrorEmbed("Already Blocked", `${channel} is already blocked`)],
          ephemeral: true,
        })
        return
      }

      await db.insert(blockedChannels).values({ guildId, channelId: channel.id })
      cache.blockedChannels.delete(cacheKeys.blockedChannels(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Channel Blocked", `${channel} will no longer earn XP`)],
      })
      return
    }

    if (subcommand === "remove") {
      const channel = interaction.options.getChannel("channel", true)

      await db
        .delete(blockedChannels)
        .where(and(eq(blockedChannels.guildId, guildId), eq(blockedChannels.channelId, channel.id)))

      cache.blockedChannels.delete(cacheKeys.blockedChannels(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Channel Unblocked", `${channel} can now earn XP`)],
      })
      return
    }

    if (subcommand === "list") {
      const blocked = await db
        .select()
        .from(blockedChannels)
        .where(eq(blockedChannels.guildId, guildId))

      if (blocked.length === 0) {
        await interaction.reply({
          embeds: [createInfoEmbed("Blocked Channels", "No channels are currently blocked")],
        })
        return
      }

      const channelList = blocked.map((c) => `<#${c.channelId}>`).join("\n")

      await interaction.reply({
        embeds: [
          createInfoEmbed("Blocked Channels", channelList).setFooter({ text: `${blocked.length} channel(s) blocked` }),
        ],
      })
    }
  },
}