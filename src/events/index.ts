import { client } from "../client.js"
import { handleReady } from "./ready.js"
import { handleMessageCreate } from "./message-create.js"
import { handleReactionAdd } from "./reaction-add.js"
import { handleVoiceStateUpdate } from "./voice-state.js"
import { handleInteractionCreate } from "./interaction-create.js"

export function registerEvents(): void {
  client.once("ready", handleReady)
  client.on("messageCreate", handleMessageCreate)
  client.on("messageReactionAdd", handleReactionAdd)
  client.on("voiceStateUpdate", handleVoiceStateUpdate)
  client.on("interactionCreate", handleInteractionCreate)

  client.on("error", (error) => {
    console.error("Discord client error:", error.message)
  })

  client.on("warn", (warning) => {
    console.warn("Discord client warning:", warning)
  })

  client.on("shardError", (error) => {
    console.error("Websocket error:", error.message)
  })

  process.on("unhandledRejection", (error) => {
    console.error("Unhandled rejection:", error)
  })

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error)
    process.exit(1)
  })
}