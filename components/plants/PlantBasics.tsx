const BASICS: { title: string; body: string }[] = [
  {
    title: 'Light, CO₂ and nutrients work as a set.',
    body: 'More of one without the others usually grows algae, not plants. In a simple tank with gentle light, choose slow, easy plants and let them set the pace.',
  },
  {
    title: 'Some plants feed through roots, some through leaves.',
    body: 'Crypts, swords and sagittaria take nutrients from the substrate. Stems, mosses, floating plants and epiphytes take them from the water.',
  },
  {
    title: 'Rhizome plants must not be buried.',
    body: 'Anubias, java fern and bucephalandra grow from a thick horizontal stem. Tie or glue it to wood or rock. Buried, it rots.',
  },
  {
    title: 'Melting after planting is often normal.',
    body: 'Plants grown out of water drop their old leaves and grow new ones that suit your water. Cryptocoryne are famous for it. Leave the roots alone and wait a few weeks.',
  },
  {
    title: 'Trim stem plants, then replant the tops.',
    body: 'Cut the stem, push the cut end a few cm into the substrate and the plant grows bushier. Every top becomes a new plant.',
  },
  {
    title: 'Floating plants shade the tank, and bettas need the surface.',
    body: 'Bettas breathe air, so keep part of the surface clear. Floating plants also like dry leaf tops, calm water and some room between the lid and the water.',
  },
  {
    title: 'Let your water tests help.',
    body: 'A nitrate reading of 0 in a planted tank can mean the plants are using all the nitrogen. Ammonia or nitrite above 0 is a problem for fish first. Never release plants or tank water into local waterways.',
  },
]

/** Short, friendly plant-care primer for the Learn tab. */
export default function PlantBasics() {
  return (
    <section aria-labelledby="basics-title" className="basics">
      <h3 id="basics-title" className="section-title">
        Plant basics
      </h3>
      <ul className="basics__list">
        {BASICS.map((b) => (
          <li key={b.title}>
            <strong>{b.title}</strong> {b.body}
          </li>
        ))}
      </ul>
      <p className="muted basics__foot">
        This is general guidance to get you started. Flowstate is not a dosing tool.
      </p>
    </section>
  )
}
