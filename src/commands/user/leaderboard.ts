import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ChatInputCommandInteraction,
} from "discord.js"
import { eq, and, desc } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { userLevels } from "../../database/schema.js"
import { createLeaderboardEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Branch } from "../../config.js"
import type { Command } from "../index.js"

const ENTRIES_PER_PAGE = 10

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the leveling leaderboard")
    .addStringOption((opt) =>
      opt
        .setName("branch")
        .setDescription("Branch to view")
        .setRequired(true)
        .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const branch = interaction.options.getString("branch", true) as Branch
    const guildId = interaction.guildId!

    const allEntries = await db
      .select({
        userId: userLevels.userId,
        level: userLevels.level,
        xp: userLevels.xp,
      })
      .from(userLevels)
      .where(and(eq(userLevels.guildId, guildId), eq(userLevels.branch, branch)))
      .orderBy(desc(userLevels.xp))

    if (allEntries.length === 0) {
      await interaction.reply({
        embeds: [createInfoEmbed("Empty Leaderboard", "No one has earned XP in this branch yet")],
      })
      return
    }

    const totalPages = Math.ceil(allEntries.length / ENTRIES_PER_PAGE)
    let currentPage = 1

    const getPageEntries = (page: number) => {
      const start = (page - 1) * ENTRIES_PER_PAGE
      return allEntries.slice(start, start + ENTRIES_PER_PAGE).map((entry, index) => ({
        rank: start + index + 1,
        userId: entry.userId,
        level: entry.level,
        xp: entry.xp,
      }))
    }

    const createButtons = (page: number, disabled: boolean = false) => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("lb_first")
          .setLabel("⏮")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page === 1),
        new ButtonBuilder()
          .setCustomId("lb_prev")
          .setLabel("◀")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled || page === 1),
        new ButtonBuilder()
          .setCustomId("lb_page")
          .setLabel(`${page}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("lb_next")
          .setLabel("▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled || page === totalPages),
        new ButtonBuilder()
          .setCustomId("lb_last")
          .setLabel("⏭")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page === totalPages)
      )
    }

    const response = await interaction.reply({
      embeds: [createLeaderboardEmbed(branch, getPageEntries(currentPage), currentPage, totalPages)],
      components: totalPages > 1 ? [createButtons(currentPage)] : [],
      fetchReply: true,
    })

    if (totalPages <= 1) return

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
      filter: (i) => i.user.id === interaction.user.id,
    })

    collector.on("collect", async (buttonInteraction) => {
      switch (buttonInteraction.customId) {
        case "lb_first":
          currentPage = 1
          break
        case "lb_prev":
          currentPage = Math.max(1, currentPage - 1)
          break
        case "lb_next":
          currentPage = Math.min(totalPages, currentPage + 1)
          break
        case "lb_last":
          currentPage = totalPages
          break
      }

      await buttonInteraction.update({
        embeds: [createLeaderboardEmbed(branch, getPageEntries(currentPage), currentPage, totalPages)],
        components: [createButtons(currentPage)],
      })
    })

    collector.on("end", async () => {
      await interaction.editReply({
        components: [createButtons(currentPage, true)],
      }).catch(() => {})
    })
  },
}