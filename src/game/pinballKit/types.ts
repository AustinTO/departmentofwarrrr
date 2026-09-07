import type { SensorRole, TableEvent, TableObject } from '../ProcurementTableDefinition';

export type ArtPoint = [number, number];

export interface KitEmit {
    objects: TableObject[];
    tunnels?: Map<string, { enter: TableObject; exit: TableObject }>;
    bumperMarkers?: Array<{ id: string; x: number; y: number; radius: number }>;
}

export interface KitPlacement {
    /** Component instance id prefix */
    id: string;
    /** Art-space origin (0..1080, 0..1600) */
    artX?: number;
    artY?: number;
    /** Mirror across vertical midline of playfield art (540) */
    mirror?: boolean;
}

export type KitBuilder = () => KitEmit;

export function emptyEmit(): KitEmit {
    return { objects: [] };
}

export function mergeEmits(...parts: KitEmit[]): KitEmit {
    const objects: TableObject[] = [];
    const tunnels = new Map<string, { enter: TableObject; exit: TableObject }>();
    const bumperMarkers: Array<{ id: string; x: number; y: number; radius: number }> = [];
    for (const part of parts) {
        objects.push(...part.objects);
        part.tunnels?.forEach((v, k) => tunnels.set(k, v));
        if (part.bumperMarkers) bumperMarkers.push(...part.bumperMarkers);
    }
    return {
        objects,
        tunnels: tunnels.size ? tunnels : undefined,
        bumperMarkers: bumperMarkers.length ? bumperMarkers : undefined
    };
}

export function wall(
    id: string,
    points: ArtPoint[],
    extras?: Partial<TableObject>
): TableObject {
    const mid = points[Math.floor(points.length / 2)] ?? [0, 0];
    return { id, kind: 'wall', x: mid[0], y: mid[1], points, ...extras };
}

export function slide(
    id: string,
    points: ArtPoint[],
    linkId?: string,
    layer: 'playfield' | 'overpass' = 'playfield'
): TableObject {
    const mid = points[Math.floor(points.length / 2)] ?? [0, 0];
    return {
        id,
        kind: 'slide',
        x: mid[0],
        y: mid[1],
        width: 76,
        points,
        linkId,
        layer
    };
}

export function circleSensor(
    id: string,
    x: number,
    y: number,
    radius: number,
    role: SensorRole,
    linkId: string
): TableObject {
    return {
        id,
        kind: 'sensor',
        x,
        y,
        radius,
        sensor: role,
        linkId,
        event: role === 'entrance' ? 'LANE_ENTER' : role === 'exit' ? 'LANE_EXIT' : 'LANE_HIT'
    };
}

export function boxTarget(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    event: TableEvent,
    angle = 0
): TableObject {
    return { id, kind: 'target', x, y, width, height, angle, event };
}

export function boxSling(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    angle: number
): TableObject {
    return {
        id,
        kind: 'sling',
        x,
        y,
        width,
        height,
        angle,
        event: 'SLINGSHOT_HIT'
    };
}

export function circlePost(id: string, x: number, y: number, radius: number): TableObject {
    return { id, kind: 'post', x, y, radius };
}

export function flipper(id: string, x: number, y: number, width: number, height: number): TableObject {
    return { id, kind: 'flipper', x, y, width, height };
}

export function drain(id: string, x: number, y: number, width: number, height: number): TableObject {
    return { id, kind: 'drain', x, y, width, height, event: 'BALL_DRAINED' };
}
