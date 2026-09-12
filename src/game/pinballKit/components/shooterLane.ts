import { artPoint, artPts, SHOOTER_MOUTH_RADIUS } from '../geometry';
import { circleSensor, slide, type KitEmit, wall } from '../types';

/**
 * Right-side plunger tube. Ceiling lip stays inside the tube (x >= divider).
 * `right-return` seals the playfield alley; physics kicks left over that seal.
 */
export function shooterLane(): KitEmit {
    const divider = wall('shooter-left', artPts([968, 1520], [968, 200]));
    const gate = wall('shooter-oneway', artPts([968, 200], [968, 55]));
    // Tube-only ceiling — never crosses left of the divider into the alley.
    const exitHood = slide(
        'shooter-exit',
        artPts([1052, 90], [1038, 42], [1010, 28], [980, 34]),
        'shooter'
    );
    const enterPt = artPoint(1010, 1220);
    const exitPt = artPoint(1010, 70);
    return {
        objects: [
            divider,
            gate,
            exitHood,
            circleSensor('shooter-enter', enterPt[0], enterPt[1], SHOOTER_MOUTH_RADIUS, 'entrance', 'shooter'),
            circleSensor('shooter-exit-gate', exitPt[0], exitPt[1], SHOOTER_MOUTH_RADIUS, 'exit', 'shooter')
        ]
    };
}
