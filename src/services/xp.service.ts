import { eq, and } from "drizzle-orm"
import { db } from "../database/connection.js"
import { userLevels, guildConfig, blockedRoles, blockedChannels, boostConfig } from "../database/schema.js"
import { cache, cacheKeys } from "../cache/manager.js"
import { generateRandomXp, applyMultipliers } from "../utils/formula.js"
import { DEFAULT_XP_CONFIG, type Branch } from "../config.js"
import type { GuildMember, TextChannel, VoiceChannel } from "discord.js"

type XpSource = "message" | "reaction" | "voice"

type QueuedXpUpdate = {
  guildId: string
  userId: string
  branch: Branch
  xpGain: number
  source: XpSource
}

const xpQueue: Map<string, QueuedXpUpdate> = new Map()
let flushTimeout: NodeJS.Timeout | null = null

function getQueueKey(guildId: string, userId: string, branch: Branch): string {
  return `${guildId}:${userId}:${branch}`
}

export async function getGuildConfig(guildId: string) {
  const cacheKey = cacheKeys.guildConfig(guildId)
  const cached = cache.guildConfig.get(cacheKey)
  if (cached) return cached

  const [config] = await db
    .select()
    .from(guildConfig)
    .where(eq(guildConfig.guildId, guildId))
    .limit(1)

  if (config) {
    cache.guildConfig.set(cacheKey, config)
    return config
  }

  const [newConfig] = await db
    .insert(guildConfig)
    .values({ guildId })
    .returning()

  cache.guildConfig.set(cacheKey, newConfig)
  return newConfig
}

export async function isRoleBlocked(guildId: string, member: GuildMember): Promise<boolean> {
  const cacheKey = cacheKeys.blockedRoles(guildId)
  let blockedIds = cache.blockedRoles.get(cacheKey)

  if (!blockedIds) {
    const blocked = await db
      .select({ roleId: blockedRoles.roleId })
      .from(blockedRoles)
      .where(eq(blockedRoles.guildId, guildId))

    blockedIds = blocked.map((r) => r.roleId)
    cache.blockedRoles.set(cacheKey, blockedIds)
  }

  return blockedIds.some((roleId) => member.roles.cache.has(roleId))
}

export async function isChannelBlocked(guildId: string, channelId: string): Promise<boolean> {
  const cacheKey = cacheKeys.blockedChannels(guildId)
  let blockedIds = cache.blockedChannels.get(cacheKey)

  if (!blockedIds) {
    const blocked = await db
      .select({ channelId: blockedChannels.channelId })
      .from(blockedChannels)
      .where(eq(blockedChannels.guildId, guildId))

    blockedIds = blocked.map((c) => c.channelId)
    cache.blockedChannels.set(cacheKey, blockedIds)
  }

  return blockedIds.includes(channelId)
}

export async function getBoostMultipliers(
  guildId: string,
  member: GuildMember,
  channelId: string
): Promise<number[]> {
  const multipliers: number[] = []

  const rolesCacheKey = cacheKeys.boostRoles(guildId)
  let roleBoosts = cache.boostConfig.get(rolesCacheKey)

  if (!roleBoosts) {
    const boosts = await db
      .select()
      .from(boostConfig)
      .where(and(eq(boostConfig.guildId, guildId), eq(boostConfig.targetType, "role")))

    roleBoosts = new Map(boosts.map((b) => [b.targetId, b.multiplier]))
    cache.boostConfig.set(rolesCacheKey, roleBoosts)
  }

  for (const [roleId, multiplier] of roleBoosts) {
    if (member.roles.cache.has(roleId)) {
      multipliers.push(multiplier)
    }
  }

  const channelsCacheKey = cacheKeys.boostChannels(guildId)
  let channelBoosts = cache.boostConfig.get(channelsCacheKey)

  if (!channelBoosts) {
    const boosts = await db
      .select()
      .from(boostConfig)
      .where(and(eq(boostConfig.guildId, guildId), eq(boostConfig.targetType, "channel")))

    channelBoosts = new Map(boosts.map((b) => [b.targetId, b.multiplier]))
    cache.boostConfig.set(channelsCacheKey, channelBoosts)
  }

  const channelMultiplier = channelBoosts.get(channelId)
  if (channelMultiplier) {
    multipliers.push(channelMultiplier)
  }

  return multipliers
}

function getCooldownKey(guildId: string, userId: string, source: XpSource): string {
  return `cooldown:${guildId}:${userId}:${source}`
}

export function isOnCooldown(guildId: string, userId: string, source: XpSource): boolean {
  const key = getCooldownKey(guildId, userId, source)
  const lastTime = cache.cooldowns.get(key)
  return lastTime !== undefined && Date.now() < lastTime
}

export function setCooldown(guildId: string, userId: string, source: XpSource, seconds: number): void {
  const key = getCooldownKey(guildId, userId, source)
  cache.cooldowns.set(key, Date.now() + seconds * 1000, seconds)
}

export function queueXpUpdate(
  guildId: string,
  userId: string,
  branch: Branch,
  xpGain: number,
  source: XpSource
): void {
  const key = getQueueKey(guildId, userId, branch)
  const existing = xpQueue.get(key)

  if (existing) {
    existing.xpGain += xpGain
  } else {
    xpQueue.set(key, { guildId, userId, branch, xpGain, source })
  }

  if (!flushTimeout) {
    flushTimeout = setTimeout(flushXpQueue, 5000)
  }
}

async function flushXpQueue(): Promise<void> {
  flushTimeout = null
  if (xpQueue.size === 0) return

  const updates = Array.from(xpQueue.values())
  xpQueue.clear()

  const results: Array<{ guildId: string; userId: string; branch: Branch; newXp: number; newLevel: number; oldLevel: number }> = []

  for (const update of updates) {
    try {
      const result = await applyXpUpdate(update)
      if (result) results.push(result)
    } catch (error) {
      console.error(`XP update failed for ${update.userId}:`, (error as Error).message)
    }
  }

  for (const result of results) {
    if (result.newLevel > result.oldLevel) {
      const { processLevelUp } = await import("./level.service.js")
      await processLevelUp(result.guildId, result.userId, result.branch, result.oldLevel, result.newLevel)
    }
  }
}

async function applyXpUpdate(update: QueuedXpUpdate) {
  const { guildId, userId, branch, xpGain, source } = update
  const config = await getGuildConfig(guildId)

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

  const { calculateLevelFromXp } = await import("../utils/formula.js")
  const now = new Date()

  if (existing) {
    const newXp = existing.xp + xpGain
    const newLevel = calculateLevelFromXp(newXp, config.levelBase, config.levelExponent)

    const updateData: Record<string, unknown> = {
      xp: newXp,
      level: newLevel,
      updatedAt: now,
    }

    if (source === "message") {
      updateData.totalMessages = existing.totalMessages + 1
      updateData.lastMsgXp = now
    } else if (source === "reaction") {
      updateData.totalReactions = existing.totalReactions + 1
      updateData.lastReactXp = now
    }

    await db
      .update(userLevels)
      .set(updateData)
      .where(
        and(
          eq(userLevels.guildId, guildId),
          eq(userLevels.userId, userId),
          eq(userLevels.branch, branch)
        )
      )

    cache.invalidateUser(guildId, userId)

    return {
      guildId,
      userId,
      branch,
      newXp,
      newLevel,
      oldLevel: existing.level,
    }
  } else {
    const newLevel = calculateLevelFromXp(xpGain, config.levelBase, config.levelExponent)

    await db.insert(userLevels).values({
      guildId,
      userId,
      branch,
      xp: xpGain,
      level: newLevel,
      totalMessages: source === "message" ? 1 : 0,
      totalReactions: source === "reaction" ? 1 : 0,
      lastMsgXp: source === "message" ? now : null,
      lastReactXp: source === "reaction" ? now : null,
    })

    cache.invalidateUser(guildId, userId)

    return {
      guildId,
      userId,
      branch,
      newXp: xpGain,
      newLevel,
      oldLevel: 0,
    }
  }
}

export async function processMessageXp(
  guildId: string,
  member: GuildMember,
  channelId: string,
  branch: Branch
): Promise<boolean> {
  if (await isRoleBlocked(guildId, member)) return false
  if (await isChannelBlocked(guildId, channelId)) return false
  if (isOnCooldown(guildId, member.id, "message")) return false

  const config = await getGuildConfig(guildId)
  const baseXp = generateRandomXp(config.msgXpMin, config.msgXpMax)
  const multipliers = await getBoostMultipliers(guildId, member, channelId)
  const finalXp = applyMultipliers(baseXp, multipliers)

  setCooldown(guildId, member.id, "message", config.msgCooldown)
  queueXpUpdate(guildId, member.id, branch, finalXp, "message")

  return true
}

export async function processReactionXp(
  guildId: string,
  member: GuildMember,
  channelId: string,
  branch: Branch
): Promise<boolean> {
  if (await isRoleBlocked(guildId, member)) return false
  if (await isChannelBlocked(guildId, channelId)) return false
  if (isOnCooldown(guildId, member.id, "reaction")) return false

  const config = await getGuildConfig(guildId)
  const multipliers = await getBoostMultipliers(guildId, member, channelId)
  const finalXp = applyMultipliers(config.reactXp, multipliers)

  setCooldown(guildId, member.id, "reaction", config.reactCooldown)
  queueXpUpdate(guildId, member.id, branch, finalXp, "reaction")

  return true
}

export async function processVoiceXp(
  guildId: string,
  userId: string,
  branch: Branch,
  minutes: number,
  wasMuted: boolean,
  channelId: string,
  member: GuildMember
): Promise<boolean> {
  if (minutes < 1) return false
  if (await isRoleBlocked(guildId, member)) return false

  const config = await getGuildConfig(guildId)
  let baseXp = minutes * config.voiceXpPerMin

  if (wasMuted) {
    baseXp = Math.floor(baseXp * 0.5)
  }

  const multipliers = await getBoostMultipliers(guildId, member, channelId)
  const finalXp = applyMultipliers(baseXp, multipliers)

  queueXpUpdate(guildId, userId, branch, finalXp, "voice")

  await db
    .update(userLevels)
    .set({
      totalVoiceMinutes: minutes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userLevels.guildId, guildId),
        eq(userLevels.userId, userId),
        eq(userLevels.branch, branch)
      )
    )

  return true
}