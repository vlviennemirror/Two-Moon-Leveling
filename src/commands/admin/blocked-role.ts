import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js"
import { eq, and } from "drizzle-orm"
import { db } from "../../database/connection.js"
import { blockedRoles } from "../../database/schema.js"
import { cache, cacheKeys } from "../../cache/manager.js"
import { createSuccessEmbed, createErrorEmbed, createInfoEmbed } from "../../utils/embeds.js"
import type { Command } from "../index.js"

export const blockedRoleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("blocked-role")
    .setDescription("Manage roles blocked from earning XP")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Block a role from earning XP")
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to block").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Unblock a role")
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to unblock").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("View all blocked roles")),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand()
    const guildId = interaction.guildId!

    if (subcommand === "add") {
      const role = interaction.options.getRole("role", true)

      const [existing] = await db
        .select()
        .from(blockedRoles)
        .where(and(eq(blockedRoles.guildId, guildId), eq(blockedRoles.roleId, role.id)))
        .limit(1)

      if (existing) {
        await interaction.reply({
          embeds: [createErrorEmbed("Already Blocked", `${role} is already blocked`)],
          ephemeral: true,
        })
        return
      }

      await db.insert(blockedRoles).values({ guildId, roleId: role.id })
      cache.blockedRoles.delete(cacheKeys.blockedRoles(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Role Blocked", `${role} will no longer earn XP`)],
      })
      return
    }

    if (subcommand === "remove") {
      const role = interaction.options.getRole("role", true)

      await db
        .delete(blockedRoles)
        .where(and(eq(blockedRoles.guildId, guildId), eq(blockedRoles.roleId, role.id)))

      cache.blockedRoles.delete(cacheKeys.blockedRoles(guildId))

      await interaction.reply({
        embeds: [createSuccessEmbed("Role Unblocked", `${role} can now earn XP`)],
      })
      return
    }

    if (subcommand === "list") {
      const blocked = await db
        .select()
        .from(blockedRoles)
        .where(eq(blockedRoles.guildId, guildId))

      if (blocked.length === 0) {
        await interaction.reply({
          embeds: [createInfoEmbed("Blocked Roles", "No roles are currently blocked")],
        })
        return
      }

      const roleList = blocked.map((r) => `<@&${r.roleId}>`).join("\n")

      await interaction.reply({
        embeds: [createInfoEmbed("Blocked Roles", roleList).setFooter({ text: `${blocked.length} role(s) blocked` })],
      })
    }
  },
}