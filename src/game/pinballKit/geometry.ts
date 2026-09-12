import type { ArtPoint } from './types';

/** Match PLAYFIELD_LAYOUT without importing PinballBoards (avoid cycles). */
export const KIT_ORIGIN_X = 0;
export const KIT_ORIGIN_Y = 280;
export const KIT_ART_WIDTH = 1080;
export const KIT_ART_HEIGHT = 1600;
export const KIT_MID_X = 540;
export const BALL_RADIUS = 28;
/** Recommended mouth / entrance channel width. */
export const MIN_CHANNEL_GAP = 100;
/** Narrowest rideable mid-channel (ball diameter + margin). */
export const MIN_RIDE_GAP = BALL_RADIUS * 2 + 16;
export const SKILL_MOUTH_RADIUS = 22;
export const SHOOTER_MOUTH_RADIUS = 28;

export function artPoint(x: number, y: number): ArtPoint {
    return [KIT_ORIGIN_X + x, KIT_ORIGIN_Y + y];
}

export function artPts(...pairs: Array<[number, number]>): ArtPoint[] {
    return pairs.map(([x, y]) => artPoint(x, y));
}

/** Mirror art X across table midline (still art space). */
export function mirrorArtX(x: number): number {
    return KIT_ART_WIDTH - x;
}

export function mirrorArtPoints(points: Array<[number, number]>): Array<[number, number]> {
    return points.map(([x, y]) => [mirrorArtX(x), y]);
}

export type ChannelGapProfile = {
    /** Width at the first centerline sample (mouth). */
    enter: number;
    /** Width through the middle majority of the path. */
    mid: number;
    /** Width at the last centerline sample (exit). */
    exit: number;
};

function resolveGapAt(t: number, profile: ChannelGapProfile): number {
    // Hold entrance width briefly, taper into mid, hold mid, ease out to exit.
    if (t <= 0.12) return profile.enter;
    if (t < 0.28) {
        const u = (t - 0.12) / 0.16;
        return profile.enter + (profile.mid - profile.enter) * u;
    }
    if (t <= 0.78) return profile.mid;
    if (t < 0.92) {
        const u = (t - 0.78) / 0.14;
        return profile.mid + (profile.exit - profile.mid) * u;
    }
    return profile.exit;
}

function normalizeGapInput(
    gap: number | ChannelGapProfile
): ChannelGapProfile {
    if (typeof gap === 'number') {
        return { enter: gap, mid: gap, exit: gap };
    }
    return gap;
}

/**
 * Build dual-edge channel from a centerline in art space.
 * Uses averaged segment normals so curves don't pinch shut.
 * Pass a profile to keep mouths wide while thinning the middle run.
 */
export function dualChannel(
    centerline: Array<[number, number]>,
    gap: number | ChannelGapProfile = MIN_CHANNEL_GAP
): { outer: ArtPoint[]; inner: ArtPoint[] } {
    const profile = normalizeGapInput(gap);
    const minGap = Math.min(profile.enter, profile.mid, profile.exit);
    if (minGap < MIN_RIDE_GAP) {
        throw new Error(`Channel gap ${minGap} < min rideable ${MIN_RIDE_GAP}`);
    }
    if (centerline.length < 2) throw new Error('Centerline needs ≥2 points');
    const normals: Array<[number, number]> = [];
    for (let i = 0; i < centerline.length - 1; i++) {
        const dx = centerline[i + 1][0] - centerline[i][0];
        const dy = centerline[i + 1][1] - centerline[i][1];
        const len = Math.hypot(dx, dy) || 1;
        normals.push([-dy / len, dx / len]);
    }
    const outer: ArtPoint[] = [];
    const inner: ArtPoint[] = [];
    const last = centerline.length - 1;
    for (let i = 0; i < centerline.length; i++) {
        const a = normals[Math.max(0, i - 1)];
        const b = normals[Math.min(normals.length - 1, i)];
        let nx = a[0] + b[0];
        let ny = a[1] + b[1];
        const nlen = Math.hypot(nx, ny) || 1;
        nx /= nlen;
        ny /= nlen;
        const half = resolveGapAt(i / last, profile) / 2;
        const [cx, cy] = centerline[i];
        outer.push(artPoint(cx + nx * half, cy + ny * half));
        inner.push(artPoint(cx - nx * half, cy - ny * half));
    }
    return { outer, inner };
}

/** Sample a quadratic bezier in art space. */
export function quadBezier(
    a: [number, number],
    ctrl: [number, number],
    b: [number, number],
    steps = 8
): Array<[number, number]> {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        pts.push([
            u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0],
            u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1]
        ]);
    }
    return pts;
}

/** Join bezier segments end-to-end, dropping duplicate join points. */
export function joinBeziers(
    segments: Array<{
        a: [number, number];
        ctrl: [number, number];
        b: [number, number];
        steps?: number;
    }>
): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (const seg of segments) {
        const pts = quadBezier(seg.a, seg.ctrl, seg.b, seg.steps ?? 7);
        for (const p of pts) {
            const last = out[out.length - 1];
            if (last && last[0] === p[0] && last[1] === p[1]) continue;
            out.push(p);
        }
    }
    return out;
}

export function assertMouthClearance(radius: number, label: string) {
    if (radius < 18 || radius > 36) {
        throw new Error(`${label}: mouth radius ${radius} out of skill range`);
    }
    if (radius * 2 >= MIN_CHANNEL_GAP) {
        throw new Error(`${label}: mouth diameter must fit inside channel`);
    }
}
