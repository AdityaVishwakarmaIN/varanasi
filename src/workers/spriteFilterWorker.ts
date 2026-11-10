/**
 * Sprite-sheet loader worker: fetch → decode → key out the red background → encode PNG, all off
 * the main thread. On the main thread this work took 190-480 ms per 2048² sheet (a synchronous
 * decode in drawImage, a per-pixel loop and a PNG encode in toDataURL) and, with a dozen sheets at
 * start-up, starved everything else (React, the PixiJS init awaits, input).
 *
 * The result goes back as a PNG Blob; the main thread wraps it in an <img> and `decode()`s it
 * (also off-thread), so the sprite cache keeps holding HTMLImageElements.
 */
import { keyOutBackground } from '@/lib/spriteKeyColor';

export type SpriteFilterRequest = { id: number; url: string; threshold: number };
export type SpriteFilterResponse =
  | { id: number; ok: true; blob: Blob; width: number; height: number }
  | { id: number; ok: false; error: string; status?: number };

function reply(message: SpriteFilterResponse): void {
  self.postMessage(message);
}

self.onmessage = async (event: MessageEvent<SpriteFilterRequest>) => {
  const { id, url, threshold } = event.data;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      reply({ id, ok: false, error: `HTTP ${response.status} for ${url}`, status: response.status });
      return;
    }
    const bitmap = await createImageBitmap(await response.blob());
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) throw new Error('OffscreenCanvas 2D context unavailable');
    g.drawImage(bitmap, 0, 0);
    bitmap.close();
    const image = g.getImageData(0, 0, width, height);
    keyOutBackground(image.data, threshold);
    g.putImageData(image, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    reply({ id, ok: true, blob, width, height });
  } catch (error) {
    reply({ id, ok: false, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
  }
};
