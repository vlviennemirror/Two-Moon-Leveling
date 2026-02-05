import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js"
import { modifyUserXp, modifyUserLevel } from "../../services/level.service.js"
import { detectUserBranch } from "../../services/branch.service.js"
import { createSuccessEmbed, createErrorEmbed, getBranchLabel } from "../../utils/embeds.js"
import type { Branch } from "../../config.js"
import type { Command } from "../index.js"

export const modifyXpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("modify-xp")
    .setDescription("Modify user XP or level")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("set-xp")
        .setDescription("Set user XP to specific amount")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("branch")
            .setDescription("Branch")
            .setRequired(true)
            .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
        )
        .addIntegerOption((opt) =>
          opt.setName("amount").setDescription("XP amount").setRequired(true).setMinValue(0)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add-xp")
        .setDescription("Add XP to user")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("branch")
            .setDescription("Branch")
            .setRequired(true)
            .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
        )
        .addIntegerOption((opt) =>
          opt.setName("amount").setDescription("XP to add").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove-xp")
        .setDescription("Remove XP from user")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("branch")
            .setDescription("Branch")
            .setRequired(true)
            .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
        )
        .addIntegerOption((opt) =>
          opt.setName("amount").setDescription("XP to remove").setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("set-level")
        .setDescription("Set user level")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName("branch")
            .setDescription("Branch")
            .setRequired(true)
            .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
        )
        .addIntegerOption((opt) =>
          opt.setName("level").setDescription("Target level").setRequired(true).setMinValue(0).setMaxValue(500)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const user = interaction.options.getUser("user", true)
    const branch = interaction.options.getString("branch", true) as Branch
    const guildId = interaction.guildId!

    if (user.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed("Invalid Target", "Cannot modify XP for bots")],
        ephemeral: true,
      })
      return
    }

    if (subcommand === "set-level") {
      const level = interaction.options.getInteger("level", true)
      const result = await modifyUserLevel(guildId, user.id, branch, level)

      await interaction.reply({
        embeds: [
          createSuccessEmbed(
            "Level Modified",
            `${user} is now **Level ${result.newLevel}** in **${getBranchLabel(branch)}**\nTotal XP: ${result.newXp.toLocaleString()}`
          ),
        ],
      })
      return
    }

    const amount = interaction.options.getInteger("amount", true)
    let action: "set" | "add" | "remove"

    if (subcommand === "set-xp") action = "set"
    else if (subcommand === "add-xp") action = "add"
    else action = "remove"

    const result = await modifyUserXp(guildId, user.id, branch, action, amount)

    const actionText = action === "set" ? "set to" : action === "add" ? "added" : "removed"

    await interaction.reply({
      embeds: [
        createSuccessEmbed(
          "XP Modified",
          `${user} — ${amount.toLocaleString()} XP ${actionText}\n**${getBranchLabel(branch)}** Level **${result.newLevel}** (${result.newXp.toLocaleString()} XP)`
        ),
      ],
    })
  },
}