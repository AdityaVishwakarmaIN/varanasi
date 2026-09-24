/**
 * "Voices of the City" citizen feed (S5-T7): neighbourhood names, first names, message templates and a picker.
 *
 * Content rules (reviewed by the owner): no religious jokes, no caste, no politics, no real people's names,
 * English only. At least a third of templates are positive so good play is rewarded.
 */
import type { Rng } from '@/lib/rng';

export interface Mohalla {
  name: string;
  /** Approximate position on the Varanasi map (u: west 0 → east 1, v: north 0 → south 1), same convention as VARANASI_MAP. */
  u: number;
  v: number;
}

/** Real Varanasi neighbourhoods, placed roughly where they sit relative to the Ganga crescent. */
export const VARANASI_MOHALLAS: readonly Mohalla[] = [
  { name: 'Sarnath', u: 0.55, v: 0.08 },
  { name: 'Shivpur', u: 0.2, v: 0.15 },
  { name: 'Pandeypur', u: 0.38, v: 0.18 },
  { name: 'Bhojubeer', u: 0.18, v: 0.3 },
  { name: 'Rajghat', u: 0.57, v: 0.32 },
  { name: 'Nadesar', u: 0.3, v: 0.34 },
  { name: 'Orderly Bazar', u: 0.22, v: 0.4 },
  { name: 'Adampura', u: 0.5, v: 0.38 },
  { name: 'Lahurabir', u: 0.38, v: 0.42 },
  { name: 'Maidagin', u: 0.45, v: 0.44 },
  { name: 'Chetganj', u: 0.35, v: 0.47 },
  { name: 'Chowk', u: 0.47, v: 0.5 },
  { name: 'Sigra', u: 0.28, v: 0.52 },
  { name: 'Luxa', u: 0.4, v: 0.55 },
  { name: 'Godowlia', u: 0.44, v: 0.56 },
  { name: 'Dashashwamedh', u: 0.48, v: 0.58 },
  { name: 'Mahmoorganj', u: 0.28, v: 0.62 },
  { name: 'Kamachha', u: 0.37, v: 0.63 },
  { name: 'Bhelupur', u: 0.42, v: 0.66 },
  { name: 'Sonarpura', u: 0.47, v: 0.66 },
  { name: 'Manduadih', u: 0.2, v: 0.7 },
  { name: 'Durgakund', u: 0.4, v: 0.72 },
  { name: 'Shivala', u: 0.48, v: 0.73 },
  { name: 'Bhadaini', u: 0.5, v: 0.79 },
  { name: 'Assi', u: 0.52, v: 0.84 },
  { name: 'Sundarpur', u: 0.33, v: 0.82 },
  { name: 'Lanka', u: 0.43, v: 0.88 },
  { name: 'Padao', u: 0.8, v: 0.45 },
  { name: 'Sujabad', u: 0.68, v: 0.62 },
  { name: 'Ramnagar', u: 0.75, v: 0.85 },
];

/**
 * Neighbourhood name for a feeder block (S3-T7's 16×16 blocks, indexed row-major).
 * The feeder grid is assumed square (feederCount = cols², as for a square map); the block's centre is mapped
 * to map fractions and the nearest mohalla wins (ties go to the earlier entry). Deterministic.
 */
export function getMohallaForFeeder(feederIndex: number, feederCount: number): string {
  const cols = Math.max(1, Math.round(Math.sqrt(Math.max(1, feederCount))));
  const idx = Math.max(0, Math.floor(feederIndex));
  const fx = idx % cols;
  const fy = Math.floor(idx / cols);
  const u = (fx + 0.5) / cols;
  const v = (fy + 0.5) / cols;
  let best = VARANASI_MOHALLAS[0];
  let bestD = Infinity;
  for (const m of VARANASI_MOHALLAS) {
    const d = (m.u - u) ** 2 + (m.v - v) ** 2;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best.name;
}

/** Common first names from many regions of India. No surnames, no famous people. */
export const INDIAN_FIRST_NAMES: readonly string[] = [
  // North and central
  'Aarti', 'Anil', 'Anita', 'Ankit', 'Deepak', 'Geeta', 'Kamla', 'Manoj', 'Neha', 'Pankaj', 'Pooja', 'Rajesh', 'Ramesh',
  'Ritu', 'Sanjay', 'Savitri', 'Seema', 'Sunita', 'Suresh', 'Vinod', 'Shalini', 'Mukesh', 'Rekha', 'Alok',
  // Punjab
  'Gurpreet', 'Harpreet', 'Jaspreet', 'Manpreet', 'Baldev',
  // West
  'Bhavna', 'Hitesh', 'Jignesh', 'Nilesh', 'Mrunal', 'Snehal', 'Tejas',
  // East and north-east
  'Bijoy', 'Moumita', 'Subhash', 'Tanmoy', 'Rupa', 'Tenzin', 'Pema', 'Bishnu',
  // South
  'Karthik', 'Lakshmi', 'Meenakshi', 'Senthil', 'Divya', 'Venkat', 'Anjali', 'Arun', 'Sreeja', 'Nandini', 'Ravi',
  // Across communities
  'Ayesha', 'Farah', 'Imran', 'Salim', 'Shabana', 'Zoya', 'Fatima', 'Irfan', 'Joseph', 'Mary', 'Thomas', 'Anthony',
  // Young Varanasi
  'Aarav', 'Ananya', 'Arjun', 'Kavya', 'Rohan', 'Priya', 'Ishaan', 'Diya', 'Vivaan', 'Meera',
];

/** A random first name. */
export function pickFirstName(rng: Rng): string {
  return INDIAN_FIRST_NAMES[Math.min(INDIAN_FIRST_NAMES.length - 1, Math.floor(rng() * INDIAN_FIRST_NAMES.length))];
}

/** City conditions a voice can react to. The caller decides which are true this week. */
export type VoiceCondition =
  | 'power_cut'
  | 'power_ok'
  | 'water_shortage'
  | 'water_ok'
  | 'ganga_clean'
  | 'ganga_dirty'
  | 'traffic_high'
  | 'traffic_low'
  | 'taxes_high'
  | 'taxes_low'
  | 'jobs_short'
  | 'jobs_plenty'
  | 'crime_high'
  | 'safe_streets'
  | 'pollution_high'
  | 'green_city'
  | 'health_poor'
  | 'health_good'
  | 'education_good'
  | 'housing_short'
  | 'settlement_formalised'
  | 'tourism_high'
  | 'ghat_busy'
  | 'cows_on_road'
  | 'heatwave'
  | 'flood'
  | 'fog'
  | 'disease'
  | 'festival_upcoming'
  | 'festival_success'
  | 'festival_overwhelmed'
  | 'landmark_built'
  | 'money_low'
  | 'happiness_high';

export interface CitizenVoice {
  id: string;
  condition: VoiceCondition;
  positive: boolean;
  /** May contain {name} and {area}. */
  text: string;
}

export const CITIZEN_VOICE_CONFIG = {
  /** At most one new message per this many in-game days. */
  minDaysBetweenMessages: 7,
  /** How many recent message ids the caller should remember to avoid repeats. */
  recentMemory: 12,
} as const;

export const CITIZEN_VOICES: readonly CitizenVoice[] = [
  // Power
  { id: 'power_cut_cricket', condition: 'power_cut', positive: false, text: 'Power cut again during the cricket match! – {name}, {area}' },
  { id: 'power_cut_inverter', condition: 'power_cut', positive: false, text: 'Our inverter battery gave up before the power came back. – {name}, {area}' },
  { id: 'power_cut_study', condition: 'power_cut', positive: false, text: 'Studying for exams by candlelight is not as romantic as it sounds. – {name}, {area}' },
  { id: 'power_ok', condition: 'power_ok', positive: true, text: 'No power cut all week. The fridge and I are both happy. – {name}, {area}' },
  // Water
  { id: 'water_short_buckets', condition: 'water_shortage', positive: false, text: 'Taps ran dry by seven in the morning. We filled buckets at midnight. – {name}, {area}' },
  { id: 'water_short_tanker', condition: 'water_shortage', positive: false, text: 'Waited two hours for the water tanker today. – {name}, {area}' },
  { id: 'water_ok', condition: 'water_ok', positive: true, text: 'Water pressure is finally good enough to reach the rooftop tank. – {name}, {area}' },
  // Ganga
  { id: 'ganga_clean_boat', condition: 'ganga_clean', positive: true, text: 'Took my kids for a boat ride. The river looks cleaner than I remember. – {name}' },
  { id: 'ganga_clean_dolphin', condition: 'ganga_clean', positive: true, text: 'The boatman says the river dolphins are coming back. – {name}, {area}' },
  { id: 'ganga_dirty', condition: 'ganga_dirty', positive: false, text: 'The river smells bad near the drains again. Visitors noticed too. – {name}, {area}' },
  { id: 'ganga_dirty_ghat', condition: 'ganga_dirty', positive: false, text: 'Fewer boats on the water this week. People say the river is too dirty. – {name}' },
  // Traffic
  { id: 'traffic_two_hours', condition: 'traffic_high', positive: false, text: 'Two hours in traffic near {area}. Two hours!' },
  { id: 'traffic_auto', condition: 'traffic_high', positive: false, text: 'Even the auto driver gave up and told me to walk. – {name}, {area}' },
  { id: 'traffic_low', condition: 'traffic_low', positive: true, text: 'Reached the office in fifteen minutes today. Is it a holiday? – {name}, {area}' },
  // Money and jobs
  { id: 'taxes_high', condition: 'taxes_high', positive: false, text: 'House tax went up again. What are we getting for it? – {name}, {area}' },
  { id: 'taxes_low', condition: 'taxes_low', positive: true, text: 'Taxes are reasonable and the roads are decent. Fair deal. – {name}, {area}' },
  { id: 'jobs_short', condition: 'jobs_short', positive: false, text: 'My son is looking for work. He says there is nothing nearby. – {name}, {area}' },
  { id: 'jobs_plenty', condition: 'jobs_plenty', positive: true, text: 'Got a job at the new workshop, walking distance from home! – {name}, {area}' },
  { id: 'money_low', condition: 'money_low', positive: false, text: 'People say the city treasury is empty. I hope someone is watching the accounts. – {name}' },
  // Safety
  { id: 'crime_high', condition: 'crime_high', positive: false, text: 'Someone took my bicycle from outside the shop. We need more patrols. – {name}, {area}' },
  { id: 'safe_streets', condition: 'safe_streets', positive: true, text: 'Walked home late after work and felt completely safe. – {name}, {area}' },
  // Environment and health
  { id: 'pollution_high', condition: 'pollution_high', positive: false, text: 'The smoke from the factories makes my eyes water. – {name}, {area}' },
  { id: 'green_city', condition: 'green_city', positive: true, text: 'The new park has the best neem trees. My morning walk is sorted. – {name}, {area}' },
  { id: 'health_poor', condition: 'health_poor', positive: false, text: 'The nearest hospital is too far. We need one closer. – {name}, {area}' },
  { id: 'health_good', condition: 'health_good', positive: true, text: 'The doctor at the new hospital saw my mother the same day. – {name}, {area}' },
  { id: 'education_good', condition: 'education_good', positive: true, text: 'My daughter topped her class at the government school! – {name}, {area}' },
  // Housing
  { id: 'housing_short', condition: 'housing_short', positive: false, text: 'Rents keep rising. Families are building shelters wherever they can. – {name}, {area}' },
  { id: 'settlement_formalised', condition: 'settlement_formalised', positive: true, text: 'We finally have a proper home with water and light. – {name}, {area}' },
  // Tourism and ghats
  { id: 'tourism_high', condition: 'tourism_high', positive: true, text: 'Sold every silk saree in the shop to visitors this week! – {name}, {area}' },
  { id: 'ghat_busy', condition: 'ghat_busy', positive: true, text: 'The ghats at dawn are full of life. This is why I love this city. – {name}' },
  { id: 'cows_on_road', condition: 'cows_on_road', positive: false, text: 'A cow parked itself in the middle of the road near {area}. Traffic waited politely.' },
  // Seasons and crises
  { id: 'heatwave', condition: 'heatwave', positive: false, text: '46 degrees today. Stay indoors and drink water. – {name}, {area}' },
  { id: 'flood', condition: 'flood', positive: false, text: 'The water reached our steps last night. We moved everything upstairs. – {name}, {area}' },
  { id: 'fog', condition: 'fog', positive: false, text: 'Could not see the end of the lane this morning. Drove at walking speed. – {name}, {area}' },
  { id: 'disease', condition: 'disease', positive: false, text: 'Half the colony has fever. Please send doctors and clean water. – {name}, {area}' },
  // Festivals and landmarks
  { id: 'festival_upcoming', condition: 'festival_upcoming', positive: true, text: 'Already buying diyas for the festival. The whole lane is excited. – {name}, {area}' },
  { id: 'festival_success', condition: 'festival_success', positive: true, text: 'Never seen the ghats so beautiful. – {name}' },
  { id: 'festival_success_lights', condition: 'festival_success', positive: true, text: 'The lamps on the river last night were unforgettable. – {name}, {area}' },
  { id: 'festival_overwhelmed', condition: 'festival_overwhelmed', positive: false, text: 'It took us three hours to get home from the ghats. It needs better planning. – {name}, {area}' },
  { id: 'landmark_built', condition: 'landmark_built', positive: true, text: 'My relatives want to visit now that the new landmark is open. – {name}, {area}' },
  { id: 'happiness_high', condition: 'happiness_high', positive: true, text: 'Chai on the rooftop, a cool breeze, a good city. What more do I need? – {name}, {area}' },
];

/**
 * Picks a voice for the active conditions, avoiding recently shown ids.
 * @param recentIds recently shown ids, oldest first
 * @returns null when no template matches any active condition
 */
export function pickCitizenVoice(
  conditions: Iterable<VoiceCondition>,
  rng: Rng,
  recentIds: readonly string[] = []
): CitizenVoice | null {
  const active = new Set(conditions);
  const matching = CITIZEN_VOICES.filter((v) => active.has(v.condition));
  if (matching.length === 0) return null;
  const recent = new Set(recentIds);
  const fresh = matching.filter((v) => !recent.has(v.id));
  if (fresh.length > 0) return fresh[Math.min(fresh.length - 1, Math.floor(rng() * fresh.length))];
  // Everything matching was shown recently: repeat the one shown longest ago.
  let best = matching[0];
  let bestIdx = Infinity;
  for (const v of matching) {
    const i = recentIds.lastIndexOf(v.id);
    if (i < bestIdx) {
      bestIdx = i;
      best = v;
    }
  }
  return best;
}

/** Fills {name} and {area}. */
export function formatCitizenVoice(voice: CitizenVoice, values: { name: string; area: string }): string {
  return voice.text.split('{name}').join(values.name).split('{area}').join(values.area);
}
