import { Client, GatewayIntentBits, Partials } from "discord.js"
import { config } from "./config.js"

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
  allowedMentions: { parse: ["users", "roles"], repliedUser: true },
  rest: { timeout: 15000, retries: 3 },
})

export function isAllowedGuild(guildId: string): boolean {
  return guildId === config.GUILD_ID
}