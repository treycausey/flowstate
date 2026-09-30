const LITRES_PER_US_GALLON = 3.78541

export function cToF(c: number): number {
  return (c * 9) / 5 + 32
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** "22–26 °C (72–79 °F)". */
export function tempRangeText(range: readonly [number, number]): string {
  return `${range[0]}–${range[1]} °C (${Math.round(cToF(range[0]))}–${Math.round(cToF(range[1]))} °F)`
}

/** "22–26 °C", without the Fahrenheit part, for tight spots. */
export function tempRangeShort(range: readonly [number, number]): string {
  return `${range[0]}–${range[1]} °C`
}

export function phRangeText(range: readonly [number, number]): string {
  return `${range[0].toFixed(1)}–${range[1].toFixed(1)}`
}

export function litresToGallons(litres: number): number {
  return litres / LITRES_PER_US_GALLON
}

/** "60 L (about 16 US gal)". */
export function volumeText(litres: number): string {
  return `${trim(litres)} L (about ${trim(Math.round(litresToGallons(litres) * 10) / 10)} US gal)`
}

export function countText(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export function sizeText(cm: number): string {
  return `${trim(cm)} cm`
}
