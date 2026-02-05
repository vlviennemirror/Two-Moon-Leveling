import type { MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js"
import { isAllowedGuild } from "../client.js"
import { detectUserBranch } from "../services/branch.service.js"
import { processReactionXp } from "../services/xp.service.js"

export async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  if (user.bot) return

  if (reaction.partial) {
    try {
      await reaction.fetch()
    } catch {
      return
    }
  }

  const message = reaction.message
  if (!message.guild) return
  if (!isAllowedGuild(message.guild.id)) return

  if (message.author?.id === user.id) return

  const member = await message.guild.members.fetch(user.id).catch(() => null)
  if (!member) return

  const branch = await detectUserBranch(message.guild.id, member)
  if (!branch) return

  await processReactionXp(message.guild.id, member, message.channelId, branch)
}