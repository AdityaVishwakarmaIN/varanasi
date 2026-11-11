// Web Worker for game save/load operations
// Handles expensive JSON serialization and LZ-string compression off the main thread
// This file is bundled separately by Next.js/Webpack

import { compressToUTF16, decompressFromUTF16, compressToEncodedURIComponent } from 'lz-string';

export type SaveWorkerMessage = 
  | { type: 'decompress-parse'; id: number; compressed: string }
  // PERF: the JSON arrives as transferred buffers - no structuredClone overhead
  | { type: 'compress-transferred-uri'; id: number; buffer: ArrayBuffer }
  // S1-T9: JSON produced in time slices on the main thread, one buffer per slice
  | { type: 'compress-transferred-parts'; id: number; buffers: ArrayBuffer[] };

export type SaveWorkerResponse = 
  | { type: 'decompressed-parsed'; id: number; state: unknown; error?: string }
  | { type: 'compressed-transferred-uri'; id: number; compressed: string; error?: string }
  | { type: 'compressed-transferred-parts'; id: number; compressed: string; error?: string };

// Worker message handler
self.onmessage = (event: MessageEvent<SaveWorkerMessage>) => {
  const { type, id } = event.data;
  
  // Compress JSON from a transferred buffer, URI-safe encoding for Supabase
  if (type === 'compress-transferred-uri') {
    try {
      const { buffer } = event.data as { type: 'compress-transferred-uri'; id: number; buffer: ArrayBuffer };
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(buffer);
      const compressed = compressToEncodedURIComponent(jsonString);
      
      self.postMessage({
        type: 'compressed-transferred-uri',
        id,
        compressed,
      });
    } catch (error) {
      self.postMessage({
        type: 'compressed-transferred-uri',
        id,
        compressed: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  // S1-T9: Join JSON slices (transferred buffers, in order) and compress
  if (type === 'compress-transferred-parts') {
    try {
      const { buffers } = event.data as { type: 'compress-transferred-parts'; id: number; buffers: ArrayBuffer[] };
      const decoder = new TextDecoder();
      const jsonString = buffers.map((buffer) => decoder.decode(buffer)).join('');
      const compressed = compressToUTF16(jsonString);

      self.postMessage({
        type: 'compressed-transferred-parts',
        id,
        compressed,
      });
    } catch (error) {
      self.postMessage({
        type: 'compressed-transferred-parts',
        id,
        compressed: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Decompress and parse JSON back to game state
  if (type === 'decompress-parse') {
    try {
      const { compressed } = event.data as { type: 'decompress-parse'; id: number; compressed: string };
      
      // Try to decompress (might be legacy uncompressed format)
      let jsonString = decompressFromUTF16(compressed);
      if (!jsonString || !jsonString.startsWith('{')) {
        // Legacy format - already JSON
        if (compressed.startsWith('{')) {
          jsonString = compressed;
        } else {
          throw new Error('Invalid compressed data');
        }
      }
      
      const state = JSON.parse(jsonString);
      
      self.postMessage({
        type: 'decompressed-parsed',
        id,
        state,
      });
    } catch (error) {
      self.postMessage({
        type: 'decompressed-parsed',
        id,
        state: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
};
