import { apron } from '../components/apron';
import { bumper } from '../components/bumper';
import { cabinet } from '../components/cabinet';
import { crossWire } from '../components/crossWire';
import { dropTargets } from '../components/dropTargets';
import { dualRamp } from '../components/dualRamp';
import { flippers } from '../components/flippers';
import { post } from '../components/post';
import { scoopTunnel } from '../components/scoopTunnel';
import { shooterLane } from '../components/shooterLane';
import { skillGate } from '../components/skillGate';
import { slingPair } from '../components/slingPair';
import { assembleBoard, type BoardAssembly } from '../assemble';
import type { KitBuilder } from '../types';
import { artPts, joinBeziers } from '../geometry';
import { wall } from '../types';

/**
 * Appropriations live table — flipper-reachable ramps, clear bumper island.
 */

/** Narrower mouths, thin mid-run, open exit spout. */
const RAMP_GAP = { enter: 112, mid: 78, exit: 120 };
const WIRE_GAP = { enter: 100, mid: 78, exit: 100 };

/** Left ramp: mouth sits on a natural up-left shot from the left flipper tip. */
const LEFT_RAMP_CENTER = joinBeziers([
    { a: [340, 1205], ctrl: [300, 1060], b: [265, 940], steps: 6 },
    { a: [265, 940], ctrl: [240, 820], b: [245, 720], steps: 5 },
    { a: [245, 720], ctrl: [260, 560], b: [285, 420], steps: 6 },
    { a: [285, 420], ctrl: [300, 340], b: [315, 280], steps: 5 }
]);

/** Right ramp: mirror, clear of shooter tube. */
const RIGHT_RAMP_CENTER = joinBeziers([
    { a: [740, 1205], ctrl: [780, 1060], b: [815, 940], steps: 6 },
    { a: [815, 940], ctrl: [840, 820], b: [835, 720], steps: 5 },
    { a: [835, 720], ctrl: [820, 560], b: [795, 420], steps: 6 },
    { a: [795, 420], ctrl: [780, 340], b: [765, 280], steps: 5 }
]);

const CROSS_WIRE_CENTER = joinBeziers([
    // Mouths sit slightly inside each side-ramp channel so a climb can divert onto the wire.
    { a: [252, 718], ctrl: [380, 688], b: [480, 678], steps: 5 },
    { a: [480, 678], ctrl: [600, 678], b: [700, 688], steps: 5 },
    { a: [700, 688], ctrl: [760, 700], b: [828, 718], steps: 4 }
]);

export const APPROPRIATIONS_RECIPE: KitBuilder[] = [
    () => cabinet(),
    () => shooterLane(),
    () => apron(),

    () =>
        dualRamp({
            id: 'left-ramp',
            centerline: LEFT_RAMP_CENTER,
            gapProfile: RAMP_GAP,
            mouthRadius: 22,
            enterMouth: [340, 1190],
            exitMouth: [315, 280],
            gates: false
        }),

    () =>
        dualRamp({
            id: 'right-ramp',
            centerline: RIGHT_RAMP_CENTER,
            gapProfile: RAMP_GAP,
            // Narrower mouth — still clear from the right flipper.
            mouthRadius: 22,
            enterMouth: [740, 1190],
            exitMouth: [765, 280],
            gates: false
        }),

    () =>
        crossWire({
            id: 'cross-wire',
            centerline: CROSS_WIRE_CENTER,
            channelGap: WIRE_GAP.mid,
            // Slightly larger mouths so a ramp graze can catch the wire.
            mouthRadius: 24
        }),

    () =>
        scoopTunnel({
            id: 'left-tunnel',
            linkId: 'loop',
            // Sit on the left-ramp exit so finishing the ramp actually warps
            enterArt: [315, 275],
            // Dump left of center above the left bat — never into the tip gap.
            exitArt: [430, 980],
            mouthRadius: 32
        }),

    // Decorative upper-right flourish — clear of right-ramp spout AND shooter exit loft.
    () => ({
        objects: [
            wall(
                'right-tunnel-hood',
                artPts([910, 95], [870, 70], [830, 85], [810, 120])
            )
        ]
    }),

    // Bumper island — kept above the sling/flipper feed zone
    () => bumper({ id: 'emergency-supplemental', artX: 540, artY: 195, radius: 22 }),
    () => bumper({ id: 'jackpot', artX: 540, artY: 400, radius: 46 }),
    () => bumper({ id: 'sole-source', artX: 455, artY: 640, radius: 32 }),
    () => bumper({ id: 'requirements-creep', artX: 625, artY: 640, radius: 32 }),
    () => bumper({ id: 'audit-failed', artX: 480, artY: 920, radius: 30 }),
    () => bumper({ id: 'fixed-price', artX: 600, artY: 920, radius: 28 }),

    () =>
        skillGate({
            id: 'skill-gate',
            artX: 640,
            artY: 118,
            width: 110,
            height: 26
        }),

    () => dropTargets({ id: 'target', artX: 540, artY: 505, count: 2, spacing: 140 }),

    () => slingPair(),
    // Posts cap the outboard sling triangles.
    () => post({ id: 'left-apron-post', artX: 255, artY: 1225, radius: 14 }),
    () => post({ id: 'right-apron-post', artX: 783, artY: 1225, radius: 14 }),
    () => flippers()
];

let cached: BoardAssembly | null = null;

export function assembleAppropriationsKit(): BoardAssembly {
    if (!cached) cached = assembleBoard(APPROPRIATIONS_RECIPE);
    return cached;
}

export function resetAppropriationsKitCache() {
    cached = null;
}
