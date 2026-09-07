import { artPoint, artPts, SHOOTER_MOUTH_RADIUS } from '../geometry';
import { circleSensor, slide, type KitEmit, wall } from '../types';

/**
 * Right-side plunger tube. Exit hood feeds left across the top skill lane
 * so a strong launch can kiss the skill gate before dropping into play.
 */
export function shooterLane(): KitEmit {
    const divider = wall('shooter-left', artPts([968, 1520], [968, 200]));
    const gate = wall('shooter-oneway', artPts([968, 200], [968, 70]));
    // Hood: climb out of the tube, then run the top rail left into open play.
    const exitHood = slide(
        'shooter-exit',
        artPts(
            [1052, 130],
            [1030, 70],
            [980, 48],
            [900, 42],
            [780, 50],
            [660, 62],
            [540, 78]
        ),
        'shooter'
    );
    const enterPt = artPoint(1010, 1220);
    const exitPt = artPoint(1010, 150);
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
