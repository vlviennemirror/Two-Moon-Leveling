export function calculateXpForLevel(level: number, base: number, exponent: number): number {
  if (level <= 0) return 0
  return Math.floor(base * Math.pow(level, exponent) + base * level)
}

export function calculateTotalXpForLevel(level: number, base: number, exponent: number): number {
  let total = 0
  for (let i = 1; i <= level; i++) {
    total += calculateXpForLevel(i, base, exponent)
  }
  return total
}

export function calculateLevelFromXp(xp: number, base: number, exponent: number): number {
  let level = 0
  let totalRequired = 0
  while (true) {
    const nextLevelXp = calculateXpForLevel(level + 1, base, exponent)
    if (totalRequired + nextLevelXp > xp) break
    totalRequired += nextLevelXp
    level++
  }
  return level
}

export function calculateProgress(
  xp: number,
  level: number,
  base: number,
  exponent: number
): { current: number; required: number; percentage: number } {
  const totalForCurrentLevel = calculateTotalXpForLevel(level, base, exponent)
  const requiredForNextLevel = calculateXpForLevel(level + 1, base, exponent)
  const currentProgress = xp - totalForCurrentLevel
  const percentage = Math.min(100, Math.floor((currentProgress / requiredForNextLevel) * 100))
  return {
    current: currentProgress,
    required: requiredForNextLevel,
    percentage,
  }
}

export function generateRandomXp(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function applyMultipliers(baseXp: number, multipliers: number[]): number {
  const totalMultiplier = multipliers.reduce((acc, m) => acc * m, 1)
  return Math.floor(baseXp * totalMultiplier)
}