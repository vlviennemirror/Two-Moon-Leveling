import { eq, and, desc, lte } from "drizzle-orm"
import { db } from "../database/connection.js"
import { userLevels, roleRewards, guildConfig } from "../database/schema.js"
import { cache, cacheKeys } from "../cache/manager.js"
import type { Branch } from "../config.js"
import type { Client, TextChannel } from "discord.js"

let discordClient: Client | null = null

export function setDiscordClient(client: Client): void {
  discordClient = client
}

export async function getRoleRewards(guildId: string, branch: Branch): Promise<Map<number, string>> {
  const cacheKey = cacheKeys.roleRewards(guildId, branch)
  const cached = cache.roleRewards.get(cacheKey)
  if (cached) return cached

  const rewards = await db
    .select()
    .from(roleRewards)
    .where(and(eq(roleRewards.guildId, guildId), eq(roleRewards.branch, branch)))
    .orderBy(desc(roleRewards.level))

  const rewardMap = new Map<number, string>()
  for (const reward of rewards) {
    rewardMap.set(reward.level, reward.roleId)
  }

  cache.roleRewards.set(cacheKey, rewardMap)
  return rewardMap
}

export async function getRewardRoleForLevel(
  guildId: string,
  branch: Branch,
  level: number
): Promise<string | null> {
  const rewards = await getRoleRewards(guildId, branch)

  let highestRewardLevel = 0
  let highestRewardRole: string | null = null

  for (const [rewardLevel, roleId] of rewards) {
    if (rewardLevel <= level && rewardLevel > highestRewardLevel) {
      highestRewardLevel = rewardLevel
      highestRewardRole = roleId
    }
  }

  return highestRewardRole
}

export async function processLevelUp(
  guildId: string,
  userId: string,
  branch: Branch,
  oldLevel: number,
  newLevel: number
): Promise<void> {
  if (!discordClient) return

  try {
    const guild = await discordClient.guilds.fetch(guildId)
    const member = await guild.members.fetch(userId)

    const [userData] = await db
      .select()
      .from(userLevels)
      .where(
        and(
          eq(userLevels.guildId, guildId),
          eq(userLevels.userId, userId),
          eq(userLevels.branch, branch)
        )
      )
      .limit(1)

    if (!userData) return

    const newRewardRole = await getRewardRoleForLevel(guildId, branch, newLevel)
    const oldRewardRole = userData.currentRewardRoleId

    if (newRewardRole && newRewardRole !== oldRewardRole) {
      if (oldRewardRole && member.roles.cache.has(oldRewardRole)) {
        await member.roles.remove(oldRewardRole).catch(() => {})
      }

      if (!member.roles.cache.has(newRewardRole)) {
        await member.roles.add(newRewardRole).catch(() => {})
      }

      await db
        .update(userLevels)
        .set({ currentRewardRoleId: newRewardRole })
        .where(
          and(
            eq(userLevels.guildId, guildId),
            eq(userLevels.userId, userId),
            eq(userLevels.branch, branch)
          )
        )

      cache.invalidateUser(guildId, userId)
    }

    const [config] = await db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId))
      .limit(1)

    if (config?.announceEnabled && config.announceChannel) {
      const channel = await guild.channels.fetch(config.announceChannel).catch(() => null)
      if (channel && channel.isTextBased()) {
        const branchLabel = branch === "A" ? "Member" : "Visitor"
        await (channel as TextChannel).send({
          content: `🎉 <@${userId}> reached **Level ${newLevel}** in **${branchLabel}** branch!${
            newRewardRole ? ` They earned <@&${newRewardRole}>!` : ""
          }`,
        })
      }
    }

    if (config?.logChannel) {
      const logChannel = await guild.channels.fetch(config.logChannel).catch(() => null)
      if (logChannel && logChannel.isTextBased()) {
        await (logChannel as TextChannel).send({
          embeds: [
            {
              title: "Level Up",
              color: 0x00ff00,
              fields: [
                { name: "User", value: `<@${userId}>`, inline: true },
                { name: "Branch", value: branch, inline: true },
                { name: "Level", value: `${oldLevel} → ${newLevel}`, inline: true },
                { name: "Role Reward", value: newRewardRole ? `<@&${newRewardRole}>` : "None", inline: true },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        })
      }
    }
  } catch (error) {
    console.error(`Level up processing failed for ${userId}:`, (error as Error).message)
  }
}

export async function setRoleReward(
  guildId: string,
  branch: Branch,
  level: number,
  roleId: string
): Promise<void> {
  await db
    .insert(roleRewards)
    .values({ guildId, branch, level, roleId })
    .onConflictDoUpdate({
      target: [roleRewards.guildId, roleRewards.branch, roleRewards.level],
      set: { roleId },
    })

  cache.roleRewards.delete(cacheKeys.roleRewards(guildId, branch))
}

export async function removeRoleReward(guildId: string, branch: Branch, level: number): Promise<boolean> {
  const result = await db
    .delete(roleRewards)
    .where(
      and(
        eq(roleRewards.guildId, guildId),
        eq(roleRewards.branch, branch),
        eq(roleRewards.level, level)
      )
    )

  cache.roleRewards.delete(cacheKeys.roleRewards(guildId, branch))
  return true
}

export async function modifyUserXp(
  guildId: string,
  userId: string,
  branch: Branch,
  action: "set" | "add" | "remove",
  amount: number
): Promise<{ success: boolean; newXp: number; newLevel: number }> {
  const { calculateLevelFromXp } = await import("../utils/formula.js")
  const config = await import("./xp.service.js").then((m) => m.getGuildConfig(guildId))

  const [existing] = await db
    .select()
    .from(userLevels)
    .where(
      and(
        eq(userLevels.guildId, guildId),
        eq(userLevels.userId, userId),
        eq(userLevels.branch, branch)
      )
    )
    .limit(1)

  let newXp: number

  if (action === "set") {
    newXp = Math.max(0, amount)
  } else if (action === "add") {
    newXp = (existing?.xp ?? 0) + amount
  } else {
    newXp = Math.max(0, (existing?.xp ?? 0) - amount)
  }

  const newLevel = calculateLevelFromXp(newXp, config.levelBase, config.levelExponent)

  if (existing) {
    await db
      .update(userLevels)
      .set({ xp: newXp, level: newLevel, updatedAt: new Date() })
      .where(
        and(
          eq(userLevels.guildId, guildId),
          eq(userLevels.userId, userId),
          eq(userLevels.branch, branch)
        )
      )
  } else {
    await db.insert(userLevels).values({
      guildId,
      userId,
      branch,
      xp: newXp,
      level: newLevel,
    })
  }

  cache.invalidateUser(guildId, userId)

  return { success: true, newXp, newLevel }
}

export async function modifyUserLevel(
  guildId: string,
  userId: string,
  branch: Branch,
  newLevel: number
): Promise<{ success: boolean; newXp: number; newLevel: number }> {
  const { calculateTotalXpForLevel } = await import("../utils/formula.js")
  const config = await import("./xp.service.js").then((m) => m.getGuildConfig(guildId))

  const targetLevel = Math.max(0, newLevel)
  const newXp = calculateTotalXpForLevel(targetLevel, config.levelBase, config.levelExponent)

  const [existing] = await db
    .select()
    .from(userLevels)
    .where(
      and(
        eq(userLevels.guildId, guildId),
        eq(userLevels.userId, userId),
        eq(userLevels.branch, branch)
      )
    )
    .limit(1)

  if (existing) {
    await db
      .update(userLevels)
      .set({ xp: newXp, level: targetLevel, updatedAt: new Date() })
      .where(
        and(
          eq(userLevels.guildId, guildId),
          eq(userLevels.userId, userId),
          eq(userLevels.branch, branch)
        )
      )
  } else {
    await db.insert(userLevels).values({
      guildId,
      userId,
      branch,
      xp: newXp,
      level: targetLevel,
    })
  }

  cache.invalidateUser(guildId, userId)

  return { success: true, newXp, newLevel: targetLevel }
}