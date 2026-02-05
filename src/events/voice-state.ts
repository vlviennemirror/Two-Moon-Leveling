import type { VoiceState } from "discord.js"
import { isAllowedGuild } from "../client.js"
import { handleVoiceStateUpdate as processVoiceState } from "../services/voice.service.js"

export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  if (newState.member?.user.bot) return
  if (!isAllowedGuild(newState.guild.id)) return

  await processVoiceState(oldState, newState)
}