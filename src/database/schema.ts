import {
  pgTable,
  varchar,
  bigint,
  integer,
  real,
  boolean,
  timestamp,
  primaryKey,
  index,
  serial,
} from "drizzle-orm/pg-core"

export const guildConfig = pgTable("guild_config", {
  guildId: varchar("guild_id", { length: 20 }).primaryKey(),
  logChannel: varchar("log_channel", { length: 20 }),
  announceChannel: varchar("announce_channel", { length: 20 }),
  announceEnabled: boolean("announce_enabled").default(true).notNull(),
  levelBase: integer("level_base").default(100).notNull(),
  levelExponent: real("level_exponent").default(1.5).notNull(),
  msgXpMin: integer("msg_xp_min").default(15).notNull(),
  msgXpMax: integer("msg_xp_max").default(25).notNull(),
  msgCooldown: integer("msg_cooldown").default(60).notNull(),
  reactXp: integer("react_xp").default(5).notNull(),
  reactCooldown: integer("react_cooldown").default(30).notNull(),
  voiceXpPerMin: integer("voice_xp_per_min").default(10).notNull(),
  swapRoleId: varchar("swap_role_id", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const branchConfig = pgTable(
  "branch_config",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    branch: varchar("branch", { length: 1 }).notNull().$type<"A" | "B">(),
    baseRoleId: varchar("base_role_id", { length: 20 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.branch] }),
  })
)

export const userLevels = pgTable(
  "user_levels",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    userId: varchar("user_id", { length: 20 }).notNull(),
    branch: varchar("branch", { length: 1 }).notNull().$type<"A" | "B">(),
    xp: bigint("xp", { mode: "number" }).default(0).notNull(),
    level: integer("level").default(0).notNull(),
    totalMessages: integer("total_messages").default(0).notNull(),
    totalReactions: integer("total_reactions").default(0).notNull(),
    totalVoiceMinutes: integer("total_voice_minutes").default(0).notNull(),
    lastMsgXp: timestamp("last_msg_xp"),
    lastReactXp: timestamp("last_react_xp"),
    currentRewardRoleId: varchar("current_reward_role_id", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId, table.branch] }),
    xpIdx: index("user_levels_xp_idx").on(table.guildId, table.branch, table.xp),
    levelIdx: index("user_levels_level_idx").on(table.guildId, table.branch, table.level),
  })
)

export const roleRewards = pgTable(
  "role_rewards",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    branch: varchar("branch", { length: 1 }).notNull().$type<"A" | "B">(),
    level: integer("level").notNull(),
    roleId: varchar("role_id", { length: 20 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.branch, table.level] }),
  })
)

export const blockedRoles = pgTable(
  "blocked_roles",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    roleId: varchar("role_id", { length: 20 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.roleId] }),
  })
)

export const blockedChannels = pgTable(
  "blocked_channels",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    channelId: varchar("channel_id", { length: 20 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.channelId] }),
  })
)

export const boostConfig = pgTable(
  "boost_config",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    targetId: varchar("target_id", { length: 20 }).notNull(),
    targetType: varchar("target_type", { length: 10 }).notNull().$type<"role" | "channel">(),
    multiplier: real("multiplier").default(1.5).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.targetId] }),
  })
)

export const voiceSessions = pgTable(
  "voice_sessions",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    userId: varchar("user_id", { length: 20 }).notNull(),
    channelId: varchar("channel_id", { length: 20 }).notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    isMuted: boolean("is_muted").default(false).notNull(),
    mutedAt: timestamp("muted_at"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.guildId, table.userId] }),
  })
)

export const backupHistory = pgTable("backup_history", {
  id: serial("id").primaryKey(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  recordCount: integer("record_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type GuildConfig = typeof guildConfig.$inferSelect
export type NewGuildConfig = typeof guildConfig.$inferInsert
export type BranchConfig = typeof branchConfig.$inferSelect
export type UserLevel = typeof userLevels.$inferSelect
export type RoleReward = typeof roleRewards.$inferSelect
export type BlockedRole = typeof blockedRoles.$inferSelect
export type BlockedChannel = typeof blockedChannels.$inferSelect
export type BoostConfig = typeof boostConfig.$inferSelect
export type VoiceSession = typeof voiceSessions.$inferSelect