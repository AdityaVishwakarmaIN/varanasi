'use client';

import { MutableRefObject, useEffect, useRef } from 'react';
import { GameState, Tool } from '@/types/game';
import {
  ControlAction,
  SPACE_TAP_MAX_MS,
  SharedControlsState,
  cycleValue,
  isInsideModal,
  isTypingTarget,
  matchKeyBinding,
} from '@/lib/controlsConfig';

export interface KeyboardControlsOptions<Overlay extends string> {
  /** Shared with CanvasIsometricGrid: held pan keys, Space state and the camera API. */
  controlsRef: MutableRefObject<SharedControlsState>;
  overlayMode: Overlay;
  setOverlayMode: (mode: Overlay) => void;
  /** Overlay order for Tab cycling (starts with 'none'). */
  overlayOrder: readonly Overlay[];
  activePanel: GameState['activePanel'];
  setActivePanel: (panel: GameState['activePanel']) => void;
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  selectedTool: Tool;
  setTool: (tool: Tool) => void;
  speed: GameState['speed'];
  setSpeed: (speed: GameState['speed']) => void;
  onShowHelp: () => void;
}

const TOOL_ACTIONS: Partial<Record<ControlAction, Tool>> = {
  toolResidential: 'zone_residential',
  toolCommercial: 'zone_commercial',
  toolIndustrial: 'zone_industrial',
  toolRoad: 'road',
  toolBulldoze: 'bulldoze',
};

const SPEED_ACTIONS: Partial<Record<ControlAction, GameState['speed']>> = {
  speed1: 1,
  speed2: 2,
  speed3: 3,
};

/**
 * The single keyboard handler for the game (S1-T10). All bindings come from `KEY_BINDINGS`
 * in `src/lib/controlsConfig.ts`. Keys are ignored while typing in inputs and while focus is
 * inside a dialog or menu (those handle Esc/Tab/Space themselves).
 *
 * Continuous panning (WASD / arrows) is recorded in `controlsRef.current.heldActions` and applied
 * per frame by the canvas camera. Space: a quick tap toggles pause, holding it lets
 * left-drag pan the map (the canvas marks `spaceUsedForPan`).
 */
export function useKeyboardControls<Overlay extends string>(options: KeyboardControlsOptions<Overlay>): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const controls = options.controlsRef.current;
    let spaceDownAt = 0;

    const togglePause = () => {
      const { speed, setSpeed } = optionsRef.current;
      // Same behaviour as the old P shortcut: paused → normal speed, running → paused.
      setSpeed(speed === 0 ? 1 : 0);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isInsideModal(e.target)) return;
      const binding = matchKeyBinding(e);
      if (!binding || binding.handledElsewhere) return;
      const opts = optionsRef.current;

      if (binding.continuous) {
        controls.heldActions.add(binding.action);
        e.preventDefault();
        return;
      }

      if (e.key === ' ') {
        // Pause happens on release (tap); holding Space enables Space + drag panning.
        e.preventDefault();
        if (!e.repeat && !controls.spaceHeld) {
          controls.spaceHeld = true;
          controls.spaceUsedForPan = false;
          spaceDownAt = performance.now();
        }
        return;
      }

      const isZoom = binding.action === 'zoomIn' || binding.action === 'zoomOut';
      if (e.repeat && !isZoom) {
        e.preventDefault();
        return;
      }

      const tool = TOOL_ACTIONS[binding.action];
      if (tool) {
        e.preventDefault();
        opts.setTool(tool);
        return;
      }
      const speed = SPEED_ACTIONS[binding.action];
      if (speed !== undefined) {
        e.preventDefault();
        opts.setSpeed(speed);
        return;
      }

      switch (binding.action) {
        case 'togglePause':
          e.preventDefault();
          togglePause();
          break;
        case 'zoomIn':
        case 'zoomOut':
          e.preventDefault();
          controls.camera?.zoomStep(binding.action === 'zoomIn' ? 1 : -1);
          break;
        case 'cancel':
          // Existing order: close overlay → close panel → deselect → Select tool.
          if (opts.overlayMode !== 'none') {
            opts.setOverlayMode('none' as Overlay);
          } else if (opts.activePanel !== 'none') {
            opts.setActivePanel('none');
          } else if (opts.selectedTile) {
            opts.setSelectedTile(null);
          } else if (opts.selectedTool !== 'select') {
            opts.setTool('select');
          }
          break;
        case 'cycleOverlay':
          e.preventDefault();
          opts.setOverlayMode(cycleValue(opts.overlayOrder, opts.overlayMode, e.shiftKey ? -1 : 1));
          break;
        case 'showHelp':
          e.preventDefault();
          opts.onShowHelp();
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Always release held keys, even if focus moved into an input meanwhile.
      const binding = matchKeyBinding({ key: e.key });
      if (binding?.continuous) controls.heldActions.delete(binding.action);

      if (e.key === ' ' && controls.spaceHeld) {
        controls.spaceHeld = false;
        const wasTap = !controls.spaceUsedForPan && performance.now() - spaceDownAt < SPACE_TAP_MAX_MS;
        controls.spaceUsedForPan = false;
        if (isTypingTarget(e.target) || isInsideModal(e.target)) return;
        e.preventDefault(); // Stop a focused button from being "clicked" by Space.
        if (wasTap) togglePause();
      }
    };

    const releaseAll = () => {
      controls.heldActions.clear();
      controls.spaceHeld = false;
      controls.spaceUsedForPan = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [options.controlsRef]);
}
