import { artPts } from '../geometry';
import { type KitEmit, wall } from '../types';

/**
 * Lower playfield: outlanes + outboard sling triangles that feed the flippers.
 * Triangle legs are plastic guides (not chrome). Rubber sits on the inboard face.
 */
export function apron(): KitEmit {
    return {
        objects: [
            // Outlanes — miss the triangle and you're draining.
            wall('left-outlane', artPts([88, 1140], [92, 1300], [130, 1455], [245, 1525])),
            wall('right-outlane', artPts([950, 1140], [946, 1300], [908, 1455], [793, 1525])),

            // Left sling triangle (apex post up-outboard → open toward flipper).
            // Outboard leg + inboard face; no chrome "return rail" clutter.
            wall('left-sling-leg', artPts([255, 1230], [200, 1325], [195, 1405])),
            wall('left-sling-face', artPts([255, 1230], [310, 1315], [345, 1415])),

            // Right sling triangle (mirror).
            wall('right-sling-leg', artPts([783, 1230], [838, 1325], [843, 1405])),
            wall('right-sling-face', artPts([783, 1230], [728, 1315], [693, 1415])),

            // Soft under-flipper apron only — keeps ball from escaping below the bats.
            wall('left-apron', artPts([70, 1455], [190, 1505], [330, 1530], [410, 1538])),
            wall('right-apron', artPts([948, 1455], [848, 1505], [708, 1530], [628, 1538]))
        ]
    };
}
