'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { msg, useGT, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { useAdvisorNotes } from '@/hooks/useAdvisorNotes';
import { Tool, TOOL_INFO } from '@/types/game';

// Translatable category labels
const CATEGORY_LABELS: Record<string, unknown> = {
  TOOLS: msg('Tools'),
  ZONES: msg('Zones'),
  tools: msg('Tools'),
  zones: msg('Zones'),
  zoning: msg('Zoning'),
  expandCity: msg('Expand City'),
  services: msg('Services'),
  parks: msg('Parks'),
  sports: msg('Sports'),
  waterfront: msg('Waterfront'),
  community: msg('Community'),
  utilities: msg('Utilities'),
  special: msg('Special'),
  riverfront: msg('Riverfront'),
  landmarks: msg('Landmarks'),
};

// UI labels for translation
const UI_LABELS = {
  budget: msg('Budget'),
  statistics: msg('Statistics'),
  advisors: msg('Advisors'),
  settings: msg('Settings'),
};
import {
  BudgetIcon,
  ChartIcon,
  AdvisorIcon,
  SettingsIcon,
} from '@/components/ui/Icons';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { openCommandMenu } from '@/components/ui/CommandMenu';
import { Users } from 'lucide-react';
import { ShareModal } from '@/components/multiplayer/ShareModal';
import { FEATURES } from '@/lib/features';
import { useMultiplayerOptional } from '@/context/MultiplayerContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatIndianNumber, formatINR } from '@/lib/format';
import { getToolDisplay, LANDMARK_TOOLS, RIVERFRONT_TOOLS, visibleTools } from '@/games/isocity/maps/varanasiCatalog';
import { getLandmarkMenuStatus, hasUnseenLandmarks, isLandmarkType, LANDMARKS, type LandmarkMenuStatus } from '@/lib/landmarks';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { ToolGlyph, CATEGORY_ICONS } from '@/components/game/ToolGlyph';

/** Shared look for a sidebar category row. */
const CATEGORY_ROW = 'press w-full justify-between gap-2.5 pl-2 pr-2.5 min-h-11 h-auto text-sm rounded-lg';
const CATEGORY_ICON = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sandstone/[0.06] ring-1 ring-gold/15 text-gold';
const FLYOUT_CLASS = 'fixed w-72 hud-panel rounded-xl overflow-hidden animate-submenu-in';
const FLYOUT_SHADOW = '0 18px 44px -12px rgba(0, 0, 0, 0.75), inset 0 1px 0 hsl(40 90% 88% / 0.07)';

// Hover Submenu Component for collapsible tool categories
// Implements triangle-rule safe zone for forgiving cursor navigation
const HoverSubmenu = React.memo(function HoverSubmenu({
  label,
  tools,
  selectedTool,
  money,
  onSelectTool,
  forceOpenUpward = false,
  mapId,
  toolStatus,
  glow = false,
  onOpen,
  icon,
}: {
  icon?: React.ReactNode;
  label: unknown; // Message object from msg() for translation
  tools: Tool[];
  selectedTool: Tool;
  money: number;
  onSelectTool: (tool: Tool) => void;
  forceOpenUpward?: boolean;
  mapId?: MapId;
  /** Landmarks (S5-T1): locked tools are greyed with a lock, built ones say "Built". */
  toolStatus?: Partial<Record<Tool, LandmarkMenuStatus>>;
  /** Pulses the category button (a landmark was unlocked and not seen yet). */
  glow?: boolean;
  onOpen?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const m = useMessages();
  const gt = useGT();
  
  const hasSelectedTool = tools.includes(selectedTool);
  const SUBMENU_GAP = 12; // Gap between sidebar and submenu
  const SUBMENU_MAX_HEIGHT = 380; // Approximate max height of submenu
  
  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    // Calculate position based on button location
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Check if opening downward would overflow the screen
      const spaceBelow = viewportHeight - rect.top;
      const openUpward = forceOpenUpward || (spaceBelow < SUBMENU_MAX_HEIGHT && rect.top > SUBMENU_MAX_HEIGHT);
      
      setMenuPosition({
        top: openUpward ? rect.bottom : rect.top,
        left: rect.right + SUBMENU_GAP,
        buttonHeight: rect.height,
        openUpward,
      });
    }
    setIsOpen(true);
    onOpen?.();
  }, [clearCloseTimeout, forceOpenUpward, onOpen]);
  
  // Triangle rule: Check if cursor is moving toward the submenu
  const isMovingTowardSubmenu = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current || !submenuRef.current) return false;
    
    const submenuRect = submenuRef.current.getBoundingClientRect();
    const currentX = e.clientX;
    const currentY = e.clientY;
    const lastX = lastMousePos.current.x;
    const lastY = lastMousePos.current.y;
    
    // Check if moving rightward (toward submenu)
    const movingRight = currentX > lastX;
    
    // Check if cursor is within vertical bounds of submenu (with generous padding)
    const padding = 50;
    const withinVerticalBounds = 
      currentY >= submenuRect.top - padding && 
      currentY <= submenuRect.bottom + padding;
    
    return movingRight && withinVerticalBounds;
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);
  
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    // If moving toward submenu, use a longer delay
    const delay = isMovingTowardSubmenu(e) ? 300 : 100;
    
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, delay);
  }, [clearCloseTimeout, isMovingTowardSubmenu]);
  
  const handleSubmenuEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);
  
  const handleSubmenuLeave = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, [clearCloseTimeout]);
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Category Header Button */}
      <Button
        ref={buttonRef}
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`${CATEGORY_ROW} group ${
          hasSelectedTool ? 'hud-selected hover:text-primary-foreground' : isOpen ? 'bg-sandstone/[0.08] text-foreground' : 'text-sidebar-foreground/90'
        } ${glow ? 'ring-2 ring-marigold/80 animate-pulse' : ''}`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {icon && <span className={`${CATEGORY_ICON} ${hasSelectedTool ? 'bg-black/10 text-primary-foreground ring-black/10' : ''}`} aria-hidden>{icon}</span>}
          <span className="font-medium truncate">{m(label as Parameters<typeof m>[0])}</span>
        </span>
        <svg 
          className={`w-4 h-4 shrink-0 opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>
      
      {/* Invisible bridge/safe-zone between button and submenu for triangle rule */}
      {isOpen && (
        <div
          className="fixed"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left - SUBMENU_GAP}px`,
            width: `${SUBMENU_GAP + 8}px`, // Overlap slightly with submenu
            height: `${Math.max(menuPosition.buttonHeight, 200)}px`, // Tall enough to cover path
            zIndex: 9998,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}
      
      {/* Flyout Submenu - uses fixed positioning to escape all parent containers */}
      {isOpen && (
        <div 
          ref={submenuRef}
          className={FLYOUT_CLASS}
          style={{ 
            boxShadow: FLYOUT_SHADOW,
            zIndex: 9999,
            ...(menuPosition.openUpward 
              ? { bottom: `${window.innerHeight - menuPosition.top}px` }
              : { top: `${menuPosition.top}px` }),
            left: `${menuPosition.left}px`,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-gold/15 jaali-bg">
            <span className="ornament text-gold/80" aria-hidden />
            <span className="hud-label">{m(label as Parameters<typeof m>[0])}</span>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5 max-h-[min(340px,60vh)] overflow-y-auto" role="menu">
            {tools.map(tool => {
              if (!TOOL_INFO[tool]) return null;
              const info = getToolDisplay(tool, TOOL_INFO[tool], mapId);
              const isSelected = selectedTool === tool;
              const canAfford = money >= info.cost;
              const status = toolStatus?.[tool];
              const statusNote = status?.locked && isLandmarkType(tool)
                ? gt('Unlocks at {count} people', { count: formatIndianNumber(LANDMARKS[tool].unlockPopulation) })
                : status?.built ? gt('Built') : null;
              
              return (
                <Button
                  key={tool}
                  onClick={() => onSelectTool(tool)}
                  disabled={(!canAfford && info.cost > 0) || !!status?.locked || !!status?.built}
                  variant="ghost"
                  role="menuitem"
                  aria-current={isSelected || undefined}
                  className={`w-full justify-start gap-3 pl-1.5 pr-2.5 py-1.5 min-h-11 h-auto text-sm rounded-lg ${
                    isSelected ? 'hud-selected hover:text-primary-foreground' : 'hover:bg-sandstone/[0.07]'
                  }`}
                  title={`${m(info.description)} - Cost: ${formatINR(info.cost)}`}
                >
                  <ToolGlyph tool={tool} size={40} className={isSelected ? 'ring-black/20' : ''} />
                  <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
                    <span className="w-full truncate text-left font-medium">
                      {status?.locked && <span aria-hidden className="mr-1 text-xs">🔒</span>}
                      {m(info.name)}
                    </span>
                    <span className={`text-[11px] font-mono ${isSelected ? 'text-primary-foreground/75' : status?.locked || status?.built ? 'text-muted-foreground' : canAfford ? 'text-marigold/85' : 'text-red-400/90'}`}>{statusNote ?? formatINR(info.cost)}</span>
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// Action Submenu Component for executing actions (like expand/shrink city)
const ActionSubmenu = React.memo(function ActionSubmenu({
  label,
  actions,
  icon,
}: {
  icon?: React.ReactNode;
  label: unknown;
  actions: { key: string; name: unknown; description: string; onClick: () => void }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, buttonHeight: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const m = useMessages();
  
  const SUBMENU_GAP = 12;
  const SUBMENU_MAX_HEIGHT = 220;
  
  const clearCloseTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  const handleMouseEnter = useCallback(() => {
    clearCloseTimeout();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.top;
      const openUpward = spaceBelow < SUBMENU_MAX_HEIGHT && rect.top > SUBMENU_MAX_HEIGHT;
      
      setMenuPosition({
        top: openUpward ? rect.bottom : rect.top,
        left: rect.right + SUBMENU_GAP,
        buttonHeight: rect.height,
        openUpward,
      });
    }
    setIsOpen(true);
  }, [clearCloseTimeout]);
  
  const isMovingTowardSubmenu = useCallback((e: React.MouseEvent) => {
    if (!lastMousePos.current || !submenuRef.current) return false;
    
    const submenuRect = submenuRef.current.getBoundingClientRect();
    const currentX = e.clientX;
    const currentY = e.clientY;
    const lastX = lastMousePos.current.x;
    
    const movingRight = currentX > lastX;
    const padding = 50;
    const withinVerticalBounds = 
      currentY >= submenuRect.top - padding && 
      currentY <= submenuRect.bottom + padding;
    
    return movingRight && withinVerticalBounds;
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);
  
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    const delay = isMovingTowardSubmenu(e) ? 300 : 100;
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, delay);
  }, [clearCloseTimeout, isMovingTowardSubmenu]);
  
  const handleSubmenuEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);
  
  const handleSubmenuLeave = useCallback(() => {
    clearCloseTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, [clearCloseTimeout]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Button
        ref={buttonRef}
        variant="ghost"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`${CATEGORY_ROW} group ${isOpen ? 'bg-sandstone/[0.08] text-foreground' : 'text-sidebar-foreground/90'}`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {icon && <span className={CATEGORY_ICON} aria-hidden>{icon}</span>}
          <span className="font-medium truncate">{m(label as Parameters<typeof m>[0])}</span>
        </span>
        <svg 
          className={`w-4 h-4 shrink-0 opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>
      
      {isOpen && (
        <div
          className="fixed"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left - SUBMENU_GAP}px`,
            width: `${SUBMENU_GAP + 8}px`,
            height: `${Math.max(menuPosition.buttonHeight, 200)}px`,
            zIndex: 9998,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}
      
      {isOpen && (
        <div 
          ref={submenuRef}
          className={FLYOUT_CLASS}
          style={{ 
            boxShadow: FLYOUT_SHADOW,
            zIndex: 9999,
            ...(menuPosition.openUpward 
              ? { bottom: `${window.innerHeight - menuPosition.top}px` }
              : { top: `${menuPosition.top}px` }),
            left: `${menuPosition.left}px`,
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-gold/15 jaali-bg">
            <span className="ornament text-gold/80" aria-hidden />
            <span className="hud-label">{m(label as Parameters<typeof m>[0])}</span>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {actions.map(action => (
              <Button
                key={action.key}
                onClick={action.onClick}
                variant="ghost"
                className="w-full justify-start gap-2 px-3 min-h-11 h-auto text-sm rounded-lg hover:bg-sandstone/[0.07]"
                title={action.description}
              >
                <span className="flex-1 text-left truncate">{m(action.name as Parameters<typeof m>[0])}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Exit confirmation dialog component
function ExitDialog({ 
  open, 
  onOpenChange, 
  onSaveAndExit, 
  onExitWithoutSaving 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSaveAndExit: () => void;
  onExitWithoutSaving: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exit to Main Menu</DialogTitle>
          <DialogDescription>
            Would you like to save your city before exiting?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onExitWithoutSaving}
            className="w-full sm:w-auto"
          >
            Exit Without Saving
          </Button>
          <Button
            onClick={onSaveAndExit}
            className="w-full sm:w-auto"
          >
            Save & Exit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Memoized Sidebar Component
export const Sidebar = React.memo(function Sidebar({ onExit }: { onExit?: () => void }) {
  const { state, setTool, setActivePanel, saveCity, expandCity, shrinkCity, markLandmarksSeen } = useGame();
  // S5-T6: badge with the count of high and critical advisor messages
  const { urgent: urgentAdvisorCount } = useAdvisorNotes(state);
  const { selectedTool, stats, activePanel } = state;
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const multiplayer = useMultiplayerOptional();
  const hasShownShareModalRef = useRef(false);
  
  // Auto-show share modal when first connecting as host (not guest)
  // Guests have initialState set (received from host), hosts don't
  useEffect(() => {
    const isHost = multiplayer?.connectionState === 'connected' && multiplayer?.roomCode && !multiplayer?.initialState;
    if (isHost && !hasShownShareModalRef.current) {
      hasShownShareModalRef.current = true;
      setShowShareModal(true);
    }
  }, [multiplayer?.connectionState, multiplayer?.roomCode, multiplayer?.initialState]);
  const m = useMessages();
  
  const handleSaveAndExit = useCallback(() => {
    saveCity();
    setShowExitDialog(false);
    onExit?.();
  }, [saveCity, onExit]);
  
  const handleExitWithoutSaving = useCallback(() => {
    setShowExitDialog(false);
    onExit?.();
  }, [onExit]);
  
  // Direct tool categories (shown inline)
  const directCategories = useMemo(() => ({
    'TOOLS': ['select', 'bulldoze', 'road', 'rail', 'subway'] as Tool[],
    'ZONES': ['zone_residential', 'zone_commercial', 'zone_industrial'] as Tool[],
  }), []);
  
  // Zoning submenu (shown under ZONES section, before BUILDINGS)
  const zoningSubmenu = useMemo(() => ({
    key: 'zoning',
    label: CATEGORY_LABELS.zoning,
    tools: ['zone_dezone', 'zone_water', 'zone_land'] as Tool[]
  }), []);
  
  // Expand City submenu (shown under TOOLS section)
  const expandCityActions = useMemo(() => [
    {
      key: 'expand_city',
      name: TOOL_INFO['expand_city'].name,
      description: 'Add 15 tiles to each edge of the city',
      onClick: expandCity,
    },
    {
      key: 'shrink_city',
      name: TOOL_INFO['shrink_city'].name,
      description: 'Remove 15 tiles from each edge of the city',
      onClick: shrinkCity,
    },
  ], [expandCity, shrinkCity]);
  
  // Submenu categories (hover to expand) - includes all new assets from main
  const mapId = state.mapId;
  const submenuCategories = useMemo(() => [
    ...(mapId === 'varanasi'
      ? [
          { key: 'riverfront', label: CATEGORY_LABELS.riverfront, tools: [...RIVERFRONT_TOOLS] as Tool[], forceOpenUpward: false },
          { key: 'landmarks', label: CATEGORY_LABELS.landmarks, tools: [...LANDMARK_TOOLS] as Tool[], forceOpenUpward: false },
        ]
      : []),
    { 
      key: 'services', 
      label: CATEGORY_LABELS.services, 
      tools: ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[]
    },
    { 
      key: 'parks', 
      label: CATEGORY_LABELS.parks, 
      tools: ['tree', 'park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden', 'mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'] as Tool[]
    },
    { 
      key: 'sports', 
      label: CATEGORY_LABELS.sports, 
      tools: ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'] as Tool[]
    },
    { 
      key: 'waterfront', 
      label: CATEGORY_LABELS.waterfront, 
      tools: ['marina_docks_small', 'pier_large'] as Tool[]
    },
    { 
      key: 'community', 
      label: CATEGORY_LABELS.community, 
      tools: ['community_center', 'animal_pens_farm', 'office_building_small'] as Tool[]
    },
    { 
      key: 'utilities', 
      label: CATEGORY_LABELS.utilities, 
      tools: ['power_plant', 'water_tower', 'subway_station', 'rail_station'] as Tool[],
      forceOpenUpward: true
    },
    { 
      key: 'special', 
      label: CATEGORY_LABELS.special, 
      tools: ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[],
      forceOpenUpward: true
    },
  ]
    .map((c) => ({ ...c, tools: visibleTools(c.tools, mapId) }))
    .filter((c) => c.tools.length > 0), [mapId]);

  // Landmarks (S5-T1): lock/built status per tool, and a glow while an unlocked landmark is unseen.
  const { peakPopulation, landmarksBuilt, landmarksSeen } = state;
  const landmarkStatus = useMemo(() => {
    const out: Partial<Record<Tool, LandmarkMenuStatus>> = {};
    for (const id of LANDMARK_TOOLS) out[id] = getLandmarkMenuStatus(id, { peakPopulation, landmarksBuilt, stats });
    return out;
  }, [peakPopulation, landmarksBuilt, stats]);
  const landmarksGlow = hasUnseenLandmarks({ peakPopulation, landmarksSeen, mapId, stats });
  
  return (
    <div
      className="w-56 border-r border-gold/20 flex flex-col h-screen fixed left-0 top-0 z-40"
      style={{ background: 'linear-gradient(180deg, hsl(233 40% 12%) 0%, hsl(234 42% 8%) 60%, hsl(236 44% 7%) 100%)', boxShadow: 'inset -1px 0 0 hsl(40 90% 88% / 0.04), 8px 0 24px -12px rgb(0 0 0 / 0.6)' }}
    >
      <div className="relative px-3 pt-3 pb-2.5 border-b border-gold/15 jaali-bg">
        <div className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-1.5 pl-1 min-w-0">
            <span className="ornament text-marigold animate-diya" aria-hidden />
            <span className="font-display text-[22px] leading-none tracking-wide text-saffron-gradient">Varanasi</span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={openCommandMenu}
              title="Search (⌘K)"
              aria-label="Search (⌘K)"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-marigold hover:bg-sandstone/[0.07]"
            >
              <svg 
                className="w-4 h-4" 
                aria-hidden
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Button>
            {/* Invite button - only show if in multiplayer context */}
            {FEATURES.coop && multiplayer && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowShareModal(true)}
                title="Invite Players"
                aria-label="Invite Players"
                className="h-9 w-9 rounded-lg text-muted-foreground hover:text-marigold hover:bg-sandstone/[0.07]"
              >
                <Users className="w-4 h-4" />
              </Button>
            )}
            {onExit && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowExitDialog(true)}
                title="Exit to Main Menu"
                aria-label="Exit to Main Menu"
                className="h-9 w-9 rounded-lg text-muted-foreground hover:text-marigold hover:bg-sandstone/[0.07]"
              >
                <svg 
                  className="w-4 h-4 -scale-x-100" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-2">
        {/* Direct categories (TOOLS, ZONES) */}
        {Object.entries(directCategories).map(([category, tools]) => (
          <div key={category} className="mb-1">
            {/* Separator above ZONES */}
            {category === 'ZONES' && (
              <div className="ornament-divider mx-5 my-2" aria-hidden />
            )}
            <div className="px-4 pt-2 pb-1.5 hud-label">
              {m((CATEGORY_LABELS[category] || category) as Parameters<typeof m>[0])}
            </div>
            <div className="px-2 flex flex-col gap-0.5">
              {tools.map(tool => {
                if (!TOOL_INFO[tool]) return null;
                const info = getToolDisplay(tool, TOOL_INFO[tool], mapId);
                const isSelected = selectedTool === tool;
                const canAfford = stats.money >= info.cost;
                
                return (
                  <Button
                    key={tool}
                    onClick={() => setTool(tool)}
                    disabled={!canAfford && info.cost > 0}
                    variant="ghost"
                    aria-pressed={isSelected}
                    className={`press w-full justify-start gap-2.5 pl-2 pr-2.5 min-h-11 h-auto text-sm rounded-lg ${
                      isSelected ? 'hud-selected hover:text-primary-foreground' : 'text-sidebar-foreground/90 hover:bg-sandstone/[0.07]'
                    }`}
                    title={`${m(info.description)}${info.cost > 0 ? ` - Cost: ${formatINR(info.cost)}` : ''}`}
                  >
                    <ToolGlyph tool={tool} size={28} className={isSelected ? 'bg-black/10 text-primary-foreground ring-black/10' : 'text-gold'} />
                    <span className="flex-1 text-left truncate font-medium">{m(info.name)}</span>
                    {info.cost > 0 && (
                      <span className={`text-[11px] font-mono ${isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{formatINR(info.cost)}</span>
                    )}
                  </Button>
                );
              })}
              {/* Expand City submenu - appears after TOOLS category */}
              {category === 'TOOLS' && mapId !== 'varanasi' && (
                <ActionSubmenu
                  key="expandCity"
                  label={CATEGORY_LABELS.expandCity}
                  icon={CATEGORY_ICONS.expandCity}
                  actions={expandCityActions}
                />
              )}
              {/* Zoning submenu - appears after ZONES category */}
              {category === 'ZONES' && (
                <HoverSubmenu
                  key={zoningSubmenu.key}
                  label={zoningSubmenu.label}
                  icon={CATEGORY_ICONS.zoning}
                  tools={zoningSubmenu.tools}
                  selectedTool={selectedTool}
                  money={stats.money}
                  onSelectTool={setTool}
                  mapId={mapId}
                />
              )}
            </div>
          </div>
        ))}
        
        {/* Separator */}
        <div className="ornament-divider mx-5 my-2" aria-hidden />
        
        {/* Buildings header */}
        <div className="px-4 pt-2 pb-1.5 hud-label">
          BUILDINGS
        </div>
        
        {/* Submenu categories */}
        <div className="px-2 flex flex-col gap-0.5">
          {submenuCategories.map(({ key, label, tools, forceOpenUpward }) => (
            <HoverSubmenu
              key={key}
              label={label}
              icon={CATEGORY_ICONS[key]}
              tools={tools}
              selectedTool={selectedTool}
              money={stats.money}
              onSelectTool={setTool}
              forceOpenUpward={forceOpenUpward}
              mapId={mapId}
              {...(key === 'landmarks'
                ? { toolStatus: landmarkStatus, glow: landmarksGlow, onOpen: markLandmarksSeen }
                : {})}
            />
          ))}
        </div>
      </ScrollArea>
      
      <div className="border-t border-gold/15 p-2 gold-hairline">
        <div className="grid grid-cols-4 gap-1 hud-well rounded-xl p-1">
          {[
            { panel: 'budget' as const, icon: <BudgetIcon size={16} />, labelKey: 'budget' as const },
            { panel: 'statistics' as const, icon: <ChartIcon size={16} />, labelKey: 'statistics' as const },
            { panel: 'advisors' as const, icon: <AdvisorIcon size={16} />, labelKey: 'advisors' as const },
            { panel: 'settings' as const, icon: <SettingsIcon size={16} />, labelKey: 'settings' as const },
          ].map(({ panel, icon, labelKey }) => (
            <Button
              key={panel}
              onClick={() => setActivePanel(activePanel === panel ? 'none' : panel)}
              variant="ghost"
              size="icon-sm"
              aria-pressed={activePanel === panel}
              aria-label={String(m(UI_LABELS[labelKey]))}
              className={`press w-full h-11 relative rounded-lg ${activePanel === panel ? 'hud-selected hover:text-primary-foreground' : 'text-sandstone/75 hover:text-marigold hover:bg-sandstone/[0.07]'}`}
              title={String(m(UI_LABELS[labelKey]))}
            >
              {icon}
              {panel === 'advisors' && urgentAdvisorCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full ring-2 ring-[hsl(234_42%_8%)] bg-destructive text-destructive-foreground text-[10px] leading-4 font-semibold text-center"
                  aria-label={`${urgentAdvisorCount}`}
                >
                  {urgentAdvisorCount > 9 ? '9+' : urgentAdvisorCount}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>
      
      <ExitDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onSaveAndExit={handleSaveAndExit}
        onExitWithoutSaving={handleExitWithoutSaving}
      />
      
      {FEATURES.coop && multiplayer && (
        <ShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
        />
      )}
    </div>
  );
});

export default Sidebar;
