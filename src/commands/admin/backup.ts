import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, type ChatInputCommandInteraction } from "discord.js"
import { createBackup, getBackupJson, restoreFromBackup, getBackupHistory } from "../../database/backup.js"
import { cache } from "../../cache/manager.js"
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Command } from "../index.js"

export const backupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Manage database backups")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName("create").setDescription("Create a backup and download it"))
    .addSubcommand((sub) =>
      sub
        .setName("restore")
        .setDescription("Restore from a backup file")
        .addAttachmentOption((opt) =>
          opt.setName("file").setDescription("Backup JSON file").setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName("history").setDescription("View backup history")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()

    if (subcommand === "create") {
      await interaction.deferReply()

      try {
        const result = await createBackup()
        const jsonData = await getBackupJson()

        const attachment = new AttachmentBuilder(Buffer.from(jsonData, "utf-8"), {
          name: result.filename,
        })

        await interaction.editReply({
          embeds: [
            createSuccessEmbed(
              "Backup Created",
              `**File:** ${result.filename}\n**Records:** ${result.recordCount.toLocaleString()}`
            ),
          ],
          files: [attachment],
        })
      } catch (error) {
        await interaction.editReply({
          embeds: [createErrorEmbed("Backup Failed", (error as Error).message)],
        })
      }
      return
    }

    if (subcommand === "restore") {
      const attachment = interaction.options.getAttachment("file", true)

      if (!attachment.name?.endsWith(".json")) {
        await interaction.reply({
          embeds: [createErrorEmbed("Invalid File", "Please upload a JSON backup file")],
          ephemeral: true,
        })
        return
      }

      await interaction.deferReply()

      try {
        const response = await fetch(attachment.url)
        const jsonData = await response.text()

        const result = await restoreFromBackup(jsonData)

        cache.invalidateGuild(interaction.guildId!)

        await interaction.editReply({
          embeds: [
            createSuccessEmbed(
              "Backup Restored",
              `Successfully restored **${result.recordCount.toLocaleString()}** records`
            ),
          ],
        })
      } catch (error) {
        await interaction.editReply({
          embeds: [createErrorEmbed("Restore Failed", (error as Error).message)],
        })
      }
      return
    }

    if (subcommand === "history") {
      const history = await getBackupHistory(10)

      if (history.length === 0) {
        await interaction.reply({
          embeds: [createInfoEmbed("Backup History", "No backups recorded yet")],
        })
        return
      }

      const historyList = history
        .map((h, i) => {
          const date = h.createdAt.toLocaleString()
          return `**${i + 1}.** ${h.filename}\n   ${date} • ${h.recordCount} records`
        })
        .join("\n\n")

      await interaction.reply({
        embeds: [
          createInfoEmbed("Backup History", historyList).setFooter({
            text: "Automatic backups run every 24 hours",
          }),
        ],
      })
    }
  },
}