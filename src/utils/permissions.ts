import type { GuildMember, PermissionResolvable } from "discord.js"

export function hasPermission(member: GuildMember, permission: PermissionResolvable): boolean {
  return member.permissions.has(permission)
}

export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has("Administrator")
}

export function isModeratorOrAbove(member: GuildMember): boolean {
  return (
    member.permissions.has("Administrator") ||
    member.permissions.has("ManageGuild") ||
    member.permissions.has("ManageRoles")
  )
}

export async function canManageRole(member: GuildMember, roleId: string): Promise<boolean> {
  if (!member.guild.members.me) return false

  const role = member.guild.roles.cache.get(roleId)
  if (!role) return false

  const botHighestRole = member.guild.members.me.roles.highest
  return botHighestRole.position > role.position
}