/**
 * track.js – track definition, spline generation, and rendering.
 *
 * The track is a closed Catmull-Rom spline through CONTROL_POINTS.
 * Pre-computed SPLINE_POINTS are used for rendering and collision queries.
 */

import { TRACK_WIDTH } from './constants.js';

// ---------------------------------------------------------------------------
// Control points (world space, 3000 × 2000)
// Driving direction: clockwise.  Start/finish line: segment 0→1.
// ---------------------------------------------------------------------------
export const CONTROL_POINTS = [
  [1500,300], [2160,300], [2510,405], [2720,675], // Start straight into the fast eastern sweeper
  [2640,960], [2300,1050], [2150,1285], [2400,1510], // Linked bends to the hairpin
  [2270,1715], [1650,1680], [1000,1650], [610,1480], // Long passing straight
  [360,1200], [540,910], [395,570], [705,305],
].map(([x,y]) => ({x,y}));

// ---------------------------------------------------------------------------
// Catmull-Rom interpolation
// ---------------------------------------------------------------------------
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (
      2 * p1.x
      + (-p0.x + p2.x) * t
      + ( 2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
      + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),
    y: 0.5 * (
      2 * p1.y
      + (-p0.y + p2.y) * t
      + ( 2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
      + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    ),
  };
}

// ---------------------------------------------------------------------------
// Pre-generate the smooth spline  (SEGMENTS_PER_CP points per segment)
// ---------------------------------------------------------------------------
const SEGMENTS_PER_CP = 24;

function buildSpline() {
  const pts = CONTROL_POINTS;
  const n   = pts.length;
  const out = [];

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];

    for (let j = 0; j < SEGMENTS_PER_CP; j++) {
      out.push(catmullRom(p0, p1, p2, p3, j / SEGMENTS_PER_CP));
    }
  }
  // Equal arc intervals make look-ahead distances and sector spacing independent of knot density.
  const distances = [0];
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[(i + 1) % out.length];
    distances.push(distances[i] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  let edge = 0;
  return out.map((_, i) => {
    const distance = i * distances.at(-1) / out.length;
    while (distances[edge + 1] < distance) edge++;
    const a = out[edge], b = out[(edge + 1) % out.length];
    const t = (distance - distances[edge]) / (distances[edge + 1] - distances[edge]);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}

export const SPLINE_POINTS = buildSpline();

// Cumulative arc-length along the spline (same index as SPLINE_POINTS)
export const SPLINE_DIST = (() => {
  const d = [0];
  for (let i = 1; i < SPLINE_POINTS.length; i++) {
    const dx = SPLINE_POINTS[i].x - SPLINE_POINTS[i - 1].x;
    const dy = SPLINE_POINTS[i].y - SPLINE_POINTS[i - 1].y;
    d.push(d[i - 1] + Math.hypot(dx, dy));
  }
  return d;
})();

export const TRACK_LENGTH = SPLINE_DIST[SPLINE_DIST.length - 1]
  + Math.hypot(SPLINE_POINTS.at(-1).x - SPLINE_POINTS[0].x,
    SPLINE_POINTS.at(-1).y - SPLINE_POINTS[0].y);

// ---------------------------------------------------------------------------
// Checkpoint indices (evenly spaced along the spline, used for lap counting)
// ---------------------------------------------------------------------------
export const NUM_CHECKPOINTS = 6;
export const CHECKPOINT_INDICES = Array.from(
  { length: NUM_CHECKPOINTS },
  (_, k) => Math.round((k / NUM_CHECKPOINTS) * SPLINE_POINTS.length) % SPLINE_POINTS.length,
);

// ---------------------------------------------------------------------------
// Spatial query helpers
// ---------------------------------------------------------------------------

/** Return the index of the nearest SPLINE_POINT to (x, y). */
export function nearestSplineIdx(x, y) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < SPLINE_POINTS.length; i++) {
    const dx = SPLINE_POINTS[i].x - x;
    const dy = SPLINE_POINTS[i].y - y;
    const d  = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export const SEGMENTS = SPLINE_POINTS.map((p,i) => {
  const q = SPLINE_POINTS[(i + 1) % SPLINE_POINTS.length];
  const length = Math.hypot(q.x-p.x, q.y-p.y);
  return { x:p.x, y:p.y, tx:(q.x-p.x)/length, ty:(q.y-p.y)/length, length };
});

// Choose the closest point on either adjacent segment, including the start seam.
export function roadFrame(x,y) {
  const i = nearestSplineIdx(x,y);
  let best, bestD = Infinity;
  for (const j of [(i + SEGMENTS.length - 1) % SEGMENTS.length, i]) {
    const edge = SEGMENTS[j];
    const along = Math.max(0, Math.min(edge.length, (x-edge.x)*edge.tx + (y-edge.y)*edge.ty));
    const px = edge.x + along*edge.tx, py = edge.y + along*edge.ty;
    const d = (x-px)**2 + (y-py)**2;
    if (d < bestD) {
      bestD = d;
      best = {idx:j, x:px, y:py, tx:edge.tx, ty:edge.ty, offset:(y-py)*edge.tx-(x-px)*edge.ty};
    }
  }
  return best;
}

/** Return the perpendicular distance from (x,y) to the nearest spline segment. */
export function distToTrack(x, y) {
  const p = roadFrame(x,y);
  return Math.hypot(x-p.x,y-p.y);
}

/** True if (x,y) is within the drivable surface. */
export function isOnTrack(x, y) {
  return distToTrack(x, y) <= TRACK_WIDTH / 2;
}

/**
 * Progress along the track [0, 1).
 * Used for position/lap counting.
 */
export function trackProgress(x, y) {
  const idx = nearestSplineIdx(x, y);
  return SPLINE_DIST[idx] / TRACK_LENGTH;
}

// ---------------------------------------------------------------------------
// Rasterize once at world resolution. Only one transformed blit per animation frame.
let artwork;
export function drawTrack(ctx) {
  if (!artwork) {
    artwork = document.createElement('canvas');
    artwork.width = 2250; artwork.height = 1500;
    const g = artwork.getContext('2d');
    g.scale(.75,.75);
    g.fillStyle = '#456459'; g.fillRect(0,0,3000,2000);
    const path = new Path2D();
    path.moveTo(SEGMENTS[0].x, SEGMENTS[0].y);
    for (const p of SEGMENTS) path.lineTo(p.x,p.y);
    path.closePath(); g.lineJoin = 'round';
    function stroke(width,color,dash=[]) {
      g.lineWidth=width; g.strokeStyle=color; g.setLineDash(dash); g.stroke(path);
    }
    stroke(TRACK_WIDTH+74,'#557366');
    stroke(TRACK_WIDTH+28,'#273a37');
    stroke(TRACK_WIDTH+14,'#c9d6c8');
    stroke(TRACK_WIDTH+10,'#273e40');
    stroke(TRACK_WIDTH,'#e8e1cb');
    stroke(TRACK_WIDTH,'#d7664a',[22,22]);
    stroke(TRACK_WIDTH-17,'#edf1dd');
    stroke(TRACK_WIDTH-22,'#414b52');
    stroke(2,'#7c888b',[26,56]);
    g.setLineDash([]);
    // Outside approach boards count down to the three braking zones.
    for (const knot of [4,7,12]) {
      const corner = CONTROL_POINTS[knot];
      const apex = nearestSplineIdx(corner.x,corner.y);
      const entry = SEGMENTS[(apex-10+SEGMENTS.length)%SEGMENTS.length], exit = SEGMENTS[apex];
      const outside = Math.sign(entry.ty*exit.tx-entry.tx*exit.ty);
      for (let count=1;count<=3;count++) {
        const p = SEGMENTS[(apex-count*4+SEGMENTS.length)%SEGMENTS.length];
        const offset=outside*(TRACK_WIDTH/2+27);
        g.save(); g.translate(p.x-p.ty*offset,p.y+p.tx*offset); g.rotate(Math.atan2(p.ty,p.tx));
        g.fillStyle='#203139'; g.fillRect(-12,-8,24,16);
        g.fillStyle='#f7d77d';
        for(let stripe=0;stripe<count;stripe++) g.fillRect(-2-(count-1)*3+stripe*6,-5,3,10);
        g.restore();
      }
    }
    const start = SEGMENTS[0];
    g.save(); g.translate(start.x,start.y); g.rotate(Math.atan2(start.ty,start.tx));
    const tile = 12;
    for(let lane=-9; lane<9; lane++) for(let row=0;row<2;row++) {
      g.fillStyle = (lane+row)%2 ? '#f6f3df' : '#202a2f';
      g.fillRect(row*tile,lane*tile,tile,tile);
    }
    g.strokeStyle='#acb8b6'; g.lineWidth=2;
    for (let row=0; row<3; row++) for (const lane of [-32,35]) {
      const x=-10-70*row;
      g.beginPath();g.moveTo(x-36,lane-21);g.lineTo(x+16,lane-21);
      g.lineTo(x+16,lane+21);g.lineTo(x-36,lane+21);g.stroke();
    }
    g.restore();
  }
  ctx.drawImage(artwork,0,0,3000,2000);
}
