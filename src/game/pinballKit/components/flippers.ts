import { artPoint } from '../geometry';
import { flipper, type KitEmit } from '../types';

const FLIPPER_W = 280;
const FLIPPER_H = 40;

/**
 * Flipper pivots — kept close so tip gap is ~ball-width, not a canyon.
 * Tip offset (~125px) aims inward toward center.
 */
export function flippers(): KitEmit {
    const left = artPoint(365, 1420);
    const right = artPoint(715, 1420);
    return {
        objects: [
            flipper('left-flipper', left[0], left[1], FLIPPER_W, FLIPPER_H),
            flipper('right-flipper', right[0], right[1], FLIPPER_W, FLIPPER_H)
        ]
    };
}
