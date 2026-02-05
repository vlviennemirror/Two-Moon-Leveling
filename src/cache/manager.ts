type CacheEntry<T> = {
  value: T
  expiresAt: number
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private readonly maxSize: number
  private readonly defaultTtl: number

  constructor(maxSize: number = 500, defaultTtlSeconds: number = 300) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTtl = defaultTtlSeconds * 1000
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, ttlSeconds?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl),
    })
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  deletePattern(pattern: string): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  cleanup(): number {
    const now = Date.now()
    let removed = 0
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        removed++
      }
    }
    return removed
  }
}

export const cacheKeys = {
  guildConfig: (guildId: string) => `guild:${guildId}:config`,
  branchConfig: (guildId: string, branch: string) => `guild:${guildId}:branch:${branch}`,
  userLevel: (guildId: string, userId: string, branch: string) => `user:${guildId}:${userId}:${branch}`,
  blockedRoles: (guildId: string) => `guild:${guildId}:blocked:roles`,
  blockedChannels: (guildId: string) => `guild:${guildId}:blocked:channels`,
  boostRoles: (guildId: string) => `guild:${guildId}:boost:roles`,
  boostChannels: (guildId: string) => `guild:${guildId}:boost:channels`,
  roleRewards: (guildId: string, branch: string) => `guild:${guildId}:rewards:${branch}`,
  leaderboard: (guildId: string, branch: string) => `guild:${guildId}:leaderboard:${branch}`,
} as const

class CacheManager {
  readonly guildConfig: LRUCache<import("../database/schema.js").GuildConfig>
  readonly branchConfig: LRUCache<import("../database/schema.js").BranchConfig>
  readonly userLevels: LRUCache<import("../database/schema.js").UserLevel>
  readonly blockedRoles: LRUCache<string[]>
  readonly blockedChannels: LRUCache<string[]>
  readonly boostConfig: LRUCache<Map<string, number>>
  readonly roleRewards: LRUCache<Map<number, string>>
  readonly cooldowns: LRUCache<number>

  constructor() {
    this.guildConfig = new LRUCache(100, 300)
    this.branchConfig = new LRUCache(200, 300)
    this.userLevels = new LRUCache(1000, 60)
    this.blockedRoles = new LRUCache(100, 600)
    this.blockedChannels = new LRUCache(100, 600)
    this.boostConfig = new LRUCache(200, 600)
    this.roleRewards = new LRUCache(200, 600)
    this.cooldowns = new LRUCache(5000, 120)
  }

  invalidateGuild(guildId: string): void {
    this.guildConfig.deletePattern(guildId)
    this.branchConfig.deletePattern(guildId)
    this.blockedRoles.deletePattern(guildId)
    this.blockedChannels.deletePattern(guildId)
    this.boostConfig.deletePattern(guildId)
    this.roleRewards.deletePattern(guildId)
  }

  invalidateUser(guildId: string, userId: string): void {
    this.userLevels.deletePattern(`${guildId}:${userId}`)
  }

  runCleanup(): void {
    this.guildConfig.cleanup()
    this.branchConfig.cleanup()
    this.userLevels.cleanup()
    this.blockedRoles.cleanup()
    this.blockedChannels.cleanup()
    this.boostConfig.cleanup()
    this.roleRewards.cleanup()
    this.cooldowns.cleanup()
  }
}

export const cache = new CacheManager()

setInterval(() => cache.runCleanup(), 60000)