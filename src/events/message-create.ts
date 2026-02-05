import type { Message } from "discord.js"
import { isAllowedGuild } from "../client.js"
import { detectUserBranch } from "../services/branch.service.js"
import { processMessageXp } from "../services/xp.service.js"

export async function handleMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return
  if (!message.guild) return
  if (!isAllowedGuild(message.guild.id)) return
  if (!message.member) return

  const branch = await detectUserBranch(message.guild.id, message.member)
  if (!branch) return

  await processMessageXp(message.guild.id, message.member, message.channelId, branch)
}