import { Boat, TourWaypoint, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import {
  BOAT_COLORS,
  BOAT_MIN_ZOOM,
  WAKE_MIN_ZOOM_MOBILE,
  BOATS_PER_DOCK,
  BOATS_PER_DOCK_MOBILE,
  MAX_BOATS,
  MAX_BOATS_MOBILE,
  WAKE_MAX_AGE,
  WAKE_SPAWN_INTERVAL,
  BOAT_MIN_ZOOM_FAR,
} from './constants';
import { gridToScreen } from './utils';
import { findMarinasAndPiers, findAdjacentWaterTile, isOverWater, generateTourWaypoints } from './gridFinders';
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';
import type { MapId } from '@/games/isocity/maps/varanasi';
import {
  GHAT_BOAT_CONFIG,
  getGhatBoatNetwork,
  getDestinationCandidates,
  getDockRoute,
  getMaxGhatBoats,
  isRouteNavigable,
  type GhatBoatNetwork,
} from './ghatBoats';

export interface BoatSystemRefs {
  boatsRef: React.MutableRefObject<Boat[]>;
  boatIdRef: React.MutableRefObject<number>;
  boatSpawnTimerRef: React.MutableRefObject<number>;
}

export interface BoatSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  isMobile: boolean;
  visualHour: number;
  /** S2-T10: on the Varanasi map, boats also travel between ghats. */
  mapId?: MapId;
  gameVersion?: number;
  structureVersionRef?: React.MutableRefObject<number>;
}

export function createBoatSystem(
  refs: BoatSystemRefs,
  systemState: BoatSystemState
) {
  const { boatsRef, boatIdRef, boatSpawnTimerRef } = refs;
  const { worldStateRef, isMobile, visualHour, mapId, gameVersion, structureVersionRef } = systemState;

  // Find marinas and piers callback
  const findMarinasAndPiersCallback = () => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findMarinasAndPiers(currentGrid, currentGridSize);
  };

  // Find adjacent water tile callback
  const findAdjacentWaterTileCallback = (dockX: number, dockY: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findAdjacentWaterTile(currentGrid, currentGridSize, dockX, dockY);
  };

  // Check if screen position is over water callback
  const isOverWaterCallback = (screenX: number, screenY: number): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return isOverWater(currentGrid, currentGridSize, screenX, screenY);
  };

  // Generate tour waypoints callback
  const generateTourWaypointsCallback = (startTileX: number, startTileY: number): TourWaypoint[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return generateTourWaypoints(currentGrid, currentGridSize, startTileX, startTileY);
  };

  // S2-T10: start a ghat boat on a trip from dock `from` to a random dock at least minRouteDistance away.
  // Returns false if there is no reachable destination.
  const startGhatTrip = (boat: Boat, network: GhatBoatNetwork, from: number): boolean => {
    const candidates = getDestinationCandidates(network.docks, from, GHAT_BOAT_CONFIG.minRouteDistance);
    // Try a few random candidates (landfill can cut a dock off from the rest of the river)
    for (let attempt = 0; attempt < 3 && candidates.length > 0; attempt++) {
      const to = candidates[Math.floor(Math.random() * candidates.length)];
      const route = getDockRoute(network, from, to);
      if (!route || route.poly.length < 4) continue;
      boat.ghatRoute = {
        tiles: route.tiles,
        poly: route.poly,
        length: route.length,
        progress: 0,
        segment: 0,
        segmentStart: 0,
        fromDock: from,
        toDock: to,
        revision: network.revision,
        waitTime: GHAT_BOAT_CONFIG.dockWaitMin + Math.random() * GHAT_BOAT_CONFIG.dockWaitRange,
      };
      boat.x = route.poly[0];
      boat.y = route.poly[1];
      boat.angle = Math.atan2(route.poly[3] - route.poly[1], route.poly[2] - route.poly[0]);
      boat.targetAngle = boat.angle;
      boat.state = 'touring';
      boat.age = 0;
      boat.speed = GHAT_BOAT_CONFIG.speedMin + Math.random() * GHAT_BOAT_CONFIG.speedRange;
      boat.originX = network.docks[from].x;
      boat.originY = network.docks[from].y;
      boat.destX = network.docks[to].x;
      boat.destY = network.docks[to].y;
      const last = route.poly.length - 2;
      boat.destScreenX = route.poly[last];
      boat.destScreenY = route.poly[last + 1];
      boat.homeScreenX = route.poly[0];
      boat.homeScreenY = route.poly[1];
      return true;
    }
    return false;
  };

  // S2-T10: move a ghat boat along its route. Positions come straight from the polyline, so the boat never
  // leaves the route's river tiles. Returns false when the boat should be removed.
  const stepGhatBoat = (boat: Boat, network: GhatBoatNetwork, dt: number, overCap: boolean): boolean => {
    const r = boat.ghatRoute!;
    if (r.revision !== network.revision) {
      // The map changed: drop boats whose route is no longer water; re-find the destination dock by its mooring tile
      if (!isRouteNavigable(network, r.tiles)) return false;
      const endTile = r.tiles[r.tiles.length - 1];
      r.toDock = network.docks.findIndex((d) => d.waterIdx === endTile);
      if (boat.state === 'docked') r.fromDock = r.toDock;
      r.revision = network.revision;
    }
    if (boat.state === 'docked') {
      if (boat.age < r.waitTime) return true;
      if (overCap || r.fromDock < 0) return false;
      if (!startGhatTrip(boat, network, r.fromDock)) boat.age = 0; // nowhere to go yet: wait again
      return true;
    }
    const { easeDistance, easeMinFactor } = GHAT_BOAT_CONFIG;
    const ease = Math.max(easeMinFactor, Math.min(1, Math.min(r.progress + 1, r.length - r.progress) / easeDistance));
    r.progress += boat.speed * ease * dt;
    const poly = r.poly;
    if (r.progress >= r.length) {
      boat.x = poly[poly.length - 2];
      boat.y = poly[poly.length - 1];
      boat.state = 'docked';
      boat.age = 0;
      boat.wake = [];
      r.fromDock = r.toDock;
      return true;
    }
    const lastSeg = poly.length / 2 - 2;
    let segLen = Math.hypot(poly[r.segment * 2 + 2] - poly[r.segment * 2], poly[r.segment * 2 + 3] - poly[r.segment * 2 + 1]);
    while (r.segment < lastSeg && r.segmentStart + segLen < r.progress) {
      r.segmentStart += segLen;
      r.segment++;
      segLen = Math.hypot(poly[r.segment * 2 + 2] - poly[r.segment * 2], poly[r.segment * 2 + 3] - poly[r.segment * 2 + 1]);
    }
    const i = r.segment * 2;
    const t = segLen > 0 ? Math.min(1, (r.progress - r.segmentStart) / segLen) : 1;
    boat.x = poly[i] + (poly[i + 2] - poly[i]) * t;
    boat.y = poly[i + 1] + (poly[i + 3] - poly[i + 1]) * t;
    boat.targetAngle = Math.atan2(poly[i + 3] - poly[i + 1], poly[i + 2] - poly[i]);
    let angleDiff = boat.targetAngle - boat.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    boat.angle += angleDiff * Math.min(1, dt * 4);
    return true;
  };

  // Add a wake particle behind a moving boat (simpler on mobile)
  const spawnWake = (boat: Boat, delta: number) => {
    const wakeSpawnInterval = isMobile ? 0.08 : WAKE_SPAWN_INTERVAL;
    boat.wakeSpawnProgress += delta;
    if (boat.wakeSpawnProgress >= wakeSpawnInterval) {
      boat.wakeSpawnProgress -= wakeSpawnInterval;

      // Add single wake particle behind the boat
      const behindBoat = -6; // Position behind the boat
      boat.wake.push({
        x: boat.x + Math.cos(boat.angle) * behindBoat,
        y: boat.y + Math.sin(boat.angle) * behindBoat,
        age: 0,
        opacity: 1
      });
    }
  };

  // Update boats - spawn, move, and manage lifecycle
  const updateBoats = (delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Clear boats if zoomed out too far (use far threshold for large map support)
    const effectiveMinZoom = Math.max(BOAT_MIN_ZOOM, BOAT_MIN_ZOOM_FAR);
    if (currentZoom < effectiveMinZoom) {
      boatsRef.current = [];
      return;
    }

    // Find marinas and piers
    const docks = findMarinasAndPiersCallback();
    // S2-T10: ghat docks on the Varanasi map (cached; rebuilt only when the map's structure changes)
    const ghatNetwork = getGhatBoatNetwork(currentGrid, currentGridSize, mapId, structureVersionRef?.current ?? 0, gameVersion ?? 0);
    const ghatDocks = ghatNetwork ? ghatNetwork.docks.length : 0;

    // No boats if no docks
    if (docks.length === 0 && ghatDocks === 0) {
      boatsRef.current = [];
      return;
    }

    // Calculate max boats based on number of docks - lower on mobile for performance
    const boatsPerDock = isMobile ? BOATS_PER_DOCK_MOBILE : BOATS_PER_DOCK;
    const maxBoatsLimit = isMobile ? MAX_BOATS_MOBILE : MAX_BOATS;
    const maxBoats = Math.min(maxBoatsLimit, Math.floor(docks.length * boatsPerDock));
    const maxGhatBoats = ghatNetwork && ghatDocks >= 2
      ? getMaxGhatBoats(ghatNetwork.ghatCount, isMobile ? GHAT_BOAT_CONFIG.maxBoatsMobile : GHAT_BOAT_CONFIG.maxBoats)
      : 0;
    let marinaBoatCount = 0;
    let ghatBoatCount = 0;
    for (const boat of boatsRef.current) {
      if (boat.ghatRoute) ghatBoatCount++;
      else marinaBoatCount++;
    }

    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    boatSpawnTimerRef.current -= delta;
    if (ghatNetwork && ghatBoatCount < maxGhatBoats && boatSpawnTimerRef.current <= 0 &&
        (docks.length === 0 || marinaBoatCount >= maxBoats || Math.random() < 0.5)) {
      // S2-T10: a new boat leaves a random ghat for another ghat along the Ganga
      const boat: Boat = {
        id: boatIdRef.current++,
        x: 0, y: 0, angle: 0, targetAngle: 0,
        state: 'touring',
        speed: GHAT_BOAT_CONFIG.speedMin,
        originX: 0, originY: 0, destX: 0, destY: 0, destScreenX: 0, destScreenY: 0,
        age: 0,
        color: BOAT_COLORS[Math.floor(Math.random() * BOAT_COLORS.length)],
        wake: [],
        wakeSpawnProgress: 0,
        sizeVariant: Math.random() < 0.7 ? 0 : 1,
        tourWaypoints: [],
        tourWaypointIndex: 0,
        homeScreenX: 0,
        homeScreenY: 0,
      };
      if (startGhatTrip(boat, ghatNetwork, Math.floor(Math.random() * ghatDocks))) {
        boatsRef.current.push(boat);
        ghatBoatCount++;
      }
      boatSpawnTimerRef.current = GHAT_BOAT_CONFIG.spawnIntervalMin + Math.random() * GHAT_BOAT_CONFIG.spawnIntervalRange;
    }
    if (docks.length > 0 && marinaBoatCount < maxBoats && boatSpawnTimerRef.current <= 0) {
      // Pick a random dock as home base
      const homeDock = docks[Math.floor(Math.random() * docks.length)];
      
      // Find adjacent water tile for positioning
      const waterTile = findAdjacentWaterTileCallback(homeDock.x, homeDock.y);
      if (waterTile) {
        // Generate tour waypoints within the connected body of water
        const tourWaypoints = generateTourWaypointsCallback(waterTile.x, waterTile.y);
        
        // Convert to screen coordinates
        const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(waterTile.x, waterTile.y, 0, 0);
        const homeScreenX = originScreenX + TILE_WIDTH / 2;
        const homeScreenY = originScreenY + TILE_HEIGHT / 2;
        
        // Set first tour waypoint as initial destination (or home if no waypoints)
        let firstDestScreenX = homeScreenX;
        let firstDestScreenY = homeScreenY;
        if (tourWaypoints.length > 0) {
          firstDestScreenX = tourWaypoints[0].screenX;
          firstDestScreenY = tourWaypoints[0].screenY;
        }
        
        // Calculate angle to first destination
        const angle = Math.atan2(firstDestScreenY - originScreenY, firstDestScreenX - originScreenX);
        
        boatsRef.current.push({
          id: boatIdRef.current++,
          x: homeScreenX,
          y: homeScreenY,
          angle: angle,
          targetAngle: angle,
          state: 'departing',
          speed: 15 + Math.random() * 10, // Boats are slower than cars
          originX: homeDock.x,
          originY: homeDock.y,
          destX: homeDock.x, // Will be updated based on tour/return
          destY: homeDock.y,
          destScreenX: firstDestScreenX,
          destScreenY: firstDestScreenY,
          age: 0,
          color: BOAT_COLORS[Math.floor(Math.random() * BOAT_COLORS.length)],
          wake: [],
          wakeSpawnProgress: 0,
          sizeVariant: Math.random() < 0.7 ? 0 : 1, // 70% small boats, 30% medium
          tourWaypoints: tourWaypoints,
          tourWaypointIndex: 0,
          homeScreenX: homeScreenX,
          homeScreenY: homeScreenY,
        });
      }
      
      boatSpawnTimerRef.current = 1 + Math.random() * 2; // 1-3 seconds between spawns
    }

    // Update existing boats
    const updatedBoats: Boat[] = [];
    
    for (const boat of boatsRef.current) {
      boat.age += delta;
      
      // Update wake particles (similar to contrails) - shorter on mobile
      const wakeMaxAge = isMobile ? 0.6 : WAKE_MAX_AGE;
      boat.wake = boat.wake
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / wakeMaxAge) }))
        .filter(p => p.age < wakeMaxAge);

      // S2-T10: ghat boats follow their river route exactly
      if (boat.ghatRoute) {
        if (!ghatNetwork) continue;
        if (!stepGhatBoat(boat, ghatNetwork, delta * speedMultiplier, ghatBoatCount > maxGhatBoats)) {
          ghatBoatCount--;
          continue;
        }
        if (boat.state !== 'docked') spawnWake(boat, delta);
        updatedBoats.push(boat);
        continue;
      }
      if (docks.length === 0) continue; // marina/pier boats need a marina or pier

      // Distance to destination
      const distToDest = Math.hypot(boat.x - boat.destScreenX, boat.y - boat.destScreenY);
      
      // Calculate next position
      let nextX = boat.x;
      let nextY = boat.y;
      
      switch (boat.state) {
        case 'departing': {
          // Move away from dock, then switch to touring (or sailing if no waypoints)
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          if (boat.age > 2) {
            // Start touring if we have waypoints, otherwise head home
            if (boat.tourWaypoints.length > 0) {
              boat.state = 'touring';
              boat.tourWaypointIndex = 0;
              // Set first waypoint as destination
              boat.destScreenX = boat.tourWaypoints[0].screenX;
              boat.destScreenY = boat.tourWaypoints[0].screenY;
            } else {
              // No tour, just sail around briefly then return
              boat.state = 'sailing';
              boat.destScreenX = boat.homeScreenX;
              boat.destScreenY = boat.homeScreenY;
            }
          }
          break;
        }
        
        case 'touring': {
          // Navigate through tour waypoints
          const angleToWaypoint = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToWaypoint;
          
          // Smooth turning (slightly slower for leisurely tour)
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 1.8);
          
          // Calculate next position
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          // Check if reached current waypoint
          if (distToDest < 40) {
            boat.tourWaypointIndex++;
            
            // Check if there are more waypoints
            if (boat.tourWaypointIndex < boat.tourWaypoints.length) {
              // Move to next waypoint
              const nextWaypoint = boat.tourWaypoints[boat.tourWaypointIndex];
              boat.destScreenX = nextWaypoint.screenX;
              boat.destScreenY = nextWaypoint.screenY;
            } else {
              // Tour complete - head back home
              boat.state = 'sailing';
              boat.destScreenX = boat.homeScreenX;
              boat.destScreenY = boat.homeScreenY;
              boat.age = 0; // Reset age for the return trip
            }
          }
          
          // Safety: remove boats that have been touring too long (stuck)
          if (boat.age > 120) {
            continue;
          }
          break;
        }
        
        case 'sailing': {
          // Navigate toward home dock with gentle course corrections
          const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToDestination;
          
          // Smooth turning
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 2);
          
          // Calculate next position
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          // Check if approaching home dock
          if (distToDest < 60) {
            boat.state = 'arriving';
          }
          
          // Safety: remove boats that have been sailing too long (stuck)
          if (boat.age > 60) {
            continue;
          }
          break;
        }
        
        case 'arriving': {
          // Slow down and dock at home
          boat.speed = Math.max(5, boat.speed - delta * 8);
          
          const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToDestination;
          
          // Smooth turning
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 3);
          
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          // Check if docked at home
          if (distToDest < 15) {
            boat.state = 'docked';
            boat.age = 0; // Reset age for dock timer
            boat.wake = []; // Clear wake when docked
          }
          break;
        }
        
        case 'docked': {
          // Wait at dock, then generate a new tour and depart
          if (boat.age > 3 + Math.random() * 3) {
            // Generate fresh tour waypoints for the next trip
            const waterTile = findAdjacentWaterTileCallback(boat.originX, boat.originY);
            if (waterTile) {
              boat.tourWaypoints = generateTourWaypointsCallback(waterTile.x, waterTile.y);
              boat.tourWaypointIndex = 0;
            }
            
            boat.state = 'departing';
            boat.speed = 15 + Math.random() * 10;
            boat.age = 0;
            
            // Set initial destination for departure
            if (boat.tourWaypoints.length > 0) {
              boat.destScreenX = boat.tourWaypoints[0].screenX;
              boat.destScreenY = boat.tourWaypoints[0].screenY;
            } else {
              // No waypoints - pick a random direction temporarily
              boat.destScreenX = boat.homeScreenX + (Math.random() - 0.5) * 200;
              boat.destScreenY = boat.homeScreenY + (Math.random() - 0.5) * 200;
            }
            
            // Calculate angle to new destination
            const angle = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
            boat.angle = angle;
            boat.targetAngle = angle;
          }
          break;
        }
      }
      
      // Check if next position is over water (skip for docked boats)
      if (boat.state !== 'docked') {
        if (!isOverWaterCallback(nextX, nextY)) {
          // Next position would be on land - remove the boat
          continue;
        }
        
        // Update position
        boat.x = nextX;
        boat.y = nextY;
        
        // Add wake particles when moving (simpler on mobile)
        spawnWake(boat, delta);
      }
      
      updatedBoats.push(boat);
    }
    
    boatsRef.current = updatedBoats;
  };

  // Draw boats with wakes
  const drawBoats = (ctx: IsoRenderer) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Don't draw boats if zoomed out
    if (currentZoom < BOAT_MIN_ZOOM) {
      return;
    }
    
    // Early exit if no boats
    if (!currentGrid || currentGridSize <= 0 || boatsRef.current.length === 0) {
      return;
    }
    
    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
    
    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 100;
    const viewTop = -currentOffset.y / currentZoom - 100;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;
    
    // Hide wakes on mobile when zoomed out (similar to streetlights/traffic lights threshold)
    const showWakes = !isMobile || currentZoom >= WAKE_MIN_ZOOM_MOBILE;
    
    for (const boat of boatsRef.current) {
      // Draw wake particles first (behind boat) - similar to plane contrails
      if (showWakes && boat.wake.length > 0) {
        for (const particle of boat.wake) {
          // Skip if outside viewport
          if (particle.x < viewLeft || particle.x > viewRight || particle.y < viewTop || particle.y > viewBottom) {
            continue;
          }
          
          // Wake particles expand and fade over time
          const size = 1.2 + particle.age * 2;
          const opacity = particle.opacity * 0.5;
          
          ctx.fillStyle = `rgba(200, 220, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Skip boat rendering if outside viewport
      if (boat.x < viewLeft || boat.x > viewRight || boat.y < viewTop || boat.y > viewBottom) {
        continue;
      }
      
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.angle);
      
      const scale = boat.sizeVariant === 0 ? 0.5 : 0.65;
      ctx.scale(scale, scale);
      
      // Draw small foam/splash at stern when moving
      if (boat.state !== 'docked') {
        const foamOpacity = Math.min(0.5, boat.speed / 30);
        ctx.fillStyle = `rgba(255, 255, 255, ${foamOpacity})`;
        ctx.beginPath();
        ctx.ellipse(-7, 0, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw boat hull (simple sailboat/motorboat shape)
      ctx.fillStyle = boat.color;
      ctx.beginPath();
      // Hull - pointed bow, flat stern
      ctx.moveTo(10, 0); // Bow
      ctx.quadraticCurveTo(8, -4, 0, -4); // Starboard side
      ctx.lineTo(-8, -3); // Stern starboard
      ctx.lineTo(-8, 3); // Stern port
      ctx.lineTo(0, 4); // Port side
      ctx.quadraticCurveTo(8, 4, 10, 0); // Back to bow
      ctx.closePath();
      ctx.fill();
      
      // Hull outline
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      
      // Deck (lighter color)
      const hullHSL = boat.color === '#ffffff' ? 'hsl(0, 0%, 95%)' : 
                      boat.color === '#1e3a5f' ? 'hsl(210, 52%, 35%)' :
                      boat.color === '#8b4513' ? 'hsl(30, 75%, 40%)' :
                      boat.color === '#2f4f4f' ? 'hsl(180, 25%, 35%)' :
                      boat.color === '#c41e3a' ? 'hsl(350, 75%, 50%)' :
                      'hsl(210, 80%, 50%)';
      ctx.fillStyle = hullHSL;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Cabin/cockpit
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(-3, -1.5, 4, 3);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.3;
      ctx.strokeRect(-3, -1.5, 4, 3);
      
      // Mast or antenna
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(2, -8);
      ctx.stroke();
      
      // Flag or light at top
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(2, -8);
      ctx.lineTo(5, -7);
      ctx.lineTo(2, -6);
      ctx.closePath();
      ctx.fill();
      
      // S2-T10: ghat boats carry a small lamp at dusk (two plain fills, no shadow blur)
      if (boat.ghatRoute && visualHour >= GHAT_BOAT_CONFIG.duskLampStartHour && visualHour < GHAT_BOAT_CONFIG.duskLampEndHour) {
        ctx.fillStyle = 'rgba(255, 170, 60, 0.28)';
        ctx.beginPath();
        ctx.arc(6, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd98a';
        ctx.beginPath();
        ctx.arc(6, 0, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Navigation lights at night (visualHour >= 20 || visualHour < 6)
      const isNight = visualHour >= 20 || visualHour < 6;
      if (isNight) {
        // White masthead light at top of mast (always on)
        ctx.fillStyle = '#ffffff';
        // PERF: Skip shadowBlur on mobile - very expensive
        if (!isMobile) {
          ctx.shadowColor = '#ffffcc';
          ctx.shadowBlur = 12;
        }
        ctx.beginPath();
        ctx.arc(2, -9, isMobile ? 1.2 : 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // Red port light (left side)
        ctx.fillStyle = '#ff3333';
        if (!isMobile) {
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.arc(-6, 2, isMobile ? 1 : 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        // Green starboard light (right side)
        ctx.fillStyle = '#33ff33';
        if (!isMobile) {
          ctx.shadowColor = '#00ff00';
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ctx.arc(-6, -2, isMobile ? 1 : 0.6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  };

  return {
    updateBoats,
    drawBoats,
    findMarinasAndPiersCallback,
    findAdjacentWaterTileCallback,
    isOverWaterCallback,
    generateTourWaypointsCallback,
  };
}

