/** "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago". */
export function ageText(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  return `${Math.round(days / 30)} months ago`
}

export function countText(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`
}

/** The trouble spots of a tank's plants, e.g. ["1 struggling", "2 checks due"]. Empty when fine. */
export function plantAttentionParts(health: {
  struggling: number
  counts: { dead: number }
  checksDue: number
}): string[] {
  const parts: string[] = []
  if (health.struggling > 0) parts.push(`${health.struggling} struggling`)
  if (health.counts.dead > 0) parts.push(`${health.counts.dead} dead`)
  if (health.checksDue > 0) parts.push(countText(health.checksDue, 'check') + ' due')
  return parts
}
