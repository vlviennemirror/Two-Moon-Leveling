import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js"
import { getGuildConfig } from "../../services/xp.service.js"
import { detectUserBranch, swapUserBranch, getAllBranchConfigs } from "../../services/branch.service.js"
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed, getBranchLabel } from "../../utils/embeds.js"
import type { Branch } from "../../config.js"
import type { Command } from "../index.js"

export const swapBranchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("swap-branch")
    .setDescription("Swap your leveling data to the other branch"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!
    const member = interaction.member

    if (!member || !("roles" in member)) {
      await interaction.reply({
        embeds: [createErrorEmbed("Error", "Could not verify your roles")],
        ephemeral: true,
      })
      return
    }

    const config = await getGuildConfig(guildId)

    if (!config.swapRoleId) {
      await interaction.reply({
        embeds: [createErrorEmbed("Disabled", "Branch swap is not enabled on this server")],
        ephemeral: true,
      })
      return
    }

    const hasSwapRole = member.roles.cache.has(config.swapRoleId)

    if (!hasSwapRole) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            "Permission Denied",
            `You need <@&${config.swapRoleId}> to use this command`
          ),
        ],
        ephemeral: true,
      })
      return
    }

    const guildMember = await interaction.guild!.members.fetch(interaction.user.id)
    const currentBranch = await detectUserBranch(guildId, guildMember)

    if (!currentBranch) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            "No Branch",
            "You are not assigned to any branch. Get a branch base role first."
          ),
        ],
        ephemeral: true,
      })
      return
    }

    const branches = await getAllBranchConfigs(guildId)
    const targetBranch: Branch = currentBranch === "A" ? "B" : "A"
    const targetBranchConfig = branches[targetBranch]

    if (!targetBranchConfig) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            "Branch Not Configured",
            `**${getBranchLabel(targetBranch)}** branch is not configured yet`
          ),
        ],
        ephemeral: true,
      })
      return
    }

    const hasTargetRole = guildMember.roles.cache.has(targetBranchConfig.baseRoleId)

    if (!hasTargetRole) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            "Missing Role",
            `You need <@&${targetBranchConfig.baseRoleId}> to swap to **${getBranchLabel(targetBranch)}** branch`
          ),
        ],
        ephemeral: true,
      })
      return
    }

    await interaction.deferReply()

    const result = await swapUserBranch(guildId, interaction.user.id, currentBranch, targetBranch)

    if (!result.success) {
      await interaction.editReply({
        embeds: [createErrorEmbed("Swap Failed", result.error ?? "Unknown error")],
      })
      return
    }

    await interaction.editReply({
      embeds: [
        createSuccessEmbed(
          "Branch Swapped",
          `Your leveling data has been moved from **${getBranchLabel(currentBranch)}** to **${getBranchLabel(targetBranch)}**`
        ).setFooter({ text: "Your XP, level, and stats have been transferred" }),
      ],
    })
  },
}