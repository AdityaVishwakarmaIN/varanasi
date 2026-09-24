/**
 * Feature flags. Values are read from build-time `NEXT_PUBLIC_*` env vars so they
 * are inlined into the client bundle.
 */
export const FEATURES = {
  /**
   * Co-op multiplayer (Supabase Realtime). Off for v1 (see game-plan 00-game-design §5.2).
   * Turn on with `NEXT_PUBLIC_ENABLE_COOP=1`. When off, no co-op UI is shown, `/coop/*`
   * redirects to `/`, and no Supabase client is ever created.
   */
  coop: process.env.NEXT_PUBLIC_ENABLE_COOP === '1',
} as const;
