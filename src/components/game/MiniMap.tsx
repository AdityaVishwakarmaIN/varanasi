'use client';

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { msg } from 'gt-next';
import { useMessages } from 'gt-next';
import { useGame } from '@/context/GameContext';
import { Card } from '@/components/ui/card';
import { TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';

// Service buildings for minimap color mapping
const SERVICE_BUILDINGS = new Set([
  'police_station', 'fire_station', 'hospital', 'school', 'university'
]);

// Park buildings for minimap color mapping
const PARK_BUILDINGS = new Set([
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small', 
  'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field', 
  'baseball_stadium', 'community_center', 'swimming_pool', 'skate_park', 
  'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
  'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground',
  'marina_docks_small', 'pier_large', 'roller_coaster_small', 'community_garden',
  'pond_park', 'park_gate', 'mountain_lodge', 'mountain_trailhead', 'office_building_small'
]);

/** Minimap tile colours. The legend swatches use these same values, so they always match the map. */
export const MINIMAP_COLORS = {
  background: '#0b1723',
  grass: '#2d5a3d',
  water: '#0ea5e9',
  road: '#6b7280',
  tree: '#166534',
  fire: '#ef4444',
  informal: '#a16207',
  residential: '#22c55e',
  residentialEmpty: '#14532d',
  commercial: '#38bdf8',
  commercialEmpty: '#1d4ed8',
  industrial: '#f59e0b',
  industrialEmpty: '#b45309',
  service: '#c084fc',
  power: '#f97316',
  waterWorks: '#06b6d4',
  park: '#84cc16',
} as const;

const MINIMAP_LEGEND = [
  { color: MINIMAP_COLORS.residential, label: msg('Residential') },
  { color: MINIMAP_COLORS.commercial, label: msg('Commercial') },
  { color: MINIMAP_COLORS.industrial, label: msg('Industrial') },
  { color: MINIMAP_COLORS.service, label: msg('Services') },
];

interface MiniMapProps {
  /** `instant`: true while dragging on the minimap, so the camera follows without a glide. */
  onNavigate?: (gridX: number, gridY: number, instant?: boolean) => void;
  /** Render inline (no fixed position), e.g. inside the mobile minimap overlay. */
  inline?: boolean;
  /** Canvas size in CSS px (default 140). */
  size?: number;
  onViewportSubscribe?: (listener: MiniMapViewportListener) => () => void;
  viewport?: { 
    offset: { x: number; y: number }; 
    zoom: number; 
    canvasSize: { width: number; height: number } 
  } | null;
}

type MiniMapViewport = {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
};

type MiniMapViewportListener = (viewport: MiniMapViewport | null) => void;

// Canvas-based Minimap - Memoized with throttled grid rendering
// Translatable label
const MINIMAP_LABEL = msg('Minimap');

export const MiniMap = React.memo(function MiniMap({ onNavigate, onViewportSubscribe, viewport, inline = false, size = 140 }: MiniMapProps) {
  const { state } = useGame();
  const { grid, gridSize, tick, structureVersion } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [subscribedViewport, setSubscribedViewport] = useState<MiniMapViewport | null>(null);
  const gridImageRef = useRef<ImageData | null>(null);
  const lastGridRenderTickRef = useRef(-1);
  const lastStructureVersionRef = useRef(-1);
  const m = useMessages();
  
  // Pre-compute color map for faster lookups
  const serviceBuildings = useMemo(() => SERVICE_BUILDINGS, []);
  const parkBuildings = useMemo(() => PARK_BUILDINGS, []);

  useEffect(() => {
    if (!onViewportSubscribe) {
      setSubscribedViewport(viewport || null);
      return;
    }

    return onViewportSubscribe((nextViewport) => {
      setSubscribedViewport(nextViewport);
    });
  }, [onViewportSubscribe, viewport]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = 140;
    const scale = size / gridSize;
    
    // Track if structure version changed (indicates building/zone/terrain changes)
    const currentStructureVersion = structureVersion ?? 0;
    const structureVersionChanged = lastStructureVersionRef.current !== currentStructureVersion;
    
    // Re-render grid portion every 10 ticks OR when grid changes (building placed, etc.)
    // This ensures immediate updates when user places buildings while keeping CPU usage low
    const shouldRenderGrid = lastGridRenderTickRef.current === -1 || 
                             tick - lastGridRenderTickRef.current >= 10 ||
                             structureVersionChanged;
    
    if (shouldRenderGrid) {
      lastStructureVersionRef.current = currentStructureVersion;
      lastGridRenderTickRef.current = tick;
      
      const C = MINIMAP_COLORS;
      ctx.fillStyle = C.background;
      ctx.fillRect(0, 0, size, size);

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const tile = grid[y][x];
          const buildingType = tile.building.type;
          let color: string = C.grass;

          // Prioritized color checks using Set for common cases
          if (buildingType === 'water') color = C.water;
          else if (buildingType === 'road') color = C.road;
          else if (buildingType === 'tree') color = C.tree;
          else if (tile.building.onFire) color = C.fire;
          else if (buildingType === 'informal_housing') color = C.informal;
          else if (tile.zone === 'residential' && buildingType !== 'grass') color = C.residential;
          else if (tile.zone === 'residential') color = C.residentialEmpty;
          else if (tile.zone === 'commercial' && buildingType !== 'grass') color = C.commercial;
          else if (tile.zone === 'commercial') color = C.commercialEmpty;
          else if (tile.zone === 'industrial' && buildingType !== 'grass') color = C.industrial;
          else if (tile.zone === 'industrial') color = C.industrialEmpty;
          else if (serviceBuildings.has(buildingType)) color = C.service;
          else if (buildingType === 'power_plant') color = C.power;
          else if (buildingType === 'water_tower' || buildingType === 'jal_sansthan_water_works') color = C.waterWorks;
          else if (parkBuildings.has(buildingType)) color = C.park;
          
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale));
        }
      }
      
      // Save the grid portion for quick viewport-only updates
      gridImageRef.current = ctx.getImageData(0, 0, size, size);
    } else if (gridImageRef.current) {
      // Restore cached grid image, then just draw viewport
      ctx.putImageData(gridImageRef.current, 0, 0);
    }
    
    // Draw viewport rectangle (always updated)
    if (subscribedViewport) {
      const { offset, zoom, canvasSize } = subscribedViewport;
      
      const screenToGridForMinimap = (screenX: number, screenY: number) => {
        const adjustedX = (screenX - offset.x) / zoom;
        const adjustedY = (screenY - offset.y) / zoom;
        const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
        const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
        return { gridX, gridY };
      };
      
      const topLeft = screenToGridForMinimap(0, 0);
      const topRight = screenToGridForMinimap(canvasSize.width, 0);
      const bottomLeft = screenToGridForMinimap(0, canvasSize.height);
      const bottomRight = screenToGridForMinimap(canvasSize.width, canvasSize.height);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topLeft.gridX * scale, topLeft.gridY * scale);
      ctx.lineTo(topRight.gridX * scale, topRight.gridY * scale);
      ctx.lineTo(bottomRight.gridX * scale, bottomRight.gridY * scale);
      ctx.lineTo(bottomLeft.gridX * scale, bottomLeft.gridY * scale);
      ctx.closePath();
      ctx.stroke();
    }
  }, [grid, gridSize, tick, structureVersion, subscribedViewport, serviceBuildings, parkBuildings]);

  const [isDragging, setIsDragging] = useState(false);
  
  const navigateToPosition = useCallback((e: { clientX: number; clientY: number }, instant = false) => {
    if (!onNavigate) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Displayed size (the canvas may be scaled up by CSS, e.g. in the mobile overlay)
    const scale = rect.width / gridSize;
    
    const gridX = Math.floor(clickX / scale);
    const gridY = Math.floor(clickY / scale);
    
    // Clamp to valid grid coordinates
    const clampedX = Math.max(0, Math.min(gridSize - 1, gridX));
    const clampedY = Math.max(0, Math.min(gridSize - 1, gridY));
    
    onNavigate(clampedX, clampedY, instant);
  }, [onNavigate, gridSize]);

  // Pointer events (mouse and touch). The press glides there; dragging then moves the camera directly.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    navigateToPosition(e);
  }, [navigateToPosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      navigateToPosition(e, true);
    }
  }, [isDragging, navigateToPosition]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <Card className={`hud-panel gold-hairline p-2.5 rounded-2xl ${inline ? '' : 'fixed bottom-4 right-4 z-50'}`}>
      <div className="hud-label mb-2 flex items-center gap-1.5">
        <span className="ornament text-gold/80 !w-2.5 !h-2.5" aria-hidden />
        {m(MINIMAP_LABEL)}
      </div>
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        style={{ width: size, height: size }}
        className="block rounded-lg ring-1 ring-gold/25 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.4)] cursor-pointer select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] leading-tight">
        {MINIMAP_LEGEND.map(({ color, label }) => (
          <div key={color} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground truncate">{m(label)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
});
