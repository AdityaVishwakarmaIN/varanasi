// TEMP-RECORDER: dev-only flight recorder mount + "REC" indicator. See src/lib/debug/tempRecorder.ts.
'use client';

import { useEffect, useState } from 'react';
import { getTempRecorder, installTempRecorderCapture } from '@/lib/debug/tempRecorder';

export function TempRecorder() {
  const [session, setSession] = useState<{ id: string; path: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // Copy failed: show the path as selectable text (never window.prompt: it blocks the main thread).
  const [showPath, setShowPath] = useState(false);
  // Below 1024 px the game uses its mobile layout (bottom toolbar ~76 px): sit just above it.
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    let uninstall: () => void = () => {};
    try {
      uninstall = installTempRecorderCapture();
      const rec = getTempRecorder();
      // Read once after mount (the session id only exists in the browser).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (rec) setSession({ id: rec.sessionId, path: rec.logPath });
    } catch {
      // never throw into the app
    }
    let mq: MediaQueryList | null = null;
    const onMq = () => setNarrow(!!mq?.matches);
    try {
      mq = window.matchMedia('(max-width: 1023px)');
      mq.addEventListener('change', onMq);
      onMq();
    } catch {
      // ignore
    }
    return () => {
      try {
        mq?.removeEventListener('change', onMq);
        uninstall();
      } catch {
        // ignore
      }
    };
  }, []);

  if (process.env.NODE_ENV !== 'development' || !session) return null;

  const copy = () => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    };
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = session.path;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) {
          done();
          return;
        }
      } catch {
        // fall through
      }
      setShowPath(true);
    };
    try {
      navigator.clipboard.writeText(session.path).then(done, fallback);
    } catch {
      fallback();
    }
  };

  // left-16: clear of the Next.js dev-tools badge, which also sits bottom-left.
  // Inline styles (not new Tailwind classes) so they apply without a CSS rebuild.
  return (
    <div
      style={{ bottom: narrow ? 'calc(80px + env(safe-area-inset-bottom))' : '4px' }}
      className="hud-glass fixed left-16 z-[9999] flex whitespace-nowrap items-center gap-1.5 rounded-none px-1.5 py-0.5 text-[10px] leading-tight font-mono text-chrome-text opacity-70 hover:opacity-100 pointer-events-auto select-text"
      title={session.path}
      data-testid="temp-recorder"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden />
      <span>REC {showPath ? session.path : session.id.slice(-6)}</span>
      <button
        type="button"
        onClick={copy}
        style={{ minHeight: 0, minWidth: 0 }}
        className="px-1 hover:bg-chrome-well rounded-none text-chrome-muted hover:text-chrome-text transition-colors"
      >
        {copied ? 'Copied' : 'Copy log path'}
      </button>
    </div>
  );
}

export default TempRecorder;
