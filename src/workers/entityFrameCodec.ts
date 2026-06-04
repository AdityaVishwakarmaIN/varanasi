/**
 * entityFrameCodec.ts — Step 8 encode/decode for the off-thread GPU entity transport.
 *
 * The main thread packs the per-frame state of MOVING entities (cars, pedestrians,
 * clouds, …) into a single transferable Float32 ArrayBuffer; the render worker decodes
 * it and replays the draws onto the dynamic GPU layers. This module is the round-trippable
 * codec for that boundary (see RenderWorkerEntityFrame in renderProtocol.ts). It is
 * backend-agnostic (no Pixi / DOM import) so it runs on either side of the worker.
 *
 * Buffer layout: groups are packed back-to-back; each group holds `count` records of
 * `stride` Float32 values, where `stride === fields.length` and field order matches
 * `layout.fields`. A group's `offset` is its first record's ELEMENT index in the buffer.
 */
import type {
  RenderWorkerCanvasId,
  RenderWorkerEntityFrame,
  RenderWorkerEntityGroup,
  RenderWorkerEntityLayout,
} from './renderProtocol';

/** One group of same-kind entities to encode. `records[i]` length must equal `fields.length`. */
export interface EntityGroupInput {
  layer: RenderWorkerCanvasId;
  kind: string;
  /** Row-major records; each inner array is one entity in `fields` order. */
  records: number[][];
}

/** Pack entity groups into a transferable Float32 frame. */
export function encodeEntityFrame(
  frameId: number,
  alpha: number,
  fields: string[],
  groups: EntityGroupInput[],
): RenderWorkerEntityFrame {
  const stride = fields.length;
  let total = 0;
  for (const g of groups) total += g.records.length * stride;

  const data = new Float32Array(total);
  const outGroups: RenderWorkerEntityGroup[] = [];
  let offset = 0;
  for (const g of groups) {
    const count = g.records.length;
    outGroups.push({ layer: g.layer, kind: g.kind, count, stride, offset });
    for (let i = 0; i < count; i++) {
      const rec = g.records[i];
      // Defensive: write up to `stride` values; missing fields default to 0.
      for (let f = 0; f < stride; f++) data[offset + f] = rec[f] ?? 0;
      offset += stride;
    }
  }

  const layout: RenderWorkerEntityLayout = { groups: outGroups, fields };
  return { frameId, alpha, layout, buffer: data.buffer };
}

/** A decoded group: a typed view over the packed buffer with per-record field access. */
export interface DecodedEntityGroup {
  layer: RenderWorkerCanvasId;
  kind: string;
  count: number;
  stride: number;
  /** Float32 view of this group's records, length === count * stride. */
  values: Float32Array;
  /** Read field `name` of record `i` (NaN if the field is unknown). */
  field(i: number, name: string): number;
  /** Subarray view of record `i` (length === stride), in `fields` order. */
  record(i: number): Float32Array;
}

export interface DecodedEntityFrame {
  frameId: number;
  alpha: number;
  fields: string[];
  groups: DecodedEntityGroup[];
}

/** Decode a frame into typed, field-addressable group views (zero-copy over the buffer). */
export function decodeEntityFrame(frame: RenderWorkerEntityFrame): DecodedEntityFrame {
  const { fields } = frame.layout;
  const fieldIndex = new Map<string, number>();
  fields.forEach((name, idx) => fieldIndex.set(name, idx));
  const view = new Float32Array(frame.buffer);

  const groups: DecodedEntityGroup[] = frame.layout.groups.map((g) => {
    const values = view.subarray(g.offset, g.offset + g.count * g.stride);
    return {
      layer: g.layer,
      kind: g.kind,
      count: g.count,
      stride: g.stride,
      values,
      field(i: number, name: string): number {
        const fi = fieldIndex.get(name);
        if (fi === undefined) return NaN;
        return values[i * g.stride + fi];
      },
      record(i: number): Float32Array {
        return values.subarray(i * g.stride, i * g.stride + g.stride);
      },
    };
  });

  return { frameId: frame.frameId, alpha: frame.alpha, fields, groups };
}
