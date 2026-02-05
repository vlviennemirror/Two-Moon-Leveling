import { client } from "./client.js"
import { config } from "./config.js"
import { registerEvents } from "./events/index.js"
import { registerCommands } from "./commands/index.js"
import { closeConnection } from "./database/connection.js"

async function main(): Promise<void> {
  console.log("Starting bot...")

  registerCommands()
  registerEvents()

  await client.login(config.DISCORD_TOKEN)
}

async function shutdown(): Promise<void> {
  console.log("Shutting down...")
  client.destroy()
  await closeConnection()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})