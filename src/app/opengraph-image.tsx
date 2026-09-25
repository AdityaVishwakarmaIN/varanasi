import { ImageResponse } from 'next/og';

/**
 * Open Graph image (S5-T12): an illustrated Varanasi riverfront at dawn (ghat steps, temple
 * shikharas, boats on the Ganga), generated at build time. Replace with a real in-game
 * screenshot of the riverfront once one is captured (save it as opengraph-image.png and
 * delete this file).
 */
export const alt = 'Varanasi: an isometric city builder on the Ganga';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const W = 1200;
const H = 630;

/** Temple silhouettes along the ghats: x, base width, height. */
const TEMPLES: [number, number, number][] = [
  [90, 70, 150], [230, 50, 110], [330, 90, 190], [480, 60, 130], [610, 80, 170],
  [760, 55, 120], [870, 95, 200], [1020, 60, 140], [1130, 70, 160],
];

function shikhara(x: number, w: number, h: number, base: number): string {
  // A curved temple spire over a plinth.
  const top = base - h;
  return [
    `M${x - w / 2},${base}`,
    `L${x - w / 2},${base - h * 0.35}`,
    `Q${x - w / 2},${top + h * 0.15} ${x},${top}`,
    `Q${x + w / 2},${top + h * 0.15} ${x + w / 2},${base - h * 0.35}`,
    `L${x + w / 2},${base}`,
    'Z',
  ].join(' ');
}

export default function OpengraphImage() {
  const bankY = 360;
  const steps = Array.from({ length: 7 }, (_, i) => i);
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2b1d3a"/><stop offset="0.55" stop-color="#c8643c"/><stop offset="1" stop-color="#f4b860"/>
      </linearGradient>
      <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d98d4c"/><stop offset="1" stop-color="#2c4a5a"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="930" cy="250" r="70" fill="#ffd98a" opacity="0.9"/>
    ${TEMPLES.map(([x, w, h]) => `<path d="${shikhara(x, w, h, bankY)}" fill="#5a2e2a"/>`).join('')}
    <rect x="0" y="${bankY - 40}" width="${W}" height="40" fill="#6b3a2c"/>
    ${steps.map((i) => `<rect x="0" y="${bankY + i * 12}" width="${W}" height="12" fill="${i % 2 ? '#a8714f' : '#b98260'}"/>`).join('')}
    <rect x="0" y="${bankY + steps.length * 12}" width="${W}" height="${H}" fill="url(#river)"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${120 + i * 230}" y="${500 + (i % 2) * 40}" width="140" height="3" fill="#ffd98a" opacity="0.35"/>`).join('')}
    ${[[210, 520], [640, 560], [980, 505]].map(([x, y]) => `<path d="M${x - 55},${y} Q${x},${y + 22} ${x + 55},${y} Z" fill="#3a2320"/>`).join('')}
  </svg>`;
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative' }}>
        <img src={src} width={W} height={H} alt="" />
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: 48,
            display: 'flex',
            flexDirection: 'column',
            color: '#fff7e8',
          }}
        >
          <div style={{ fontSize: 96, letterSpacing: 6 }}>Varanasi</div>
          <div style={{ fontSize: 34, color: '#ffe2b0' }}>A city builder on the Ganga</div>
        </div>
      </div>
    ),
    size,
  );
}
