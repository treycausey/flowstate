import type { PlantSpecies } from './types'

/**
 * Built-in plant catalog. Values are conservative, widely quoted hobby figures: ranges are
 * comfortable ranges, not survival limits, and heights are typical upper sizes. A field is
 * omitted when it varies too much to state honestly. This is general guidance, not a dosing guide.
 */
export const PLANT_CATALOG: readonly PlantSpecies[] = [
  {
    id: 'anubias-nana',
    name: 'Anubias nana',
    scientific: 'Anubias barteri var. nana',
    aliases: ['dwarf anubias'],
    placement: 'epiphyte',
    difficulty: 'easy',
    light: 'low',
    co2: 'not needed',
    growth: 'slow',
    feeding: 'water column',
    rhizome: true,
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 15,
    propagation: 'Cut the rhizome into pieces that each keep a few leaves and some roots.',
    planting:
      'Do not bury the rhizome, the thick horizontal stem. Tie or glue it to wood or rock, or tuck the roots into the substrate with the rhizome sitting above it.',
    care: 'Very slow and hardy. Strong light lets algae grow on the leaves, and the old leaves last a long time, so keep the light gentle.',
    bettaNote:
      'Small, firm, smooth leaves that are safe for fins. The broad leaves make good resting spots when the plant sits near the surface.',
    commonProblems: ['algae-on-leaves', 'melting', 'no-new-growth', 'yellowing-old-leaves'],
  },
  {
    id: 'anubias-barteri',
    name: 'Anubias barteri',
    scientific: 'Anubias barteri var. barteri',
    aliases: ['broadleaf anubias'],
    placement: 'epiphyte',
    difficulty: 'easy',
    light: 'low',
    co2: 'not needed',
    growth: 'slow',
    feeding: 'water column',
    rhizome: true,
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 45,
    propagation: 'Cut the rhizome into pieces that each keep a few leaves and some roots.',
    planting:
      'Do not bury the rhizome, the thick horizontal stem. Tie or glue it to wood or rock, or tuck the roots into the substrate with the rhizome sitting above it.',
    care: 'Hardy and slow, and it does well in low light. Strong light mostly grows algae on the large old leaves.',
    bettaNote:
      'Large, broad, sturdy leaves that are safe for fins and give bettas a solid place to rest and shade to hide in. It can be too large for a very small tank.',
    commonProblems: ['algae-on-leaves', 'melting', 'no-new-growth', 'yellowing-old-leaves'],
  },
  {
    id: 'java-fern',
    name: 'Java fern',
    scientific: 'Microsorum pteropus',
    aliases: ['Leptochilus pteropus'],
    placement: 'epiphyte',
    difficulty: 'easy',
    light: 'low',
    co2: 'not needed',
    growth: 'slow',
    feeding: 'water column',
    rhizome: true,
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [20, 28],
    maxHeightCm: 30,
    propagation:
      'Cut the rhizome into pieces, or let small plantlets grow on the leaves and detach them once they have roots.',
    planting:
      'Do not bury the rhizome. Tie or glue it to wood or rock. Buried rhizomes rot and the plant declines.',
    care: 'Hardy and undemanding. Brown bumps on the underside of mature leaves are spore clusters, not a disease.',
    bettaNote:
      'Firm, smooth-edged leaves that are safe for fins. The fronds are narrower than Anubias leaves, so they give cover but weaker resting spots.',
    commonProblems: ['melting', 'no-new-growth', 'algae-on-leaves', 'yellowing-old-leaves'],
  },
  {
    id: 'java-moss',
    name: 'Java moss',
    scientific: 'Taxiphyllum barbieri',
    aliases: ['Vesicularia dubyana'],
    placement: 'epiphyte',
    difficulty: 'easy',
    light: 'low',
    co2: 'not needed',
    growth: 'moderate',
    feeding: 'water column',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [20, 28],
    propagation: 'Pull off a piece and attach it somewhere new. Every piece keeps growing.',
    planting:
      'Do not plant it in the substrate. Tie or glue small pieces to wood or rock, or let it drift and tangle into a mat.',
    care: 'Very forgiving. Trim it regularly and rinse off trapped debris, because it collects detritus and algae easily.',
    bettaNote:
      'Soft and fin-safe. Bettas like to rest on and explore moss mats. It traps food, so keep it trimmed and rinse it now and then.',
    commonProblems: ['algae-on-leaves', 'melting', 'floating-loose', 'stunted'],
  },
  {
    id: 'christmas-moss',
    name: 'Christmas moss',
    scientific: 'Vesicularia montagnei',
    placement: 'epiphyte',
    difficulty: 'easy',
    light: 'low',
    co2: 'not needed',
    growth: 'slow',
    feeding: 'water column',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [18, 27],
    propagation: 'Pull off a piece and attach it somewhere new.',
    planting:
      'Do not plant it in the substrate. Tie or glue small pieces to wood or rock. It grows in layered, drooping branches.',
    care: 'Slow, and it does best in gentle light with steady water. It tends to slow down or brown in water that stays at the warm end.',
    bettaNote:
      'Soft, fine texture that is safe for fins. Betta-tank temperatures sit near its upper comfort range, so slow growth is normal.',
    commonProblems: ['algae-on-leaves', 'melting', 'stunted', 'no-new-growth'],
  },
  {
    id: 'cryptocoryne-wendtii',
    name: 'Cryptocoryne wendtii',
    scientific: 'Cryptocoryne wendtii',
    aliases: ['crypt', 'wendtii'],
    placement: 'midground',
    difficulty: 'easy',
    light: 'low',
    co2: 'not needed',
    growth: 'slow',
    feeding: 'root',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 20,
    propagation:
      'Sends out runners that grow new plants nearby. Separate them once they have roots.',
    planting:
      'Plant it in the substrate with the crown, where the leaves start, above the surface. Expect it to melt back in the first weeks and regrow leaves that suit your water. Leave the roots in place.',
    care: 'Feeds mostly through its roots, so it likes a nutrient-rich substrate. Avoid moving it, because crypts often melt after a change in conditions.',
    bettaNote:
      'Soft, wavy leaves that are safe for fins, and they stay low, so they give ground cover more than resting places.',
    commonProblems: ['melting', 'transparent-leaves', 'stunted', 'yellowing-old-leaves'],
  },
  {
    id: 'cryptocoryne-parva',
    name: 'Cryptocoryne parva',
    scientific: 'Cryptocoryne parva',
    aliases: ['crypt parva', 'dwarf crypt'],
    placement: 'foreground',
    difficulty: 'moderate',
    light: 'medium',
    co2: 'helps',
    growth: 'slow',
    feeding: 'root',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 8,
    propagation:
      'Sends out runners that grow new plants nearby. It spreads very slowly, so be patient.',
    planting:
      'Plant small portions a few cm apart with the crown above the substrate. It melts back after planting and regrows slowly. Leave the roots in place.',
    care: 'The smallest common crypt and very slow. It feeds through its roots and dislikes being moved. A stable tank matters more than anything else.',
    bettaNote:
      'Tiny, fin-safe leaves that form a low, patchy carpet over time. They do not reach up to the surface.',
    commonProblems: ['melting', 'transparent-leaves', 'stunted', 'no-new-growth'],
  },
  {
    id: 'amazon-sword',
    name: 'Amazon sword',
    scientific: "Echinodorus grisebachii 'Bleherae'",
    aliases: [
      'sword plant',
      'Echinodorus bleherae',
      'Echinodorus bleheri',
      'Echinodorus amazonicus',
      'Aquarius grisebachii',
    ],
    placement: 'background',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'moderate',
    feeding: 'root',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 50,
    propagation:
      'Sends out flower stalks that grow small plantlets. Plant the plantlets once they have roots and a few leaves.',
    planting:
      'Plant it in the substrate with the crown above the surface and enough room to grow. It sheds some leaves while it adapts.',
    care: 'A heavy root feeder that likes a nutrient-rich substrate or a root fertiliser for planted tanks. Yellowing older leaves often mean the roots need more nutrients. Trim old leaves at the base.',
    bettaNote:
      'Big, broad leaves that bettas like to rest on and hide under. It gets large, so it suits bigger tanks.',
    commonProblems: [
      'yellowing-old-leaves',
      'pinholes',
      'algae-on-leaves',
      'melting',
      'pale-new-growth',
    ],
  },
  {
    id: 'vallisneria',
    name: 'Vallisneria',
    scientific: 'Vallisneria spiralis',
    aliases: ['val', 'eelgrass', 'Italian val', 'straight val'],
    placement: 'background',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'fast',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.5, 8.0],
    tempC: [20, 28],
    maxHeightCm: 50,
    propagation: 'Spreads by runners that send up new plants. Separate them once they have roots.',
    planting:
      'Push the roots into the substrate with the crown, where the leaves start, just above the surface. Burying the crown can rot the plant.',
    care: 'Grows quickly from runners. It prefers neutral to harder water, and it may struggle in very soft, acidic water. Trim leaves that reach the surface. Jungle val (Vallisneria americana) is a different, much larger species. It often melts when "liquid carbon" products are used.',
    bettaNote:
      'Soft ribbon leaves that are safe for fins and make good cover. Untrimmed leaves lie across the surface, so keep some of it clear for breathing.',
    commonProblems: ['melting', 'yellowing-old-leaves', 'brown-edges', 'stunted', 'pinholes'],
  },
  {
    id: 'dwarf-sagittaria',
    name: 'Dwarf sagittaria',
    scientific: 'Sagittaria subulata',
    aliases: ['sagittaria', 'dwarf sag'],
    placement: 'foreground',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'moderate',
    feeding: 'root',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [20, 28],
    maxHeightCm: 30,
    propagation:
      'Spreads by runners and forms clumps. Separate runner plants once they have roots.',
    planting:
      'Divide it into small portions and plant them a few cm apart, roots in the substrate and the crown above it. It melts back a little after planting and regrows.',
    care: 'Spreads into a lawn when trimmed and kept in stronger light. In low light the leaves grow taller and thinner.',
    bettaNote:
      'Grassy, soft leaves that are safe for fins. They give ground cover and thin cover higher up when the plant grows tall.',
    commonProblems: ['melting', 'stunted', 'yellowing-old-leaves'],
  },
  {
    id: 'rotala-rotundifolia',
    name: 'Rotala rotundifolia',
    scientific: 'Rotala rotundifolia',
    aliases: ['rotala', 'roundleaf rotala'],
    placement: 'background',
    difficulty: 'moderate',
    light: 'medium',
    co2: 'helps',
    growth: 'fast',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 40,
    propagation: 'Cut the stem and replant the top. Each cutting grows into a new plant.',
    planting:
      'Push the cut end of each stem a few cm into the substrate and plant several stems together for a fuller look. Remove the lowest leaves first so they do not rot.',
    care: 'Needs steady light and nutrients to stay compact, and it turns reddish in stronger light. Trim the tops often, because it gets leggy and loses lower leaves in weak light.',
    bettaNote:
      'Fine, soft leaves that are safe for fins. It makes airy cover at the back, but it wants more light than most betta-tank plants.',
    commonProblems: ['leggy-growth', 'melting', 'pale-new-growth', 'pinholes', 'algae-on-leaves'],
  },
  {
    id: 'ludwigia-repens',
    name: 'Ludwigia repens',
    scientific: 'Ludwigia repens',
    aliases: ['ludwigia', 'red ludwigia'],
    placement: 'background',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'fast',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 40,
    propagation: 'Cut the stem and replant the top. Each cutting grows into a new plant.',
    planting:
      'Push the cut end of each stem a few cm into the substrate and plant several stems together. Remove the lowest leaves first so they do not rot.',
    care: 'A forgiving stem plant. The leaves turn reddish in stronger light. It loses lower leaves in weak light, so trim the tops and replant them.',
    bettaNote:
      'Soft, rounded leaves that are safe for fins. Stems that reach the surface give bettas cover and light resting spots.',
    commonProblems: ['leggy-growth', 'yellowing-old-leaves', 'melting', 'pale-new-growth'],
  },
  {
    id: 'hygrophila-polysperma',
    name: 'Hygrophila polysperma',
    scientific: 'Hygrophila polysperma',
    aliases: ['Indian waterweed', 'dwarf hygro', 'hygro', 'East Indian hygrophila'],
    placement: 'background',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'fast',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 40,
    propagation: 'Cut the stem and replant the top. Each cutting grows into a new plant.',
    planting:
      'Push the cut end of each stem a few cm into the substrate. Remove the lowest leaves first so they do not rot.',
    care: 'Very hardy and fast. Trim it often, because the lower leaves yellow and drop once the top shades them. In the US this is a federal noxious weed: it is illegal to import it or move it between states without a permit, and several states ban it. Check your local rules before you buy, and never release it or put trimmings in a drain or waterway.',
    bettaNote:
      'Soft, fin-safe leaves. It grows quickly to the surface, so trim it to keep the water surface open.',
    commonProblems: ['leggy-growth', 'yellowing-old-leaves', 'melting', 'pale-new-growth'],
  },
  {
    id: 'water-wisteria',
    name: 'Water wisteria',
    scientific: 'Hygrophila difformis',
    aliases: ['Synnema triflorum'],
    placement: 'background',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'fast',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 50,
    propagation: 'Cut the stem and replant the top. Each cutting grows into a new plant.',
    planting:
      'Push the cut end of each stem a few cm into the substrate. Leaves grown out of water often drop and regrow in a lacier underwater shape.',
    care: 'Fast and forgiving once settled. It may shed leaves after planting or a move. Trim the tops and replant them to keep it full.',
    bettaNote:
      'Delicate, lacy, fin-safe leaves that give soft cover. Trim it before it covers the surface.',
    commonProblems: ['melting', 'transparent-leaves', 'leggy-growth', 'yellowing-old-leaves'],
  },
  {
    id: 'bacopa-caroliniana',
    name: 'Bacopa caroliniana',
    scientific: 'Bacopa caroliniana',
    aliases: ['bacopa'],
    placement: 'background',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'moderate',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 40,
    propagation: 'Cut the stem and replant the top. Each cutting grows into a new plant.',
    planting:
      'Push the cut end of each stem a few cm into the substrate and plant several stems together. Remove the lowest leaves first so they do not rot.',
    care: 'A sturdy stem plant with thick leaves. It grows slowly for a stem plant and loses lower leaves in weak light, so trim the tops and replant them.',
    bettaNote:
      'Thick, rounded, fin-safe leaves. Stems that reach the surface give bettas cover and light resting spots.',
    commonProblems: ['leggy-growth', 'melting', 'yellowing-old-leaves', 'pinholes'],
  },
  {
    id: 'dwarf-hairgrass',
    name: 'Dwarf hairgrass',
    scientific: 'Eleocharis parvula',
    aliases: ['hair grass', 'Eleocharis acicularis', 'Eleocharis pusilla', 'eleocharis'],
    placement: 'foreground',
    difficulty: 'moderate',
    light: 'high',
    co2: 'recommended',
    growth: 'moderate',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [20, 28],
    maxHeightCm: 15,
    propagation: 'Spreads by runners. Split a clump into small tufts and plant them in the gaps.',
    planting:
      'Divide it into small tufts and plant them a few cm apart, roots in the substrate. It usually melts back at first and regrows into a carpet over weeks.',
    care: 'A carpet plant that wants bright light to spread. Trim it with scissors to keep it dense. In weaker light it stays sparse and grows taller.',
    bettaNote:
      'Fine, soft blades that are safe for fins. It covers the substrate and does not give resting spots.',
    commonProblems: ['melting', 'algae-on-leaves', 'stunted', 'leggy-growth', 'pale-new-growth'],
  },
  {
    id: 'monte-carlo',
    name: 'Monte Carlo',
    scientific: 'Micranthemum tweediei',
    aliases: ["Micranthemum 'Monte Carlo'", 'MC carpet'],
    placement: 'foreground',
    difficulty: 'moderate',
    light: 'medium',
    co2: 'helps',
    growth: 'moderate',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [20, 28],
    maxHeightCm: 10,
    propagation:
      'Spreads by creeping stems. Trim it and replant the cuttings, and they root along the ground.',
    planting:
      'Divide it into small portions and plant them a few cm apart, pressed into the substrate. Loose portions float up until they root, so weigh them down if needed.',
    care: 'A carpet plant that grows best with good light and steady nutrients. In weaker light it grows taller and may not spread. Trim it to keep the carpet low.',
    bettaNote:
      'Small, soft, fin-safe leaves. It covers the substrate and does not give resting spots.',
    commonProblems: ['floating-loose', 'leggy-growth', 'melting', 'algae-on-leaves', 'stunted'],
  },
  {
    id: 'staurogyne-repens',
    name: 'Staurogyne repens',
    scientific: 'Staurogyne repens',
    aliases: ['staurogyne'],
    placement: 'foreground',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'moderate',
    feeding: 'both',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [20, 28],
    maxHeightCm: 10,
    propagation: 'Trim the creeping stems and replant the cuttings. They root along the ground.',
    planting:
      'Divide it into small portions and plant them a few cm apart. It spreads sideways and forms a low, bushy mat.',
    care: 'An easier low plant than most carpet plants. It stays lower and bushier when it gets enough light and is trimmed.',
    bettaNote: 'Small, soft, fin-safe leaves that give low ground cover.',
    commonProblems: ['leggy-growth', 'melting', 'algae-on-leaves', 'stunted'],
  },
  {
    id: 'bucephalandra',
    name: 'Bucephalandra',
    scientific: 'Bucephalandra spp.',
    aliases: ['buce', 'bucephalandra sp.'],
    placement: 'epiphyte',
    difficulty: 'moderate',
    light: 'low',
    co2: 'not needed',
    growth: 'slow',
    feeding: 'water column',
    rhizome: true,
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    maxHeightCm: 15,
    propagation: 'Cut the rhizome into pieces that each keep a few leaves and some roots.',
    planting:
      'Do not bury the rhizome. Tie or glue it to wood or rock. Plants sold with leaves grown out of water often lose leaves at first, then regrow.',
    care: 'Slow and sensitive to sudden changes. It does best with stable water and gentle light, and it grows well on rock and wood.',
    bettaNote: 'Small, firm, fin-safe leaves. It is decorative rather than a place to rest.',
    commonProblems: ['melting', 'no-new-growth', 'algae-on-leaves', 'stunted'],
  },
  {
    id: 'marimo-moss-ball',
    name: 'Marimo moss ball',
    scientific: 'Aegagropila linnaei',
    aliases: ['marimo', 'moss ball', 'Cladophora ball'],
    placement: 'foreground',
    difficulty: 'easy',
    light: 'low',
    co2: 'not needed',
    growth: 'slow',
    feeding: 'water column',
    bettaFriendly: false,
    ph: [6.5, 8.0],
    tempC: [15, 25],
    propagation:
      'Very slow. You can carefully split a large ball into pieces and roll each piece back into a ball.',
    planting:
      'Do not plant it. Set it on the substrate or on a rock. Roll it gently every so often so every side gets light and it keeps its round shape.',
    care: 'Not a moss or a plant: it is a ball of green algae. Prefers cooler, shaded water. Strong light turns it brown and warm water damages it. Rinse it gently in tank water if it collects debris.',
    bettaNote:
      'Soft and fin-safe, but it prefers cooler water than a betta tank. It can survive at the low end of betta temperatures (about 24–25 °C) in shade, and it tends to brown in warmer water.',
    commonProblems: ['algae-on-leaves', 'floating-loose', 'no-new-growth'],
  },
  {
    id: 'amazon-frogbit',
    name: 'Amazon frogbit',
    scientific: 'Limnobium laevigatum',
    aliases: ['frogbit', 'South American spongeplant', 'Hydrocharis laevigata'],
    placement: 'floating',
    surfaceFloater: true,
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'fast',
    feeding: 'water column',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    propagation: 'Grows runners with new plants. Separate them, or thin the extra plants.',
    planting:
      'Just drop it on the surface. Its roots hang in the water. Keep the tops of the leaves dry.',
    care: 'Wants bright light and still surface water. Splashing, or condensation dripping from a close lid, wets the leaves and they rot. Thin it out before it covers the whole surface. It is a regulated invasive weed in some places (for example California and Washington state). Check your local rules and never release it.',
    bettaNote:
      'The hanging roots give bettas cover and the leaves shade the tank. Bettas breathe air at the surface, so keep part of the surface clear.',
    commonProblems: ['brown-edges', 'melting', 'yellowing-old-leaves', 'stunted'],
  },
  {
    id: 'salvinia',
    name: 'Salvinia',
    scientific: 'Salvinia minima',
    aliases: ['water spangles', 'floating fern', 'water fern', 'Salvinia natans'],
    placement: 'floating',
    surfaceFloater: true,
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'fast',
    feeding: 'water column',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [22, 28],
    propagation: 'Splits by itself as it grows. Separate and thin the extra plants.',
    planting:
      'Just drop it on the surface. The dangling parts are modified leaves that work as roots. Shop labels for Salvinia are often wrong.',
    care: 'Wants bright light and calm surface water. Splashing or heavy condensation makes the leaves brown and rot. Giant salvinia (Salvinia molesta and its close relatives, including S. auriculata) is a US federal noxious weed, and some states restrict all Salvinia. Check your local rules, and never release it.',
    bettaNote:
      'The dangling parts give cover, but the leaves can cover the surface quickly. Bettas breathe air at the surface, so keep part of it clear.',
    commonProblems: ['brown-edges', 'melting', 'stunted', 'yellowing-old-leaves'],
  },
  {
    id: 'hornwort',
    name: 'Hornwort',
    scientific: 'Ceratophyllum demersum',
    aliases: ['coontail'],
    placement: 'floating',
    difficulty: 'easy',
    light: 'low',
    co2: 'not needed',
    growth: 'fast',
    feeding: 'water column',
    bettaFriendly: true,
    ph: [6.0, 7.5],
    tempC: [18, 28],
    propagation: 'Break off a piece. Each piece keeps growing.',
    planting:
      'It has no true roots. Let it float, or anchor the base with a small weight or wedge it between rocks.',
    care: 'Very hardy and quick, and it soaks up nutrients from the water. It sheds needles when stressed or after a move, and in poor light or very warm water. Trim it to keep it in check.',
    bettaNote:
      'Bushy cover that bettas like. The needle-like leaves are coarser than most plants, so watch very long fins and trim it before it covers the surface.',
    commonProblems: ['melting', 'stunted', 'algae-on-leaves', 'pale-new-growth'],
  },
  {
    id: 'anacharis',
    name: 'Anacharis',
    scientific: 'Egeria densa',
    aliases: ['Elodea', 'Elodea densa', 'Brazilian waterweed', 'egeria'],
    placement: 'background',
    difficulty: 'easy',
    light: 'medium',
    co2: 'not needed',
    growth: 'fast',
    feeding: 'water column',
    bettaFriendly: false,
    ph: [6.0, 7.5],
    tempC: [18, 26],
    propagation:
      'Cut the stem and replant the top, or let a piece float. Each piece keeps growing.',
    planting:
      'Push the cut end of each stem a few cm into the substrate, or let it float. Remove the lowest leaves first so they do not rot.',
    care: 'Fast and undemanding, and it soaks up nutrients from the water. It prefers cooler water and gets thin and brown when it is too warm. Trim it often. It often melts when "liquid carbon" products are used. It is an invasive weed that several US states ban from sale (for example Washington). Check your local rules and never release it.',
    bettaNote:
      'Fin-safe, but it prefers cooler water than a betta tank, so it often struggles at betta temperatures. Other stem plants are a better fit.',
    commonProblems: ['melting', 'leggy-growth', 'pale-new-growth', 'stunted'],
  },
]

const BY_ID = new Map(PLANT_CATALOG.map((s) => [s.id, s]))

export function getSpecies(id: string | null | undefined): PlantSpecies | undefined {
  return id ? BY_ID.get(id) : undefined
}

export const CELSIUS_TO_F = (c: number) => Math.round((c * 9) / 5 + 32)

/** "22–28 °C (72–82 °F)". */
export function formatTemp(range: readonly [number, number]) {
  return `${range[0]}–${range[1]} °C (${CELSIUS_TO_F(range[0])}–${CELSIUS_TO_F(range[1])} °F)`
}

export function formatPh(range: readonly [number, number]) {
  return `${range[0].toFixed(1)}–${range[1].toFixed(1)}`
}

export type SpeciesFilters = {
  query?: string
  easyOnly?: boolean
  lowLight?: boolean
  bettaFriendly?: boolean
  placement?: PlantSpecies['placement'] | null
}

/** Catalog entries matching a text query and the picker's filters. */
export function filterSpecies(filters: SpeciesFilters): PlantSpecies[] {
  const q = (filters.query ?? '').trim().toLowerCase()
  return PLANT_CATALOG.filter((s) => {
    if (filters.easyOnly && s.difficulty !== 'easy') return false
    if (filters.lowLight && s.light !== 'low') return false
    if (filters.bettaFriendly && !s.bettaFriendly) return false
    if (filters.placement && s.placement !== filters.placement) return false
    if (!q) return true
    return [s.name, s.scientific, ...(s.aliases ?? [])].some((t) => t.toLowerCase().includes(q))
  })
}
