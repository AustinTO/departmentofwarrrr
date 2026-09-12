import { artPts } from '../geometry';
import { drain, type KitEmit, wall } from '../types';

/** Outer cabinet walls, top rail, bottom rails, and center drain. */
export function cabinet(): KitEmit {
    return {
        objects: [
            // Full-width sealed top rail — nothing ever leaves over the top,
            // including ramp spout pops and hard plunger lofts.
            wall('top-rail', artPts([70, 50], [1052, 50])),
            wall('left-rail', artPts([70, 50], [70, 1520])),
            wall('right-rail', artPts([1052, 50], [1052, 1520])),
            // Narrower drain gap to match close flippers
            wall('left-bottom-rail', artPts([70, 1520], [460, 1520])),
            wall('right-bottom-rail', artPts([620, 1520], [1052, 1520])),
            drain('drain', 540, 280 + 1520 + 20, 180, 36)
        ]
    };
}
