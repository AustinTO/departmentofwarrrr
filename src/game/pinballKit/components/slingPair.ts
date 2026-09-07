import { artPoint } from '../geometry';
import { boxSling, type KitEmit } from '../types';

/**
 * Rubber bands seated on the inboard sling-triangle faces.
 * Kick up/in when the ball glances the triangle from center play.
 */
export function slingPair(): KitEmit {
    // Midpoints of left/right sling-face walls (art space).
    const left = artPoint(305, 1320);
    const right = artPoint(733, 1320);
    const deg = (d: number) => (d * Math.PI) / 180;
    return {
        objects: [
            boxSling('left-sling', left[0], left[1], 118, 22, deg(38)),
            boxSling('right-sling', right[0], right[1], 118, 22, deg(-38))
        ]
    };
}
