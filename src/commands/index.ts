import {
  Collection,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js"

import { branchSetCommand } from "./admin/branch-set.js"
import { blockedRoleCommand } from "./admin/blocked-role.js"
import { blockedChannelCommand } from "./admin/blocked-channel.js"
import { boostRoleCommand } from "./admin/boost-role.js"
import { boostChannelCommand } from "./admin/boost-channel.js"
import { roleRewardCommand } from "./admin/role-reward.js"
import { modifyXpCommand } from "./admin/modify-xp.js"
import { logChannelCommand } from "./admin/log-channel.js"
import { xpSettingsCommand } from "./admin/xp-settings.js"
import { swapRoleConfigCommand } from "./admin/swap-role-config.js"
import { backupCommand } from "./admin/backup.js"
import { profileCommand } from "./user/profile.js"
import { leaderboardCommand } from "./user/leaderboard.js"
import { swapBranchCommand } from "./user/swap-branch.js"

export type Command = {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>
}

export const commands = new Collection<string, Command>()

const commandList: Command[] = [
  branchSetCommand,
  blockedRoleCommand,
  blockedChannelCommand,
  boostRoleCommand,
  boostChannelCommand,
  roleRewardCommand,
  modifyXpCommand,
  logChannelCommand,
  xpSettingsCommand,
  swapRoleConfigCommand,
  backupCommand,
  profileCommand,
  leaderboardCommand,
  swapBranchCommand,
]

export function registerCommands(): void {
  for (const command of commandList) {
    commands.set(command.data.name, command)
  }
  console.log(`Registered ${commands.size} commands`)
}

export function getCommandsData() {
  return commandList.map((cmd) => cmd.data.toJSON())
}