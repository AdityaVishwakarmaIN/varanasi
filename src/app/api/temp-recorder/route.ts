// TEMP-RECORDER: dev-only sink for the flight recorder (src/lib/debug/tempRecorder.ts).
// Appends each posted record as one JSON line to debug-logs/session-<sessionId>.jsonl at the repo root.
// Returns 404 outside `next dev`. Delete this folder when the recorder is removed.
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1024 * 1024;
const SESSION_ID = /^[A-Za-z0-9-]{1,64}$/;

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') return notFound();

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return Response.json({ ok: false, error: 'too large' }, { status: 413 });

  let text: string;
  try {
    text = await request.text();
  } catch {
    return Response.json({ ok: false, error: 'unreadable body' }, { status: 400 });
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return Response.json({ ok: false, error: 'too large' }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const { sessionId, records } = (body ?? {}) as { sessionId?: unknown; records?: unknown };
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
    return Response.json({ ok: false, error: 'invalid sessionId' }, { status: 400 });
  }
  if (!Array.isArray(records)) return Response.json({ ok: false, error: 'records must be an array' }, { status: 400 });
  if (records.length === 0) return Response.json({ ok: true, written: 0 });

  let lines = '';
  for (const record of records) lines += JSON.stringify(record) + '\n';

  try {
    const dir = path.join(process.cwd(), 'debug-logs');
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, `session-${sessionId}.jsonl`), lines, 'utf8');
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
  return Response.json({ ok: true, written: records.length });
}

export function GET(): Response {
  return notFound();
}
