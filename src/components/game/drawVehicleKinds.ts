/**
 * Draws one road vehicle of any kind (S3-T4), in its own frame: the caller has already translated to the
 * vehicle's position and rotated so +x points the way it drives and +y is across the road.
 * Everything is simple vector shapes, like the original car.
 */
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';
import { VEHICLE_MIX } from '@/lib/trafficConfig';
import type { Car } from './types';

/** The original car is 20 x 10 units at this scale (about 10 x 5 px). */
const S = 0.5;
const TYRE = '#111827';
const WINDOW = 'rgba(255, 255, 255, 0.6)';
const RIDER_SHIRTS = ['#F5F5F5', '#E07A1F', '#3B5BA5', '#7A3E9D', '#2E7D32'];
const SKIN = '#8D5524';

function drawCar(ctx: IsoRenderer, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10 * S, -5 * S);
  ctx.lineTo(10 * S, -5 * S);
  ctx.lineTo(12 * S, 0);
  ctx.lineTo(10 * S, 5 * S);
  ctx.lineTo(-10 * S, 5 * S);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = WINDOW;
  ctx.fillRect(-4 * S, -2.8 * S, 7 * S, 5.6 * S);
  ctx.fillStyle = TYRE;
  ctx.fillRect(-10 * S, -4 * S, 2.4 * S, 8 * S);
}

/** Auto-rickshaw: rounded nose with one front wheel, yellow-green body, black canopy over the back. */
function drawAuto(ctx: IsoRenderer, body: string, canopy: string): void {
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-7 * S, -4 * S);
  ctx.lineTo(4 * S, -4 * S);
  ctx.lineTo(8 * S, -1.5 * S);
  ctx.lineTo(8 * S, 1.5 * S);
  ctx.lineTo(4 * S, 4 * S);
  ctx.lineTo(-7 * S, 4 * S);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = canopy;
  ctx.fillRect(-7 * S, -3.6 * S, 8.5 * S, 7.2 * S);
  ctx.fillStyle = TYRE;
  ctx.fillRect(-6 * S, -4.6 * S, 2.4 * S, 1 * S);
  ctx.fillRect(-6 * S, 3.6 * S, 2.4 * S, 1 * S);
}

/** E-rickshaw: a pale box with a coloured flat roof and a small open front. */
function drawErickshaw(ctx: IsoRenderer, body: string, canopy: string): void {
  ctx.fillStyle = body;
  ctx.fillRect(-7 * S, -3.8 * S, 14 * S, 7.6 * S);
  ctx.fillStyle = canopy;
  ctx.fillRect(-6.5 * S, -3.4 * S, 9.5 * S, 6.8 * S);
  ctx.fillStyle = WINDOW;
  ctx.fillRect(3.5 * S, -2.5 * S, 2 * S, 5 * S);
}

/** Motorbike: a thin dark body with one rider (shirt and head). */
function drawMotorbike(ctx: IsoRenderer, body: string, shirt: string): void {
  ctx.fillStyle = body;
  ctx.fillRect(-5 * S, -0.9 * S, 10 * S, 1.8 * S);
  ctx.fillStyle = shirt;
  ctx.fillRect(-2.5 * S, -1.8 * S, 3.5 * S, 3.6 * S);
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, 0, 1.3 * S, 0, Math.PI * 2);
  ctx.fill();
}

/** Cycle rickshaw: a bicycle in front, a covered bench seat behind. */
function drawCycleRickshaw(ctx: IsoRenderer, body: string, canopy: string, shirt: string): void {
  ctx.fillStyle = body;
  ctx.fillRect(0, -0.6 * S, 7 * S, 1.2 * S);
  ctx.fillStyle = shirt;
  ctx.fillRect(2 * S, -1.4 * S, 2.6 * S, 2.8 * S);
  ctx.fillStyle = body;
  ctx.fillRect(-6 * S, -3.5 * S, 6.5 * S, 7 * S);
  ctx.fillStyle = canopy;
  ctx.fillRect(-6 * S, -3.2 * S, 4 * S, 6.4 * S);
}

/**
 * Draws the vehicle. With `detailed` false (zoomed out) every kind is the same plain rectangle in its
 * body colour, sized by kind: the detail would be invisible and this keeps frame time low.
 */
export function drawVehicleBody(ctx: IsoRenderer, car: Car, detailed: boolean): void {
  const kind = car.kind ?? 'car';
  // Cars keep their original look at every zoom, so the random map is unchanged
  if (!detailed && kind !== 'car') {
    const look = VEHICLE_MIX[kind]?.look;
    const len = 20 * S * (look?.lengthScale ?? 1);
    const wid = 10 * S * (look?.widthScale ?? 1);
    ctx.fillStyle = kind === 'erickshaw' || kind === 'cycle_rickshaw' ? car.canopyColor ?? car.color : car.color;
    ctx.fillRect(-len / 2, -wid / 2, len, wid);
    return;
  }
  const canopy = car.canopyColor ?? '#1A1A1A';
  const shirt = RIDER_SHIRTS[car.id % RIDER_SHIRTS.length];
  switch (kind) {
    case 'auto': drawAuto(ctx, car.color, canopy); break;
    case 'erickshaw': drawErickshaw(ctx, car.color, canopy); break;
    case 'motorbike': drawMotorbike(ctx, car.color, shirt); break;
    case 'cycle_rickshaw': drawCycleRickshaw(ctx, car.color, canopy, shirt); break;
    default: drawCar(ctx, car.color);
  }
}
