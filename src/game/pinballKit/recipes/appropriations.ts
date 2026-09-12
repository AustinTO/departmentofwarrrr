import { apron } from '../components/apron';
import { bumper } from '../components/bumper';
import { cabinet } from '../components/cabinet';
import { dropTargets } from '../components/dropTargets';
import { dualRamp } from '../components/dualRamp';
import { flippers } from '../components/flippers';
import { post } from '../components/post';
import { scoopTunnel } from '../components/scoopTunnel';
import { shooterLane } from '../components/shooterLane';
import { skillGate } from '../components/skillGate';
import { slingPair } from '../components/slingPair';
import { assembleBoard, type BoardAssembly } from '../assemble';
import { joinBeziers } from '../geometry';
import type { KitBuilder } from '../types';

/**
 * Appropriations table — clean, playable layout.
 *
 * Playfield art space: x 0..1080, y 0..1600 (origin y=280 in game).
 * Plunger tube: x 968..1052. Open play: x 70..968.
 *
 * Layout zones:
 *   y 0..230    marquee / skill rollover (plunge sweeps left through here)
 *   y 240..740  bumper island (emergency → jackpot → sole-source/req-creep)
 *   y 800..1150 mid play — target bank, scoop tunnel, satellite bumpers
 *   y 1150..1520 lower play — ramp mouths, slings, outlanes, flippers
 */

/** Rideable channels — narrow mid-run, mouths just wide enough to catch. */
const RAMP_GAP = { enter: 100, mid: 72, exit: 86 };

/**
 * Left ramp: natural up-left shot from the left flipper tip.
 * Climbs the left wall and ends in an open spout — physics flies the ball
 * off the end into the bumper island (no top curl = no dead corners).
 * Centerline stays outboard so bumper/play lanes stay ball-clear.
 */
const LEFT_RAMP_CENTER = joinBeziers([
    { a: [280, 1180], ctrl: [220, 1020], b: [175, 880], steps: 6 },
    { a: [175, 880], ctrl: [145, 720], b: [150, 560], steps: 5 },
    { a: [150, 560], ctrl: [148, 440], b: [160, 320], steps: 5 }
]);

/**
 * Right ramp: mirror shot from the right flipper tip, clear of the plunger tube.
 * Climbs the right wall and ends in an open spout below the skill rollover —
 * a soft plunge can drop in here for the skill shot (bidirectional entry).
 */
const RIGHT_RAMP_CENTER = joinBeziers([
    { a: [800, 1180], ctrl: [850, 1020], b: [885, 880], steps: 6 },
    { a: [885, 880], ctrl: [910, 720], b: [905, 560], steps: 5 },
    { a: [905, 560], ctrl: [900, 440], b: [890, 320], steps: 5 }
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
            mouthRadius: 24,
            enterMouth: [280, 1165],
            exitMouth: [160, 300],
            gates: false
        }),

    () =>
        dualRamp({
            id: 'right-ramp',
            centerline: RIGHT_RAMP_CENTER,
            gapProfile: RAMP_GAP,
            mouthRadius: 24,
            enterMouth: [800, 1165],
            exitMouth: [890, 300],
            gates: false
        }),

    // Loop scoop — mid-play warp, reachable from both flippers.
    // Exit dumps onto the left flipper for an immediate recovery shot.
    () =>
        scoopTunnel({
            id: 'mid-scoop',
            linkId: 'loop',
            enterArt: [620, 1000],
            exitArt: [430, 1100],
            mouthRadius: 30
        }),

    // Bumper island — pulled inward so lanes between bumpers and narrow
    // ramps stay ≥ ball diameter clear.
    () => bumper({ id: 'emergency-supplemental', artX: 540, artY: 330, radius: 22 }),
    () => bumper({ id: 'jackpot', artX: 540, artY: 510, radius: 40 }),
    () => bumper({ id: 'sole-source', artX: 440, artY: 690, radius: 30 }),
    () => bumper({ id: 'requirements-creep', artX: 640, artY: 690, radius: 30 }),
    // Mid-play satellites — further center-side of the ramp channels.
    () => bumper({ id: 'audit-failed', artX: 420, artY: 1040, radius: 26 }),
    () => bumper({ id: 'fixed-price', artX: 660, artY: 1040, radius: 26 }),

    // Skill rollover above the right-ramp spout — a soft plunge drops through
    // here into the ramp mouth for the skill shot.
    () =>
        skillGate({
            id: 'skill-gate',
            artX: 875,
            artY: 250,
            width: 90,
            height: 22
        }),

    // Drop-target bank between the bumper island and mid play.
    () => dropTargets({ id: 'target', artX: 540, artY: 860, count: 3, spacing: 90 }),

    () => slingPair(),
    // Posts guard the target bank flanks (kept clear of the ramp mouth lanes).
    () => post({ id: 'left-bank-post', artX: 380, artY: 870, radius: 13 }),
    () => post({ id: 'right-bank-post', artX: 700, artY: 870, radius: 13 }),
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
