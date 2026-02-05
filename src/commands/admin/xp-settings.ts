import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js"
import { eq } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { guildConfig } from "../../database/schema.js"
import { cache, cacheKeys } from "../../cache/manager.js"
import { getGuildConfig } from "../../services/xp.service.js"
import { createSuccessEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Command } from "../index.js"

export const xpSettingsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("xp-settings")
    .setDescription("Configure XP system settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("message")
        .setDescription("Configure message XP")
        .addIntegerOption((opt) =>
          opt.setName("min").setDescription("Minimum XP per message").setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName("max").setDescription("Maximum XP per message").setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName("cooldown").setDescription("Cooldown in seconds").setMinValue(10).setMaxValue(300)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reaction")
        .setDescription("Configure reaction XP")
        .addIntegerOption((opt) =>
          opt.setName("xp").setDescription("XP per reaction").setMinValue(1).setMaxValue(50)
        )
        .addIntegerOption((opt) =>
          opt.setName("cooldown").setDescription("Cooldown in seconds").setMinValue(10).setMaxValue(300)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("voice")
        .setDescription("Configure voice XP")
        .addIntegerOption((opt) =>
          opt.setName("xp-per-min").setDescription("XP per minute in voice").setMinValue(1).setMaxValue(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("formula")
        .setDescription("Configure leveling formula")
        .addIntegerOption((opt) =>
          opt.setName("base").setDescription("Base XP value").setMinValue(50).setMaxValue(500)
        )
        .addNumberOption((opt) =>
          opt.setName("exponent").setDescription("Exponent value (1.2 - 2.5)").setMinValue(1.2).setMaxValue(2.5)
        )
    )
    .addSubcommand((sub) => sub.setName("view").setDescription("View current XP settings")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guildId!

    await getGuildConfig(guildId)

    if (subcommand === "message") {
      const min = interaction.options.getInteger("min")
      const max = interaction.options.getInteger("max")
      const cooldown = interaction.options.getInteger("cooldown")

      if (!min && !max && !cooldown) {
        await interaction.reply({
          embeds: [createInfoEmbed("No Changes", "Provide at least one option to update")],
          ephemeral: true,
        })
        return
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (min !== null) updates.msgXpMin = min
      if (max !== null) updates.msgXpMax = max
      if (cooldown !== null) updates.msgCooldown = cooldown

      await db.update(guildConfig).set(updates).where(eq(guildConfig.guildId, guildId))
      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Message XP Updated", "Settings saved successfully")],
      })
      return
    }

    if (subcommand === "reaction") {
      const xp = interaction.options.getInteger("xp")
      const cooldown = interaction.options.getInteger("cooldown")

      if (!xp && !cooldown) {
        await interaction.reply({
          embeds: [createInfoEmbed("No Changes", "Provide at least one option to update")],
          ephemeral: true,
        })
        return
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (xp !== null) updates.reactXp = xp
      if (cooldown !== null) updates.reactCooldown = cooldown

      await db.update(guildConfig).set(updates).where(eq(guildConfig.guildId, guildId))
      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Reaction XP Updated", "Settings saved successfully")],
      })
      return
    }

    if (subcommand === "voice") {
      const xpPerMin = interaction.options.getInteger("xp-per-min")

      if (!xpPerMin) {
        await interaction.reply({
          embeds: [createInfoEmbed("No Changes", "Provide XP per minute value")],
          ephemeral: true,
        })
        return
      }

      await db
        .update(guildConfig)
        .set({ voiceXpPerMin: xpPerMin, updatedAt: new Date() })
        .where(eq(guildConfig.guildId, guildId))

      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Voice XP Updated", `XP per minute set to **${xpPerMin}**`)],
      })
      return
    }

    if (subcommand === "formula") {
      const base = interaction.options.getInteger("base")
      const exponent = interaction.options.getNumber("exponent")

      if (!base && !exponent) {
        await interaction.reply({
          embeds: [createInfoEmbed("No Changes", "Provide at least one option to update")],
          ephemeral: true,
        })
        return
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (base !== null) updates.levelBase = base
      if (exponent !== null) updates.levelExponent = exponent

      await db.update(guildConfig).set(updates).where(eq(guildConfig.guildId, guildId))
      cache.guildConfig.delete(cacheKeys.guildConfig(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Formula Updated", "Leveling formula updated successfully")],
      })
      return
    }

    if (subcommand === "view") {
      const config = await getGuildConfig(guildId)

      await interaction.reply({
        embeds: [
          createInfoEmbed("XP Settings")
            .addFields(
              {
                name: "📝 Message XP",
                value: `Min: ${config.msgXpMin}\nMax: ${config.msgXpMax}\nCooldown: ${config.msgCooldown}s`,
                inline: true,
              },
              {
                name: "👍 Reaction XP",
                value: `XP: ${config.reactXp}\nCooldown: ${config.reactCooldown}s`,
                inline: true,
              },
              {
                name: "🎙️ Voice XP",
                value: `Per minute: ${config.voiceXpPerMin}\nMuted: 50%`,
                inline: true,
              },
              {
                name: "📊 Formula",
                value: `Base: ${config.levelBase}\nExponent: ${config.levelExponent}\n\`XP = ${config.levelBase} × level^${config.levelExponent} + ${config.levelBase} × level\``,
                inline: false,
              }
            ),
        ],
      })
    }
  },
}