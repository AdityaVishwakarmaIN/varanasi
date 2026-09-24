import { useSyncExternalStore } from 'react';
import {
  SERVER_GRAPHICS_SNAPSHOT,
  getGraphicsSnapshot,
  subscribeGraphics,
  type GraphicsSnapshot,
} from '@/lib/graphicsSettings';

const getServerSnapshot = () => SERVER_GRAPHICS_SNAPSHOT;

/** React view of the graphics settings (S1-T7): re-renders when the renderer or quality changes. */
export function useGraphicsSettings(): GraphicsSnapshot {
  return useSyncExternalStore(subscribeGraphics, getGraphicsSnapshot, getServerSnapshot);
}
