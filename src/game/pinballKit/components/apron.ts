import { artPts } from '../geometry';
import { type KitEmit, wall } from '../types';

/**
 * Lower playfield lanes.
 *
 * Each side: an outlane guide wall that ends high (balls outboard of it fall
 * into the trough = drain), a sling leg that seals the ramp-mouth underside
 * and curves over the flipper base (inlane feed), and a sling face on the
 * center-play side carrying the rubber. Sling triangles are sealed at both
 * ends so the ball can never wedge inside them.
 */
export function apron(): KitEmit {
    return {
        objects: [
            // Outlane guide walls — outboard of these is the drain alley.
            wall('left-outlane', artPts([130, 1140], [140, 1300], [200, 1400])),
            wall('right-outlane', artPts([950, 1140], [940, 1300], [880, 1400])),

            // Sling legs: seal the ramp-mouth underside, then curve over the
            // flipper base so inlane balls drop onto the bat.
            wall('left-sling-leg', artPts([250, 1200], [230, 1300], [280, 1380], [390, 1450])),
            wall('right-sling-leg', artPts([830, 1200], [850, 1300], [800, 1380], [690, 1450])),

            // Sling faces (rubber side, center-play) — feed the flipper too.
            wall('left-sling-face', artPts([255, 1230], [310, 1315], [370, 1420])),
            wall('right-sling-face', artPts([825, 1230], [770, 1315], [710, 1420])),

            // Soft under-flipper apron only — keeps ball from escaping below the bats.
            wall('left-apron', artPts([70, 1455], [190, 1505], [330, 1530], [410, 1538])),
            wall('right-apron', artPts([948, 1455], [848, 1505], [708, 1530], [628, 1538]))
        ]
    };
}
