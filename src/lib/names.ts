// Name generation utilities for cities and water bodies (Indian names, to suit the Varanasi setting)

/** Neighbouring towns shown as the adjacent cities. */
const CITY_NAMES = [
  'Mirzapur', 'Jaunpur', 'Ghazipur', 'Chandauli', 'Bhadohi', 'Sultanpur', 'Azamgarh', 'Ballia',
  'Prayagraj', 'Ayodhya', 'Gorakhpur', 'Sonbhadra', 'Sarnath', 'Ramnagar', 'Chunar', 'Mughalsarai',
  'Kachhwa', 'Gyanpur', 'Handia', 'Saidpur', 'Mau', 'Deoria', 'Basti', 'Rewa',
];

/** Inland water bodies: talabs, kunds and jheels of Kashi and nearby (place name x water-body word). */
const LAKE_PLACES = [
  'Lahartara', 'Durga', 'Laxmi', 'Sarnath', 'Belwa', 'Matsya', 'Shankudha', 'Kardam',
  'Ram', 'Surya', 'Kurukshetra', 'Pisach', 'Mochan', 'Naiya',
];
const LAKE_FORMS = ['Talab', 'Kund', 'Sarovar', 'Jheel'];
const LAKE_NAMES = LAKE_FORMS.flatMap((form) => LAKE_PLACES.map((place) => `${place} ${form}`));

/** Large water bodies (the map generator's big lakes and rivers). */
const OCEAN_PLACES = ['Ganga', 'Yamuna', 'Saryu', 'Ghaghara', 'Son', 'Gandak', 'Rapti', 'Gomti', 'Varuna', 'Assi'];
const OCEAN_FORMS = ['', ' Bend', ' Basin', ' Reach', ' Channel'];
const OCEAN_NAMES = OCEAN_FORMS.flatMap((form) => OCEAN_PLACES.map((place) => `${place}${form}`));

/** Names for a renamed example city. */
const EXAMPLE_CITY_NAME = 'Kashi Nagar';

export function generateCityName(): string {
  const name = CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
  // Keep drawing as many random numbers as the old two-part generator did: the simulation tests replace
  // Math.random with a seeded sequence and their golden fingerprints depend on how many numbers are consumed.
  Math.random();
  Math.random();
  Math.random();
  return name;
}

export function generateWaterName(type: 'lake' | 'ocean'): string {
  const filtered = type === 'lake' ? LAKE_NAMES : OCEAN_NAMES;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * The example saves were made with Western names ("StephCity", "North Sea"). Gives a copy of such a save an Indian city
 * name and Indian water-body and neighbour names when it is loaded, so the big JSON files stay untouched.
 */
export function localizeExampleState<T extends { cityName?: string; waterBodies?: unknown; adjacentCities?: unknown; notifications?: unknown }>(state: T): T {
  const out: Record<string, unknown> = { ...state, cityName: EXAMPLE_CITY_NAME };
  const used = new Set<string>();
  const pick = (type: 'lake' | 'ocean') => {
    let name = generateWaterName(type);
    for (let i = 0; i < 20 && used.has(name); i++) name = generateWaterName(type);
    used.add(name);
    return name;
  };
  if (Array.isArray(state.waterBodies)) {
    out.waterBodies = state.waterBodies.map((w: { type?: string }) => ({ ...w, name: pick(w.type === 'ocean' ? 'ocean' : 'lake') }));
  }
  if (Array.isArray(state.adjacentCities)) {
    const usedCities = new Set<string>();
    out.adjacentCities = state.adjacentCities.map((c: object) => {
      let name = generateCityName();
      for (let i = 0; i < 20 && usedCities.has(name); i++) name = generateCityName();
      usedCities.add(name);
      return { ...c, name };
    });
  }
  if (Array.isArray(state.notifications)) {
    // Old saved notices quote dollars: show rupees instead.
    out.notifications = state.notifications.map((n: { description?: string }) =>
      typeof n.description === 'string' ? { ...n, description: n.description.replace(/\$(\d)/g, '₹$1') } : n);
  }
  return out as T;
}
