// CHANGE SUMMARY: Desktop overlay/minimap visibility persisted via localStorage; state initializes from storage on client mount
// and the save effect skips the first run so defaults are not written over saved prefs during the mount effect flush.
// Earlier state: Overlay mode toggle + minimap were always rendered, and no desktop panel visibility preferences were persisted.

'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { Tool } from '@/types/game';
import { useMobile } from '@/hooks/useMobile';
import { MobileToolbar } from '@/components/mobile/MobileToolbar';
import { MobileTopBar } from '@/components/mobile/MobileTopBar';
import { MobileMiniMapToggle, TouchGestureHint } from '@/components/mobile/MobileMapExtras';
import { TileInfoPanel } from '@/components/game/panels/TileInfoPanel';
import { isDrawModeTool } from '@/lib/touchGestures';
import { msg, useMessages, useGT } from 'gt-next';
import { loadIsocityUiPreferences, saveIsocityUiPreferences } from '@/lib/isocityStorage';
import { formatINR } from '@/lib/format';

// Import shadcn components
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCheatCodes } from '@/hooks/useCheatCodes';
import { VinnieDialog } from '@/components/VinnieDialog';
import { CommandMenu } from '@/components/ui/CommandMenu';
import { TipToast } from '@/components/ui/TipToast';
import { useTipSystem } from '@/hooks/useTipSystem';
import { useGameAudio } from '@/hooks/useGameAudio';
import { useMultiplayerSync } from '@/hooks/useMultiplayerSync';
import { useCopyRoomLink } from '@/hooks/useCopyRoomLink';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import { ShareModal } from '@/components/multiplayer/ShareModal';
import { FEATURES } from '@/lib/features';
import { Copy, Check } from 'lucide-react';

// Import game components
import { OverlayMode } from '@/components/game/types';
import { getOverlayForTool, getOverlayModesForMap } from '@/components/game/overlays';
import { ControlsHelpDialog } from '@/components/game/ControlsHelpDialog';
import { useKeyboardControls } from '@/hooks/useKeyboardControls';
import { createSharedControlsState, SharedControlsState } from '@/lib/controlsConfig';
import { OverlayModeToggle } from '@/components/game/OverlayModeToggle';
import { Sidebar } from '@/components/game/Sidebar';
import {
  BudgetPanel,
  StatisticsPanel,
  SettingsPanel,
  AdvisorsPanel,
} from '@/components/game/panels';
import { MiniMap } from '@/components/game/MiniMap';
import { TopBar, StatsPanel } from '@/components/game/TopBar';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';
import { NotificationToasts } from '@/components/game/NotificationToasts';
import { NotificationLog } from '@/components/game/NotificationLog';
import { CityStatusChips, CrisisPauseBanner } from '@/components/game/CityStatusChips';
import { GettingStartedChecklist } from '@/components/game/GettingStartedChecklist';
import { FailureOverlays } from '@/components/game/FailureOverlays';
import { FestivalEventBanner, FestivalEventPanel, festivalFromEventId } from '@/components/game/FestivalPanel';
import type { FestivalId } from '@/lib/festivals';
import { CitizenFeed } from '@/components/game/CitizenFeed';
import type { AdvisorNote } from '@/lib/advisors';
import { LandmarkBulldozeDialog } from '@/components/game/LandmarkBulldozeDialog';
import type { Notification } from '@/types/game';

// Cargo type names for notifications
const CARGO_TYPE_NAMES = [msg('containers'), msg('bulk materials'), msg('oil')];

type ViewportState = {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
};

type MiniMapViewportListener = (viewport: ViewportState | null) => void;

export default function Game({ onExit }: { onExit?: () => void }) {
  const gt = useGT();
  const m = useMessages();
  const { state, latestStateRef, setTool, setActivePanel, addMoney, addNotification, setSpeed } = useGame();
  // S5-T9: music, sound effects and ambient
  useGameAudio(state, latestStateRef);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  // S2-T8: the top-bar Ganga Health chip toggles the Ganga overlay.
  const toggleGangaOverlay = useCallback(() => {
    setOverlayMode(mode => (mode === 'ganga' ? 'none' : 'ganga'));
  }, []);
  const togglePowerOverlay = useCallback(() => {
    setOverlayMode(mode => (mode === 'power' ? 'none' : 'power'));
  }, []);
  const toggleWaterOverlay = useCallback(() => {
    setOverlayMode(mode => (mode === 'water' ? 'none' : 'water'));
  }, []);
  // Read from localStorage on first client render so we never persist the default `true,true`
  // in the same effect flush as hydration (that was overwriting saved prefs on every mount).
  const [showOverlayPanel, setShowOverlayPanel] = useState(() =>
    typeof window === 'undefined' ? true : loadIsocityUiPreferences().showOverlayPanel,
  );
  const [showMinimap, setShowMinimap] = useState(() =>
    typeof window === 'undefined' ? true : loadIsocityUiPreferences().showMinimap,
  );
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  // A replaced city (load, import, new game, resize) bumps gameVersion: the old selection means nothing there
  const [selectionGameVersion, setSelectionGameVersion] = useState(state.gameVersion);
  if (selectionGameVersion !== state.gameVersion) {
    setSelectionGameVersion(state.gameVersion);
    setSelectedTile(null);
  }
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number; instant?: boolean } | null>(null);
  const clearNavigationTarget = useCallback(() => setNavigationTarget(null), []);
  // Minimap (desktop and mobile): a press glides, a drag moves the camera directly
  const navigateFromMiniMap = useCallback((x: number, y: number, instant?: boolean) => setNavigationTarget({ x, y, instant }), []);
  // Crisis notifications (S4-T4): jump to the problem and show the overlay that explains it
  // S5-T4: the Event panel opens from a festival forecast notification, the calendar strip or the banner
  const [eventPanel, setEventPanel] = useState<FestivalId | null>(null);
  const closeEventPanel = useCallback(() => setEventPanel(null), []);
  const openCalendarEvent = useCallback((id: string) => {
    const festival = festivalFromEventId(id);
    if (festival) setEventPanel(festival);
  }, []);
  const locateEventArea = useCallback((x: number, y: number, overlay: OverlayMode | undefined) => {
    setNavigationTarget({ x, y });
    if (overlay) setOverlayMode(overlay);
  }, []);
  const locateNotification = useCallback((n: Notification) => {
    if (n.x !== undefined && n.y !== undefined) setNavigationTarget({ x: n.x, y: n.y });
    if (n.overlay) setOverlayMode(n.overlay);
    const festival = festivalFromEventId(n.id);
    if (festival) setEventPanel(festival);
  }, []);
  const resumeAfterCrisis = useCallback(() => setSpeed(1), [setSpeed]);
  // Advisor "Show me" (S5-T6) and citizen feed (S5-T7): same jump as notifications
  const showAdvisorNote = useCallback((note: AdvisorNote) => {
    if (note.x !== undefined && note.y !== undefined) setNavigationTarget({ x: note.x, y: note.y });
    if (note.overlay) setOverlayMode(note.overlay as OverlayMode);
  }, []);
  const locateTile = useCallback((x: number, y: number) => setNavigationTarget({ x, y }), []);
  const minimapViewportRef = useRef<ViewportState | null>(null);
  const minimapViewportListenersRef = useRef<Set<MiniMapViewportListener>>(new Set());
  const isInitialMount = useRef(true);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;
  const [showShareModal, setShowShareModal] = useState(false);
  const skipInitialUiPrefsSave = useRef(true);
  const multiplayer = useMultiplayerOptional();
  // Keyboard/camera state shared between useKeyboardControls and the canvas (S1-T10)
  const controlsRef = useRef<SharedControlsState>(createSharedControlsState());
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const openControlsHelp = useCallback(() => setShowControlsHelp(true), []);
  // S1-T11 (touch): Draw mode makes a one-finger drag draw roads/rail/zones instead of panning.
  const [touchDrawMode, setTouchDrawMode] = useState(false);
  // Picking a road / rail / zone tool turns Draw on (so a drag draws, not pans); Select turns it off.
  // The player can still flip the Draw button by hand afterwards.
  useEffect(() => {
    if (isDrawModeTool(state.selectedTool)) setTouchDrawMode(true);
    else if (state.selectedTool === 'select') setTouchDrawMode(false);
  }, [state.selectedTool]);
  // S1-T11 (touch): a long-press inspects a tile with any tool. Remember the tool it was inspected
  // with, so the tile info stays open for that tool and closes when the player switches tools.
  const [selectedTileTool, setSelectedTileTool] = useState<Tool>('select');
  const selectedToolForTile = state.selectedTool;
  const selectTileOnMobile = useCallback((tile: { x: number; y: number } | null) => {
    setSelectedTile(tile);
    setSelectedTileTool(selectedToolForTile);
  }, [selectedToolForTile]);
  
  // Cheat code system
  const {
    triggeredCheat,
    showVinnieDialog,
    setShowVinnieDialog,
    clearTriggeredCheat,
  } = useCheatCodes();
  
  // Tip system for helping new players
  const {
    currentTip,
    isVisible: isTipVisible,
    onContinue: onTipContinue,
    onSkipAll: onTipSkipAll,
  } = useTipSystem(state);
  
  // Multiplayer sync
  const {
    isMultiplayer,
    isHost,
    playerCount,
    roomCode,
    players,
    broadcastPlace,
    leaveRoom,
  } = useMultiplayerSync();
  
  const { copied: copiedRoomLink, handleCopyRoomLink } = useCopyRoomLink(roomCode, 'coop');
  const initialSelectedToolRef = useRef<Tool | null>(null);
  const previousSelectedToolRef = useRef<Tool | null>(null);
  const hasCapturedInitialTool = useRef(false);
  const currentSelectedToolRef = useRef<Tool>(state.selectedTool);

  const handleViewportChange = useCallback((nextViewport: ViewportState) => {
    const previousViewport = minimapViewportRef.current;
    const changed = !previousViewport
      || previousViewport.offset.x !== nextViewport.offset.x
      || previousViewport.offset.y !== nextViewport.offset.y
      || previousViewport.zoom !== nextViewport.zoom
      || previousViewport.canvasSize.width !== nextViewport.canvasSize.width
      || previousViewport.canvasSize.height !== nextViewport.canvasSize.height;

    if (!changed) return;

    minimapViewportRef.current = nextViewport;

    minimapViewportListenersRef.current.forEach((listener) => {
      listener(nextViewport);
    });
  }, []);

  const subscribeMiniMapViewport = useCallback((listener: MiniMapViewportListener) => {
    minimapViewportListenersRef.current.add(listener);

    if (minimapViewportRef.current) {
      listener(minimapViewportRef.current);
    }

    return () => {
      minimapViewportListenersRef.current.delete(listener);
    };
  }, []);
  
  // Keep currentSelectedToolRef in sync with state
  useEffect(() => {
    currentSelectedToolRef.current = state.selectedTool;
  }, [state.selectedTool]);
  
  // Track the initial selectedTool after localStorage loads (with a small delay to allow state to load)
  useEffect(() => {
    if (!hasCapturedInitialTool.current) {
      // Use a timeout to ensure localStorage state has loaded
      const timeoutId = setTimeout(() => {
        initialSelectedToolRef.current = currentSelectedToolRef.current;
        previousSelectedToolRef.current = currentSelectedToolRef.current;
        hasCapturedInitialTool.current = true;
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, []); // Only run once on mount
  
  // Auto-set overlay when selecting utility tools (but not on initial page load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Select tool always resets overlay to none (user is explicitly switching to select)
    if (state.selectedTool === 'select') {
      setTimeout(() => {
        setOverlayMode('none');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
      return;
    }
    
    // Subway tool sets overlay when actively selected (not on page load)
    if (state.selectedTool === 'subway' || state.selectedTool === 'subway_station') {
      setTimeout(() => {
        setOverlayMode('subway');
      }, 0);
      previousSelectedToolRef.current = state.selectedTool;
      return;
    }
    
    // Don't auto-set overlay until we've captured the initial tool
    if (!hasCapturedInitialTool.current) {
      return;
    }
    
    // Don't auto-set overlay if this matches the initial tool from localStorage
    if (initialSelectedToolRef.current !== null && 
        initialSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Don't auto-set overlay if tool hasn't changed
    if (previousSelectedToolRef.current === state.selectedTool) {
      return;
    }
    
    // Update previous tool reference
    previousSelectedToolRef.current = state.selectedTool;
    
    setTimeout(() => {
      setOverlayMode(getOverlayForTool(state.selectedTool));
    }, 0);
  }, [state.selectedTool]);
  
  // All keyboard shortcuts (bindings in src/lib/controlsConfig.ts KEY_BINDINGS)
  const overlayOrder = useMemo(() => getOverlayModesForMap(state.mapId), [state.mapId]);
  useKeyboardControls({
    controlsRef,
    overlayMode,
    setOverlayMode,
    // Tab cycles overlays in the same order as the overlay toolbar (only this map's overlays)
    overlayOrder: overlayOrder,
    activePanel: state.activePanel,
    setActivePanel,
    selectedTile,
    setSelectedTile,
    selectedTool: state.selectedTool,
    setTool,
    speed: state.speed,
    setSpeed,
    onShowHelp: openControlsHelp,
  });

  // Handle cheat code triggers
  useEffect(() => {
    if (!triggeredCheat) return;

    switch (triggeredCheat.type) {
      case 'konami':
        addMoney(triggeredCheat.amount);
        addNotification(
          gt('Retro Cheat Activated!'),
          gt('Your accountants are confused but not complaining. You received {amount}!', { amount: formatINR(triggeredCheat.amount) }),
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'motherlode':
        addMoney(triggeredCheat.amount);
        addNotification(
          gt('Motherlode!'),
          gt('Your treasury just got a lot heavier. You received {amount}!', { amount: formatINR(triggeredCheat.amount) }),
          'trophy'
        );
        clearTriggeredCheat();
        break;

      case 'vinnie':
        // Vinnie dialog is handled by VinnieDialog component
        clearTriggeredCheat();
        break;
    }
  }, [triggeredCheat, addMoney, addNotification, clearTriggeredCheat, gt]);

  useEffect(() => {
    if (skipInitialUiPrefsSave.current) {
      skipInitialUiPrefsSave.current = false;
      return;
    }
    saveIsocityUiPreferences({ showOverlayPanel, showMinimap });
  }, [showOverlayPanel, showMinimap]);
  
  // Track barge deliveries to show occasional notifications
  const bargeDeliveryCountRef = useRef(0);
  
  // Handle barge cargo delivery - adds money to the city treasury
  const handleBargeDelivery = useCallback((cargoValue: number, cargoType: number) => {
    addMoney(cargoValue);
    bargeDeliveryCountRef.current++;

    // Show a notification every 5 deliveries to avoid spam
    if (bargeDeliveryCountRef.current % 5 === 1) {
      const cargoName = CARGO_TYPE_NAMES[cargoType] || msg('cargo');
      addNotification(
        gt('Cargo Delivered'),
        gt('A shipment of {cargoName} has arrived at the marina. +{cargoValue} trade revenue.', { cargoName: m(cargoName), cargoValue: formatINR(cargoValue) }),
        'ship'
      );
    }
  }, [addMoney, addNotification, gt, m]);

  // Mobile layout
  if (isMobile) {
    const mobileSelectedTile = selectedTile && (state.selectedTool === 'select' || state.selectedTool === selectedTileTool)
      ? state.grid[selectedTile.y]?.[selectedTile.x] ?? null
      : null;
    return (
      <TooltipProvider>
        <div className="w-full h-full overflow-hidden bg-background flex flex-col">
          {/* Mobile Top Bar */}
          <MobileTopBar
            gangaOverlayActive={overlayMode === 'ganga'}
            onToggleGangaOverlay={toggleGangaOverlay}
            overlayMode={overlayMode}
            onTogglePowerOverlay={togglePowerOverlay}
            onToggleWaterOverlay={toggleWaterOverlay}
            onCalendarEventClick={openCalendarEvent}
            onShare={FEATURES.coop ? () => setShowShareModal(true) : undefined}
            onExit={onExit}
          />
          
          {/* Share Modal for mobile co-op */}
          {FEATURES.coop && multiplayer && (
            <ShareModal
              open={showShareModal}
              onOpenChange={setShowShareModal}
            />
          )}
          
          {/* Main canvas area - fills remaining space, with padding for top/bottom bars */}
          <div className="flex-1 relative overflow-hidden" style={{ paddingTop: 'calc(72px + env(safe-area-inset-top))', paddingBottom: 'calc(76px + env(safe-area-inset-bottom))' }}>
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={selectTileOnMobile}
              isMobile={true}
              navigationTarget={navigationTarget}
              onNavigationComplete={clearNavigationTarget}
              onBargeDelivery={handleBargeDelivery}
              controlsRef={controlsRef}
              touchDrawMode={touchDrawMode}
              onViewportChange={handleViewportChange}
            />
            {/* B4: minimap toggle (opens the shared MiniMap in an overlay) */}
            <MobileMiniMapToggle
              onNavigate={navigateFromMiniMap}
              onViewportSubscribe={subscribeMiniMapViewport}
              className="absolute right-3 bottom-[calc(140px+env(safe-area-inset-bottom))] z-20"
            />
            {/* Top HUD column: tip first, notifications stack under it (never overlap) */}
            <div className="absolute top-[calc(80px+env(safe-area-inset-top))] left-3 right-3 z-30 flex flex-col gap-2 pointer-events-none">
              {/* Notification log, crisis status and the crisis pause line (A2/A3) */}
              <div className="flex items-start gap-2">
                <NotificationLog notifications={state.notifications} onLocate={locateNotification} />
                <CityStatusChips state={state} onOverlay={setOverlayMode} onLocate={locateEventArea} onOpenFestival={setEventPanel} className="flex-1 pt-1" />
              </div>
              <CrisisPauseBanner speed={state.speed} notifications={state.notifications} onResume={resumeAfterCrisis} />
              <TouchGestureHint selectedTool={state.selectedTool} />
              <TipToast
                message={currentTip || ''}
                isVisible={isTipVisible}
                onContinue={onTipContinue}
                onSkipAll={onTipSkipAll}
                className="w-full"
              />
              <NotificationToasts
                notifications={state.notifications}
                onLocate={locateNotification}
              />
              <GettingStartedChecklist key={state.id} cityId={state.id} compact className="self-start w-[min(16rem,100%)]" />
            </div>
            <FailureOverlays bannerClassName="absolute bottom-[132px] left-3 right-3 z-30" onExit={onExit} />
            <FestivalEventBanner state={state} onOpen={setEventPanel} className="absolute bottom-[184px] left-3 z-20" />
            <FestivalEventPanel festivalId={eventPanel} state={state} onClose={closeEventPanel} onLocate={locateEventArea} />
            <CitizenFeed
              compact
              onLocate={locateTile}
              className="absolute bottom-[84px] left-3 z-20 w-[min(18rem,calc(100%-1.5rem))]"
            />
            
            {/* Multiplayer Players Indicator - Mobile */}
            {isMultiplayer && (
              <div className="absolute top-2 right-2 z-20">
                <div className="hud-glass rounded-xl px-2 py-1.5 shadow-lg">
                  <div className="flex items-center gap-1.5 text-xs text-white">
                    {roomCode && (
                      <>
                        <span className="font-mono tracking-wider">{roomCode}</span>
                        <button
                          onClick={handleCopyRoomLink}
                          className="p-0.5 hover:bg-white/10 rounded transition-colors"
                          title="Copy invite link"
                        >
                          {copiedRoomLink ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                  {players.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {players.map((player) => (
                        <div key={player.id} className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {player.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Tile info: the shared TileInfoPanel as a bottom sheet (Select tool, or a long-press with any tool) */}
          {mobileSelectedTile && (
            <TileInfoPanel
              isMobile
              tile={mobileSelectedTile}
              services={state.services}
              onClose={() => setSelectedTile(null)}
            />
          )}

          {/* Mobile Bottom Toolbar */}
          <MobileToolbar
            onOpenPanel={(panel) => setActivePanel(panel)}
            overlayMode={overlayMode}
            setOverlayMode={setOverlayMode}
            drawMode={touchDrawMode}
            onDrawModeChange={setTouchDrawMode}
          />
          
          {/* Panels - render as fullscreen modals on mobile */}
          {state.activePanel === 'budget' && <BudgetPanel />}
          {state.activePanel === 'statistics' && <StatisticsPanel />}
          <LandmarkBulldozeDialog />
          {state.activePanel === 'advisors' && <AdvisorsPanel onShowMe={showAdvisorNote} />}
          {state.activePanel === 'settings' && <SettingsPanel />}
          
          <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
          
        </div>
      </TooltipProvider>
    );
  }

  // Desktop layout
  return (
    <TooltipProvider>
      <div className="w-full h-full min-h-[720px] overflow-hidden bg-background flex">
        <Sidebar onExit={onExit} />
        
        <div className="flex-1 flex flex-col ml-56">
          <TopBar
            showOverlayPanel={showOverlayPanel}
            showMinimap={showMinimap}
            onToggleOverlayPanel={setShowOverlayPanel}
            onToggleMinimap={setShowMinimap}
            gangaOverlayActive={overlayMode === 'ganga'}
            onToggleGangaOverlay={toggleGangaOverlay}
            overlayMode={overlayMode}
            onTogglePowerOverlay={togglePowerOverlay}
            onToggleWaterOverlay={toggleWaterOverlay}
            onCalendarEventClick={openCalendarEvent}
          />
          <StatsPanel />
          <div className="flex-1 relative overflow-visible">
            <CanvasIsometricGrid 
              overlayMode={overlayMode} 
              selectedTile={selectedTile} 
              setSelectedTile={setSelectedTile}
              navigationTarget={navigationTarget}
              onNavigationComplete={clearNavigationTarget}
              onViewportChange={handleViewportChange}
              onBargeDelivery={handleBargeDelivery}
              controlsRef={controlsRef}
            />
            {/* Top-left HUD column: notification log + crisis status, the crisis pause line, then toasts (A2/A3) */}
            <div className="absolute top-3 left-4 z-30 w-[min(24rem,calc(100%-26rem))] flex flex-col gap-2 pointer-events-none">
              <div className="flex items-start gap-2">
                <NotificationLog notifications={state.notifications} onLocate={locateNotification} />
                <CityStatusChips state={state} onOverlay={setOverlayMode} onLocate={locateEventArea} onOpenFestival={setEventPanel} className="flex-1 pt-1.5" />
              </div>
              <CrisisPauseBanner speed={state.speed} notifications={state.notifications} onResume={resumeAfterCrisis} />
              <NotificationToasts notifications={state.notifications} onLocate={locateNotification} />
            </div>
            {/* Bottom centre sits above the overlay bar (bottom-left) and clear of the minimap (bottom-right) */}
            <FailureOverlays bannerClassName="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-[min(24rem,calc(100%-2rem))]" onExit={onExit} />
            <FestivalEventBanner state={state} onOpen={setEventPanel} className="absolute bottom-[168px] left-1/2 -translate-x-1/2 z-20" />
            <FestivalEventPanel festivalId={eventPanel} state={state} onClose={closeEventPanel} onLocate={locateEventArea} />
            <CitizenFeed
              onLocate={locateTile}
              className={`absolute left-4 z-20 w-72 ${showOverlayPanel ? 'bottom-24' : 'bottom-4'}`}
            />
            {showOverlayPanel && (
              <OverlayModeToggle overlayMode={overlayMode} setOverlayMode={setOverlayMode} mapId={state.mapId} />
            )}
            {showMinimap && (
              <MiniMap onNavigate={navigateFromMiniMap} onViewportSubscribe={subscribeMiniMapViewport} />
            )}
            
            {/* Right HUD column: multiplayer card, then the tip (never over the feed or overlay bar) */}
            <div className="absolute top-3 right-4 z-30 w-[22rem] flex flex-col items-end gap-2 pointer-events-none">
            {isMultiplayer && (
              <div className="pointer-events-auto">
                <div className="hud-glass rounded-xl px-3 py-2 shadow-lg min-w-[120px]">
                  <div className="flex items-center gap-2 text-sm text-white">
                    {roomCode && (
                      <>
                        <span className="font-mono font-medium tracking-wider">{roomCode}</span>
                        <button
                          onClick={handleCopyRoomLink}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                          title="Copy invite link"
                        >
                          {copiedRoomLink ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                  {players.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {players.map((player) => (
                        <div key={player.id} className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          {player.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
              <TipToast
                message={currentTip || ''}
                isVisible={isTipVisible}
                onContinue={onTipContinue}
                onSkipAll={onTipSkipAll}
                className="w-full"
              />
              <GettingStartedChecklist key={state.id} cityId={state.id} className="w-64" />
            </div>
          </div>
        </div>
        
        {state.activePanel === 'budget' && <BudgetPanel />}
        {state.activePanel === 'statistics' && <StatisticsPanel />}
        <LandmarkBulldozeDialog />
        {state.activePanel === 'advisors' && <AdvisorsPanel onShowMe={showAdvisorNote} />}
        {state.activePanel === 'settings' && <SettingsPanel />}
        <ControlsHelpDialog open={showControlsHelp} onOpenChange={setShowControlsHelp} />
        
        <VinnieDialog open={showVinnieDialog} onOpenChange={setShowVinnieDialog} />
        <CommandMenu />
        
      </div>
    </TooltipProvider>
  );
}
