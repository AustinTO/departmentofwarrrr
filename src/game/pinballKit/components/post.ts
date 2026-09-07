import { artPoint, BALL_RADIUS } from '../geometry';
import { circlePost, type KitEmit, type KitPlacement } from '../types';

export interface PostOpts extends KitPlacement {
    artX: number;
    artY: number;
    radius?: number;
}

/** Rubber post at fixed radius. */
export function post(opts: PostOpts): KitEmit {
    const r = opts.radius ?? 14;
    if (r < 12 || r > BALL_RADIUS) throw new Error(`${opts.id}: bad post radius`);
    const [x, y] = artPoint(opts.artX, opts.artY);
    return { objects: [circlePost(opts.id, x, y, r)] };
}
