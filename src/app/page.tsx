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
import { T, Var } from 'gt-next';
import { Users, X } from 'lucide-react';
import {
  backupIsoCityAutosave,
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
import { localizeExampleState } from '@/lib/exampleCity';

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
        className="press title-well w-full text-left p-3 pr-11 rounded-xl hover:!border-gold/40 hover:bg-[hsl(233_40%_14%/0.8)]"
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onConfirm({ mapId, name });
            }
          }}
        />
        {hasSaved && (
          <p className="text-xs text-amber-900">
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
  const [cityToDelete, setCityToDelete] = useState<SavedCityMeta | null>(null);
  const { isMobileDevice, isSmallScreen, isTouchDevice, screenHeight } = useMobile();
  // A phone held sideways is wide but short: it gets the phone layout too (as in Game.tsx).
  const isMobile = isMobileDevice || isSmallScreen || (isTouchDevice && screenHeight > 0 && screenHeight < 600);
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
    
    // Otherwise copy it into the autosave slot, which GameProvider loads.
    // First keep the current autosave city as "<name> (auto-backup)" (5b).
    backupIsoCityAutosave(city.id)
      .catch((e) => console.error('Failed to back up the current city:', e))
      .then(() => copyIsoCitySavedCityToAutosave(city.id))
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
      <main className="theme-dark min-h-screen bg-background title-jaali flex items-center justify-center">
        <div className="flex items-center gap-2 text-sandstone/90">
          <span className="title-lotus text-marigold animate-diya" aria-hidden />
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
    const exampleState = localizeExampleState(await response.json());
    try {
      const compressed = compressToUTF16(JSON.stringify(exampleState));
      await writeIsoCityAutosaveRaw(compressed);
    } catch (e) {
      console.error('Failed to save example state:', e);
    }
    setStartFreshGame(false);
    setShowGame(true);
  };

  // Every menu button shares one shape (height, radius, type); only the fill differs.
  // Backgrounds are opaque so nothing behind a button ever shows through.
  const titleButton = 'press h-11 w-full gap-2 rounded-xl text-base font-semibold tracking-wide';
  const secondaryButton = `${titleButton} border border-gold/35 bg-[hsl(var(--hud-top))] text-sandstone hover:border-gold/60 hover:bg-secondary hover:text-foreground`;

  const menu = (
    <div className="flex w-full flex-col gap-2.5">
      <Button
        onClick={handlePrimary}
        className={`${titleButton} bg-chrome-accent text-chrome-accentText hover:bg-chrome-accent hover:brightness-110 shadow-[inset_0_1px_0_hsl(var(--chrome-accentText)/0.25),0_10px_28px_-14px_hsl(var(--saffron)/0.8)]`}
      >
        {hasSaved ? <T>Continue</T> : <T>New Game</T>}
      </Button>

      {hasSaved && (
        <Button onClick={() => setShowResetDialog(true)} variant="outline" className={secondaryButton}>
          <T>New Game</T>
        </Button>
      )}

      {FEATURES.coop && (
        <Button onClick={() => setShowCoopModal(true)} variant="outline" className={secondaryButton}>
          <Users className="w-4 h-4" aria-hidden />
          <T>Co-op</T>
        </Button>
      )}

      {/* Developer tool (?dev=1): it writes an example city over the autosave */}
      {isDevMode() && (
        <Button
          onClick={handleLoadExample}
          variant="outline"
          className={`${secondaryButton} border-sandstone/20 text-sandstone/75 hover:border-sandstone/40`}
        >
          <T>Load Example</T>
        </Button>
      )}
    </div>
  );

  // One centred group; every item gets the same side padding so the dots sit evenly between them.
  const footerItem = 'min-h-11 px-2 text-sm tracking-wide text-sandstone/60 hover:text-marigold hover:bg-transparent transition-colors duration-200';
  const footerDot = <span className="text-sandstone/30 select-none" aria-hidden>·</span>;
  const footer = (
    <div className="flex w-full flex-wrap items-center justify-center whitespace-nowrap">
      <a
        href="https://github.com/amilich/isometric-city"
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center ${footerItem}`}
      >
        <T>Built on IsoCity</T>
      </a>
      {footerDot}
      <CreditsButton variant="ghost" className={`h-auto ${footerItem}`} />
      {footerDot}
      <LanguageSelector variant="ghost" className={`h-11 gap-1.5 [&>span]:text-sm ${footerItem}`} />
    </div>
  );

  const savedList = visibleSavedCities.length > 0 && (
    <>
      <h2 className="title-label mb-2.5 flex items-center gap-1.5 flex-shrink-0">
        <span className="title-lotus text-gold/80 !w-2.5 !h-2.5" aria-hidden />
        <T>Saved Cities</T>
      </h2>
      <div
        className="flex flex-col gap-2 min-h-0 overflow-y-auto overscroll-y-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        {visibleSavedCities.slice(0, 5).map((city) => cityToDelete?.id === city.id ? (
          // Same two-step confirm as the Settings saved-cities list
          <div key={city.id} className="hud-well rounded-xl p-3 space-y-2">
            <p className="text-xs text-sandstone/80 text-center">
              <T>Delete <span className="font-semibold"><Var>{city.cityName}</Var></span>? This cannot be undone.</T>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 min-h-11" onClick={() => setCityToDelete(null)}>
                <T>Cancel</T>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 min-h-11"
                onClick={() => {
                  deleteSavedCity(city);
                  setCityToDelete(null);
                }}
              >
                <T>Delete</T>
              </Button>
            </div>
          </div>
        ) : (
          <SavedCityCard
            key={city.id}
            city={city}
            onLoad={() => loadSavedCity(city)}
            onDelete={() => setCityToDelete(city)}
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
        <main className="theme-dark title-stage title-stage-compact relative h-[100dvh] max-h-[100dvh] bg-background overflow-hidden">
          <TitleBackdrop compact />
          <div className="relative z-10 h-full flex flex-col items-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto short:grid short:grid-cols-2 short:content-center short:items-start short:gap-x-8 short:px-8">
            {/* Top spacer and the menu block share the free height, so title + menu sit centred above the skyline */}
            <div className="flex-1 short:hidden" aria-hidden />
            <div className="flex-shrink-0 short:row-span-3 short:justify-self-center short:self-start"><TitleMark compact /></div>
            <div className="flex w-full max-w-xs min-h-0 flex-[1_1_auto] flex-col">
              <div className="mt-6 short:mt-0 w-full flex-shrink-0 animate-rise-in [animation-delay:120ms]">
                {menu}
              </div>
              {visibleSavedCities.length > 0 && (
                <div className="title-panel w-full mt-4 rounded-2xl p-3 min-h-[7rem] max-h-[40dvh] short:mt-2 short:min-h-0 short:max-h-24 flex flex-col animate-rise-in [animation-delay:200ms]">
                  {savedList}
                </div>
              )}
            </div>
            {/* Keeps the block above out of the skyline band (the footer sits in the river below it) */}
            <div className="title-skyline-spacer short:hidden" aria-hidden />
            <div className="w-full max-w-xs flex-shrink-0 pt-3 short:pt-1">{footer}</div>
          </div>
          {dialogs}
        </main>
      </MultiplayerContextProvider>
    );
  }

  // Desktop landing page
  return (
    <MultiplayerContextProvider>
      <main className="theme-dark title-stage relative min-h-[100dvh] bg-background overflow-hidden">
        <TitleBackdrop />
        {/* The stage ends where the skyline band begins (padding = --title-reserve), so nothing in it can reach the art */}
        <div className="relative z-10 flex h-[100dvh] min-h-[36rem] flex-col items-center px-8 pt-[clamp(1rem,3dvh,2rem)] pb-[var(--title-reserve)]">
          {/* Equal growth for this spacer and the menu block centres title + menu in the stage */}
          <div className="flex-1" aria-hidden />
          <TitleMark />
          <div className="relative mt-[clamp(1.25rem,3.5dvh,2.5rem)] flex w-full min-h-0 flex-[1_1_auto] justify-center">
            <div className="w-60 animate-rise-in [animation-delay:120ms]">
              {menu}
            </div>
            {/* Beside the menu (not under it) so it never pushes the menu down; capped at the stage bottom */}
            {visibleSavedCities.length > 0 && (
              <aside className="title-panel absolute top-0 left-[calc(50%+9rem)] w-[min(18rem,calc(50%-9rem))] max-h-[min(18rem,100%)] rounded-2xl p-3.5 flex flex-col animate-rise-in [animation-delay:200ms]">
                {savedList}
              </aside>
            )}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 px-8">{footer}</div>

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
        className={`font-display text-gold/85 tracking-[0.2em] ${compact ? 'text-base' : 'text-[length:clamp(1rem,2dvh,1.25rem)] leading-[1.4]'}`}
      >
        वाराणसी
      </span>
      {/* Desktop: 120px from ~1000px tall, scaling down to 72px so short screens keep the menu clear */}
      <h1
        className={`font-display text-saffron-gradient leading-[0.95] tracking-wide drop-shadow-[0_4px_24px_hsl(var(--saffron)/0.35)] ${compact ? 'text-6xl mt-1' : 'text-[length:clamp(4.5rem,12dvh,7.5rem)] mt-1'}`}
      >
        Varanasi
      </h1>
      <div className={`flex items-center gap-3 ${compact ? 'mt-2 w-56' : 'mt-3 w-80'}`} aria-hidden>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/70" />
        <span className="title-lotus text-marigold animate-diya !w-4 !h-4" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/70" />
      </div>
      <p className={`mt-2 tracking-[0.18em] uppercase text-sandstone/85 ${compact ? 'text-xs' : 'text-sm'}`}>
        <T>A city on the Ganga</T>
      </p>
    </div>
  );
}
