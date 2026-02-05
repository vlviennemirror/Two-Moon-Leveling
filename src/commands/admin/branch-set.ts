import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js"
import { setBranchConfig, getBranchConfig } from "../../services/branch.service.js"
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed, getBranchLabel } from "../../utils/embeds.js"
import type { Branch } from "../../config.js"
import type { Command } from "../index.js"

export const branchSetCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("branch-set")
    .setDescription("Configure branch base roles")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("assign")
        .setDescription("Set base role for a branch")
        .addStringOption((opt) =>
          opt
            .setName("branch")
            .setDescription("Branch to configure")
            .setRequired(true)
            .addChoices({ name: "Branch A (Member)", value: "A" }, { name: "Branch B (Visitor)", value: "B" })
        )
        .addRoleOption((opt) => opt.setName("role").setDescription("Base role for this branch").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("view").setDescription("View current branch configuration")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === "assign") {
      const branch = interaction.options.getString("branch", true) as Branch
      const role = interaction.options.getRole("role", true)

      if (role.managed) {
        await interaction.reply({
          embeds: [createErrorEmbed("Invalid Role", "Cannot use managed/integration roles")],
          ephemeral: true,
        })
        return
      }

      await setBranchConfig(interaction.guildId!, branch, role.id)

      await interaction.reply({
        embeds: [
          createSuccessEmbed(
            "Branch Configured",
            `**${getBranchLabel(branch)}** branch base role set to ${role}`
          ),
        ],
      })
      return
    }

    if (subcommand === "view") {
      const [branchA, branchB] = await Promise.all([
        getBranchConfig(interaction.guildId!, "A"),
        getBranchConfig(interaction.guildId!, "B"),
      ])

      const embed = createInfoEmbed("Branch Configuration")
        .addFields(
          {
            name: "Branch A (Member)",
            value: branchA ? `<@&${branchA.baseRoleId}>` : "Not configured",
            inline: true,
          },
          {
            name: "Branch B (Visitor)",
            value: branchB ? `<@&${branchB.baseRoleId}>` : "Not configured",
            inline: true,
          }
        )
        .setFooter({ text: "Users with these roles will earn XP in their respective branches" })

      await interaction.reply({ embeds: [embed] })
    }
  },
}