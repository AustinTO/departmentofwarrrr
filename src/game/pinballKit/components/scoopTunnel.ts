import { artPoint, assertMouthClearance, SKILL_MOUTH_RADIUS } from '../geometry';
import { circleSensor, type KitEmit, type KitPlacement } from '../types';
import type { TableObject } from '../../ProcurementTableDefinition';

export interface ScoopTunnelOpts extends KitPlacement {
    /** Tunnel link id (physics key), e.g. `loop` */
    linkId?: string;
    enterArt: [number, number];
    exitArt: [number, number];
    mouthRadius?: number;
}

/**
 * Open scoop warp — enter sensor warps ball to exit. No blocking hood rails
 * around the mouth (those were trapping balls in fake pockets).
 */
export function scoopTunnel(opts: ScoopTunnelOpts): KitEmit {
    const mouthR = opts.mouthRadius ?? SKILL_MOUTH_RADIUS;
    assertMouthClearance(mouthR, opts.id);
    const linkId = opts.linkId ?? opts.id;
    const enterPt = artPoint(opts.enterArt[0], opts.enterArt[1]);
    const exitPt = artPoint(opts.exitArt[0], opts.exitArt[1]);

    const enter = circleSensor(
        `tunnel-${linkId}-enter`,
        enterPt[0],
        enterPt[1],
        mouthR,
        'entrance',
        linkId
    );
    const exit = circleSensor(
        `tunnel-${linkId}-exit`,
        exitPt[0],
        exitPt[1],
        Math.min(36, mouthR + 4),
        'exit',
        linkId
    );

    const objects: TableObject[] = [enter, exit];
    const tunnels = new Map<string, { enter: TableObject; exit: TableObject }>();
    tunnels.set(linkId, { enter, exit });
    return { objects, tunnels };
}
