import { EmbedBuilder, type ColorResolvable } from "discord.js"
import type { Branch } from "../config.js"

export const Colors = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  error: 0xed4245,
  branchA: 0x3498db,
  branchB: 0xe91e63,
} as const

export function getBranchColor(branch: Branch): ColorResolvable {
  return branch === "A" ? Colors.branchA : Colors.branchB
}

export function getBranchLabel(branch: Branch): string {
  return branch === "A" ? "Member" : "Visitor"
}

export function createSuccessEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.success).setTitle(`✅ ${title}`)

  if (description) embed.setDescription(description)
  return embed
}

export function createErrorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.error).setTitle(`❌ ${title}`)

  if (description) embed.setDescription(description)
  return embed
}

export function createInfoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.primary).setTitle(title)

  if (description) embed.setDescription(description)
  return embed
}

export function createProfileEmbed(
  userId: string,
  username: string,
  avatarUrl: string | null,
  branch: Branch,
  level: number,
  xp: number,
  progress: { current: number; required: number; percentage: number },
  rank: number,
  stats: { messages: number; reactions: number; voiceMinutes: number }
): EmbedBuilder {
  const progressBar = createProgressBar(progress.percentage)

  return new EmbedBuilder()
    .setColor(getBranchColor(branch))
    .setAuthor({ name: username, iconURL: avatarUrl ?? undefined })
    .setTitle(`${getBranchLabel(branch)} Profile`)
    .addFields(
      { name: "Level", value: `${level}`, inline: true },
      { name: "Rank", value: `#${rank}`, inline: true },
      { name: "Total XP", value: xp.toLocaleString(), inline: true },
      { name: "Progress", value: `${progressBar}\n${progress.current.toLocaleString()} / ${progress.required.toLocaleString()} XP (${progress.percentage}%)`, inline: false },
      { name: "Messages", value: stats.messages.toLocaleString(), inline: true },
      { name: "Reactions", value: stats.reactions.toLocaleString(), inline: true },
      { name: "Voice", value: `${stats.voiceMinutes} min`, inline: true }
    )
    .setFooter({ text: `Branch ${branch}` })
    .setTimestamp()
}

export function createLeaderboardEmbed(
  branch: Branch,
  entries: Array<{ rank: number; userId: string; level: number; xp: number }>,
  page: number,
  totalPages: number
): EmbedBuilder {
  const description = entries
    .map((entry) => {
      const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `**${entry.rank}.**`
      return `${medal} <@${entry.userId}> — Level ${entry.level} (${entry.xp.toLocaleString()} XP)`
    })
    .join("\n")

  return new EmbedBuilder()
    .setColor(getBranchColor(branch))
    .setTitle(`🏆 ${getBranchLabel(branch)} Leaderboard`)
    .setDescription(description || "No entries yet")
    .setFooter({ text: `Page ${page}/${totalPages} • Branch ${branch}` })
    .setTimestamp()
}

function createProgressBar(percentage: number): string {
  const filled = Math.floor(percentage / 10)
  const empty = 10 - filled
  return "█".repeat(filled) + "░".repeat(empty)
}