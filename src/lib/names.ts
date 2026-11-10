// Name generation utilities for cities and water bodies
// (Varanasi's waters are named by its map generator: Ganga, Varuna, Assi.)
import type { MapId } from '@/games/isocity/maps/varanasi';

const CITY_NAME_PARTS = [
  'Spring', 'Riverside', 'Harbor', 'Valley', 'Hill', 'Bay', 'Creek', 'Park',
  'Lake', 'Mountain', 'Beach', 'Forest', 'Bridge', 'Port', 'View', 'Heights',
  'Grove', 'Meadow', 'Ridge', 'Point', 'Falls', 'Brook', 'Pine', 'Oak',
  'Maple', 'Cedar', 'Elm', 'Willow', 'Ash', 'Birch', 'Green', 'Blue',
  'White', 'Black', 'Red', 'New', 'Old', 'East', 'West', 'North', 'South',
  'Grand', 'Little', 'Big', 'Upper', 'Lower', 'Central', 'Fair', 'Bright',
  'Sunny', 'Clear', 'Rock', 'Stone', 'Iron', 'Gold', 'Silver', 'Copper',
  'Mill', 'Town', 'City', 'Ville', 'Burg', 'Field', 'Land', 'Wood',
];

const CITY_SUFFIXES = [
  'City', 'Town', 'Ville', 'Burg', 'Port', 'Harbor', 'Bay', 'Beach',
  'Park', 'Heights', 'Hills', 'Valley', 'Ridge', 'Point', 'Falls',
  'Springs', 'Grove', 'Meadow', 'Field', 'Woods', 'Lake', 'River',
];

const LAKE_NAMES = [
  'Pine Lake', 'Crystal Lake', 'Emerald Lake', 'Blue Lake', 'Clear Lake',
  'Silver Lake', 'Golden Lake', 'Mountain Lake', 'Forest Lake', 'Sunset Lake',
  'Sunrise Lake', 'Moon Lake', 'Star Lake', 'Mirror Lake', 'Reflection Lake',
  'Tranquil Lake', 'Serene Lake', 'Peaceful Lake', 'Still Lake', 'Calm Lake',
  'Deep Lake', 'Shallow Lake', 'Hidden Lake', 'Secret Lake', 'Lost Lake',
  'Wild Lake', 'Bear Lake', 'Eagle Lake', 'Deer Lake', 'Wolf Lake',
  'Trout Lake', 'Bass Lake', 'Salmon Lake', 'Perch Lake', 'Pike Lake',
  'Lily Lake', 'Lotus Lake', 'Willow Lake', 'Oak Lake', 'Maple Lake',
  'Cedar Lake', 'Birch Lake', 'Spruce Lake', 'Fir Lake',
  'Misty Lake', 'Foggy Lake', 'Cloudy Lake', 'Bright Lake', 'Shimmer Lake',
  'Sparkle Lake', 'Glitter Lake', 'Diamond Lake', 'Pearl Lake', 'Jade Lake',
];

const OCEAN_NAMES = [
  'Pacific Ocean', 'Atlantic Ocean', 'Arctic Ocean', 'Indian Ocean',
  'Southern Ocean', 'Mediterranean Sea', 'Caribbean Sea', 'North Sea',
  'Baltic Sea', 'Black Sea', 'Red Sea', 'Caspian Sea', 'Aral Sea',
  'Bering Sea', 'Sea of Japan', 'East China Sea', 'South China Sea',
  'Yellow Sea', 'Philippine Sea', 'Coral Sea', 'Tasman Sea', 'Arabian Sea',
  'Bay of Bengal', 'Gulf of Mexico', 'Persian Gulf', 'Gulf of Alaska',
  'Hudson Bay', 'Baffin Bay', 'Davis Strait', 'Denmark Strait',
  'Great Bay', 'Grand Bay', 'Royal Bay', 'Majestic Bay', 'Noble Bay',
  'Ancient Sea', 'Eternal Sea', 'Endless Sea', 'Boundless Sea', 'Vast Sea',
  'Infinite Sea', 'Crystal Sea', 'Emerald Sea', 'Sapphire Sea', 'Azure Sea',
  'Turquoise Sea', 'Northern Sea', 'Southern Sea', 'Eastern Sea', 'Western Sea',
];

/** Real towns around Varanasi, used for the neighbouring cities on the Varanasi map. */
export const VARANASI_NEIGHBOUR_NAMES = [
  'Ramnagar', 'Sarnath', 'Mughalsarai', 'Chunar', 'Mirzapur', 'Jaunpur',
  'Ghazipur', 'Bhadohi', 'Chandauli', 'Gyanpur', 'Saidpur', 'Chakia',
];

/** A neighbouring city name. On the Varanasi map these are real nearby towns; the random map keeps invented names. */
export function generateCityName(mapId?: MapId): string {
  if (mapId === 'varanasi') {
    return VARANASI_NEIGHBOUR_NAMES[Math.floor(Math.random() * VARANASI_NEIGHBOUR_NAMES.length)];
  }
  const part1 = CITY_NAME_PARTS[Math.floor(Math.random() * CITY_NAME_PARTS.length)];
  const part2 = CITY_NAME_PARTS[Math.floor(Math.random() * CITY_NAME_PARTS.length)];
  const suffix = CITY_SUFFIXES[Math.floor(Math.random() * CITY_SUFFIXES.length)];
  
  // Sometimes use two parts, sometimes one part + suffix
  if (Math.random() > 0.5) {
    return `${part1} ${suffix}`;
  } else {
    // Avoid duplicate parts
    if (part1 === part2) {
      return `${part1} ${suffix}`;
    }
    return `${part1}${part2} ${suffix}`;
  }
}

export function generateWaterName(type: 'lake' | 'ocean'): string {
  const filtered = type === 'lake' ? LAKE_NAMES : OCEAN_NAMES;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
