import type { Client } from "discord.js"
import { config } from "../config.js"
import { testConnection } from "../database/connection.js"
import { setDiscordClient } from "../services/level.service.js"
import { restoreVoiceSessions } from "../services/voice.service.js"
import { isAllowedGuild } from "../client.js"
import { scheduleBackup } from "../database/backup.js"

export async function handleReady(client: Client<true>): Promise<void> {
  console.log(`Bot online: ${client.user.tag}`)

  const dbConnected = await testConnection()
  if (!dbConnected) {
    console.error("Database connection failed. Shutting down.")
    process.exit(1)
  }
  console.log("Database connected")

  setDiscordClient(client)

  const guild = client.guilds.cache.get(config.GUILD_ID)
  if (!guild) {
    console.error(`Target guild ${config.GUILD_ID} not found. Shutting down.`)
    process.exit(1)
  }
  console.log(`Locked to guild: ${guild.name}`)

  const unauthorizedGuilds = client.guilds.cache.filter((g) => !isAllowedGuild(g.id))
  for (const [guildId, guild] of unauthorizedGuilds) {
    console.log(`Leaving unauthorized guild: ${guild.name} (${guildId})`)
    await guild.leave().catch(() => {})
  }

  const restoredSessions = await restoreVoiceSessions(config.GUILD_ID)
  if (restoredSessions > 0) {
    console.log(`Restored ${restoredSessions} voice sessions`)
  }

  scheduleBackup()

  client.user.setPresence({
    status: "online",
    activities: [{ name: "Leveling System", type: 3 }],
  })

  console.log("Initialization complete")
}