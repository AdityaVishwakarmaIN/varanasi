'use client';

import React, { useEffect, useRef, useState } from 'react';
import { msg, useGT, useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { useAdvisorNotes } from '@/hooks/useAdvisorNotes';
import { Tool, TOOL_INFO } from '@/types/game';
import { Button } from '@/components/ui/button';
import { ChevronDown, Ellipsis, Lock, Pencil } from 'lucide-react';
import { isDrawModeTool } from '@/lib/touchGestures';
import { CloseIcon, ToolIcons } from '@/components/ui/Icons';
import { getToolDisplay, LANDMARK_TOOLS, RIVERFRONT_TOOLS, visibleTools } from '@/games/isocity/maps/varanasiCatalog';
import { getLandmarkMenuStatus, hasUnseenLandmarks, isLandmarkType, LANDMARKS } from '@/lib/landmarks';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { formatIndianNumber, formatINR } from '@/lib/format';
import { ToolGlyph, CATEGORY_ICONS } from '@/components/game/ToolGlyph';

/** Bottom-bar quick tool: saffron when selected, sandstone otherwise. */
function quickToolClass(selected: boolean, extra = '') {
  return `press h-11 w-11 rounded-none focus-visible:ring-chrome-text ${selected ? 'hud-selected hover:text-chrome-accentText' : `text-chrome-text hover:bg-chrome-well ${extra}`}`;
}

/** Bottom-bar quick-tool icon: the same line icon (and zone tint) the desktop sidebar uses. */
function QuickIcon({ tool }: { tool: Tool }) {
  const Icon = ToolIcons[tool];
  return Icon ? <Icon size={20} /> : null;
}

// Category labels for translation
const CATEGORY_LABELS: Record<string, unknown> = {
  RIVERFRONT: msg('Riverfront'),
  LANDMARKS: msg('Landmarks'),
  'TOOLS': msg('Tools'),
  'ZONES': msg('Zones'),
  'EXPAND_CITY': msg('Expand City'),
  'ZONING': msg('Land tools'),
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

/** Overlay buttons in the build sheet: mode, label and the colour of the pressed button. */
const OVERLAY_BUTTONS: [OverlayMode, (typeof UI_LABELS)[keyof typeof UI_LABELS], string][] = [
  ['none', UI_LABELS.none, 'hud-selected hover:text-chrome-accentText'],
  ['power', UI_LABELS.power, 'bg-amber-700 hover:bg-amber-800 text-white'],
  ['water', UI_LABELS.water, 'bg-blue-700 hover:bg-blue-800 text-white'],
  ['fire', UI_LABELS.fire, 'bg-red-700 hover:bg-red-800 text-white'],
  ['police', UI_LABELS.police, 'bg-blue-700 hover:bg-blue-800 text-white'],
  ['health', UI_LABELS.health, 'bg-green-700 hover:bg-green-800 text-white'],
  ['education', UI_LABELS.education, 'bg-purple-700 hover:bg-purple-800 text-white'],
  ['subway', UI_LABELS.subway, 'bg-yellow-700 hover:bg-yellow-800 text-white'],
  ['ganga', UI_LABELS.ganga, 'bg-cyan-700 hover:bg-cyan-800 text-white'],
  ['flood', UI_LABELS.flood, 'bg-orange-700 hover:bg-orange-800 text-white'],
];

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
  /** Floating pieces stacked (bottom to top) in one column above the toolbar, so they never overlap it or each other. */
  bannerSlot?: React.ReactNode;
  /** The Voices chip: sits in the same row as the Draw button. */
  feedSlot?: React.ReactNode;
}

export function MobileToolbar({ onOpenPanel, overlayMode = 'none', setOverlayMode, drawMode = false, onDrawModeChange, bannerSlot, feedSlot }: MobileToolbarProps) {
  const { state, setTool, expandCity, shrinkCity, markLandmarksSeen } = useGame();
  // S5-T6: badge with the count of high and critical advisor messages
  const { urgent: urgentAdvisorCount } = useAdvisorNotes(state);
  const advisorBadge = urgentAdvisorCount > 0 ? (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-none bg-destructive text-destructive-foreground text-[10px] leading-4 font-semibold text-center">
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
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll an opened category to the top of the list so its tools (and prices) are in view.
  // Instant, not smooth: hit areas must not move under the finger while it settles.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !expandedCategory) return;
    const header = list.querySelector<HTMLElement>(`[data-category="${expandedCategory}"]`);
    if (header) list.scrollTop = Math.max(0, header.offsetTop - 4);
  }, [expandedCategory]);

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
        {/* One column above the toolbar for everything that floats over the map: banners, then the Voices chip
            and the Draw button (S1-T11, only for tools that are drawn by dragging: road, rail, zones). */}
        <div className={`pointer-events-none absolute bottom-full left-0 right-0 flex flex-col items-start gap-2 px-3 pb-2 ${showMenu ? 'hidden' : ''}`}>
          {bannerSlot}
          <div className="flex w-full flex-wrap items-end justify-between gap-2">
            {feedSlot}
            {onDrawModeChange && isDrawModeTool(selectedTool) && (
              <Button
                data-testid="draw-mode-toggle"
                variant="ghost"
                aria-pressed={drawMode}
                className={`press pointer-events-auto ml-auto h-11 min-w-11 px-4 gap-2 rounded-none ${drawMode ? 'hud-selected hover:text-chrome-accentText' : 'hud-panel text-chrome-text'}`}
                onClick={() => onDrawModeChange(!drawMode)}
              >
                <Pencil size={20} strokeWidth={1.75} aria-hidden />
                <span className="text-xs">{drawMode ? m(UI_LABELS.drawOn) : m(UI_LABELS.drawOff)}</span>
              </Button>
            )}
          </div>
        </div>
        <div className="hud-panel rounded-none border-x-0 border-b-0">
          {/* Selected tool info - now above the toolbar */}
          {selectedTool && TOOL_INFO[selectedTool] && (
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-chrome-border text-xs">
              <span className="flex items-center gap-1.5 text-chrome-text font-medium">
                {m(getToolDisplay(selectedTool, TOOL_INFO[selectedTool], state.mapId).name)}
              </span>
              {TOOL_INFO[selectedTool].cost > 0 && (
                <span className={`font-mono ${stats.money >= TOOL_INFO[selectedTool].cost ? 'text-chrome-text' : 'text-red-700'}`}>
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
              <QuickIcon tool="select" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['bulldoze'].name))}
              aria-pressed={selectedTool === 'bulldoze'}
              className={quickToolClass(selectedTool === 'bulldoze', '!text-red-700')}
              onClick={() => handleToolSelect('bulldoze')}
            >
              <QuickIcon tool="bulldoze" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['road'].name))}
              aria-pressed={selectedTool === 'road'}
              className={quickToolClass(selectedTool === 'road')}
              onClick={() => handleToolSelect('road')}
            >
              <QuickIcon tool="road" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['rail'].name))}
              aria-pressed={selectedTool === 'rail'}
              className={quickToolClass(selectedTool === 'rail')}
              onClick={() => handleToolSelect('rail')}
            >
              <QuickIcon tool="rail" />
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
              <QuickIcon tool="zone_residential" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['zone_commercial'].name))}
              aria-pressed={selectedTool === 'zone_commercial'}
              className={quickToolClass(selectedTool === 'zone_commercial')}
              onClick={() => handleToolSelect('zone_commercial')}
            >
              <QuickIcon tool="zone_commercial" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={String(m(TOOL_INFO['zone_industrial'].name))}
              aria-pressed={selectedTool === 'zone_industrial'}
              className={quickToolClass(selectedTool === 'zone_industrial')}
              onClick={() => handleToolSelect('zone_industrial')}
            >
              <QuickIcon tool="zone_industrial" />
            </Button>

            {/* More tools menu button */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={showMenu ? gt('Close build menu') : gt('Open build menu')}
              aria-expanded={showMenu}
              data-testid="mobile-build-menu"
              className={`press h-11 w-11 relative rounded-none ${showMenu ? 'hud-selected hover:text-chrome-accentText' : 'hud-well text-chrome-text'}`}
              onClick={() => setShowMenu(!showMenu)}
            >
              {!showMenu && advisorBadge}
              {!showMenu && landmarksGlow && <span className="absolute left-1 top-1 h-2 w-2 bg-chrome-text" aria-hidden />}
              {showMenu ? (
                <CloseIcon size={20} />
              ) : (
                <Ellipsis size={20} strokeWidth={1.75} aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Tool Menu */}
      {showMenu && (
        <>
          {/* Scrim: covers the top bar and the map (it sits above the top bar's z-40), so nothing
              under it reacts; a tap anywhere on it only closes the menu. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={gt('Close build menu')}
            data-testid="build-menu-scrim"
            className="fixed inset-0 z-[45] cursor-default touch-none bg-[hsl(25_30%_10%/0.55)] animate-fadeIn"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(false); }}
          />
          {/* The whole sheet scrolls as one, so the categories get almost all of its height. */}
          <div
            ref={listRef}
            data-testid="build-menu-sheet"
            className="hud-panel animate-rise-in fixed z-[46] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-2 right-2 max-h-[min(78dvh,calc(100dvh-10.5rem))] overflow-y-auto overscroll-contain touch-pan-y rounded-none"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* City management: one compact row above the categories */}
            <div className="grid grid-cols-4 gap-1.5 border-b border-chrome-border p-2">
              {(['budget', 'statistics', 'advisors', 'settings'] as const).map((panel) => (
                <Button
                  key={panel}
                  variant="ghost"
                  size="sm"
                  className="press hud-well relative h-11 w-full px-1 text-xs text-chrome-text rounded-none"
                  onClick={() => { onOpenPanel(panel); setShowMenu(false); }}
                >
                  {m(UI_LABELS[panel])}
                  {panel === 'advisors' && advisorBadge}
                </Button>
              ))}
            </div>
            <div>
              <div className="p-2 space-y-1">
                {/* Category buttons */}
                {getMapToolCategories(state.mapId).map(([category, tools]) => (
                  <div key={category}>
                    {/* Expand City section - appears before ZONING */}
                    {category === 'ZONING' && state.mapId !== 'varanasi' && (
                      <div className="mb-1">
                        <Button
                          variant="ghost"
                          aria-expanded={expandCityExpanded}
                          className={`w-full justify-start gap-3 h-12 rounded-none focus-visible:ring-chrome-text ${expandCityExpanded ? 'bg-chrome-well' : ''}`}
                          onClick={() => setExpandCityExpanded(!expandCityExpanded)}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-chrome-well border border-chrome-border text-chrome-text" aria-hidden>{CATEGORY_ICONS.expandCity}</span>
                          <span className="flex-1 text-left font-medium">{m((CATEGORY_LABELS['EXPAND_CITY']) as Parameters<typeof m>[0])}</span>
                          <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={`shrink-0 opacity-60 transition-transform ${expandCityExpanded ? 'rotate-180' : ''}`} />
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
                      data-category={category}
                      aria-expanded={expandedCategory === category}
                      className={`w-full justify-start gap-3 h-12 rounded-none focus-visible:ring-chrome-text ${expandedCategory === category ? 'bg-chrome-well text-chrome-text' : 'text-chrome-text'}`}
                      onClick={() => handleCategoryClick(category)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-chrome-well border border-chrome-border text-chrome-text" aria-hidden>{CATEGORY_ICONS[category.toLowerCase()]}</span>
                      <span className="flex-1 text-left font-medium">{m((CATEGORY_LABELS[category] || category) as Parameters<typeof m>[0])}</span>
                      {category === 'LANDMARKS' && landmarksGlow && <span className="shrink-0 border border-chrome-text px-1 text-[10px] font-semibold uppercase leading-[14px] tracking-[0.04em] text-chrome-text">New</span>}
                      <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={`shrink-0 opacity-60 transition-transform ${expandedCategory === category ? 'rotate-180' : ''}`} />
                    </Button>

                    {/* Expanded tools */}
                    {expandedCategory === category && (
                      <div className="grid grid-cols-3 gap-1.5 px-1 pt-1 pb-2">
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
                              className={`press h-auto min-h-11 w-full flex-col items-center justify-start gap-1 rounded-none px-1 py-2 whitespace-normal ${selectedTool === tool ? 'hud-selected hover:text-chrome-accentText' : 'hud-well text-chrome-text'}`}
                              disabled={(!canAfford && info.cost > 0) || !!status?.locked || !!status?.built}
                              onClick={() => handleToolSelect(tool, true)}
                            >
                              <ToolGlyph tool={tool} size={52} selected={selectedTool === tool} />
                              <span className="w-full text-center text-[11px] font-medium leading-tight line-clamp-2">
                                {status?.locked && <Lock size={12} strokeWidth={1.75} aria-hidden className="mr-0.5 inline align-[-1px]" />}
                                {m(info.name)}
                              </span>
                              {statusNote ? (
                                <span className="text-[10px] leading-tight text-center text-chrome-muted">{statusNote}</span>
                              ) : info.cost > 0 && (
                                <span className={`text-[10px] font-mono ${selectedTool === tool ? 'text-chrome-accentText' : canAfford ? 'text-chrome-text' : 'text-red-700'}`}>
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

            {/* View overlays: after the categories, in the same scroll */}
            {setOverlayMode && (
                <div className="flex flex-col gap-1.5 border-t border-chrome-border p-2">
                  <span className="hud-label shrink-0">{m(UI_LABELS.viewOverlays)}</span>
                  <div className="grid min-w-0 grid-cols-5 gap-1" role="group" aria-label={String(m(UI_LABELS.viewOverlays))}>
                    {OVERLAY_BUTTONS.filter(([mode]) => state.mapId === 'varanasi' || (mode !== 'ganga' && mode !== 'flood')).map(([mode, label, activeClass]) => (
                      <Button
                        key={mode}
                        variant="ghost"
                        size="sm"
                        aria-pressed={overlayMode === mode}
                        className={`press h-9 min-w-0 px-1 text-[11px] rounded-none focus-visible:ring-chrome-text ${overlayMode === mode ? activeClass : 'hud-well text-chrome-text'}`}
                        onClick={() => setOverlayMode(mode)}
                      >
                        {m(label)}
                      </Button>
                    ))}
                  </div>
                </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default MobileToolbar;
