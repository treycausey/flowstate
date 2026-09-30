import type { StockKind, StockSpecies, StockZone } from './types'

/**
 * Built-in stock catalog. Values are conservative, widely quoted hobby figures: ranges are
 * comfortable ranges for healthy, captive-bred animals, not survival limits. Sizes are typical
 * adult sizes. A field is left out when it varies too much to state honestly. Betta notes are
 * tendencies, not promises: individual bettas differ. This is general guidance, not a rulebook.
 * Images are cut-outs at public/tank/fish/<id>.webp and are optional.
 */
export const STOCK_CATALOG: readonly StockSpecies[] = [
  {
    id: 'betta',
    name: 'Betta',
    scientific: 'Betta splendens',
    aliases: ['siamese fighting fish', 'fighting fish'],
    kind: 'fish',
    zone: 'top',
    sizeCm: 6.5,
    tempC: [24, 28],
    ph: [6.0, 7.5],
    minGroup: 1,
    temperament: 'territorial',
    diet: 'A carnivore: small betta pellets, plus frozen or live foods such as brine shrimp and bloodworms.',
    bioload: 2,
    bettaCompat: 'avoid',
    bettaReason:
      'Male bettas fight each other, often to serious injury. Never keep two males in the same undivided tank.',
    care: 'Gentle flow, warm stable water and somewhere to rest near the surface. Bettas breathe air, so keep the surface open and the air above it warm. Keep a lid on: bettas can jump.',
    notes:
      'Long-finned males can tear their fins on sharp decor. Each betta has its own temperament, so watch how yours reacts to new tankmates.',
  },
  {
    id: 'neon-tetra',
    name: 'Neon tetra',
    scientific: 'Paracheirodon innesi',
    aliases: ['neons'],
    kind: 'fish',
    zone: 'middle',
    sizeCm: 3.5,
    tempC: [22, 26],
    ph: [6.0, 7.5],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Omnivore: small flakes or micro pellets, with the occasional frozen or live treat.',
    bioload: 1,
    bettaCompat: 'caution',
    bettaReason:
      'Usually fine in a school of six or more, but some bettas chase or eat small tetras.',
    care: 'Keep a school of six or more in a tank with some plants and dim corners. Neons are sensitive to sudden changes, so add them slowly to a cycled tank.',
    notes:
      'Small groups are stressed and hide more. A longer tank suits a school better than a tall one.',
  },
  {
    id: 'cardinal-tetra',
    name: 'Cardinal tetra',
    scientific: 'Paracheirodon axelrodi',
    kind: 'fish',
    zone: 'middle',
    sizeCm: 4,
    tempC: [24, 28],
    ph: [5.5, 7.0],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Omnivore: small flakes or micro pellets, with frozen or live treats.',
    bioload: 1.2,
    bettaCompat: 'caution',
    bettaReason:
      'Similar to neons: often fine as a school of six or more, but a bold betta may harass them.',
    care: 'Prefers warm, soft, slightly acidic water and gentle light. Keep a school of six or more and add them slowly to a cycled tank.',
    notes: 'Looks like a neon but has red along the whole underside and grows a little larger.',
  },
  {
    id: 'ember-tetra',
    name: 'Ember tetra',
    scientific: 'Hyphessobrycon amandae',
    kind: 'fish',
    zone: 'middle',
    sizeCm: 2,
    tempC: [23, 29],
    ph: [5.5, 7.5],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Micro pellets, crushed flakes, or tiny frozen foods such as baby brine shrimp.',
    bioload: 0.5,
    bettaCompat: 'caution',
    bettaReason:
      'Very small, so a betta may chase or eat them. They can work in a larger, well-planted tank.',
    care: 'A school of six or more in a planted tank with gentle flow. Feed small pieces, because their mouths are tiny.',
    notes: 'One of the smallest common tetras, so a large tankmate can overpower it.',
  },
  {
    id: 'rummy-nose-tetra',
    name: 'Rummy-nose tetra',
    scientific:
      'Petitella rhodostoma (formerly Hemigrammus rhodostomus); P. bleheri is also sold under this name',
    aliases: ['rummynose', 'rummy nose', 'hemigrammus rhodostomus'],
    kind: 'fish',
    zone: 'middle',
    sizeCm: 5,
    tempC: [24, 28],
    ph: [5.5, 7.0],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Omnivore: small flakes or micro pellets, with frozen foods now and then.',
    bioload: 1.3,
    bettaCompat: 'good',
    bettaReason:
      'They stay mid-water in a tight school and are usually ignored by bettas in a tank with enough room.',
    care: 'Keep a school of six or more in clean, stable, soft-to-medium water. They react badly to poor water, and a school that stays tight is a good sign.',
    notes: 'The red nose is often a health sign: it fades in stressed or unwell fish.',
  },
  {
    id: 'harlequin-rasbora',
    name: 'Harlequin rasbora',
    scientific: 'Trigonostigma heteromorpha',
    kind: 'fish',
    zone: 'middle',
    sizeCm: 4.5,
    tempC: [22, 27],
    ph: [6.0, 7.5],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Omnivore: small flakes or micro pellets, plus small frozen foods.',
    bioload: 1.3,
    bettaCompat: 'good',
    bettaReason:
      'Calm mid-water schoolers that keep out of a betta’s way. Keep the group at six or more.',
    care: 'A school of six or more in a planted tank. They like broad-leaved plants and calm water.',
    notes: 'Hardy and easy, which makes them a good first schooling fish.',
  },
  {
    id: 'chili-rasbora',
    name: 'Chili rasbora',
    scientific: 'Boraras brigittae',
    aliases: ['mosquito rasbora'],
    kind: 'fish',
    zone: 'middle',
    sizeCm: 2,
    tempC: [23, 28],
    ph: [5.0, 7.0],
    minGroup: 8,
    temperament: 'peaceful',
    diet: 'Micro pellets, crushed flakes, or tiny frozen foods.',
    bioload: 0.4,
    bettaCompat: 'caution',
    bettaReason: 'Tiny, so a betta may chase or eat them. A large planted tank helps.',
    care: 'Needs a group of eight or more, small food and gentle flow. Prefers soft, slightly acidic water and a planted tank.',
    notes: 'Among the smallest aquarium fish, so keep them with equally calm, small tankmates.',
  },
  {
    id: 'celestial-pearl-danio',
    name: 'Celestial pearl danio',
    scientific: 'Danio margaritatus',
    aliases: ['galaxy rasbora', 'cpd'],
    kind: 'fish',
    zone: 'middle',
    sizeCm: 2.5,
    tempC: [22, 26],
    ph: [6.5, 7.5],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Micro pellets, crushed flakes and tiny frozen or live foods.',
    bioload: 0.6,
    bettaCompat: 'caution',
    bettaReason:
      'Small and shy, and they like cooler water than most bettas, so the fit is uncertain.',
    care: 'A group of six or more in a planted tank with gentle flow and plenty of hiding places. Feed small foods, because they are shy eaters.',
    notes: 'Males are brighter and spar with each other, which is normal.',
  },
  {
    id: 'guppy',
    name: 'Guppy',
    plural: 'guppies',
    scientific: 'Poecilia reticulata',
    aliases: ['fancy guppy'],
    kind: 'fish',
    zone: 'top',
    sizeCm: 5,
    tempC: [22, 28],
    ph: [6.8, 7.8],
    minGroup: 3,
    temperament: 'peaceful',
    diet: 'Omnivore: flakes or small pellets, plus some plant matter and frozen foods.',
    bioload: 1.3,
    bettaCompat: 'avoid',
    bettaReason:
      'Bright, long fins can trigger a betta, and the guppies then get nipped or chased.',
    care: 'Keep a group with more females than males. Guppies breed quickly, so plan for the fry. They do best in neutral to slightly hard water.',
    notes:
      'Females are larger than males. Fancy strains with long tails are more fragile than plain ones.',
  },
  {
    id: 'endler',
    name: 'Endler’s livebearer',
    plural: 'Endler’s livebearers',
    scientific: 'Poecilia wingei',
    aliases: ['endler', 'endlers'],
    kind: 'fish',
    zone: 'top',
    sizeCm: 3.5,
    tempC: [22, 28],
    ph: [6.8, 8.0],
    minGroup: 3,
    temperament: 'peaceful',
    diet: 'Omnivore: flakes or small pellets, with some plant matter and frozen foods.',
    bioload: 0.8,
    bettaCompat: 'caution',
    bettaReason: 'Colourful males can look like rivals to a betta, and the livebearers breed fast.',
    care: 'Keep more females than males. They breed quickly, so plan for the fry. Active swimmers that do well in planted tanks.',
    notes: 'Smaller than guppies, and often kept in single-species tanks to protect the strain.',
  },
  {
    id: 'platy',
    name: 'Platy',
    plural: 'platies',
    scientific: 'Xiphophorus maculatus',
    aliases: ['southern platyfish'],
    kind: 'fish',
    zone: 'middle',
    sizeCm: 6,
    tempC: [20, 26],
    ph: [7.0, 8.0],
    minGroup: 3,
    temperament: 'peaceful',
    diet: 'Omnivore: flakes or pellets, with vegetables or algae wafers for plant matter.',
    bioload: 2,
    bettaCompat: 'caution',
    bettaReason:
      'Hardy and active, but they prefer cooler, harder water than most bettas, and their busy swimming can stress a betta.',
    care: 'Keep a group with more females than males. They breed quickly. They do best in neutral to hard water and a tank with swimming room.',
    notes: 'Females are larger and rounder than males.',
  },
  {
    id: 'honey-gourami',
    name: 'Honey gourami',
    scientific: 'Trichogaster chuna',
    aliases: ['sunset gourami'],
    kind: 'fish',
    zone: 'top',
    sizeCm: 4.5,
    tempC: [22, 28],
    ph: [6.0, 7.5],
    minGroup: 1,
    temperament: 'peaceful',
    diet: 'Omnivore: small flakes or pellets, plus frozen foods.',
    bioload: 1.3,
    bettaCompat: 'caution',
    bettaReason:
      'A betta often treats a gourami as a rival, because both are labyrinth fish that hold the surface. Try it only in a well-planted tank of about 75 L (20 US gal) or more, and have a plan to separate them.',
    care: 'Shy and gentle. Give it floating plants and plenty of cover. A single fish is fine, or a pair in a larger tank.',
    notes: 'Like bettas, gouramis breathe air at the surface, so keep the surface open.',
  },
  {
    id: 'panda-corydoras',
    name: 'Panda corydoras',
    plural: 'panda corydoras',
    scientific: 'Hoplisoma panda (formerly Corydoras panda)',
    aliases: ['panda cory', 'corydoras panda'],
    kind: 'fish',
    zone: 'bottom',
    sizeCm: 4.5,
    tempC: [22, 26],
    ph: [6.0, 7.5],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Sinking pellets or wafers, with frozen or live worms now and then.',
    bioload: 1.5,
    bettaCompat: 'good',
    bettaReason:
      'Bottom dwellers that stay out of a betta’s space, and a betta usually ignores them.',
    care: 'Keep a group of six or more on smooth sand or fine gravel so their barbels stay healthy. Feed sinking food, because they miss food that floats.',
    notes: 'Prefers slightly cooler water than a typical betta tank.',
  },
  {
    id: 'bronze-corydoras',
    name: 'Bronze corydoras',
    plural: 'bronze corydoras',
    scientific: 'Osteogaster aeneus (formerly Corydoras aeneus)',
    aliases: ['bronze cory', 'green cory', 'corydoras aeneus'],
    kind: 'fish',
    zone: 'bottom',
    sizeCm: 7,
    tempC: [22, 26],
    ph: [6.0, 7.5],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Sinking pellets or wafers, with frozen or live worms now and then.',
    bioload: 2.5,
    bettaCompat: 'good',
    bettaReason:
      'Bottom dwellers that stay out of a betta’s space, and a betta usually ignores them.',
    care: 'Keep a group of six or more on smooth sand or fine gravel. They are hardy and active, and they need room to forage along the floor.',
    notes: 'Albino and black forms are the same species.',
  },
  {
    id: 'pygmy-corydoras',
    name: 'Pygmy corydoras',
    plural: 'pygmy corydoras',
    scientific: 'Gastrodermus pygmaeus (formerly Corydoras pygmaeus)',
    aliases: ['pygmy cory', 'corydoras pygmaeus'],
    kind: 'fish',
    zone: 'bottom',
    sizeCm: 2.5,
    tempC: [22, 26],
    ph: [6.0, 7.5],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Small sinking pellets, crushed flakes and tiny frozen foods.',
    bioload: 0.5,
    bettaCompat: 'good',
    bettaReason: 'They stay low and out of the way. They are small, so watch a bold betta.',
    care: 'Keep a group of six or more on smooth sand. They often hover in mid-water as well as sitting on the bottom.',
    notes: 'Much smaller than other corydoras, so give them small foods.',
  },
  {
    id: 'otocinclus',
    name: 'Otocinclus',
    plural: 'otocinclus',
    scientific: 'Otocinclus spp. (often O. vittatus or O. macrospilus)',
    aliases: ['oto', 'otto', 'dwarf sucker catfish'],
    kind: 'fish',
    zone: 'surfaces',
    sizeCm: 4,
    tempC: [22, 26],
    ph: [6.0, 7.5],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Grazes algae and biofilm. Add algae wafers and blanched vegetables such as courgette.',
    bioload: 0.8,
    bettaCompat: 'good',
    bettaReason: 'Peaceful and quiet, and they stay on plants, wood and glass.',
    care: 'Needs a mature tank with algae and biofilm to graze on, and a group of six or more. Do not add them to a new tank.',
    notes:
      'Newly imported fish are fragile. Buy from a source that has had them for several weeks.',
  },
  {
    id: 'kuhli-loach',
    name: 'Kuhli loach',
    plural: 'kuhli loaches',
    scientific: 'Pangio semicincta (often sold as P. kuhlii)',
    aliases: ['coolie loach', 'pangio kuhlii'],
    kind: 'fish',
    zone: 'bottom',
    sizeCm: 10,
    tempC: [24, 30],
    ph: [5.5, 7.0],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Sinking pellets and wafers, plus frozen or live worms.',
    bioload: 1.2,
    bettaCompat: 'good',
    bettaReason: 'Shy, mostly nocturnal bottom dwellers that a betta rarely notices.',
    care: 'Keep a group of six or more on soft sand with lots of hiding places. They can slip through small gaps, so cover the tank and filter intakes.',
    notes: 'They hide often, so a group you rarely see is normal.',
  },
  {
    id: 'cherry-shrimp',
    name: 'Cherry shrimp',
    plural: 'cherry shrimp',
    scientific: 'Neocaridina davidi',
    aliases: ['red cherry shrimp', 'neocaridina'],
    kind: 'shrimp',
    zone: 'surfaces',
    sizeCm: 3,
    tempC: [20, 26],
    ph: [6.5, 8.0],
    minGroup: 6,
    temperament: 'peaceful',
    diet: 'Grazes biofilm and algae. Add shrimp pellets or blanched vegetables sometimes.',
    bioload: 0.3,
    bettaCompat: 'caution',
    bettaReason:
      'A betta may eat cherry shrimp, especially the babies. Dense moss and plants give them cover.',
    care: 'Needs a mature, stable tank and no copper. Do not add them to a new tank. Dense moss gives the young places to hide.',
    notes:
      'Breeds easily in freshwater. Sudden changes in water can kill shrimp, so acclimate them slowly.',
  },
  {
    id: 'amano-shrimp',
    name: 'Amano shrimp',
    plural: 'amano shrimp',
    scientific: 'Caridina multidentata',
    aliases: ['algae eating shrimp', 'yamato shrimp'],
    kind: 'shrimp',
    zone: 'surfaces',
    sizeCm: 5,
    tempC: [22, 28],
    ph: [6.5, 7.5],
    minGroup: 3,
    temperament: 'peaceful',
    diet: 'Grazes algae and biofilm. Add shrimp pellets or blanched vegetables sometimes.',
    bioload: 0.6,
    bettaCompat: 'caution',
    bettaReason:
      'Larger than cherry shrimp, and some bettas leave them alone, but others attack them.',
    care: 'Needs a mature tank and no copper. Acclimate slowly. They are good algae grazers but can escape through gaps, so keep a lid on.',
    notes: 'They do not breed in plain freshwater, because their young need brackish water.',
  },
  {
    id: 'nerite-snail',
    name: 'Nerite snail',
    scientific: 'Vittina natalensis (formerly Neritina natalensis)',
    aliases: ['zebra nerite', 'nerite', 'neritina natalensis'],
    kind: 'snail',
    zone: 'surfaces',
    sizeCm: 2.5,
    tempC: [22, 28],
    ph: [7.0, 8.5],
    minGroup: 1,
    temperament: 'peaceful',
    diet: 'Grazes algae and biofilm. Add algae wafers if the tank has little algae.',
    bioload: 0.5,
    bettaCompat: 'good',
    bettaReason: 'Their hard shell protects them, and bettas usually ignore them.',
    care: 'Needs hard enough water to keep the shell healthy. They climb out of tanks, so keep a lid on. A snail on its back may need to be turned over.',
    notes: 'They lay small white eggs on hard surfaces. The eggs do not hatch in fresh water.',
  },
  {
    id: 'mystery-snail',
    name: 'Mystery snail',
    scientific: 'Pomacea diffusa',
    aliases: ['apple snail', 'pomacea'],
    kind: 'snail',
    zone: 'surfaces',
    sizeCm: 5,
    tempC: [20, 28],
    ph: [7.0, 8.0],
    minGroup: 1,
    temperament: 'peaceful',
    diet: 'Scavenges algae and leftovers. Add algae wafers and blanched vegetables.',
    bioload: 1.5,
    bettaCompat: 'caution',
    bettaReason:
      'Too big to be eaten, but some bettas repeatedly nip the long antennae. Watch closely for the first weeks.',
    care: 'Needs hard enough water for the shell. Leave a gap between the water and lid, because they lay eggs above the waterline and breathe air.',
    notes: 'Females lay a pink clutch above the water. Remove it if you do not want more snails.',
  },
  {
    id: 'ramshorn-snail',
    name: 'Ramshorn snail',
    scientific: 'Planorbidae (Planorbella and Planorbarius species)',
    aliases: ['ramshorn', 'planorbis'],
    kind: 'snail',
    zone: 'surfaces',
    sizeCm: 2,
    tempC: [20, 28],
    ph: [6.8, 8.0],
    minGroup: 1,
    temperament: 'peaceful',
    diet: 'Scavenges algae, dead plant matter and leftovers.',
    bioload: 0.3,
    bettaCompat: 'good',
    bettaReason: 'Small, but the hard shell protects them, and bettas usually leave them alone.',
    care: 'Hardy and undemanding. They breed quickly when there is extra food, so feed less if the numbers climb.',
    notes: 'A sudden boom in snails usually means there is too much food or waste in the tank.',
  },
]

const BY_ID = new Map(STOCK_CATALOG.map((s) => [s.id, s]))

export function stockSpecies(id: string | null | undefined): StockSpecies | undefined {
  return id ? BY_ID.get(id) : undefined
}

/** The betta cut-out is the single right-facing frame the living tank already ships. */
export const BETTA_IMAGE = '/tank/betta-cruise.webp'

/** Path of the optional cut-out image. The UI must cope with it being absent. */
export function stockImageSrc(speciesId: string): string {
  if (speciesId === 'betta') return BETTA_IMAGE
  return `/tank/fish/${speciesId}.webp`
}

/** "Neon tetra" for 1, "neon tetras" for more. */
export function speciesCountName(species: StockSpecies, count: number): string {
  if (count === 1) return species.name
  return species.plural ?? `${species.name.toLowerCase()}s`
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export type StockFilter = {
  query?: string
  /** Only species that usually get on with a betta. */
  bettaSafe?: boolean
  kind?: StockKind | null
  zone?: StockZone | null
}

export function filterStock(filter: StockFilter): StockSpecies[] {
  return searchStock(filter.query ?? '').filter(
    (s) =>
      (!filter.bettaSafe || s.bettaCompat === 'good') &&
      (!filter.kind || s.kind === filter.kind) &&
      (!filter.zone || s.zone === filter.zone),
  )
}

/** Catalog species whose name, scientific name or aliases contain every word of the query. */
export function searchStock(query: string): readonly StockSpecies[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return STOCK_CATALOG
  return STOCK_CATALOG.filter((s) => {
    const hay = normalize([s.name, s.scientific, ...(s.aliases ?? [])].join(' '))
    return words.every((w) => hay.includes(w))
  })
}
