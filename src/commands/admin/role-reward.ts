import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js"
import { eq, and, asc } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { roleRewards } from "../../database/schema.js"
import { setRoleReward, removeRoleReward } from "../../services/level.service.js"
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed, getBranchLabel, getBranchColor } from "../../utils/embeds.js"
import type { Branch } from "../../config.js"
import type { Command } from "../index.js"

export const roleRewardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("role-reward")
    .setDescription("Manage level-up role rewards")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set a role reward for a level")
        .addStringOption((opt) =>
          opt
            .setName("branch")
            .setDescription("Branch for this reward")
            .setRequired(true)
            .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
        )
        .addIntegerOption((opt) =>
          opt.setName("level").setDescription("Level to award at").setRequired(true).setMinValue(1).setMaxValue(500)
        )
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to award").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a role reward")
        .addStringOption((opt) =>
          opt
            .setName("branch")
            .setDescription("Branch")
            .setRequired(true)
            .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
        )
        .addIntegerOption((opt) =>
          opt.setName("level").setDescription("Level to remove reward from").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("View all role rewards")
        .addStringOption((opt) =>
          opt
            .setName("branch")
            .setDescription("Branch to view")
            .setRequired(true)
            .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guildId!

    if (subcommand === "set") {
      const branch = interaction.options.getString("branch", true) as Branch
      const level = interaction.options.getInteger("level", true)
      const role = interaction.options.getRole("role", true)

      if (role.managed) {
        await interaction.reply({
          embeds: [createErrorEmbed("Invalid Role", "Cannot use managed/integration roles as rewards")],
          ephemeral: true,
        })
        return
      }

      await setRoleReward(guildId, branch, level, role.id)

      await interaction.reply({
        embeds: [
          createSuccessEmbed(
            "Role Reward Set",
            `**${getBranchLabel(branch)}** Level **${level}** will now award ${role}`
          ),
        ],
      })
      return
    }

    if (subcommand === "remove") {
      const branch = interaction.options.getString("branch", true) as Branch
      const level = interaction.options.getInteger("level", true)

      await removeRoleReward(guildId, branch, level)

      await interaction.reply({
        embeds: [
          createSuccessEmbed("Role Reward Removed", `**${getBranchLabel(branch)}** Level **${level}** reward removed`),
        ],
      })
      return
    }

    if (subcommand === "list") {
      const branch = interaction.options.getString("branch", true) as Branch

      const rewards = await db
        .select()
        .from(roleRewards)
        .where(and(eq(roleRewards.guildId, guildId), eq(roleRewards.branch, branch)))
        .orderBy(asc(roleRewards.level))

      if (rewards.length === 0) {
        await interaction.reply({
          embeds: [createInfoEmbed(`${getBranchLabel(branch)} Role Rewards`, "No rewards configured")],
        })
        return
      }

      const rewardList = rewards.map((r) => `Level **${r.level}** → <@&${r.roleId}>`).join("\n")

      await interaction.reply({
        embeds: [
          createInfoEmbed(`${getBranchLabel(branch)} Role Rewards`, rewardList)
            .setColor(getBranchColor(branch))
            .setFooter({ text: `${rewards.length} reward(s) • Branch ${branch}` }),
        ],
      })
    }
  },
}