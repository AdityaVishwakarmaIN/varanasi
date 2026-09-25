'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState } from '@/types/game';
import { msg } from 'gt-next';
import { calculateGangaTargetHealth, getGangaTrend } from '@/lib/scoring';
import { findStps, gatherGangaInputs } from '@/lib/ganga';
import {
  gameDayIndex,
  isGangaFallingLongEnough,
  isSewageDominant,
  needsFirstGhat,
  nextGangaFallingDays,
} from '@/lib/gangaTips';
import { SYSTEM_TIP_CHECKS, type SystemTipId } from '@/lib/systemTips';
import { SHOWN_TIPS_KEY, TIPS_RESET_EVENT } from '@/lib/feedbackPrefs';

// Tip definitions with their conditions and messages
export type TipId = 
  | 'get_started'
  | 'needs_utilities'
  | 'negative_demand'
  | 'needs_safety_services'
  | 'needs_parks'
  | 'needs_health_education'
  | 'build_first_ghat'
  | 'ganga_falling'
  | 'needs_stp'
  | SystemTipId;

/**
 * Ganga numbers the tips need that are not in GameState. Updated once per in-game day (never per frame)
 * by useTipSystem; see S2-T11.
 */
export interface TipContext {
  /** Consecutive in-game days the Ganga Health trend has pointed down. */
  gangaFallingDays: number;
  /** Untreated sewage is more than half of the river's net load (as of the last in-game day). */
  sewageDominant: boolean;
}

export interface TipDefinition {
  id: TipId;
  message: string;
  priority: number; // Lower number = higher priority
  check: (state: GameState, context: TipContext) => boolean;
}

// Define all tips with their conditions
const TIP_DEFINITIONS: TipDefinition[] = [
  {
    id: 'get_started',
    message: msg('Welcome! Start by zoning areas for residential, commercial, and industrial buildings. Then add roads, power, and water to build your city.'),
    priority: 0, // Highest priority - shows first on fresh cities
    check: (state: GameState) => {
      // Check if this is a fresh/empty city - no zones placed yet
      let hasAnyZone = false;
      let hasAnyBuilding = false;
      
      for (let y = 0; y < state.gridSize; y++) {
        for (let x = 0; x < state.gridSize; x++) {
          const tile = state.grid[y][x];
          if (tile.zone !== 'none') {
            hasAnyZone = true;
          }
          const type = tile.building.type;
          // Check for any placed buildings (not natural terrain)
          if (type !== 'grass' && type !== 'water' && type !== 'tree') {
            hasAnyBuilding = true;
          }
        }
      }
      
      // Show on fresh cities with no zones and no buildings
      return !hasAnyZone && !hasAnyBuilding;
    },
  },
  {
    id: 'needs_utilities',
    message: msg('Buildings need power, water, and roads for construction to begin.'),
    priority: 1,
    check: (state: GameState) => {
      // Check if there are zoned tiles (even just grass) but no utilities infrastructure
      let hasZonedTiles = false;
      let hasPowerPlant = false;
      let hasWaterTower = false;
      let hasRoad = false;
      
      for (let y = 0; y < state.gridSize; y++) {
        for (let x = 0; x < state.gridSize; x++) {
          const tile = state.grid[y][x];
          if (tile.zone !== 'none') {
            hasZonedTiles = true;
          }
          const type = tile.building.type;
          if (type === 'power_plant') hasPowerPlant = true;
          if (type === 'water_tower') hasWaterTower = true;
          if (type === 'road' || type === 'bridge') hasRoad = true;
        }
      }
      
      // Trigger if: have zones but missing any utility infrastructure
      return hasZonedTiles && (!hasPowerPlant || !hasWaterTower || !hasRoad);
    },
  },
  {
    id: 'negative_demand',
    message: msg('Keep an eye on zone demand. Negative demand can cause buildings to become abandoned.'),
    priority: 2,
    check: (state: GameState) => {
      const { residential, commercial, industrial } = state.stats.demand;
      // Check if any demand is significantly negative
      return residential < -20 || commercial < -20 || industrial < -20;
    },
  },
  {
    id: 'needs_safety_services',
    message: msg('Add fire and police stations to keep your city safe from crime and fires.'),
    priority: 3,
    check: (state: GameState) => {
      // Check if there are buildings but no fire/police stations
      let hasBuildings = false;
      let hasFireStation = false;
      let hasPoliceStation = false;
      
      for (let y = 0; y < state.gridSize; y++) {
        for (let x = 0; x < state.gridSize; x++) {
          const type = state.grid[y][x].building.type;
          if (type === 'fire_station') hasFireStation = true;
          if (type === 'police_station') hasPoliceStation = true;
          
          // Check for any developed zone buildings
          const zone = state.grid[y][x].zone;
          if (zone !== 'none' && type !== 'grass') {
            hasBuildings = true;
          }
        }
      }
      
      // Has at least 50 population but no safety services
      return hasBuildings && state.stats.population >= 50 && (!hasFireStation || !hasPoliceStation);
    },
  },
  {
    id: 'needs_parks',
    message: msg('Add parks and trees to improve your city\'s environment and make residents happier.'),
    priority: 4,
    check: (state: GameState) => {
      // Check if environment score is low
      return state.stats.environment < 40 && state.stats.population >= 100;
    },
  },
  {
    id: 'needs_health_education',
    message: msg('Build hospitals and schools to improve health and education for your citizens.'),
    priority: 5,
    check: (state: GameState) => {
      // Check if there's population but no hospitals or schools
      let hasHospital = false;
      let hasSchool = false;
      
      for (let y = 0; y < state.gridSize; y++) {
        for (let x = 0; x < state.gridSize; x++) {
          const type = state.grid[y][x].building.type;
          if (type === 'hospital') hasHospital = true;
          if (type === 'school' || type === 'university') hasSchool = true;
        }
      }
      
      // Has at least 100 population but no health/education
      return state.stats.population >= 100 && (!hasHospital || !hasSchool);
    },
  },
  // Varanasi map only (S2-T11)
  {
    id: 'build_first_ghat',
    message: msg("Pilgrims come to Varanasi for the ghats. Build some on the Ganga's west bank to earn tourism income."),
    priority: 6,
    check: (state: GameState) => {
      if (state.mapId !== 'varanasi' || !needsFirstGhat(state.stats.population, 0)) return false;
      for (let y = 0; y < state.gridSize; y++) {
        for (let x = 0; x < state.gridSize; x++) {
          if (state.grid[y][x].building.type === 'ghat') return false;
        }
      }
      return true;
    },
  },
  {
    id: 'ganga_falling',
    message: msg("The Ganga is getting dirtier. Open the Ganga overlay to see what's polluting it."),
    priority: 7,
    check: (state: GameState, context: TipContext) =>
      state.mapId === 'varanasi' && isGangaFallingLongEnough(context.gangaFallingDays),
  },
  {
    id: 'needs_stp',
    message: msg('Untreated sewage is flowing into the Ganga. A Sewage Treatment Plant near homes will help.'),
    priority: 8,
    check: (state: GameState, context: TipContext) => state.mapId === 'varanasi' && context.sewageDominant,
  },
  // One tip per system, the first time it matters (S5-T8). Crisis tips outrank the general advice above.
  {
    id: 'debt_warning',
    message: msg('The treasury is in debt. Raise taxes or cut spending on the Budget panel. After three months in debt, the city is offered an emergency loan: it clears the debt, but you repay it with interest every month.'),
    priority: -9,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.debt_warning(state),
  },
  {
    id: 'first_outbreak',
    message: msg('Disease has broken out in a neighbourhood (the biohazard icon). Clean water, working sewers and a nearby hospital stop it spreading.'),
    priority: -8,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.first_outbreak(state),
  },
  {
    id: 'first_heatwave',
    message: msg('A heatwave is coming. Power and water demand will jump. Trees, parks and hospitals keep people safe in the heat.'),
    priority: -7,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.first_heatwave(state),
  },
  {
    id: 'monsoon_forecast',
    message: msg('The monsoon is coming and the Ganga will rise. Open the Flood overlay to see which tiles will go under, and build embankments along the bank to hold the water back.'),
    priority: -6,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.monsoon_forecast(state),
  },
  {
    id: 'first_power_cut',
    message: msg('Demand is higher than supply, so blocks are taking turns without power (the flickering bolt). Build more power plants to end the rolling cuts.'),
    priority: -5,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.first_power_cut(state),
  },
  {
    id: 'first_water_shortage',
    message: msg('There is not enough water for everyone. Build more water towers, and check the Water overlay for homes without pipes.'),
    priority: -4,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.first_water_shortage(state),
  },
  {
    id: 'festival_prep',
    message: msg('A big festival is coming. Open the Event panel from the calendar to see the readiness checklist: crowd safety, fire and medical cover, road access, sanitation and lights.'),
    priority: -3,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.festival_prep(state),
  },
  {
    id: 'first_informal_settlement',
    message: msg('Families who cannot find a home have built an informal settlement. Zone the settlement residential and give it road access, power and water. After 30 days with all of these, it is formalised into proper homes.'),
    priority: -2,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.first_informal_settlement(state),
  },
  {
    id: 'first_landmark_unlocked',
    message: msg('Your city has grown enough to build its first landmark. Look for it in the build menu. Landmarks draw pilgrims and tourists.'),
    priority: -1,
    check: (state: GameState) => SYSTEM_TIP_CHECKS.first_landmark_unlocked(state),
  },
];

const STORAGE_KEY = 'isocity-tips-disabled';
const MIN_TIP_INTERVAL_MS = 15000; // Minimum 15 seconds between tips
const TIP_CHECK_INTERVAL_MS = 5000; // Check for tip conditions every 5 seconds
const INITIAL_TIP_DELAY_MS = 3000; // Wait 3 seconds before first tip

interface UseTipSystemReturn {
  currentTip: string | null;
  isVisible: boolean;
  onContinue: () => void;
  onSkipAll: () => void;
  tipsEnabled: boolean;
  setTipsEnabled: (enabled: boolean) => void;
}

export function useTipSystem(state: GameState): UseTipSystemReturn {
  const [tipsEnabled, setTipsEnabledState] = useState(true);
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [shownTips, setShownTips] = useState<Set<TipId>>(new Set());
  const lastTipTimeRef = useRef<number>(0);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedRef = useRef(false);
  
  // Use a ref to always have the latest state without causing effect re-runs
  const stateRef = useRef(state);
  stateRef.current = state;

  // Ganga tip context, refreshed once per in-game day (S2-T11).
  const tipContextRef = useRef<TipContext>({ gangaFallingDays: 0, sewageDominant: false });
  const lastObservedDayRef = useRef<number | null>(null);
  const { year, month, day, mapId } = state;
  useEffect(() => {
    const current = stateRef.current;
    const today = gameDayIndex(year, month, day);
    const lastDay = lastObservedDayRef.current;
    lastObservedDayRef.current = today;
    const { gangaHealth, gangaHealthTarget } = current.stats;
    if (mapId !== 'varanasi' || gangaHealth === undefined || gangaHealthTarget === undefined) {
      tipContextRef.current = { gangaFallingDays: 0, sewageDominant: false };
      return;
    }
    const trend = getGangaTrend(gangaHealth, gangaHealthTarget);
    const gangaFallingDays = lastDay === null
      ? 0
      : nextGangaFallingDays(tipContextRef.current.gangaFallingDays, trend, today - lastDay);
    const { grid, gridSize } = current;
    const load = calculateGangaTargetHealth(gatherGangaInputs(grid, gridSize, findStps(grid, gridSize)));
    tipContextRef.current = {
      gangaFallingDays,
      sewageDominant: isSewageDominant(load.sewageLoad, load.netLoad),
    };
  }, [year, month, day, mapId]);

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const disabled = localStorage.getItem(STORAGE_KEY);
      if (disabled === 'true') {
        setTipsEnabledState(false);
      }
      
      const shown = localStorage.getItem(SHOWN_TIPS_KEY);
      if (shown) {
        const parsed = JSON.parse(shown);
        if (Array.isArray(parsed)) {
          setShownTips(new Set(parsed as TipId[]));
        }
      }
    } catch (e) {
      console.error('Failed to load tip preferences:', e);
    }
    
    hasLoadedRef.current = true;
  }, []);

  // Settings -> "Reset tips" (S5-T8): every tip can show once more
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onReset = () => setShownTips(new Set());
    window.addEventListener(TIPS_RESET_EVENT, onReset);
    return () => window.removeEventListener(TIPS_RESET_EVENT, onReset);
  }, []);

  // Save shown tips to localStorage when they change
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(SHOWN_TIPS_KEY, JSON.stringify(Array.from(shownTips)));
    } catch (e) {
      console.error('Failed to save shown tips:', e);
    }
  }, [shownTips]);

  // Set tips enabled preference
  const setTipsEnabled = useCallback((enabled: boolean) => {
    setTipsEnabledState(enabled);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, enabled ? 'false' : 'true');
      } catch (e) {
        console.error('Failed to save tip preference:', e);
      }
    }
    if (!enabled) {
      setIsVisible(false);
      setCurrentTip(null);
    }
  }, []);

  // Track shown tips in a ref as well for synchronous access
  const shownTipsRef = useRef<Set<TipId>>(new Set());
  
  // Keep ref in sync with state
  useEffect(() => {
    shownTipsRef.current = shownTips;
  }, [shownTips]);

  // Check for conditions and show tip - uses refs to get latest values
  const checkAndShowTip = useCallback(() => {
    if (!hasLoadedRef.current) return;
    if (!tipsEnabled) return;
    if (isVisible) return;
    
    const now = Date.now();
    
    // Rate limiting - don't show tips too frequently (skip for first tip)
    if (lastTipTimeRef.current > 0 && now - lastTipTimeRef.current < MIN_TIP_INTERVAL_MS) {
      return;
    }
    
    const currentState = stateRef.current;
    const currentShownTips = shownTipsRef.current;
    
    // Find the first applicable tip that hasn't been shown
    const applicableTips = TIP_DEFINITIONS
      .filter(tip => !currentShownTips.has(tip.id) && tip.check(currentState, tipContextRef.current))
      .sort((a, b) => a.priority - b.priority);
    
    if (applicableTips.length > 0) {
      const tip = applicableTips[0];
      setCurrentTip(tip.message);
      setIsVisible(true);
      lastTipTimeRef.current = now;
      setShownTips(prev => new Set([...prev, tip.id]));
    }
  }, [tipsEnabled, isVisible]);

  // Set up periodic check for tip conditions
  useEffect(() => {
    // Clear any existing interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    
    if (!tipsEnabled) return;
    
    // Initial check after a short delay (give time for game to initialize)
    const initialTimeout = setTimeout(() => {
      checkAndShowTip();
    }, INITIAL_TIP_DELAY_MS);
    
    // Set up periodic checking
    checkIntervalRef.current = setInterval(checkAndShowTip, TIP_CHECK_INTERVAL_MS);
    
    return () => {
      clearTimeout(initialTimeout);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [tipsEnabled, checkAndShowTip]);

  // Handle continue button - dismiss current tip
  const onContinue = useCallback(() => {
    setIsVisible(false);
    // Small delay before clearing the message to allow exit animation
    setTimeout(() => {
      setCurrentTip(null);
    }, 300);
  }, []);

  // Handle skip all button - disable tips permanently
  const onSkipAll = useCallback(() => {
    setTipsEnabled(false);
    setIsVisible(false);
    setCurrentTip(null);
  }, [setTipsEnabled]);

  return {
    currentTip,
    isVisible,
    onContinue,
    onSkipAll,
    tipsEnabled,
    setTipsEnabled,
  };
}
