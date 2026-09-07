export { assembleBoard } from './assemble';
export type { BoardAssembly } from './assemble';
export {
    assembleAppropriationsKit,
    resetAppropriationsKitCache,
    APPROPRIATIONS_RECIPE
} from './recipes/appropriations';
export { MIN_CHANNEL_GAP, MIN_RIDE_GAP, SKILL_MOUTH_RADIUS, BALL_RADIUS, artPoint } from './geometry';
export type { KitEmit, KitBuilder } from './types';

import { assembleAppropriationsKit } from './recipes/appropriations';
import type { TableObject } from '../ProcurementTableDefinition';

/** Live TableObject[] from kit (bumpers excluded — merged separately). */
export function kitTableObjects(): TableObject[] {
    return assembleAppropriationsKit().objects.filter((e) => e.kind !== 'bumper');
}

export function kitTunnels() {
    return assembleAppropriationsKit().tunnels ?? new Map();
}

/** Overlay kit bumper markers onto satire bumper defs. */
export function mergeBumpersFromKit<T extends { id: string; x: number; y: number; radius: number }>(
    bumpers: readonly T[]
): T[] {
    const markers = assembleAppropriationsKit().bumperMarkers ?? [];
    return bumpers.map((b) => {
        const hit = markers.find((m) => m.id === b.id);
        if (!hit) return { ...b };
        return { ...b, x: hit.x, y: hit.y, radius: hit.radius ?? b.radius };
    });
}
