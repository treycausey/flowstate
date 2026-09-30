const BASICS: { title: string; body: string }[] = [
  {
    title: 'Cycle the tank first.',
    body: 'A new tank has no bacteria to clear ammonia and nitrite, and both harm fish. Add an ammonia source (fish food or bottled ammonia) and test every few days. The tank is ready when it clears that ammonia to 0 ammonia and 0 nitrite within a day, and nitrate is rising. This usually takes several weeks. The Log tab shows where your tank stands.',
  },
  {
    title: 'Add slowly.',
    body: 'Add one group at a time and wait a couple of weeks before the next. The filter bacteria need time to grow with the load, and a sudden jump in ammonia is the usual result of adding too many at once.',
  },
  {
    title: 'Quarantine newcomers if you can.',
    body: 'A spare tub or tank for two to four weeks lets you spot illness before it reaches the main tank. At the least, watch new animals closely for the first days.',
  },
  {
    title: 'Bettas have their own temperament.',
    body: 'Many bettas live peacefully with calm tankmates, and some attack anything. Bright, long-finned fish and other bettas are the usual trouble. Start with plenty of cover, watch closely, and keep a plan to separate them.',
  },
  {
    title: 'Keep schooling fish in groups.',
    body: 'Tetras, rasboras, corydoras and loaches feel safe in numbers. Alone or in pairs they hide, fade or nip. The group sizes in the catalog are minimums, and more is better if the tank has room.',
  },
  {
    title: 'Bioload is about waste, not just size.',
    body: 'Every animal adds waste, and the filter can only clear so much. The stocking estimate is a rough guide. Filtration, plants, feeding and regular water changes change what a tank can carry.',
  },
  {
    title: 'Feed small amounts.',
    body: 'Give only what they eat in about a minute or two, once or twice a day. Extra food rots and raises ammonia, and it feeds snail booms. Tap Fed on the My stock page to keep a simple log.',
  },
  {
    title: 'Shrimp and snails like stable water.',
    body: 'They are sensitive to sudden changes and to copper, which is in some medicines and plant products. Acclimate them slowly and keep the water steady.',
  },
]

/** Short, friendly stocking primer for the Learn tab. */
export default function StockBasics() {
  return (
    <section aria-labelledby="stock-basics-title" className="basics">
      <h3 id="stock-basics-title" className="section-title">
        Stocking basics
      </h3>
      <ul className="basics__list">
        {BASICS.map((b) => (
          <li key={b.title}>
            <strong>{b.title}</strong> {b.body}
          </li>
        ))}
      </ul>
      <p className="muted basics__foot">
        This is general guidance to get you started. Flowstate does not track medication or
        treatment. See a fish vet or an experienced keeper when animals look ill.
      </p>
    </section>
  )
}
