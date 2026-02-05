import { eq, desc } from "drizzle-orm"
import { db } from "./connection.js"
import { userLevels, guildConfig, branchConfig, roleRewards, blockedRoles, blockedChannels, boostConfig, backupHistory } from "./schema.js"
import { config } from "../config.js"

type BackupData = {
  version: number
  timestamp: string
  guildId: string
  guildConfig: unknown[]
  branchConfig: unknown[]
  userLevels: unknown[]
  roleRewards: unknown[]
  blockedRoles: unknown[]
  blockedChannels: unknown[]
  boostConfig: unknown[]
}

export async function createBackup(): Promise<{ success: boolean; filename: string; recordCount: number }> {
  const guildId = config.GUILD_ID
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `backup-${guildId}-${timestamp}.json`

  const [
    guildConfigData,
    branchConfigData,
    userLevelsData,
    roleRewardsData,
    blockedRolesData,
    blockedChannelsData,
    boostConfigData,
  ] = await Promise.all([
    db.select().from(guildConfig).where(eq(guildConfig.guildId, guildId)),
    db.select().from(branchConfig).where(eq(branchConfig.guildId, guildId)),
    db.select().from(userLevels).where(eq(userLevels.guildId, guildId)),
    db.select().from(roleRewards).where(eq(roleRewards.guildId, guildId)),
    db.select().from(blockedRoles).where(eq(blockedRoles.guildId, guildId)),
    db.select().from(blockedChannels).where(eq(blockedChannels.guildId, guildId)),
    db.select().from(boostConfig).where(eq(boostConfig.guildId, guildId)),
  ])

  const backupData: BackupData = {
    version: 1,
    timestamp: new Date().toISOString(),
    guildId,
    guildConfig: guildConfigData,
    branchConfig: branchConfigData,
    userLevels: userLevelsData,
    roleRewards: roleRewardsData,
    blockedRoles: blockedRolesData,
    blockedChannels: blockedChannelsData,
    boostConfig: boostConfigData,
  }

  const recordCount =
    guildConfigData.length +
    branchConfigData.length +
    userLevelsData.length +
    roleRewardsData.length +
    blockedRolesData.length +
    blockedChannelsData.length +
    boostConfigData.length

  await db.insert(backupHistory).values({
    guildId,
    filename,
    recordCount,
  })

  return { success: true, filename, recordCount }
}

export async function getBackupJson(): Promise<string> {
  const guildId = config.GUILD_ID

  const [
    guildConfigData,
    branchConfigData,
    userLevelsData,
    roleRewardsData,
    blockedRolesData,
    blockedChannelsData,
    boostConfigData,
  ] = await Promise.all([
    db.select().from(guildConfig).where(eq(guildConfig.guildId, guildId)),
    db.select().from(branchConfig).where(eq(branchConfig.guildId, guildId)),
    db.select().from(userLevels).where(eq(userLevels.guildId, guildId)),
    db.select().from(roleRewards).where(eq(roleRewards.guildId, guildId)),
    db.select().from(blockedRoles).where(eq(blockedRoles.guildId, guildId)),
    db.select().from(blockedChannels).where(eq(blockedChannels.guildId, guildId)),
    db.select().from(boostConfig).where(eq(boostConfig.guildId, guildId)),
  ])

  const backupData: BackupData = {
    version: 1,
    timestamp: new Date().toISOString(),
    guildId,
    guildConfig: guildConfigData,
    branchConfig: branchConfigData,
    userLevels: userLevelsData,
    roleRewards: roleRewardsData,
    blockedRoles: blockedRolesData,
    blockedChannels: blockedChannelsData,
    boostConfig: boostConfigData,
  }

  return JSON.stringify(backupData, null, 2)
}

export async function restoreFromBackup(jsonData: string): Promise<{ success: boolean; recordCount: number }> {
  const data = JSON.parse(jsonData) as BackupData

  if (data.version !== 1) {
    throw new Error("Unsupported backup version")
  }

  if (data.guildId !== config.GUILD_ID) {
    throw new Error("Backup guild ID mismatch")
  }

  let recordCount = 0

  await db.transaction(async (tx) => {
    await tx.delete(userLevels).where(eq(userLevels.guildId, data.guildId))
    await tx.delete(roleRewards).where(eq(roleRewards.guildId, data.guildId))
    await tx.delete(blockedRoles).where(eq(blockedRoles.guildId, data.guildId))
    await tx.delete(blockedChannels).where(eq(blockedChannels.guildId, data.guildId))
    await tx.delete(boostConfig).where(eq(boostConfig.guildId, data.guildId))
    await tx.delete(branchConfig).where(eq(branchConfig.guildId, data.guildId))
    await tx.delete(guildConfig).where(eq(guildConfig.guildId, data.guildId))

    if (data.guildConfig.length > 0) {
      await tx.insert(guildConfig).values(data.guildConfig as any)
      recordCount += data.guildConfig.length
    }

    if (data.branchConfig.length > 0) {
      await tx.insert(branchConfig).values(data.branchConfig as any)
      recordCount += data.branchConfig.length
    }

    if (data.userLevels.length > 0) {
      const chunks = chunkArray(data.userLevels, 100)
      for (const chunk of chunks) {
        await tx.insert(userLevels).values(chunk as any)
      }
      recordCount += data.userLevels.length
    }

    if (data.roleRewards.length > 0) {
      await tx.insert(roleRewards).values(data.roleRewards as any)
      recordCount += data.roleRewards.length
    }

    if (data.blockedRoles.length > 0) {
      await tx.insert(blockedRoles).values(data.blockedRoles as any)
      recordCount += data.blockedRoles.length
    }

    if (data.blockedChannels.length > 0) {
      await tx.insert(blockedChannels).values(data.blockedChannels as any)
      recordCount += data.blockedChannels.length
    }

    if (data.boostConfig.length > 0) {
      await tx.insert(boostConfig).values(data.boostConfig as any)
      recordCount += data.boostConfig.length
    }
  })

  return { success: true, recordCount }
}

export async function getBackupHistory(limit: number = 10) {
  return db
    .select()
    .from(backupHistory)
    .where(eq(backupHistory.guildId, config.GUILD_ID))
    .orderBy(desc(backupHistory.createdAt))
    .limit(limit)
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

let backupInterval: NodeJS.Timeout | null = null

export function scheduleBackup(): void {
  if (backupInterval) {
    clearInterval(backupInterval)
  }

  backupInterval = setInterval(
    async () => {
      try {
        const result = await createBackup()
        console.log(`Scheduled backup created: ${result.filename} (${result.recordCount} records)`)
      } catch (error) {
        console.error("Scheduled backup failed:", (error as Error).message)
      }
    },
    24 * 60 * 60 * 1000
  )

  console.log("Backup scheduler initialized (every 24 hours)")
}