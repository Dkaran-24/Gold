import type { OverlayAsset } from './types';

export interface Landmark { x: number; y: number; visibility?: number }
export interface Placement { x: number; y: number; width: number; rotation: number }

function usable(point?: Landmark): point is Landmark {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y) && (point.visibility ?? 1) >= 0.5;
}

/** Coordinates are source-video pixels in a top-left, y-down coordinate system. */
export function placements(face: Landmark[], pose: Landmark[], asset: OverlayAsset, width: number, height: number): Placement[] {
  const left = face[234], right = face[454], chin = face[152];
  if (!usable(left) || !usable(right) || !usable(chin) || width <= 0 || height <= 0) return [];
  const dx = (right.x - left.x) * width;
  const dy = (right.y - left.y) * height;
  const faceSpan = Math.hypot(dx, dy);
  if (faceSpan < 10) return [];
  const roll = Math.atan2(dy, dx);
  const rotation = asset.rotation * Math.PI / 180;
  function anchor(x: number, y: number, itemWidth: number, angle: number): Placement {
    return {
      x: x + asset.offsetX * faceSpan, y: y + asset.offsetY * faceSpan,
      width: itemWidth * asset.scale, rotation: angle + rotation,
    };
  }
  if (asset.kind === 'EARRINGS') {
    return [left, right].map(ear => anchor(
      ear.x * width - Math.sin(roll) * 0.1 * faceSpan,
      ear.y * height + Math.cos(roll) * 0.1 * faceSpan,
      0.145 * faceSpan, roll,
    ));
  }
  const shoulderA = pose[11], shoulderB = pose[12];
  if (!usable(shoulderA) || !usable(shoulderB)) return [];
  const [a, b] = shoulderA.x < shoulderB.x ? [shoulderA, shoulderB] : [shoulderB, shoulderA];
  const shoulderSpan = Math.hypot((b.x - a.x) * width, (b.y - a.y) * height);
  if (shoulderSpan < faceSpan * 0.7) return [];
  const shoulderX = (a.x + b.x) * width / 2, shoulderY = (a.y + b.y) * height / 2;
  return [anchor(
    0.7 * shoulderX + 0.3 * chin.x * width,
    0.62 * shoulderY + 0.38 * chin.y * height,
    shoulderSpan * 0.51, Math.atan2((b.y - a.y) * height, (b.x - a.x) * width),
  )];
}

/** Transform the display, never the landmark input. Mirroring both layers preserves their registration. */
export function displayTransform(front: boolean) { return front ? 'scaleX(-1)' : 'none'; }

export function smooth(previous: Placement | undefined, next: Placement, deltaMs: number): Placement {
  if (!previous || deltaMs > 350) return next;
  const alpha = 1 - Math.exp(-Math.max(1, deltaMs) / 65);
  const mix = (a: number, b: number) => a + (b - a) * alpha;
  const angleDelta = Math.atan2(Math.sin(next.rotation - previous.rotation), Math.cos(next.rotation - previous.rotation));
  return { x: mix(previous.x, next.x), y: mix(previous.y, next.y), width: mix(previous.width, next.width), rotation: previous.rotation + angleDelta * alpha };
}

