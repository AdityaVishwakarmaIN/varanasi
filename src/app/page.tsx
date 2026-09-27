'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GameProvider } from '@/context/GameContext';
import { MultiplayerContextProvider } from '@/context/MultiplayerContext';
import Game from '@/components/Game';
import { PerfHud } from '@/components/game/PerfHud';
import { BenchmarkRunner } from '@/components/game/BenchmarkRunner';
import { parseBenchmarkParams } from '@/lib/benchmark';
import { isDevMode } from '@/lib/devMode';
import { CreditsButton } from '@/components/CreditsDialog';
import { CrashSaveRegistrar, GameErrorBoundary } from '@/components/GameErrorBoundary';
import { formatINR, formatPopulation } from '@/lib/format';
import { CoopModal } from '@/components/multiplayer/CoopModal';
import { FEATURES } from '@/lib/features';
import { useMobile } from '@/hooks/useMobile';
import { TitleBackdrop } from '@/components/TitleBackdrop';
import { SavedCityMeta, GameState } from '@/types/game';
import { compressToUTF16 } from 'lz-string';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { T } from 'gt-next';
import { Users, X } from 'lucide-react';
import {
  clearIsoCityAutosave,
  copyIsoCitySavedCityToAutosave,
  deleteIsoCitySavedCityData,
  flushPendingSaves,
  hasIsoCityAutosave,
  loadIsoCitySavedCities,
  updateIsoCitySavedCities,
  writeIsoCityAutosaveRaw,
} from '@/lib/isocityStorage';
import { MapChoiceCards } from '@/components/MapChoiceCards';
import { Input } from '@/components/ui/input';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { DEFAULT_CITY_NAMES } from '@/lib/mapConfig';
import type { NewGameOptions } from '@/lib/newGame';

// Save a city to the saved cities index (for multiplayer cities)
async function saveCityToIndex(state: GameState, roomCode?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    // Create city meta
    const cityMeta: SavedCityMeta = {
      id: state.id || `city-${Date.now()}`,
      cityName: state.cityName || 'Co-op City',
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
      roomCode: roomCode,
    };
    
    await updateIsoCitySavedCities((stored) => {
      const cities = [...stored];
      // Check if city already exists (by id or roomCode)
      const existingIndex = cities.findIndex(c => 
        c.id === cityMeta.id || (roomCode && c.roomCode === roomCode)
      );
      
      if (existingIndex >= 0) {
        // Update existing entry
        cities[existingIndex] = cityMeta;
      } else {
        // Add new entry at the beginning
        cities.unshift(cityMeta);
      }
      
      // Keep only the last 20 cities
      return cities.slice(0, 20);
    });
  } catch (e) {
    console.error('Failed to save city to index:', e);
  }
}

// Saved City Card Component
function SavedCityCard({ city, onLoad, onDelete }: { city: SavedCityMeta; onLoad: () => void; onDelete?: () => void }) {
  return (
    <div className="relative group">
      <button
        onClick={onLoad}
        className="press hud-well w-full text-left p-3 pr-11 rounded-xl hover:!border-gold/40 hover:bg-[hsl(233_40%_14%/0.8)]"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-foreground font-semibold truncate text-sm flex-1">
            {city.cityName}
          </h3>
          {FEATURES.coop && city.roomCode && (
            <span className="text-xs px-1.5 py-0.5 bg-ganga/15 text-ganga ring-1 ring-ganga/30 rounded-full shrink-0">
              Co-op
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs font-mono text-sandstone/60">
          <span>Pop: {formatPopulation(city.population)}</span>
          <span className="text-marigold/80">{formatINR(city.money)}</span>
          {FEATURES.coop && city.roomCode && <span className="text-ganga/70">{city.roomCode}</span>}
        </div>
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1/2 -translate-y-1/2 right-0.5 h-11 w-11 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-500/15 text-sandstone/50 hover:text-red-400 rounded-lg transition-[opacity,color,background-color] duration-200"
          title="Delete city"
          aria-label="Delete city"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function NewGameResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-11 py-2 text-sm tracking-wide text-sandstone/60 hover:text-marigold transition-colors duration-200"
    >
      <T>New Game</T>
    </button>
  );
}

function NewGameDialog({
  open,
  onOpenChange,
  hasSaved,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasSaved: boolean;
  onConfirm: (options: NewGameOptions) => void;
}) {
  const [mapId, setMapId] = useState<MapId>('varanasi');
  const [name, setName] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <T>Start a New City</T>
          </DialogTitle>
          <DialogDescription>
            <T>Choose where to build.</T>
          </DialogDescription>
        </DialogHeader>

        <MapChoiceCards value={mapId} onChange={setMapId} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={DEFAULT_CITY_NAMES[mapId]}
          aria-label="City name"
          maxLength={40}
        />
        {hasSaved && (
          <p className="text-xs text-amber-300/90">
            <T>This replaces your current autosave. Cities saved from Settings are kept.</T>
          </p>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto min-h-[44px]"
          >
            <T>Cancel</T>
          </Button>
          <Button
            onClick={() => onConfirm({ mapId, name })}
            className="w-full sm:w-auto min-h-[44px]"
          >
            <T>Start Building</T>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HomePage() {
  const [showGame, setShowGame] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  const [hasSaved, setHasSaved] = useState(false);
  const [showCoopModal, setShowCoopModal] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [newGameOptions, setNewGameOptions] = useState<NewGameOptions | undefined>(undefined);
  const [, setIsMultiplayer] = useState(false);
  const [startFreshGame, setStartFreshGame] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  const hasResettableProgress = hasSaved;
  // Co-op cities live in a remote room; hide them while co-op is off (the index entries are kept).
  const visibleSavedCities = FEATURES.coop ? savedCities : savedCities.filter(c => !c.roomCode);

  // Check for saved game and room code in URL after mount
  useEffect(() => {
    let cancelled = false;
    const checkSavedGame = async () => {
      // Saves live in IndexedDB (async); the first read also migrates old
      // localStorage saves. Keep showing "Loading..." until this is done.
      const [cities, saved] = await Promise.all([
        loadIsoCitySavedCities(),
        hasIsoCityAutosave(),
      ]);
      if (cancelled) return;
      setSavedCities(cities);
      setHasSaved(saved);
      setIsChecking(false);
      
      // Check for room code in URL (legacy format) - redirect to new format
      const params = new URLSearchParams(window.location.search);
      const roomCode = params.get('room');
      if (FEATURES.coop && roomCode && roomCode.length === 5) {
        // Redirect to new /coop/XXXXX format
        window.location.replace(`/coop/${roomCode.toUpperCase()}`);
        return;
      }
      // ?bench=120|160: go straight into the game; BenchmarkRunner loads the benchmark city
      if (parseBenchmarkParams(window.location.search).bench !== null) {
        setShowGame(true);
        return;
      }
      // Always show landing page - don't auto-load into game
      // User can select from saved cities or start new
    };
    checkSavedGame().catch((e) => {
      console.error('Failed to read saved cities:', e);
      if (!cancelled) setIsChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle exit from game - refresh saved cities list
  const handleExitGame = () => {
    setShowGame(false);
    setIsMultiplayer(false);
    setStartFreshGame(false);
    // Clear room code from URL
    window.history.replaceState({}, '', '/');
    // Wait for the game's final saves (started on unmount) before listing.
    // The macrotask yield lets React commit the unmount first.
    void (async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await flushPendingSaves();
      const [cities, saved] = await Promise.all([
        loadIsoCitySavedCities(),
        hasIsoCityAutosave(),
      ]);
      setSavedCities(cities);
      setHasSaved(saved);
    })();
  };

  const handleStartFreshGame = async (options: NewGameOptions = {}) => {
    // Only the autosave is replaced; cities saved from Settings stay in the list.
    await clearIsoCityAutosave();
    setShowResetDialog(false);
    setShowCoopModal(false);
    setPendingRoomCode(null);
    setHasSaved(false);
    setIsMultiplayer(false);
    setNewGameOptions(options);
    setStartFreshGame(true);
    window.history.replaceState({}, '', '/');
    setShowGame(true);
  };

  // Load a saved city
  const loadSavedCity = (city: SavedCityMeta) => {
    // If it's a multiplayer city, navigate to the room
    if (FEATURES.coop && city.roomCode) {
      window.history.replaceState({}, '', `/coop/${city.roomCode}`);
      setPendingRoomCode(city.roomCode);
      setShowCoopModal(true);
      return;
    }
    
    // Otherwise copy it into the autosave slot, which GameProvider loads
    copyIsoCitySavedCityToAutosave(city.id)
      .then((found) => {
        if (found) {
          setStartFreshGame(false);
          setShowGame(true);
        }
      })
      .catch(() => {
        console.error('Failed to load saved city');
      });
  };

  // Delete a saved city from the index
  const deleteSavedCity = (city: SavedCityMeta) => {
    // Remove from saved cities index
    const remove = (cities: SavedCityMeta[]) => cities.filter(c => c.id !== city.id);
    setSavedCities(remove);
    updateIsoCitySavedCities(remove).catch(() => {
      console.error('Failed to delete saved city');
    });
    
    // Also remove the city state data if it exists
    if (!city.roomCode) {
      deleteIsoCitySavedCityData(city.id).catch(() => {
        console.error('Failed to delete saved city data');
      });
    }
  };

  // Handle co-op game start
  const handleCoopStart = async (isHost: boolean, initialState?: GameState, roomCode?: string) => {
    setIsMultiplayer(true);
    
    if (isHost && initialState) {
      // Host starts with the state they created - save it so GameProvider loads it
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        await writeIsoCityAutosaveRaw(compressed);
        
        // Also save to saved cities index so it appears on homepage
        if (roomCode) {
          await saveCityToIndex(initialState, roomCode);
        }
      } catch (e) {
        console.error('Failed to save co-op state:', e);
      }
      setStartFreshGame(false);
    } else if (isHost) {
      // Host without state - fallback to fresh game
      setStartFreshGame(true);
    } else if (initialState) {
      // Guest received state from host - save it so GameProvider loads it
      try {
        const compressed = compressToUTF16(JSON.stringify(initialState));
        await writeIsoCityAutosaveRaw(compressed);
        
        // Also save to saved cities index so it appears on homepage
        if (roomCode) {
          await saveCityToIndex(initialState, roomCode);
        }
      } catch (e) {
        console.error('Failed to save co-op state:', e);
      }
      setStartFreshGame(false);
    } else {
      // Guest without state - fallback to fresh game
      setStartFreshGame(true);
    }
    
    setShowGame(true);
  };

  if (isChecking) {
    return (
      <main className="min-h-screen bg-background jaali-bg flex items-center justify-center">
        <div className="flex items-center gap-2 text-sandstone/70">
          <span className="ornament text-marigold animate-diya" aria-hidden />
          <T>Loading...</T>
        </div>
      </main>
    );
  }

  if (showGame) {
    const gameContent = (
      <main className="h-screen w-screen overflow-hidden">
        <CrashSaveRegistrar />
        <Game onExit={handleExitGame} />
        {/* S5-T12: the perf HUD is a developer tool (?dev=1). ?bench= URLs are automated runs. */}
        {isDevMode() && <PerfHud />}
        <BenchmarkRunner />
      </main>
    );

    // Always wrap in MultiplayerContextProvider so players can invite others from within the game
    return (
      <GameErrorBoundary>
        <MultiplayerContextProvider>
          <GameProvider startFresh={startFreshGame} newGameOptions={newGameOptions}>
            {gameContent}
          </GameProvider>
        </MultiplayerContextProvider>
      </GameErrorBoundary>
    );
  }

  const handlePrimary = () => {
    if (!hasSaved) {
      setShowResetDialog(true);
      return;
    }
    setStartFreshGame(false);
    setShowGame(true);
  };

  const handleLoadExample = async () => {
    // Clear any room code from URL to prevent multiplayer conflicts
    if (window.location.search.includes('room=')) {
      window.history.replaceState({}, '', '/');
      setPendingRoomCode(null);
    }
    const response = await fetch('/example-states/example_state_9.json');
    const exampleState = await response.json();
    try {
      const compressed = compressToUTF16(JSON.stringify(exampleState));
      await writeIsoCityAutosaveRaw(compressed);
    } catch (e) {
      console.error('Failed to save example state:', e);
    }
    setStartFreshGame(false);
    setShowGame(true);
  };

  const menu = (
    <div className="flex w-full flex-col gap-3">
      <Button
        onClick={handlePrimary}
        className="press h-14 w-full rounded-xl text-lg font-semibold tracking-wide shadow-[inset_0_1px_0_hsl(48_100%_85%/0.6),0_14px_34px_-12px_hsl(var(--saffron)/0.9)]"
      >
        {hasSaved ? <T>Continue</T> : <T>New Game</T>}
      </Button>

      {FEATURES.coop && (
        <Button
          onClick={() => setShowCoopModal(true)}
          variant="outline"
          className="press h-12 w-full rounded-xl text-base bg-[hsl(233_40%_11%/0.78)] border-gold/35 text-sandstone hover:bg-[hsl(233_40%_15%/0.9)] hover:text-foreground"
        >
          <Users className="w-4 h-4" aria-hidden />
          <T>Co-op</T>
        </Button>
      )}

      <Button
        onClick={handleLoadExample}
        variant="outline"
        className="press h-12 w-full rounded-xl text-base bg-[hsl(233_40%_9%/0.6)] border-sandstone/15 text-sandstone/80 hover:bg-[hsl(233_40%_13%/0.85)] hover:text-sandstone"
      >
        <T>Load Example</T>
      </Button>

      <div className="mt-1 grid w-full grid-cols-[1fr_auto] items-start gap-x-4">
        <div className="flex flex-col">
          <a
            href="https://github.com/amilich/isometric-city"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center text-left text-sm tracking-wide text-sandstone/60 hover:text-marigold transition-colors duration-200"
          >
            <T>Built on IsoCity (MIT licence)</T>
          </a>
          <CreditsButton variant="ghost" className="justify-start h-auto min-h-11 px-0 text-sm tracking-wide text-sandstone/60 hover:text-marigold hover:bg-transparent" />
        </div>
        <div className="flex h-full min-h-[88px] flex-col items-end justify-between">
          <LanguageSelector variant="ghost" className="text-sandstone/60 hover:text-marigold hover:bg-sandstone/[0.06]" />
          {hasResettableProgress && (
            <NewGameResetButton onClick={() => setShowResetDialog(true)} />
          )}
        </div>
      </div>
    </div>
  );

  const savedList = visibleSavedCities.length > 0 && (
    <>
      <h2 className="hud-label mb-2.5 flex items-center gap-1.5 flex-shrink-0">
        <span className="ornament text-gold/80 !w-2.5 !h-2.5" aria-hidden />
        <T>Saved Cities</T>
      </h2>
      <div
        className="flex flex-col gap-2 min-h-0 overflow-y-auto overscroll-y-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        {visibleSavedCities.slice(0, 5).map((city) => (
          <SavedCityCard
            key={city.id}
            city={city}
            onLoad={() => loadSavedCity(city)}
            onDelete={() => deleteSavedCity(city)}
          />
        ))}
      </div>
    </>
  );

  const dialogs = (
    <>
      {FEATURES.coop && (
        <CoopModal
          open={showCoopModal}
          onOpenChange={setShowCoopModal}
          onStartGame={handleCoopStart}
          pendingRoomCode={pendingRoomCode}
        />
      )}
      <NewGameDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        hasSaved={hasSaved}
        onConfirm={handleStartFreshGame}
      />
    </>
  );

  // Mobile landing page
  if (isMobile) {
    return (
      <MultiplayerContextProvider>
        <main className="relative h-[100dvh] max-h-[100dvh] bg-background overflow-hidden">
          <TitleBackdrop compact />
          <div className="relative z-10 h-full flex flex-col items-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto">
            <div className="flex-shrink-0 h-2 sm:h-6" />
            <TitleMark compact />
            <div className="mt-6 w-full max-w-xs flex-shrink-0 animate-rise-in [animation-delay:120ms]">
              {menu}
            </div>
            {visibleSavedCities.length > 0 && (
              <div className="hud-panel gold-hairline w-full max-w-xs mt-4 rounded-2xl p-3 flex-shrink min-h-[8rem] max-h-[40dvh] flex flex-col animate-rise-in [animation-delay:200ms]">
                {savedList}
              </div>
            )}
            <div className="flex-shrink-0 h-2" />
          </div>
          {dialogs}
        </main>
      </MultiplayerContextProvider>
    );
  }

  // Desktop landing page
  return (
    <MultiplayerContextProvider>
      <main className="relative min-h-screen bg-background overflow-hidden">
        <TitleBackdrop />
        <div className="relative z-10 min-h-screen flex flex-col items-center px-8 pt-[max(2.5rem,7vh)] pb-8">
          <TitleMark />
          <div className="mt-8 w-72 animate-rise-in [animation-delay:120ms]">
            {menu}
          </div>
        </div>

        {visibleSavedCities.length > 0 && (
          <aside className="hud-panel gold-hairline absolute z-10 top-8 right-8 w-72 max-h-[min(24rem,45vh)] rounded-2xl p-3.5 flex flex-col animate-rise-in [animation-delay:200ms]">
            {savedList}
          </aside>
        )}

        {dialogs}
      </main>
    </MultiplayerContextProvider>
  );
}

/** The wordmark: Devanagari kicker, display-face title, lotus divider and tagline. */
function TitleMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center animate-rise-in">
      <span
        lang="hi"
        aria-hidden
        className={`font-display text-gold/85 tracking-[0.2em] ${compact ? 'text-base' : 'text-xl'}`}
      >
        वाराणसी
      </span>
      <h1
        className={`font-display text-saffron-gradient leading-[0.95] tracking-wide drop-shadow-[0_4px_24px_hsl(var(--saffron)/0.35)] ${compact ? 'text-6xl mt-1' : 'text-[7.5rem] mt-1'}`}
      >
        Varanasi
      </h1>
      <div className={`flex items-center gap-3 ${compact ? 'mt-2 w-56' : 'mt-3 w-80'}`} aria-hidden>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/70" />
        <span className="ornament text-marigold animate-diya !w-4 !h-4" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/70" />
      </div>
      <p className={`mt-2 tracking-[0.18em] uppercase text-sandstone/85 ${compact ? 'text-xs' : 'text-sm'}`}>
        <T>A city on the Ganga</T>
      </p>
    </div>
  );
}
