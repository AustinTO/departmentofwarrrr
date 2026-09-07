import { artPoint } from '../geometry';
import { type KitEmit, type KitPlacement } from '../types';

export interface BumperMarkerOpts extends KitPlacement {
    artX: number;
    artY: number;
    radius?: number;
}

const placed: Array<{ id: string; x: number; y: number; radius: number }> = [];

/** Reset overlap registry (tests / re-assemble). */
export function resetBumperRegistry() {
    placed.length = 0;
}

/**
 * Bumper marker only — satire stats merged later. Rejects overlaps.
 */
export function bumper(opts: BumperMarkerOpts): KitEmit {
    const r = opts.radius ?? 48;
    if (r < 18) throw new Error(`${opts.id}: bumper radius too small`);
    const [x, y] = artPoint(opts.artX, opts.artY);
    for (const other of placed) {
        const dist = Math.hypot(x - other.x, y - other.y);
        if (dist < r + other.radius + 8) {
            throw new Error(`${opts.id} overlaps ${other.id}`);
        }
    }
    const marker = { id: opts.id, x, y, radius: r };
    placed.push(marker);
    return { objects: [], bumperMarkers: [marker] };
}
