import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js"
import { eq, and, desc } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { userLevels } from "../../database/schema.js"
import { getGuildConfig } from "../../services/xp.service.js"
import { detectUserBranch, getUserBranchData } from "../../services/branch.service.js"
import { calculateProgress } from "../../utils/formula.js"
import { createProfileEmbed, createErrorEmbed, createInfoEmbed, getBranchLabel } from "../../utils/embeds.js"
import type { Branch } from "../../config.js"
import type { Command } from "../index.js"

export const profileCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View leveling profile")
    .addUserOption((opt) => opt.setName("user").setDescription("User to view (defaults to yourself)"))
    .addStringOption((opt) =>
      opt
        .setName("branch")
        .setDescription("Branch to view")
        .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser("user") ?? interaction.user
    const specifiedBranch = interaction.options.getString("branch") as Branch | null
    const guildId = interaction.guildId!

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed("Invalid User", "Bots do not have leveling profiles")],
        ephemeral: true,
      })
      return
    }

    const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null)
    if (!member) {
      await interaction.reply({
        embeds: [createErrorEmbed("User Not Found", "Could not find this user in the server")],
        ephemeral: true,
      })
      return
    }

    let branch: Branch | null = specifiedBranch

    if (!branch) {
      branch = await detectUserBranch(guildId, member)
    }

    if (!branch) {
      await interaction.reply({
        embeds: [
          createInfoEmbed(
            "No Branch",
            `${targetUser} is not assigned to any branch.\nThey need a branch base role to earn XP.`
          ),
        ],
        ephemeral: true,
      })
      return
    }

    const userData = await getUserBranchData(guildId, targetUser.id, branch)

    if (!userData) {
      await interaction.reply({
        embeds: [
          createInfoEmbed(
            "No Data",
            `${targetUser} has no XP in **${getBranchLabel(branch)}** branch yet.`
          ),
        ],
      })
      return
    }

    const config = await getGuildConfig(guildId)
    const progress = calculateProgress(userData.xp, userData.level, config.levelBase, config.levelExponent)

    const rankResult = await db
      .select({ userId: userLevels.userId })
      .from(userLevels)
      .where(and(eq(userLevels.guildId, guildId), eq(userLevels.branch, branch)))
      .orderBy(desc(userLevels.xp))

    const rank = rankResult.findIndex((r) => r.userId === targetUser.id) + 1

    const embed = createProfileEmbed(
      targetUser.id,
      targetUser.username,
      targetUser.displayAvatarURL({ size: 128 }),
      branch,
      userData.level,
      userData.xp,
      progress,
      rank || rankResult.length + 1,
      {
        messages: userData.totalMessages,
        reactions: userData.totalReactions,
        voiceMinutes: userData.totalVoiceMinutes,
      }
    )

    await interaction.reply({ embeds: [embed] })
  },
}