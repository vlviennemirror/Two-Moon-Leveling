import { eq, and } from "drizzle-orm"
import { db } from "../database/connection.js"
import { branchConfig, userLevels } from "../database/schema.js"
import { cache, cacheKeys } from "../cache/manager.js"
import type { Branch } from "../config.js"
import type { GuildMember } from "discord.js"

export async function getBranchConfig(guildId: string, branch: Branch) {
  const cacheKey = cacheKeys.branchConfig(guildId, branch)
  const cached = cache.branchConfig.get(cacheKey)
  if (cached) return cached

  const [config] = await db
    .select()
    .from(branchConfig)
    .where(and(eq(branchConfig.guildId, guildId), eq(branchConfig.branch, branch)))
    .limit(1)

  if (config) {
    cache.branchConfig.set(cacheKey, config)
  }
  return config ?? null
}

export async function getAllBranchConfigs(guildId: string) {
  const [branchA, branchB] = await Promise.all([
    getBranchConfig(guildId, "A"),
    getBranchConfig(guildId, "B"),
  ])
  return { A: branchA, B: branchB }
}

export async function detectUserBranch(guildId: string, member: GuildMember): Promise<Branch | null> {
  const branches = await getAllBranchConfigs(guildId)

  if (branches.A && member.roles.cache.has(branches.A.baseRoleId)) {
    return "A"
  }
  if (branches.B && member.roles.cache.has(branches.B.baseRoleId)) {
    return "B"
  }
  return null
}

export async function setBranchConfig(guildId: string, branch: Branch, baseRoleId: string) {
  await db
    .insert(branchConfig)
    .values({ guildId, branch, baseRoleId })
    .onConflictDoUpdate({
      target: [branchConfig.guildId, branchConfig.branch],
      set: { baseRoleId },
    })

  cache.branchConfig.delete(cacheKeys.branchConfig(guildId, branch))
}

export async function getUserBranchData(guildId: string, userId: string, branch: Branch) {
  const cacheKey = cacheKeys.userLevel(guildId, userId, branch)
  const cached = cache.userLevels.get(cacheKey)
  if (cached) return cached

  const [data] = await db
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

  if (data) {
    cache.userLevels.set(cacheKey, data)
  }
  return data ?? null
}

export async function swapUserBranch(
  guildId: string,
  userId: string,
  fromBranch: Branch,
  toBranch: Branch
): Promise<{ success: boolean; error?: string }> {
  const existingInTarget = await getUserBranchData(guildId, userId, toBranch)
  if (existingInTarget) {
    return { success: false, error: "User already has data in target branch" }
  }

  const currentData = await getUserBranchData(guildId, userId, fromBranch)
  if (!currentData) {
    return { success: false, error: "User has no data in current branch" }
  }

  await db.transaction(async (tx) => {
    await tx.insert(userLevels).values({
      guildId,
      userId,
      branch: toBranch,
      xp: currentData.xp,
      level: currentData.level,
      totalMessages: currentData.totalMessages,
      totalReactions: currentData.totalReactions,
      totalVoiceMinutes: currentData.totalVoiceMinutes,
      currentRewardRoleId: null,
    })

    await tx
      .delete(userLevels)
      .where(
        and(
          eq(userLevels.guildId, guildId),
          eq(userLevels.userId, userId),
          eq(userLevels.branch, fromBranch)
        )
      )
  })

  cache.invalidateUser(guildId, userId)
  return { success: true }
}