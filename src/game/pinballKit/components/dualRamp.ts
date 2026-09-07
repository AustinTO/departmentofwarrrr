import {
    artPoint,
    artPts,
    assertMouthClearance,
    dualChannel,
    MIN_CHANNEL_GAP,
    SKILL_MOUTH_RADIUS,
    type ChannelGapProfile
} from '../geometry';
import { circleSensor, slide, type KitEmit, type KitPlacement, wall } from '../types';

export interface DualRampOpts extends KitPlacement {
    centerline: Array<[number, number]>;
    /** Uniform channel width (ignored when gapProfile is set). */
    channelGap?: number;
    /** Wide entrance + thin mid run + exit width. */
    gapProfile?: ChannelGapProfile;
    mouthRadius?: number;
    hoodAtExit?: boolean;
    /** Extra art-space points for a custom exit hood (overrides default hood). */
    exitHood?: Array<[number, number]>;
    enterMouth?: [number, number];
    exitMouth?: [number, number];
    /** Skip skill-gate cheeks (mouths only). */
    gates?: boolean;
}

/**
 * Dual-edge ramp with circular enter/exit mouths and optional exit hood.
 */
export function dualRamp(opts: DualRampOpts): KitEmit {
    const gap = opts.gapProfile ?? opts.channelGap ?? MIN_CHANNEL_GAP;
    const mouthR = opts.mouthRadius ?? SKILL_MOUTH_RADIUS;
    assertMouthClearance(mouthR, opts.id);

    const { outer, inner } = dualChannel(opts.centerline, gap);
    const linkId = opts.id;
    const objects = [
        slide(`${opts.id}-outer`, outer, linkId),
        slide(`${opts.id}-inner`, inner, linkId)
    ];

    const [ex, ey] = opts.enterMouth ?? opts.centerline[0];
    if (opts.gates !== false) {
        // Narrow cheeks below the mouth — forces a deliberate flipper aim.
        objects.push(
            wall(`${opts.id}-gate-l`, artPts([ex - 42, ey + 48], [ex - 20, ey + 12])),
            wall(`${opts.id}-gate-r`, artPts([ex + 42, ey + 48], [ex + 20, ey + 12]))
        );
    }

    if (opts.exitHood && opts.exitHood.length >= 2) {
        objects.push(slide(`${opts.id}-hood`, artPts(...opts.exitHood), linkId));
    } else if (opts.hoodAtExit) {
        const top = opts.exitMouth ?? opts.centerline[opts.centerline.length - 1];
        objects.push(
            slide(
                `${opts.id}-hood`,
                artPts(
                    [top[0] - 80, top[1] + 16],
                    [top[0] - 36, top[1] - 40],
                    [top[0] + 36, top[1] - 40],
                    [top[0] + 80, top[1] + 16]
                ),
                linkId
            )
        );
    }

    const enterArt = opts.enterMouth ?? opts.centerline[0];
    const exitArt = opts.exitMouth ?? opts.centerline[opts.centerline.length - 1];
    const enterPt = artPoint(enterArt[0], enterArt[1]);
    const exitPt = artPoint(exitArt[0], exitArt[1]);
    objects.push(
        circleSensor(`${opts.id}-enter`, enterPt[0], enterPt[1], mouthR, 'entrance', linkId),
        circleSensor(`${opts.id}-exit`, exitPt[0], exitPt[1], mouthR, 'exit', linkId)
    );

    return { objects };
}
