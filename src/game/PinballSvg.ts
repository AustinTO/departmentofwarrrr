import type { SensorRole, TableEvent, TableObject } from './ProcurementTableDefinition';
import tableSvgRaw from '../../public/assets/pinball/table_v1.svg?raw';

/** Same origin as PLAYFIELD_LAYOUT — kept local to avoid circular imports. */
const ORIGIN_X = 0;
const ORIGIN_Y = 280;

function artPoint(x: number, y: number): [number, number] {
    return [ORIGIN_X + x, ORIGIN_Y + y];
}

export type PinballSvgKind =
    | 'rail'
    | 'slide'
    | 'bumper'
    | 'sling'
    | 'post'
    | 'target'
    | 'flipper'
    | 'drain'
    | 'sensor'
    | 'tunnel-enter'
    | 'tunnel-exit';

export interface PinballSvgTable {
    table: TableObject[];
    /** linkId → exit object for tunnel warps */
    tunnels: Map<string, { enter: TableObject; exit: TableObject }>;
}

/** Bundled SVG playfield (art space 1080×1600). */
export const TABLE_V1_SVG = tableSvgRaw;

function parsePointsAttr(raw: string | null): Array<[number, number]> {
    if (!raw?.trim()) return [];
    const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
        pts.push(artPoint(nums[i], nums[i + 1]));
    }
    return pts;
}

function parseRotate(transform: string | null): number {
    if (!transform) return 0;
    const m = /rotate\(\s*([-\d.]+)/.exec(transform);
    return m ? (Number(m[1]) * Math.PI) / 180 : 0;
}

function midOf(points: Array<[number, number]>): [number, number] {
    const mid = points[Math.floor(points.length / 2)] ?? [0, 0];
    return mid;
}

function num(el: Element, attr: string, fallback = 0): number {
    const v = el.getAttribute(attr);
    return v != null && v !== '' ? Number(v) : fallback;
}

/**
 * Parse a pinball SVG document into game-space TableObjects.
 * Supports polyline (rails/slides), circle (bumpers/posts/sensors/tunnels),
 * rect (targets/slings/flippers/drain).
 */
export function parsePinballSvg(svgText: string): PinballSvgTable {
    // Prefer image/svg+xml; fall back to HTML parser if XML rejects odd bytes in comments.
    let doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    if (!doc.documentElement || doc.querySelector('parsererror')) {
        doc = new DOMParser().parseFromString(svgText, 'text/html');
    }
    const root = doc.querySelector('svg') ?? doc.documentElement;
    if (!root || root.querySelector?.('parsererror')) {
        throw new Error('Invalid pinball SVG');
    }

    const table: TableObject[] = [];
    const tunnelEnter = new Map<string, TableObject>();
    const tunnelExit = new Map<string, TableObject>();

    const pushSensor = (
        id: string,
        kind: PinballSvgKind,
        x: number,
        y: number,
        opts: { width?: number; height?: number; radius?: number; angle?: number; linkId: string; sensor: SensorRole }
    ) => {
        const obj: TableObject = {
            id,
            kind: 'sensor',
            x,
            y,
            width: opts.width,
            height: opts.height,
            radius: opts.radius,
            angle: opts.angle,
            sensor: opts.sensor,
            linkId: opts.linkId,
            event: opts.sensor === 'entrance' ? 'LANE_ENTER' : opts.sensor === 'exit' ? 'LANE_EXIT' : 'LANE_HIT'
        };
        table.push(obj);
        if (kind === 'tunnel-enter') tunnelEnter.set(opts.linkId, obj);
        if (kind === 'tunnel-exit') tunnelExit.set(opts.linkId, obj);
    };

    root.querySelectorAll('[data-kind]').forEach((el) => {
        const kind = el.getAttribute('data-kind') as PinballSvgKind | null;
        const id = el.getAttribute('id');
        if (!kind || !id) return;
        const tag = el.tagName.toLowerCase();

        if (kind === 'rail' || kind === 'slide') {
            const points = parsePointsAttr(el.getAttribute('points'));
            if (points.length < 2) return;
            const [x, y] = midOf(points);
            const layerAttr = el.getAttribute('data-layer');
            table.push({
                id,
                kind: kind === 'rail' ? 'wall' : 'slide',
                x,
                y,
                width: kind === 'slide' ? 76 : undefined,
                points,
                linkId: el.getAttribute('data-link') ?? undefined,
                layer: layerAttr === 'overpass' ? 'overpass' : 'playfield'
            });
            return;
        }

        if (kind === 'bumper' || kind === 'post') {
            const cx = num(el, 'cx');
            const cy = num(el, 'cy');
            const r = num(el, 'r', kind === 'bumper' ? 32 : 14);
            const [x, y] = artPoint(cx, cy);
            table.push({
                id,
                kind,
                x,
                y,
                radius: r,
                event: kind === 'bumper' ? 'BUMPER_HIT' : undefined
            });
            return;
        }

        if (kind === 'sensor' || kind === 'tunnel-enter' || kind === 'tunnel-exit') {
            const linkId = el.getAttribute('data-link') ?? id;
            let sensor: SensorRole =
                (el.getAttribute('data-sensor') as SensorRole | null) ?? 'lane';
            if (kind === 'tunnel-enter') sensor = 'entrance';
            if (kind === 'tunnel-exit') sensor = 'exit';

            if (tag === 'circle') {
                const [x, y] = artPoint(num(el, 'cx'), num(el, 'cy'));
                const radius = num(el, 'r', 36);
                pushSensor(id, kind, x, y, { radius, linkId, sensor });
                return;
            }

            const ax = num(el, 'x');
            const ay = num(el, 'y');
            const w = num(el, 'width', 64);
            const h = num(el, 'height', 28);
            const angle = parseRotate(el.getAttribute('transform'));
            const [x, y] = artPoint(ax + w / 2, ay + h / 2);
            pushSensor(id, kind, x, y, { width: w, height: h, angle, linkId, sensor });
            return;
        }

        // Remaining rect-based pieces
        const ax = num(el, 'x');
        const ay = num(el, 'y');
        const w = num(el, 'width', 64);
        const h = num(el, 'height', 28);
        const angle = parseRotate(el.getAttribute('transform'));
        const [x, y] = artPoint(ax + w / 2, ay + h / 2);

        if (kind === 'target') {
            const event = (el.getAttribute('data-event') as TableEvent | null) ?? 'TARGET_HIT';
            table.push({ id, kind: 'target', x, y, width: w, height: h, angle, event });
            return;
        }

        if (kind === 'sling') {
            table.push({
                id,
                kind: 'sling',
                x,
                y,
                width: w,
                height: h,
                angle,
                event: 'SLINGSHOT_HIT'
            });
            return;
        }

        if (kind === 'flipper') {
            table.push({ id, kind: 'flipper', x, y, width: w, height: h });
            return;
        }

        if (kind === 'drain') {
            table.push({
                id,
                kind: 'drain',
                x,
                y,
                width: w,
                height: h,
                event: 'BALL_DRAINED'
            });
        }
    });

    const tunnels = new Map<string, { enter: TableObject; exit: TableObject }>();
    tunnelEnter.forEach((enter, link) => {
        const exit = tunnelExit.get(link);
        if (exit) tunnels.set(link, { enter, exit });
    });

    return { table, tunnels };
}

/** Parsed shared SVG table used by all boards this milestone. */
let cached: PinballSvgTable | null = null;
let cachedRaw: string | null = null;

export function getSvgPinballTable(): PinballSvgTable {
    if (!cached || cachedRaw !== TABLE_V1_SVG) {
        cached = parsePinballSvg(TABLE_V1_SVG);
        cachedRaw = TABLE_V1_SVG;
    }
    return cached;
}

/** Game-space table objects from SVG (+ no bumper duplicates — bumpers merged by board). */
export function svgTableObjects(): TableObject[] {
    return getSvgPinballTable().table.filter((e) => e.kind !== 'bumper');
}

export function svgTunnels() {
    return getSvgPinballTable().tunnels;
}

/** Overlay SVG bumper markers onto satire bumper defs (position/radius from SVG). */
export function mergeBumpersFromSvg<T extends { id: string; x: number; y: number; radius: number }>(
    bumpers: readonly T[]
): T[] {
    const svgBumpers = getSvgPinballTable().table.filter((e) => e.kind === 'bumper');
    return bumpers.map((b) => {
        const hit = svgBumpers.find((s) => s.id === b.id);
        if (!hit) return { ...b };
        return {
            ...b,
            x: hit.x,
            y: hit.y,
            radius: hit.radius ?? b.radius
        };
    });
}

export function svgPlayfieldBounds() {
    return {
        width: 1080,
        height: 1600,
        originX: ORIGIN_X,
        originY: ORIGIN_Y
    };
}
