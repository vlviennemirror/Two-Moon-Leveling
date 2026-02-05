import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  GUILD_ID: z.string().min(1),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data

export const DEFAULT_XP_CONFIG = {
  BASE: 100,
  EXPONENT: 1.5,
  MSG_MIN: 15,
  MSG_MAX: 25,
  MSG_COOLDOWN: 60,
  REACT_XP: 5,
  REACT_COOLDOWN: 30,
  VOICE_PER_MIN: 10,
  VOICE_MUTED_MULTIPLIER: 0.5,
} as const

export type Branch = "A" | "B"