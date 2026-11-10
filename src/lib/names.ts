// Name generation utilities for cities and water bodies
// (Varanasi's waters are named by its map generator: Ganga, Varuna, Assi.)
import type { MapId } from '@/games/isocity/maps/varanasi';

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

/** Real towns right around Varanasi, used for the neighbouring cities on the Varanasi map. */
export const VARANASI_NEIGHBOUR_NAMES = [
  'Ramnagar', 'Sarnath', 'Mughalsarai', 'Chunar', 'Mirzapur', 'Jaunpur',
  'Ghazipur', 'Bhadohi', 'Chandauli', 'Gyanpur', 'Saidpur', 'Chakia',
];

export function generateCityName(mapId?: MapId): string {
  const names = mapId === 'varanasi' ? VARANASI_NEIGHBOUR_NAMES : CITY_NAMES;
  const name = names[Math.floor(Math.random() * names.length)];
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
