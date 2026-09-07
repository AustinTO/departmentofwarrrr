import {
    artPoint,
    artPts,
    assertMouthClearance,
    dualChannel,
    MIN_CHANNEL_GAP,
    SKILL_MOUTH_RADIUS
} from '../geometry';
import { circleSensor, slide, type KitEmit, type KitPlacement } from '../types';

export interface CrossWireOpts extends KitPlacement {
    /** Art centerline left→right across the overpass */
    centerline: Array<[number, number]>;
    channelGap?: number;
    mouthRadius?: number;
    /** linkIds of ramps this wire bridges (for scoring / arming context) */
    fromLinkId?: string;
    toLinkId?: string;
}

/**
 * Overpass dual slides spanning left→right. Mouths are always emitted;
 * physics only mounts when cross-wire is armed after ramp entrance.
 */
export function crossWire(opts: CrossWireOpts): KitEmit {
    const gap = opts.channelGap ?? MIN_CHANNEL_GAP;
    const mouthR = opts.mouthRadius ?? SKILL_MOUTH_RADIUS;
    assertMouthClearance(mouthR, opts.id);

    const { outer, inner } = dualChannel(opts.centerline, gap);
    const linkId = opts.id;
    const objects = [
        slide(`${opts.id}-outer`, outer, linkId, 'overpass'),
        slide(`${opts.id}-inner`, inner, linkId, 'overpass')
    ];

    const start = opts.centerline[0];
    const end = opts.centerline[opts.centerline.length - 1];
    const enterPt = artPoint(start[0], start[1]);
    const exitPt = artPoint(end[0], end[1]);
    objects.push(
        circleSensor(`${opts.id}-enter`, enterPt[0], enterPt[1], mouthR, 'entrance', linkId),
        circleSensor(`${opts.id}-exit`, exitPt[0], exitPt[1], mouthR, 'exit', linkId)
    );

    // Soft guide cheeks so mouths seat into ramp channels
    objects.push(
        slide(
            `${opts.id}-cheek-l`,
            artPts([start[0] - 30, start[1] - 40], [start[0], start[1]], [start[0] + 20, start[1] + 30]),
            linkId,
            'overpass'
        ),
        slide(
            `${opts.id}-cheek-r`,
            artPts([end[0] + 30, end[1] - 40], [end[0], end[1]], [end[0] - 20, end[1] + 30]),
            linkId,
            'overpass'
        )
    );

    return { objects };
}
