'use client';

import React from 'react';
import { Tool } from '@/types/game';

type IconProps = { size?: number; className?: string };

const baseStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function SelectIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M5 3l14 7-6 2-2.5 6.5z" fill="currentColor" fillOpacity="0.18" />
      <path {...baseStroke} d="M13 12l5.5 6.5" />
    </svg>
  );
}

export function BulldozeIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M3 17v-6h9v6" />
      <path {...baseStroke} d="M5.5 11V7h4l2.5 4" />
      <rect {...baseStroke} x="2.5" y="17" width="13" height="4" />
      <path {...baseStroke} d="M15 12h4.5M20 5v13" />
      <path {...baseStroke} d="M6 19h.01M12 19h.01" />
    </svg>
  );
}

export function PlayIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M8 5v14l10-7z" />
    </svg>
  );
}

export function PauseIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M8 5v14M16 5v14" />
    </svg>
  );
}

export function FastForwardIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M4 5l7 7-7 7zM13 5l7 7-7 7z" />
    </svg>
  );
}

export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

export function RoadIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M9.5 3L4 21M14.5 3L20 21" />
      <path {...baseStroke} d="M12 4v2.5M12 10v3M12 17v3.5" />
      <path {...baseStroke} d="M3 21h18" />
    </svg>
  );
}

export function TreeIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M12 2.5c3.6 2.2 6 4.6 6 8a6 6 0 01-12 0c0-3.4 2.4-5.8 6-8z" fill="currentColor" fillOpacity="0.15" />
      <path {...baseStroke} d="M12 10v11M12 14l-2.5-2.5M12 12.5l2.5-2.5" />
      <path {...baseStroke} d="M8.5 21h7" />
    </svg>
  );
}

export function FireIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3s2 3 2 5-2 4-2 4-2-2-2-4 2-5 2-5z" />
      <path {...baseStroke} d="M12 12c-2 1-3 3-3 4.5a3 3 0 0 0 6 0C15 15 14 13 12 12z" />
    </svg>
  );
}

export function PowerIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M13 2l-4 10h4l-2 10 8-12h-5l3-8z" />
    </svg>
  );
}

/** A river with waves: used for the Ganga overlay and Ganga Health. */
export function RiverIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M3 3.5h4v4h4v4h4v3.5" />
      <path {...baseStroke} d="M3 17c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0" />
      <path {...baseStroke} d="M3 21c2-1.4 4-1.4 6 0s4 1.4 6 0 4-1.4 6 0" />
      <path {...baseStroke} d="M17 8c1.2-.8 2.8-.8 4 0" />
    </svg>
  );
}

/** A house with water up to its walls: used for the flood-risk overlay (S4-T5). */
export function FloodIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M5 13V8l7-5 7 5v5" />
      <path {...baseStroke} d="M2 16c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0 2 .6 2 .6" />
      <path {...baseStroke} d="M2 20.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0 2 .6 2 .6" />
    </svg>
  );
}

export function WaterIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
      <path {...baseStroke} d="M9 15c.5.8 1.5 1.2 3 1.2 1.5 0 2.5-.4 3-1.2" />
    </svg>
  );
}

export function PopulationIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="9" cy="8" r="3" />
      <path {...baseStroke} d="M4 19c0-3 2.5-5 5-5s5 2 5 5" />
      <circle {...baseStroke} cx="17" cy="10" r="2" />
      <path {...baseStroke} d="M15 19c0-2 1.2-3.3 2.5-3.8" />
    </svg>
  );
}

export function JobsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <path {...baseStroke} d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path {...baseStroke} d="M10 14h4" />
    </svg>
  );
}

export function MoneyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect {...baseStroke} x="4" y="6" width="16" height="12" rx="2" />
      <path {...baseStroke} d="M12 9v6M9 12h6" />
    </svg>
  );
}

export function HappyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="12" cy="12" r="9" />
      <path {...baseStroke} d="M9 10h.01M15 10h.01M8 14c1 1 2.5 1.5 4 1.5s3-.5 4-1.5" />
    </svg>
  );
}

export function HealthIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="12" cy="12" r="8.5" />
      <path {...baseStroke} d="M12 9v6M9 12h6" />
    </svg>
  );
}

export function MedicalCrossIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 2v20M2 12h20" />
      <circle {...baseStroke} cx="12" cy="12" r="10" />
    </svg>
  );
}

export function EducationIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M3 9l9-5 9 5-9 5-9-5z" />
      <path {...baseStroke} d="M12 14v7" />
      <path {...baseStroke} d="M7 12v4c0 1 2 2 5 2s5-1 5-2v-4" />
    </svg>
  );
}

export function SafetyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3l8 4v5c0 4.5-3.5 7.8-8 9-4.5-1.2-8-4.5-8-9V7z" />
      <path {...baseStroke} d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function EnvironmentIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 3c3 3 6 6 6 10a6 6 0 0 1-12 0c0-4 3-7 6-10z" />
      <path {...baseStroke} d="M12 10v6M9 14h6" />
    </svg>
  );
}

export function BudgetIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M3 8h18v12H3z" fill="currentColor" fillOpacity="0.14" />
      <path {...baseStroke} d="M3 8V5.5L17 4v4" />
      <path {...baseStroke} d="M21 12.5h-5.5v4H21" />
      <path {...baseStroke} d="M17.5 14.5h.01" strokeWidth={2.6} />
    </svg>
  );
}

export function ChartIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M3.5 20.5h17" />
      <rect {...baseStroke} x="5" y="13" width="3.5" height="7.5" />
      <rect {...baseStroke} x="10.25" y="8" width="3.5" height="12.5" />
      <rect {...baseStroke} x="15.5" y="4" width="3.5" height="16.5" />
    </svg>
  );
}

export function TrophyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path {...baseStroke} d="M10 14h4M9 19h6" />
      <path {...baseStroke} d="M6 6h-2v2a3 3 0 0 0 3 3" />
      <path {...baseStroke} d="M18 6h2v2a3 3 0 0 1-3 3" />
    </svg>
  );
}

export function AdvisorIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M9 17.5h6M10 21h4" />
      <path {...baseStroke} d="M12 3a6 6 0 00-3.6 10.8c.6.5 1.1 1.2 1.1 2h5c0-.8.5-1.5 1.1-2A6 6 0 0012 3z" fill="currentColor" fillOpacity="0.14" />
    </svg>
  );
}

export function SettingsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="12" cy="12" r="3" />
      <path {...baseStroke} d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function AlertIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M12 4l8 14H4z" />
      <path {...baseStroke} d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function InfoIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle {...baseStroke} cx="12" cy="12" r="9" />
      <path {...baseStroke} d="M12 10v6M12 7h.01" />
    </svg>
  );
}

export function BudgetSheetIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M6 4h9l3 3v13H6z" />
      <path {...baseStroke} d="M9 10h6M9 14h6M9 18h3" />
    </svg>
  );
}

export function PlaneIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M3 13l18-8-7 14-3-4-5 3z" />
    </svg>
  );
}

export function MuseumIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M4 20h16v-2H4z" />
      <path {...baseStroke} d="M6 18V8l6-4 6 4v10" />
      <path {...baseStroke} d="M8 12h2M14 12h2M10 16h4" />
    </svg>
  );
}

export function CityHallIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Building base */}
      <path {...baseStroke} d="M4 20h16v-8H4z" />
      {/* Columns */}
      <path {...baseStroke} d="M6 12V8M10 12V8M14 12V8M18 12V8" />
      {/* Dome/roof */}
      <path {...baseStroke} d="M4 8l8-4 8 4" />
      {/* Flag */}
      <path {...baseStroke} d="M12 4v2M12 4l2 1-2 1" />
    </svg>
  );
}

export function AmusementParkIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Ferris wheel circle */}
      <circle {...baseStroke} cx="12" cy="12" r="7" />
      {/* Center hub */}
      <circle {...baseStroke} cx="12" cy="12" r="1.5" />
      {/* Spokes */}
      <path {...baseStroke} d="M12 5l0 7M19 12l-7 0M12 19l0-7M5 12l7 0" />
      {/* Base/platform */}
      <path {...baseStroke} d="M6 20h12" />
      <path {...baseStroke} d="M8 20v-1M16 20v-1" />
    </svg>
  );
}

export function ShareIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Share nodes */}
      <circle {...baseStroke} cx="18" cy="5" r="3" />
      <circle {...baseStroke} cx="6" cy="12" r="3" />
      <circle {...baseStroke} cx="18" cy="19" r="3" />
      {/* Connecting lines */}
      <path {...baseStroke} d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

export function CheckIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path {...baseStroke} d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function SubwayIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect {...baseStroke} x="5" y="3" width="14" height="15" rx="3" />
      <path {...baseStroke} d="M5 11h14" />
      <rect {...baseStroke} x="7.5" y="5.5" width="9" height="3.5" />
      <path {...baseStroke} d="M8.5 14.5h.01M15.5 14.5h.01" strokeWidth={2.6} />
      <path {...baseStroke} d="M8 18l-2 3M16 18l2 3" />
    </svg>
  );
}

export function RailIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...baseStroke} d="M9.5 3L7 21M14.5 3L17 21" />
      <path {...baseStroke} d="M8.5 6.5h7M7.8 11.5h8.4M7.2 16.5h9.6M4.5 21h15" />
    </svg>
  );
}

export function SubwayStationIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* Station entrance */}
      <path {...baseStroke} d="M4 19h16" />
      <path {...baseStroke} d="M6 19V9l6-4 6 4v10" />
      {/* Stairs going down */}
      <path {...baseStroke} d="M9 19v-3h2v-2h2v-2h2v7" />
      {/* "M" for Metro */}
      <path {...baseStroke} d="M8 10l2 2 2-2" />
    </svg>
  );
}

/** Zone tool glyph: a building that says which zone it is, with a faint zone-colour fill. */
function ZoneBuilding({ color, size = 18, className, kind }: IconProps & { color: string; kind: 'res' | 'com' | 'ind' }) {
  const tint = { fill: color, fillOpacity: 0.34, stroke: 'none' };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {kind === 'res' && (<>
        <rect {...tint} x="4" y="9" width="16" height="12" />
        <path {...baseStroke} d="M4 21V9h16v12M2.5 21h19M6.5 9V5.5h11V9M10 21v-5a2 2 0 014 0v5" />
      </>)}
      {kind === 'com' && (<>
        <rect {...tint} x="4" y="10" width="16" height="11" />
        <path {...baseStroke} d="M4 10v11h16V10M2.5 21h19M5 3.5h14l2 6.5H3zM9.7 3.5L8.5 10M14.3 3.5L15.5 10M10 21v-6h4v6" />
      </>)}
      {kind === 'ind' && (<>
        <path {...tint} d="M3 21V10l6 4v-4l6 4v7z" />
        <path {...baseStroke} d="M3 21V10l6 4v-4l6 4V21M2 21h20M17 21V4h4v17M18 1.5c1 .8 2 .8 3 0" />
        <path {...baseStroke} d="M7 18h.01M11 18h.01" />
      </>)}
    </svg>
  );
}

/** Land tools: a dashed tile with a small mark (X to clear, waves for water, mound for land). */
function ZoneTile({ color, size = 18, className, mark }: IconProps & { color: string; mark: 'x' | 'water' | 'land' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" fill={color} fillOpacity="0.3" />
      <rect {...baseStroke} x="3.5" y="3.5" width="17" height="17" strokeDasharray="3.2 2.6" />
      {mark === 'x' && <path {...baseStroke} d="M8.5 8.5l7 7M15.5 8.5l-7 7" />}
      {mark === 'water' && <path {...baseStroke} d="M7 10.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 1.8-.7 2.5-.4M7 15c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 1.8-.7 2.5-.4" />}
      {mark === 'land' && <path {...baseStroke} d="M7 16l3.5-5 2.5 3 1.5-2L17 16z" />}
    </svg>
  );
}

export const ToolIcons: Partial<Record<Tool, React.FC<IconProps>>> = {
  select: SelectIcon,
  bulldoze: BulldozeIcon,
  road: RoadIcon,
  rail: RailIcon,
  subway: SubwayIcon,
  tree: TreeIcon,
  zone_residential: (props) => <ZoneBuilding {...props} kind="res" color="#15803d" />, 
  zone_commercial: (props) => <ZoneBuilding {...props} kind="com" color="#0369a1" />, 
  zone_industrial: (props) => <ZoneBuilding {...props} kind="ind" color="#b45309" />, 
  zone_dezone: (props) => <ZoneTile {...props} mark="x" color="#57534e" />,
  zone_water: (props) => <ZoneTile {...props} mark="water" color="#0e7490" />,
  zone_land: (props) => <ZoneTile {...props} mark="land" color="#047857" />,
  police_station: SafetyIcon,
  fire_station: FireIcon,
  hospital: HealthIcon,
  school: EducationIcon,
  university: EducationIcon,
  park: TreeIcon,
  power_plant: PowerIcon,
  water_tower: WaterIcon,
  subway_station: SubwayStationIcon,
  stadium: TrophyIcon,
  museum: MuseumIcon,
  airport: PlaneIcon,
  city_hall: CityHallIcon,
  amusement_park: AmusementParkIcon,
};

