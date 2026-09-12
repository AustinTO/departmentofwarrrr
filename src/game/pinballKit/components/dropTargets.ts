import { artPoint } from '../geometry';
import { boxTarget, type KitEmit, type KitPlacement } from '../types';

export interface DropTargetsOpts extends KitPlacement {
    /** Art-space center of bank */
    artX: number;
    artY: number;
    count?: 1 | 2 | 3;
    spacing?: number;
}

/** 1–3 TARGET_HIT drop targets. */
export function dropTargets(opts: DropTargetsOpts): KitEmit {
    const count = opts.count ?? 2;
    const spacing = opts.spacing ?? 70;
    const names = ['left', 'center', 'right'];
    const objects = [];
    for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spacing;
        const [x, y] = artPoint(opts.artX + offset, opts.artY);
        const suffix = count === 1 ? String(i + 1) : names[i] ?? String(i + 1);
        objects.push(boxTarget(`${opts.id}-${suffix}`, x, y, 60, 24, 'TARGET_HIT', 0));
    }
    return { objects };
}
