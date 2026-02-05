import { eq, and } from "drizzle-orm"
import { db } from "../database/connection.js"
import { voiceSessions } from "../database/schema.js"
import { detectUserBranch } from "./branch.service.js"
import { processVoiceXp, isChannelBlocked } from "./xp.service.js"
import type { VoiceState, GuildMember } from "discord.js"

type ActiveSession = {
  userId: string
  channelId: string
  joinedAt: Date
  isMuted: boolean
  mutedDuration: number
  lastMuteStart: Date | null
}

const activeSessions: Map<string, ActiveSession> = new Map()

function getSessionKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`
}

export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const userId = newState.id
  const guildId = newState.guild.id
  const sessionKey = getSessionKey(guildId, userId)

  const wasInChannel = !!oldState.channelId
  const isInChannel = !!newState.channelId
  const isAfkChannel = newState.channel?.id === newState.guild.afkChannelId

  if (!wasInChannel && isInChannel && !isAfkChannel) {
    await handleJoin(sessionKey, guildId, userId, newState.channelId!, newState.selfMute || newState.serverMute)
    return
  }

  if (wasInChannel && !isInChannel) {
    await handleLeave(sessionKey, guildId, userId, oldState.channelId!, newState.member)
    return
  }

  if (wasInChannel && isInChannel && oldState.channelId !== newState.channelId) {
    if (isAfkChannel) {
      await handleLeave(sessionKey, guildId, userId, oldState.channelId!, newState.member)
    } else if (oldState.channel?.id === oldState.guild.afkChannelId) {
      await handleJoin(sessionKey, guildId, userId, newState.channelId!, newState.selfMute || newState.serverMute)
    }
    return
  }

  const session = activeSessions.get(sessionKey)
  if (!session) return

  const wasMuted = oldState.selfMute || oldState.serverMute
  const isMuted = newState.selfMute || newState.serverMute

  if (!wasMuted && isMuted) {
    session.isMuted = true
    session.lastMuteStart = new Date()
  } else if (wasMuted && !isMuted) {
    if (session.lastMuteStart) {
      session.mutedDuration += Date.now() - session.lastMuteStart.getTime()
      session.lastMuteStart = null
    }
    session.isMuted = false
  }
}

async function handleJoin(
  sessionKey: string,
  guildId: string,
  userId: string,
  channelId: string,
  isMuted: boolean
): Promise<void> {
  if (await isChannelBlocked(guildId, channelId)) return

  activeSessions.set(sessionKey, {
    userId,
    channelId,
    joinedAt: new Date(),
    isMuted,
    mutedDuration: 0,
    lastMuteStart: isMuted ? new Date() : null,
  })

  await db
    .insert(voiceSessions)
    .values({
      guildId,
      userId,
      channelId,
      isMuted,
      mutedAt: isMuted ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [voiceSessions.guildId, voiceSessions.userId],
      set: {
        channelId,
        joinedAt: new Date(),
        isMuted,
        mutedAt: isMuted ? new Date() : null,
      },
    })
}

async function handleLeave(
  sessionKey: string,
  guildId: string,
  userId: string,
  channelId: string,
  member: GuildMember | null
): Promise<void> {
  const session = activeSessions.get(sessionKey)
  activeSessions.delete(sessionKey)

  await db
    .delete(voiceSessions)
    .where(and(eq(voiceSessions.guildId, guildId), eq(voiceSessions.userId, userId)))

  if (!session || !member) return

  const now = Date.now()
  let totalMutedMs = session.mutedDuration

  if (session.isMuted && session.lastMuteStart) {
    totalMutedMs += now - session.lastMuteStart.getTime()
  }

  const totalMs = now - session.joinedAt.getTime()
  const totalMinutes = Math.floor(totalMs / 60000)
  const mutedMinutes = Math.floor(totalMutedMs / 60000)
  const unmutedMinutes = totalMinutes - mutedMinutes

  if (totalMinutes < 1) return

  const branch = await detectUserBranch(guildId, member)
  if (!branch) return

  const wasMostlyMuted = mutedMinutes > unmutedMinutes

  await processVoiceXp(guildId, userId, branch, totalMinutes, wasMostlyMuted, channelId, member)
}

export async function restoreVoiceSessions(guildId: string): Promise<number> {
  const sessions = await db
    .select()
    .from(voiceSessions)
    .where(eq(voiceSessions.guildId, guildId))

  let restored = 0
  for (const session of sessions) {
    const sessionKey = getSessionKey(guildId, session.userId)
    activeSessions.set(sessionKey, {
      userId: session.userId,
      channelId: session.channelId,
      joinedAt: session.joinedAt,
      isMuted: session.isMuted,
      mutedDuration: session.mutedAt ? Date.now() - session.mutedAt.getTime() : 0,
      lastMuteStart: session.isMuted ? session.mutedAt : null,
    })
    restored++
  }

  return restored
}

export function getActiveSessionCount(): number {
  return activeSessions.size
}