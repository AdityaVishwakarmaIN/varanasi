'use client';

/**
 * Dev-only preview of the procedural Varanasi sprites (S3-T3 part 1).
 * Shows every sprite × variant on light and dark backgrounds, a mock river bank with a row of
 * ghats, flipped ghats, and the landmarks next to painted sprites from the default sheets.
 * Open http://localhost:3000/dev/sprites while `npm run dev` is running.
 */
import { useEffect, useRef, useState } from 'react';
import { loadPreviewSheets, renderPreview } from './previewScenes';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export default function DevSpritesPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading painted comparison sheets…');

  useEffect(() => {
    if (IS_PRODUCTION) return;
    let cancelled = false;
    loadPreviewSheets().then((sheets) => {
      if (cancelled || !rootRef.current) return;
      const t0 = performance.now();
      renderPreview(rootRef.current, sheets);
      setStatus(`Rendered in ${Math.round(performance.now() - t0)} ms · painted sheets loaded: ${sheets.size}`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (IS_PRODUCTION) {
    return <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>This preview is only available in development.</main>;
  }

  return (
    <main style={{ height: '100vh', overflow: 'auto', background: '#8a8a8a', color: '#111', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <h1 style={{ font: '700 20px system-ui, sans-serif', margin: 0 }}>Procedural Varanasi sprites</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>{status}</p>
      </div>
      <div ref={rootRef} style={{ padding: 16 }} />
    </main>
  );
}
