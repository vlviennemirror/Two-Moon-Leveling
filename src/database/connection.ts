import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { config } from "../config.js"
import * as schema from "./schema.js"

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
})

pool.on("error", (err) => {
  console.error("Database pool error:", err.message)
})

export const db = drizzle(pool, { schema })

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect()
    client.release()
    return true
  } catch (error) {
    console.error("Database connection failed:", (error as Error).message)
    return false
  }
}

export async function closeConnection(): Promise<void> {
  await pool.end()
}