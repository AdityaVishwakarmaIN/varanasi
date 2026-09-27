'use client';

import React, { useState } from 'react';
import { msg, useGT, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { useAdvisorNotes } from '@/hooks/useAdvisorNotes';
import { Tool, TOOL_INFO } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { isDrawModeTool } from '@/lib/touchGestures';
import {
  CloseIcon,
  RoadIcon,
  RailIcon,
  SubwayIcon,
  TreeIcon,
  PowerIcon,
  WaterIcon,
  BudgetIcon,
  ChartIcon,
  AdvisorIcon,
  TrophyIcon,
  SettingsIcon,
  FireIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
} from '@/components/ui/Icons';
import { getToolDisplay, LANDMARK_TOOLS, RIVERFRONT_TOOLS, visibleTools } from '@/games/isocity/maps/varanasiCatalog';
import { getLandmarkMenuStatus, hasUnseenLandmarks, isLandmarkType, LANDMARKS } from '@/lib/landmarks';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { formatIndianNumber, formatINR } from '@/lib/format';
import { ToolGlyph, CATEGORY_ICONS } from '@/components/game/ToolGlyph';

/** Bottom-bar quick tool: saffron when selected, sandstone otherwise. */
function quickToolClass(selected: boolean, extra = '') {
  return `press h-11 w-11 rounded-xl ${selected ? 'hud-selected hover:text-primary-foreground' : `text-sandstone/85 hover:bg-sandstone/[0.08] ${extra}`}`;
}

const SECTION_LABEL = 'hud-label mb-2 flex items-center gap-1.5';

// Tool category icons
const CategoryIcons: Record<string, React.ReactNode> = {
  'TOOLS': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  'ZONES': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  'ZONING': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l16 16M20 4L4 20" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  'SERVICES': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  ),
  'PARKS': <TreeIcon size={20} />,
  'SPORTS': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M6 12h12" />
    </svg>
  ),
  'WATERFRONT': <WaterIcon size={20} />,
  'COMMUNITY': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  'UTILITIES': <PowerIcon size={20} />,
  'SPECIAL': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

// Tool icons for quick access (Partial because not all tools need custom icons)
const QuickToolIcons: Partial<Record<Tool, React.ReactNode>> = {
  select: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l16 8-8 3-3 8z" />
    </svg>
  ),
  bulldoze: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M6 6v14a2 2 0 002 2h8a2 2 0 002-2V6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  ),
  road: <RoadIcon size={20} />,
  rail: <RailIcon size={20} />,
  subway: <SubwayIcon size={20} />,
  tree: <TreeIcon size={20} />,
  zone_residential: (
    <div className="w-5 h-5 rounded-md bg-green-500 ring-1 ring-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] flex items-center justify-center text-[10px] font-bold text-white">R</div>
  ),
  zone_commercial: (
    <div className="w-5 h-5 rounded-md bg-blue-500 ring-1 ring-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] flex items-center justify-center text-[10px] font-bold text-white">C</div>
  ),
  zone_industrial: (
    <div className="w-5 h-5 rounded-md bg-amber-500 ring-1 ring-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] flex items-center justify-center text-[10px] font-bold text-white">I</div>
  ),
  zone_dezone: (
    <div className="w-5 h-5 rounded-md bg-gray-500 ring-1 ring-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] flex items-center justify-center text-[10px] font-bold text-white">X</div>
  ),
  zone_water: (
    <div className="w-5 h-5 rounded-md bg-cyan-500 ring-1 ring-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] flex items-center justify-center text-[10px] font-bold text-white">~</div>
  ),
  zone_land: (
    <div className="w-5 h-5 rounded-md bg-emerald-600 ring-1 ring-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] flex items-center justify-center text-[10px] font-bold text-white">▲</div>
  ),
  police_station: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V5l9-4z" />
    </svg>
  ),
  fire_station: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c-1.5 4-1.5 6 0 8 1.5-2 1.5-4 0-8zM8 10c-2 4-2 6 0 10 2-4 2-6 0-10zM16 10c-2 4-2 6 0 10 2-4 2-6 0-10z" />
    </svg>
  ),
  hospital: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  school: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  university: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20h20" />
      <path d="M5 20V8l7-4 7 4v12" />
      <path d="M9 20v-4h6v4" />
    </svg>
  ),
  park: <TreeIcon size={20} />,
  park_large: <TreeIcon size={20} />,
  tennis: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.5 4.5c5 5 10 5 15 0" />
      <path d="M4.5 19.5c5-5 10-5 15 0" />
    </svg>
  ),
  power_plant: <PowerIcon size={20} />,
  water_tower: <WaterIcon size={20} />,
  subway_station: <SubwayIcon size={20} />,
  stadium: <TrophyIcon size={20} />,
  museum: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20h20" />
      <path d="M4 20v-6h4v6" />
      <path d="M10 20v-6h4v6" />
      <path d="M16 20v-6h4v6" />
      <path d="M2 14h20" />
      <path d="M12 3l10 7H2l10-7z" />
    </svg>
  ),
  airport: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  ),
  space_program: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L4 5v6.5c0 6 5.5 10.5 8 11.5 2.5-1 8-5.5 8-11.5V5l-8-3z" />
    </svg>
  ),
  city_hall: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 20h20" />
      <path d="M4 20v-8l8-8 8 8v8" />
      <rect x="9" y="14" width="6" height="6" />
    </svg>
  ),
  amusement_park: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

// Category labels for translation
const CATEGORY_LABELS: Record<string, unknown> = {
  RIVERFRONT: msg('Riverfront'),
  LANDMARKS: msg('Landmarks'),
  'TOOLS': msg('Tools'),
  'ZONES': msg('Zones'),
  'EXPAND_CITY': msg('Expand City'),
  'ZONING': msg('Zoning'),
  'UTILITIES': msg('Utilities'),
  'SERVICES': msg('Services'),
  'PARKS': msg('Parks'),
  'SPORTS': msg('Sports'),
  'WATERFRONT': msg('Waterfront'),
  'COMMUNITY': msg('Community'),
  'SPECIAL': msg('Special'),
};

// UI labels for translation
const UI_LABELS = {
  viewOverlays: msg('View Overlays'),
  none: msg('None'),
  power: msg('Power'),
  water: msg('Water'),
  fire: msg('Fire'),
  police: msg('Police'),
  health: msg('Health'),
  education: msg('Education'),
  subway: msg('Subway'),
  ganga: msg('Ganga'),
  flood: msg('Floods'),
  budget: msg('Budget'),
  statistics: msg('Statistics'),
  advisors: msg('Advisors'),
  settings: msg('Settings'),
  drawOn: msg('Draw: on'),
  drawOff: msg('Draw: off'),
};

const toolCategories = {
  'TOOLS': ['select', 'bulldoze', 'road', 'rail', 'subway'] as Tool[],
  'ZONES': ['zone_residential', 'zone_commercial', 'zone_industrial'] as Tool[],
  'ZONING': ['zone_dezone', 'zone_water', 'zone_land'] as Tool[],
  'UTILITIES': ['power_plant', 'water_tower', 'subway_station', 'rail_station'] as Tool[],
  'SERVICES': ['police_station', 'fire_station', 'hospital', 'school', 'university'] as Tool[],
  'PARKS': ['park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden', 'mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'] as Tool[],
  'SPORTS': ['tennis', 'basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'] as Tool[],
  'WATERFRONT': ['marina_docks_small', 'pier_large'] as Tool[],
  'COMMUNITY': ['community_center', 'animal_pens_farm', 'office_building_small'] as Tool[],
  'SPECIAL': ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'] as Tool[],
};

/** Menu categories for this map: Riverfront first on Varanasi, tools hidden per map (S3-T1). */
function getMapToolCategories(mapId: MapId | undefined): [string, Tool[]][] {
  const base: [string, Tool[]][] = Object.entries(toolCategories);
  const withRiverfront: [string, Tool[]][] = mapId === 'varanasi'
    ? [['RIVERFRONT', [...RIVERFRONT_TOOLS]], ['LANDMARKS', [...LANDMARK_TOOLS]], ...base]
    : base;
  return withRiverfront
    .map(([category, tools]): [string, Tool[]] => [category, visibleTools(tools, mapId)])
    .filter(([, tools]) => tools.length > 0);
}

type OverlayMode = import('@/components/game/types').OverlayMode;

interface MobileToolbarProps {
  onOpenPanel: (panel: 'budget' | 'statistics' | 'advisors' | 'settings') => void;
  overlayMode?: OverlayMode;
  setOverlayMode?: (mode: OverlayMode) => void;
  /** S1-T11: touch Draw mode (one-finger drag draws instead of pans). */
  drawMode?: boolean;
  onDrawModeChange?: (on: boolean) => void;
}

export function MobileToolbar({ onOpenPanel, overlayMode = 'none', setOverlayMode, drawMode = false, onDrawModeChange }: MobileToolbarProps) {
  const { state, setTool, expandCity, shrinkCity, markLandmarksSeen } = useGame();
  // S5-T6: badge with the count of high and critical advisor messages
  const { urgent: urgentAdvisorCount } = useAdvisorNotes(state);
  const advisorBadge = urgentAdvisorCount > 0 ? (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full ring-2 ring-[hsl(234_42%_9%)] bg-destructive text-destructive-foreground text-[10px] leading-4 font-semibold text-center">
      {urgentAdvisorCount > 9 ? '9+' : urgentAdvisorCount}
    </span>
  ) : null;
  const { selectedTool, stats } = state;
  const gt = useGT();
  // S5-T1: the Landmarks category glows while an unlocked landmark has not been seen.
  const landmarksGlow = hasUnseenLandmarks(state);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [expandCityExpanded, setExpandCityExpanded] = useState(false);
  const m = useMessages();

  const handleCategoryClick = (category: string) => {
    if (expandedCategory === category) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
      if (category === 'LANDMARKS') markLandmarksSeen();
    }
  };

  const handleToolSelect = (tool: Tool, closeMenu: boolean = false) => {
    // If the tool is already selected and it's not 'select', toggle back to select
    if (selectedTool === tool && tool !== 'select') {
      setTool('select');
    } else {
      setTool(tool);
    }
    setExpandedCategory(null);
    if (closeMenu) {
      setShowMenu(false);
    }
  };

  return (
    <>
      {/* Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom safe-area-left safe-area-right">
        {/* S1-T11: Draw mode toggle, only for tools that are drawn by dragging (road, rail, zones) */}
        {onDrawModeChange && isDrawModeTool(selectedTool) && (
          <Button
            data-testid="draw-mode-toggle"
            variant="ghost"
            aria-pressed={drawMode}
            className={`press absolute bottom-full right-2 mb-2 h-11 min-w-11 px-4 gap-2 rounded-full ${drawMode ? 'hud-selected hover:text-primary-foreground' : 'hud-panel text-sandstone'}`}
            onClick={() => onDrawModeChange(!drawMode)}
          >
            <Pencil className="w-4 h-4" />
            <span className="text-xs">{drawMode ? m(UI_LABELS.drawOn) : m(UI_LABELS.drawOff)}</span>
          </Button>
        )}
        <div className="hud-panel gold-hairline rounded-t-2xl border-x-0 border-b-0">
          {/* Selected tool info - now above the toolbar */}
          {selectedTool && TOOL_INFO[selectedTool] && (
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-gold/10 text-xs">
              <span className="flex items-center gap-1.5 text-sandstone font-medium">
                <span className="ornament text-marigold !w-2.5 !h-2.5" aria-hidden />
                {m(getToolDisplay(selectedTool, TOOL_INFO[selectedTool], state.mapId).name)}
              </span>
              {TOOL_INFO[selectedTool].cost > 0 && (
                <span className={`font-mono ${stats.money >= TOOL_INFO[selectedTool].cost ? 'text-marigold' : 'text-red-400'}`}>
                  {formatINR(TOOL_INFO[selectedTool].cost)}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-around px-1 py-2 gap-0 min-[400px]:px-2 min-[400px]:gap-1">
            {/* Quick access tools */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['select'].name))}
              aria-pressed={selectedTool === 'select'}
              className={quickToolClass(selectedTool === 'select')}
              onClick={() => handleToolSelect('select')}
            >
              {QuickToolIcons.select}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['bulldoze'].name))}
              aria-pressed={selectedTool === 'bulldoze'}
              className={quickToolClass(selectedTool === 'bulldoze', '!text-red-400')}
              onClick={() => handleToolSelect('bulldoze')}
            >
              {QuickToolIcons.bulldoze}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['road'].name))}
              aria-pressed={selectedTool === 'road'}
              className={quickToolClass(selectedTool === 'road')}
              onClick={() => handleToolSelect('road')}
            >
              {QuickToolIcons.road}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['rail'].name))}
              aria-pressed={selectedTool === 'rail'}
              className={quickToolClass(selectedTool === 'rail')}
              onClick={() => handleToolSelect('rail')}
            >
              {QuickToolIcons.rail}
            </Button>

            {/* Zone buttons */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['zone_residential'].name))}
              aria-pressed={selectedTool === 'zone_residential'}
              className={quickToolClass(selectedTool === 'zone_residential')}
              onClick={() => handleToolSelect('zone_residential')}
            >
              {QuickToolIcons.zone_residential}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['zone_commercial'].name))}
              aria-pressed={selectedTool === 'zone_commercial'}
              className={quickToolClass(selectedTool === 'zone_commercial')}
              onClick={() => handleToolSelect('zone_commercial')}
            >
              {QuickToolIcons.zone_commercial}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['zone_industrial'].name))}
              aria-pressed={selectedTool === 'zone_industrial'}
              className={quickToolClass(selectedTool === 'zone_industrial')}
              onClick={() => handleToolSelect('zone_industrial')}
            >
              {QuickToolIcons.zone_industrial}
            </Button>

            {/* More tools menu button */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={showMenu ? gt('Close build menu') : gt('Open build menu')}
              aria-expanded={showMenu}
              data-testid="mobile-build-menu"
              className={`press h-11 w-11 relative rounded-xl ${showMenu ? 'hud-selected hover:text-primary-foreground' : 'hud-well text-marigold'} ${landmarksGlow && !showMenu ? 'ring-2 ring-marigold/80 animate-pulse' : ''}`}
              onClick={() => setShowMenu(!showMenu)}
            >
              {!showMenu && advisorBadge}
              {showMenu ? (
                <CloseIcon size={20} />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Tool Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-[hsl(234_50%_4%/0.62)] animate-fadeIn" onClick={() => setShowMenu(false)}>
          <div
            className="hud-panel gold-hairline animate-rise-in absolute bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-2 right-2 max-h-[70dvh] overflow-hidden rounded-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* City Management section at top */}
            <div className="p-3 border-b border-gold/15 flex-shrink-0 jaali-bg">
              <div className={SECTION_LABEL}>
                <span className="ornament text-gold/80 !w-2.5 !h-2.5" aria-hidden />
                {m(msg('City Management'))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="press hud-well h-11 w-full px-1 text-xs text-sandstone rounded-xl"
                  onClick={() => { onOpenPanel('budget'); setShowMenu(false); }}
                >
                  {m(UI_LABELS.budget)}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="press hud-well h-11 w-full px-1 text-xs text-sandstone rounded-xl"
                  onClick={() => { onOpenPanel('statistics'); setShowMenu(false); }}
                >
                  {m(UI_LABELS.statistics)}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="press hud-well h-11 w-full px-1 text-xs text-sandstone rounded-xl relative"
                  onClick={() => { onOpenPanel('advisors'); setShowMenu(false); }}
                >
                  {m(UI_LABELS.advisors)}
                  {advisorBadge}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="press hud-well h-11 w-full px-1 text-xs text-sandstone rounded-xl"
                  onClick={() => { onOpenPanel('settings'); setShowMenu(false); }}
                >
                  {m(UI_LABELS.settings)}
                </Button>
              </div>
            </div>

            {/* Overlay Toggle Section */}
            {setOverlayMode && (
              <div className="p-3 border-b border-gold/15 flex-shrink-0">
                <div className={SECTION_LABEL}>
                  {m(UI_LABELS.viewOverlays)}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={overlayMode === 'none'}
                    className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'none' ? 'hud-selected hover:text-primary-foreground' : 'hud-well text-sandstone/85'}`}
                    onClick={() => setOverlayMode('none')}
                  >
                    {m(UI_LABELS.none)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={overlayMode === 'power'}
                    className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'power' ? 'bg-amber-500 hover:bg-amber-600 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                    onClick={() => setOverlayMode('power')}
                  >
                    {m(UI_LABELS.power)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={overlayMode === 'water'}
                    className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'water' ? 'bg-blue-500 hover:bg-blue-600 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                    onClick={() => setOverlayMode('water')}
                  >
                    {m(UI_LABELS.water)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={overlayMode === 'fire'}
                    className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'fire' ? 'bg-red-500 hover:bg-red-600 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                    onClick={() => setOverlayMode('fire')}
                  >
                    {m(UI_LABELS.fire)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={overlayMode === 'police'}
                    className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'police' ? 'bg-blue-600 hover:bg-blue-700 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                    onClick={() => setOverlayMode('police')}
                  >
                    {m(UI_LABELS.police)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={overlayMode === 'health'}
                    className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'health' ? 'bg-green-500 hover:bg-green-600 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                    onClick={() => setOverlayMode('health')}
                  >
                    {m(UI_LABELS.health)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={overlayMode === 'education'}
                    className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'education' ? 'bg-purple-500 hover:bg-purple-600 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                    onClick={() => setOverlayMode('education')}
                  >
                    {m(UI_LABELS.education)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={overlayMode === 'subway'}
                    className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'subway' ? 'bg-yellow-500 hover:bg-yellow-600 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                    onClick={() => setOverlayMode('subway')}
                  >
                    {m(UI_LABELS.subway)}
                  </Button>
                  {state.mapId === 'varanasi' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-pressed={overlayMode === 'ganga'}
                      className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'ganga' ? 'bg-cyan-600 hover:bg-cyan-700 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                      onClick={() => setOverlayMode('ganga')}
                    >
                      {m(UI_LABELS.ganga)}
                    </Button>
                  )}
                  {state.mapId === 'varanasi' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-pressed={overlayMode === 'flood'}
                      className={`press h-11 w-full px-1 text-xs rounded-xl ${overlayMode === 'flood' ? 'bg-orange-600 hover:bg-orange-700 text-white ring-1 ring-white/25' : 'hud-well text-sandstone/85'}`}
                      onClick={() => setOverlayMode('flood')}
                    >
                      {m(UI_LABELS.flood)}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-2 space-y-1 pb-4">
                {/* Category buttons */}
                {getMapToolCategories(state.mapId).map(([category, tools]) => (
                  <div key={category}>
                    {/* Expand City section - appears before ZONING */}
                    {category === 'ZONING' && state.mapId !== 'varanasi' && (
                      <div className="mb-1">
                        <Button
                          variant="ghost"
                          aria-expanded={expandCityExpanded}
                          className={`w-full justify-start gap-3 h-12 rounded-xl ${expandCityExpanded ? 'bg-sandstone/[0.08]' : ''}`}
                          onClick={() => setExpandCityExpanded(!expandCityExpanded)}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sandstone/[0.06] ring-1 ring-gold/15 text-gold" aria-hidden>{CATEGORY_ICONS.expandCity}</span>
                          <span className="flex-1 text-left font-medium">{m((CATEGORY_LABELS['EXPAND_CITY']) as Parameters<typeof m>[0])}</span>
                          <svg
                            className={`w-4 h-4 transition-transform ${expandCityExpanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </Button>

                        {/* Expand City actions */}
                        {expandCityExpanded && (
                          <div className="pl-4 py-1 space-y-0.5">
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-3 h-11"
                              onClick={() => { expandCity(); setShowMenu(false); }}
                            >
                              <span className="flex-1 text-left">{m(TOOL_INFO['expand_city'].name)}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-3 h-11"
                              onClick={() => { shrinkCity(); setShowMenu(false); }}
                            >
                              <span className="flex-1 text-left">{m(TOOL_INFO['shrink_city'].name)}</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      aria-expanded={expandedCategory === category}
                      className={`w-full justify-start gap-3 h-12 rounded-xl ${expandedCategory === category ? 'bg-sandstone/[0.08] text-foreground' : 'text-sandstone/90'} ${tools.includes(selectedTool) ? 'ring-1 ring-saffron/60' : ''} ${category === 'LANDMARKS' && landmarksGlow ? 'ring-2 ring-marigold/80 animate-pulse' : ''}`}
                      onClick={() => handleCategoryClick(category)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sandstone/[0.06] ring-1 ring-gold/15 text-gold" aria-hidden>{CATEGORY_ICONS[category.toLowerCase()]}</span>
                      <span className="flex-1 text-left font-medium">{m((CATEGORY_LABELS[category] || category) as Parameters<typeof m>[0])}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedCategory === category ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </Button>

                    {/* Expanded tools */}
                    {expandedCategory === category && (
                      <div className="grid grid-cols-3 gap-1.5 px-1 pt-1 pb-2 animate-submenu-in">
                        {tools.map((tool) => {
                          if (!TOOL_INFO[tool]) return null;
                          const info = getToolDisplay(tool, TOOL_INFO[tool], state.mapId);
                          const canAfford = stats.money >= info.cost;
                          const status = isLandmarkType(tool) ? getLandmarkMenuStatus(tool, state) : null;
                          const statusNote = status?.locked && isLandmarkType(tool)
                            ? gt('Unlocks at {count} people', { count: formatIndianNumber(LANDMARKS[tool].unlockPopulation) })
                            : status?.built ? gt('Built') : null;

                          return (
                            <Button
                              key={tool}
                              variant="ghost"
                              aria-pressed={selectedTool === tool}
                              className={`press h-auto min-h-11 w-full flex-col items-center justify-start gap-1 rounded-xl px-1 py-2 whitespace-normal ${selectedTool === tool ? 'hud-selected hover:text-primary-foreground' : 'hud-well text-sandstone'}`}
                              disabled={(!canAfford && info.cost > 0) || !!status?.locked || !!status?.built}
                              onClick={() => handleToolSelect(tool, true)}
                            >
                              <ToolGlyph tool={tool} size={52} />
                              <span className="w-full text-center text-[11px] font-medium leading-tight line-clamp-2">
                                {status?.locked && <span aria-hidden className="mr-0.5">🔒</span>}
                                {m(info.name)}
                              </span>
                              {statusNote ? (
                                <span className="text-[10px] leading-tight text-center text-muted-foreground">{statusNote}</span>
                              ) : info.cost > 0 && (
                                <span className={`text-[10px] font-mono ${selectedTool === tool ? 'text-primary-foreground/80' : canAfford ? 'text-marigold/90' : 'text-red-400'}`}>
                                  {formatINR(info.cost)}
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileToolbar;
