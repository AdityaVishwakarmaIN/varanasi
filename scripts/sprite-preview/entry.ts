// Browser entry for the sprite preview harness: paints every procedural sprite into a grid,
// each at inspection size (160 px/tile) and at in-game size (64 px/tile, zoom 1) on a grass plot.
import {
  getProceduralSpriteDef,
  getProceduralSpriteSize,
  getProceduralSpriteTypes,
  getProceduralSprite,
  paintProceduralSprite,
} from '@/components/game/procedural/buildingArt';

const w = window as unknown as { __types?: string; __done: boolean; __abandoned?: boolean };
const filter = w.__types ? w.__types.split(',') : null;
const tilePx = 160;
const root = document.getElementById('root')!;

function grassPlot(ctx: CanvasRenderingContext2D, cx: number, topY: number, n: number, tw: number) {
  const th = tw * 0.6;
  ctx.fillStyle = '#7fa04e';
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx + (n * tw) / 2, topY + (n * th) / 2);
  ctx.lineTo(cx, topY + n * th);
  ctx.lineTo(cx - (n * tw) / 2, topY + (n * th) / 2);
  ctx.closePath();
  ctx.fill();
}

for (const type of getProceduralSpriteTypes()) {
  if (filter && !filter.includes(type)) continue;
  const def = getProceduralSpriteDef(type)!;
  for (let v = 0; v < def.variants; v++) {
    const size = getProceduralSpriteSize(type, tilePx);
    const cell = document.createElement('figure');
    const big = document.createElement('canvas');
    big.width = size.width;
    big.height = size.height;
    paintProceduralSprite(big.getContext('2d')!, type, v, false, tilePx);
    // in-game size: 64 px tiles drawn from the 96 px cache tier, like the map at zoom 1
    const tw = 64;
    const s = getProceduralSprite(type, v, false, 96, { abandoned: !!w.__abandoned })!;
    const sc = tw / s.tilePx;
    const small = document.createElement('canvas');
    small.width = Math.ceil(s.width * sc) + 8;
    small.height = Math.ceil(s.height * sc) + 8;
    const sctx = small.getContext('2d')!;
    grassPlot(sctx, small.width / 2, s.baseTopY * sc + 4, def.footprint, tw);
    sctx.drawImage(s.canvas as CanvasImageSource, 4, 4, s.width * sc, s.height * sc);
    const cap = document.createElement('figcaption');
    cap.textContent = `${type} v${v} (${def.footprint}×${def.footprint})`;
    cell.append(big, small, cap);
    root.append(cell);
  }
}
w.__done = true;
