import { artPoint } from '../geometry';
import { boxTarget, type KitEmit, type KitPlacement } from '../types';

export interface SkillGateOpts extends KitPlacement {
    artX: number;
    artY: number;
    width?: number;
    height?: number;
    angle?: number;
}

/** Narrow skill-shot target. */
export function skillGate(opts: SkillGateOpts): KitEmit {
    const w = opts.width ?? 36;
    const h = opts.height ?? 28;
    // Skill gate is thin in the approach axis (height when horizontal bar).
    if (Math.min(w, h) > 40) throw new Error(`${opts.id}: skill gate too thick`);
    const [x, y] = artPoint(opts.artX, opts.artY);
    return {
        objects: [boxTarget(opts.id, x, y, w, h, 'SKILL_SHOT', opts.angle ?? 0)]
    };
}
