import { WeaponType } from './config';
import type { ProcurementBumper, TableObject } from './ProcurementTableDefinition';
import { kitTableObjects, mergeBumpersFromKit } from './pinballKit';

export type PinballBoardId = 'appropriations' | 'audit_chamber' | 'supplemental_stadium';

export interface PinballBoardDef {
    id: PinballBoardId;
    name: string;
    subtitle: string;
    playfieldKey: string;
    accent: number;
    unlockFy?: number;
    unlockMansions?: number;
    bumpers: readonly ProcurementBumper[];
    table: readonly TableObject[];
}

const FLIPPER_W = 280;
const FLIPPER_H = 40;

/**
 * Playfield PNGs are 1080×1600. They are placed 1:1 into the portrait canvas
 * so art pixels == physics coordinates (no stretch mismatch).
 */
export const PLAYFIELD_LAYOUT = {
    artWidth: 1080,
    artHeight: 1600,
    /** Top-left of the playfield image in game space. */
    originX: 0,
    originY: 280,
    get bottom() {
        return this.originY + this.artHeight; // 1880
    },
    get centerY() {
        return this.originY + this.artHeight / 2; // 1080
    }
} as const;

/** Convert art-space points (0..1080, 0..1600) into game coordinates. */
export function artPoint(x: number, y: number): [number, number] {
    return [PLAYFIELD_LAYOUT.originX + x, PLAYFIELD_LAYOUT.originY + y];
}

function artPts(...pairs: Array<[number, number]>): Array<[number, number]> {
    return pairs.map(([x, y]) => artPoint(x, y));
}

/**
 * Plunger tube — traced from the painted far-right channel.
 * ~84px between wall centers → ~70px clear for the 56px ball.
 * All playfield ramps stay left of artInnerX.
 */
export const SHOOTER_LANE = {
    artInnerX: 968,
    artOuterX: 1052,
    artLaunchX: 1010,
    artLaunchY: 1220,
    artReadyY: 1320,
    /** Solid divider ends here; one-way gate continues to the top exit. */
    artExitY: 200,
    get launchX() { return artPoint(this.artLaunchX, this.artLaunchY)[0]; },
    get launchY() { return artPoint(this.artLaunchX, this.artLaunchY)[1]; },
    get readyX() { return artPoint(this.artLaunchX, this.artReadyY)[0]; },
    get readyY() { return artPoint(this.artLaunchX, this.artReadyY)[1]; }
} as const;

function wall(id: string, points: Array<[number, number]>): TableObject {
    const mid = points[Math.floor(points.length / 2)];
    return { id, kind: 'wall', x: mid[0], y: mid[1], points };
}

function slide(id: string, points: Array<[number, number]>, width = 70): TableObject {
    const mid = points[Math.floor(points.length / 2)];
    return { id, kind: 'slide', x: mid[0], y: mid[1], width, points };
}

function laneSensor(
    id: string,
    artX: number,
    artY: number,
    role: 'entrance' | 'exit',
    linkId: string,
    angle = 0,
    width = 78,
    height = 34
): TableObject {
    const [x, y] = artPoint(artX, artY);
    return {
        id,
        kind: 'sensor',
        x,
        y,
        width,
        height,
        angle,
        sensor: role,
        linkId,
        event: role === 'entrance' ? 'LANE_ENTER' : 'LANE_EXIT'
    };
}

/**
 * Keep a ramp channel out of the plunger tube by shifting BOTH edges by the
 * same overflow (preserves channel width).
 */
function keepChannelLeftOfShooter(
    outer: Array<[number, number]>,
    inner: Array<[number, number]>
): [Array<[number, number]>, Array<[number, number]>] {
    const maxX = SHOOTER_LANE.artInnerX - 20;
    const overflow = Math.max(
        0,
        ...outer.map(([x]) => x - maxX),
        ...inner.map(([x]) => x - maxX)
    );
    if (overflow <= 0) return [outer, inner];
    return [
        outer.map(([x, y]) => [x - overflow, y] as [number, number]),
        inner.map(([x, y]) => [x - overflow, y] as [number, number])
    ];
}

/** Keep widened channels inside the art playfield (don't spill past left rail). */
function clampChannelToPlayfield(
    outer: Array<[number, number]>,
    inner: Array<[number, number]>
): [Array<[number, number]>, Array<[number, number]>] {
    const minX = 55;
    const underflow = Math.max(
        0,
        ...outer.map(([x]) => minX - x),
        ...inner.map(([x]) => minX - x)
    );
    if (underflow <= 0) return [outer, inner];
    return [
        outer.map(([x, y]) => [x + underflow, y] as [number, number]),
        inner.map(([x, y]) => [x + underflow, y] as [number, number])
    ];
}

/** Ball diameter (56) + thin rail slabs + room so curves never pinch. */
const MIN_CHANNEL_GAP = 112;

/**
 * Push paired outer/inner midlines apart so corresponding samples stay open.
 */
function widenChannelPair(
    outer: Array<[number, number]>,
    inner: Array<[number, number]>,
    minGap = MIN_CHANNEL_GAP
): [Array<[number, number]>, Array<[number, number]>] {
    const n = Math.min(outer.length, inner.length);
    const o: Array<[number, number]> = outer.map(([x, y]) => [x, y]);
    const inn: Array<[number, number]> = inner.map(([x, y]) => [x, y]);
    for (let i = 0; i < n; i++) {
        const dx = inn[i][0] - o[i][0];
        const dy = inn[i][1] - o[i][1];
        const dist = Math.hypot(dx, dy) || 1;
        if (dist >= minGap) continue;
        const mx = (o[i][0] + inn[i][0]) / 2;
        const my = (o[i][1] + inn[i][1]) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        const half = minGap / 2;
        o[i] = [mx - nx * half, my - ny * half];
        inn[i] = [mx + nx * half, my + ny * half];
    }
    return [o, inn];
}

/** Closest distance between two segments (sampled). */
function segmentProximity(
    a: [number, number],
    b: [number, number],
    c: [number, number],
    d: [number, number]
): { dist: number; ox: number; oy: number; ix: number; iy: number } {
    let best = { dist: Infinity, ox: 0, oy: 0, ix: 0, iy: 0 };
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const ox = a[0] + (b[0] - a[0]) * t;
        const oy = a[1] + (b[1] - a[1]) * t;
        for (let j = 0; j <= 6; j++) {
            const u = j / 6;
            const ix = c[0] + (d[0] - c[0]) * u;
            const iy = c[1] + (d[1] - c[1]) * u;
            const dist = Math.hypot(ox - ix, oy - iy);
            if (dist < best.dist) best = { dist, ox, oy, ix, iy };
        }
    }
    return best;
}

/**
 * Curves can pinch even when indexed pairs are wide — push any close
 * segment pairs apart until the true channel clearance is playable.
 */
function separateChannelCurves(
    outer: Array<[number, number]>,
    inner: Array<[number, number]>,
    minGap = MIN_CHANNEL_GAP
): [Array<[number, number]>, Array<[number, number]>] {
    const o: Array<[number, number]> = outer.map(([x, y]) => [x, y]);
    const inn: Array<[number, number]> = inner.map(([x, y]) => [x, y]);
    for (let pass = 0; pass < 10; pass++) {
        let worst = { dist: minGap, oi: 0, ii: 0, ox: 0, oy: 0, ix: 0, iy: 0 };
        for (let i = 0; i < o.length - 1; i++) {
            for (let j = 0; j < inn.length - 1; j++) {
                const hit = segmentProximity(o[i], o[i + 1], inn[j], inn[j + 1]);
                if (hit.dist < worst.dist) {
                    worst = { dist: hit.dist, oi: i, ii: j, ox: hit.ox, oy: hit.oy, ix: hit.ix, iy: hit.iy };
                }
            }
        }
        if (worst.dist >= minGap - 0.5) break;
        const dx = worst.ix - worst.ox;
        const dy = worst.iy - worst.oy;
        const dist = Math.hypot(dx, dy) || 1;
        const push = (minGap - dist) / 2 + 1;
        const nx = dx / dist;
        const ny = dy / dist;
        for (const idx of [worst.oi, worst.oi + 1]) {
            o[idx] = [o[idx][0] - nx * push, o[idx][1] - ny * push];
        }
        for (const idx of [worst.ii, worst.ii + 1]) {
            inn[idx] = [inn[idx][0] + nx * push, inn[idx][1] + ny * push];
        }
    }
    return [o, inn];
}

/**
 * Drop upper channel tips that poke into the skill-lane alley (they formed
 * dead pockets with the plunger exit hood).
 */
function trimChannelTop(
    outer: Array<[number, number]>,
    inner: Array<[number, number]>,
    minArtY = 280
): [Array<[number, number]>, Array<[number, number]>] {
    let cut = 0;
    for (let i = outer.length - 1; i >= 2; i--) {
        if (outer[i][1] < minArtY || inner[Math.min(i, inner.length - 1)][1] < minArtY) cut++;
        else break;
    }
    if (cut <= 0) return [outer, inner];
    const end = Math.max(3, outer.length - cut);
    return [outer.slice(0, end), inner.slice(0, Math.min(end, inner.length))];
}

/**
 * Playable ramp = dual slippery edges + entrance/exit sensors.
 * Midlines are widened and de-pinched so the ball never wedges.
 */
function rampChannel(
    id: string,
    outer: Array<[number, number]>,
    inner: Array<[number, number]>
): TableObject[] {
    let [outerPts, innerPts] = trimChannelTop(outer, inner);
    [outerPts, innerPts] = widenChannelPair(outerPts, innerPts);
    [outerPts, innerPts] = separateChannelCurves(outerPts, innerPts);
    [outerPts, innerPts] = keepChannelLeftOfShooter(outerPts, innerPts);
    [outerPts, innerPts] = clampChannelToPlayfield(outerPts, innerPts);
    [outerPts, innerPts] = widenChannelPair(outerPts, innerPts);
    [outerPts, innerPts] = separateChannelCurves(outerPts, innerPts);
    [outerPts, innerPts] = keepChannelLeftOfShooter(outerPts, innerPts);
    [outerPts, innerPts] = clampChannelToPlayfield(outerPts, innerPts);
    const finalOuter = outerPts;
    const finalInner = innerPts;
    const last = finalOuter.length - 1;
    const enterArt: [number, number] = [
        (finalOuter[0][0] + finalInner[0][0]) / 2,
        (finalOuter[0][1] + finalInner[0][1]) / 2
    ];
    const exitArt: [number, number] = [
        (finalOuter[last][0] + finalInner[Math.min(last, finalInner.length - 1)][0]) / 2,
        (finalOuter[last][1] + finalInner[Math.min(last, finalInner.length - 1)][1]) / 2
    ];
    const enterAngle = Math.atan2(finalOuter[1][1] - finalOuter[0][1], finalOuter[1][0] - finalOuter[0][0]);
    const exitAngle = Math.atan2(
        finalOuter[last][1] - finalOuter[last - 1][1],
        finalOuter[last][0] - finalOuter[last - 1][0]
    );
    return [
        slide(`${id}-outer`, artPts(...finalOuter), 76),
        slide(`${id}-inner`, artPts(...finalInner), 76),
        laneSensor(`${id}-enter`, enterArt[0], enterArt[1], 'entrance', id, enterAngle),
        laneSensor(`${id}-exit`, exitArt[0], exitArt[1], 'exit', id, exitAngle)
    ];
}

/** Shared cabinet + plunger tube + flippers (art space). */
function cabinetFrame(): TableObject[] {
    const L = SHOOTER_LANE.artInnerX;
    const R = SHOOTER_LANE.artOuterX;
    return [
        wall('top-rail', artPts([70, 45], [L - 20, 50])),
        wall('left-rail', artPts([70, 45], [70, 1520])),
        wall('right-rail', artPts([R, 45], [R, 1520])),
        wall('left-bottom-rail', artPts([70, 1520], [420, 1520])),
        wall('right-bottom-rail', artPts([660, 1520], [R, 1520])),
        // Plunger tube — solid lower divider, one-way upper so ball can exit left
        wall('shooter-left', artPts([L, 1520], [L, SHOOTER_LANE.artExitY])),
        wall('shooter-oneway', artPts([L, SHOOTER_LANE.artExitY], [L, 70])),
        // Soft top exit: loft left across the skill lane (does not cap the tube)
        wall('shooter-exit', artPts(
            [R, 110],
            [1025, 55],
            [940, 40],
            [820, 45],
            [700, 55],
            [560, 60]
        )),
        // Plunger tube enter (bottom) / exit (top) sensors
        laneSensor('shooter-enter', SHOOTER_LANE.artLaunchX, SHOOTER_LANE.artLaunchY - 40, 'entrance', 'shooter', -Math.PI / 2, 70, 40),
        laneSensor('shooter-exit-gate', SHOOTER_LANE.artLaunchX, 160, 'exit', 'shooter', -Math.PI / 2, 70, 40),
        {
            id: 'drain', kind: 'drain',
            x: artPoint(540, 1520)[0], y: artPoint(540, 1520)[1],
            width: 220, height: 36, event: 'BALL_DRAINED'
        },
        {
            id: 'left-flipper', kind: 'flipper',
            x: artPoint(270, 1420)[0], y: artPoint(270, 1420)[1],
            width: FLIPPER_W, height: FLIPPER_H
        },
        {
            id: 'right-flipper', kind: 'flipper',
            x: artPoint(810, 1420)[0], y: artPoint(810, 1420)[1],
            width: FLIPPER_W, height: FLIPPER_H
        }
    ];
}

/**
 * Appropriations — art-traced red ramps (dual-edge channels), desk nose,
 * money/elevator solids, brass apron. Midlines from playfield.png.
 */
function appropriationsShell(): TableObject[] {
    return [
        ...cabinetFrame(),
        // No desk solid — painted art only. A collision here + ramp tops formed a
        // dead pocket that trapped launched balls at the skill lane.
        ...rampChannel('left-ramp',
            [[208, 1029], [213, 1001], [209, 979], [191, 950], [172, 920], [131, 883], [111, 831], [116, 774], [147, 740], [157, 676], [173, 634], [196, 592], [233, 555], [252, 528], [260, 504], [260, 477], [240, 420], [210, 360], [200, 300], [190, 240], [200, 180]],
            [[283, 1041], [289, 999], [279, 951], [256, 910], [229, 870], [192, 837], [186, 819], [184, 806], [217, 770], [230, 694], [242, 666], [256, 638], [291, 605], [320, 562], [335, 516], [336, 473], [320, 410], [300, 350], [290, 280], [275, 200], [260, 150]]
        ),
        ...rampChannel('right-ramp',
            [[860, 1031], [855, 1010], [878, 975], [910, 801], [943, 760], [924, 675], [903, 602], [884, 567], [877, 532], [846, 459], [829, 441], [845, 360], [860, 260], [850, 180]],
            [[785, 1039], [782, 990], [805, 955], [838, 779], [868, 750], [851, 695], [831, 628], [813, 593], [805, 558], [777, 491], [753, 439], [770, 350], [790, 250], [780, 170]]
        ),
        wall('left-return', artPts([155, 1100], [145, 1240], [130, 1360])),
        wall('right-return', artPts([900, 1100], [910, 1240], [925, 1360])),
        wall('left-apron', artPts([70, 1320], [190, 1385], [270, 1415])),
        wall('right-apron', artPts([948, 1320], [870, 1385], [810, 1415])),
        wall('left-apron-inner', artPts([155, 1280], [255, 1388])),
        wall('right-apron-inner', artPts([900, 1280], [825, 1388])),

        { id: 'skill-gate', kind: 'target', x: artPoint(540, 250)[0], y: artPoint(540, 250)[1], width: 170, height: 34, event: 'SKILL_SHOT' },
        { id: 'target-left', kind: 'target', x: artPoint(400, 480)[0], y: artPoint(400, 480)[1], width: 68, height: 26, event: 'TARGET_HIT' },
        { id: 'target-center', kind: 'target', x: artPoint(540, 500)[0], y: artPoint(540, 500)[1], width: 80, height: 28, event: 'TARGET_HIT' },
        { id: 'target-right', kind: 'target', x: artPoint(680, 480)[0], y: artPoint(680, 480)[1], width: 68, height: 26, event: 'TARGET_HIT' },
        { id: 'target-low-left', kind: 'target', x: artPoint(400, 860)[0], y: artPoint(400, 860)[1], width: 64, height: 24, event: 'TARGET_HIT' },
        { id: 'target-low-right', kind: 'target', x: artPoint(680, 860)[0], y: artPoint(680, 860)[1], width: 64, height: 24, event: 'TARGET_HIT' },

        { id: 'left-sling', kind: 'sling', x: artPoint(230, 1260)[0], y: artPoint(230, 1260)[1], width: 130, height: 28, angle: 0.55, event: 'SLINGSHOT_HIT' },
        { id: 'right-sling', kind: 'sling', x: artPoint(850, 1260)[0], y: artPoint(850, 1260)[1], width: 130, height: 28, angle: -0.55, event: 'SLINGSHOT_HIT' },

        { id: 'left-post', kind: 'post', x: artPoint(300, 980)[0], y: artPoint(300, 980)[1], radius: 15 },
        { id: 'right-post', kind: 'post', x: artPoint(780, 980)[0], y: artPoint(780, 980)[1], radius: 15 },
        { id: 'left-apron-post', kind: 'post', x: artPoint(355, 1200)[0], y: artPoint(355, 1200)[1], radius: 14 },
        { id: 'right-apron-post', kind: 'post', x: artPoint(725, 1200)[0], y: artPoint(725, 1200)[1], radius: 14 },
        { id: 'mid-left-post', kind: 'post', x: artPoint(360, 700)[0], y: artPoint(360, 700)[1], radius: 13 },
        { id: 'mid-right-post', kind: 'post', x: artPoint(720, 700)[0], y: artPoint(720, 700)[1], radius: 13 }
    ];
}

/**
 * Audit Chamber — leather red pads as dual-edge channels, desk, brass gutters.
 */
function auditChamberShell(): TableObject[] {
    return [
        ...cabinetFrame(),
        ...rampChannel('left-leather',
            [[189, 1074], [186, 1044], [183, 1028], [127, 997], [77, 960], [50, 900], [55, 840], [70, 780], [90, 720], [110, 660], [145, 600], [180, 540], [210, 480], [200, 400], [150, 340], [180, 280], [220, 220]],
            [[264, 1066], [260, 1026], [235, 972], [169, 933], [140, 880], [130, 820], [150, 760], [170, 700], [200, 640], [235, 580], [270, 520], [295, 460], [280, 390], [250, 330], [270, 260], [290, 200]]
        ),
        ...rampChannel('right-leather',
            [[887, 1084], [902, 1049], [913, 1019], [940, 950], [948, 860], [948, 780], [940, 700], [925, 620], [910, 540], [890, 460], [860, 380], [850, 280], [870, 200]],
            [[817, 1056], [831, 1021], [847, 981], [870, 920], [885, 840], [890, 760], [880, 680], [860, 600], [840, 520], [815, 440], [790, 360], [800, 260], [820, 180]]
        ),
        wall('left-brass', artPts([95, 200], [88, 420], [100, 700], [115, 950])),
        wall('left-return', artPts([175, 1100], [170, 1280], [155, 1360])),
        wall('right-return', artPts([890, 1100], [900, 1280], [915, 1360])),
        wall('left-apron', artPts([70, 1320], [200, 1385], [270, 1415])),
        wall('right-apron', artPts([948, 1320], [870, 1385], [810, 1415])),
        wall('left-apron-inner', artPts([175, 1280], [255, 1388])),
        wall('right-apron-inner', artPts([890, 1280], [825, 1388])),

        { id: 'skill-gate', kind: 'target', x: artPoint(540, 245)[0], y: artPoint(540, 245)[1], width: 160, height: 32, event: 'SKILL_SHOT' },
        { id: 'target-evidence-1', kind: 'target', x: artPoint(680, 420)[0], y: artPoint(680, 420)[1], width: 70, height: 24, event: 'TARGET_HIT' },
        { id: 'target-evidence-2', kind: 'target', x: artPoint(680, 520)[0], y: artPoint(680, 520)[1], width: 70, height: 24, event: 'TARGET_HIT' },
        { id: 'target-evidence-3', kind: 'target', x: artPoint(680, 620)[0], y: artPoint(680, 620)[1], width: 70, height: 24, event: 'TARGET_HIT' },
        { id: 'target-exhibit-a', kind: 'target', x: artPoint(400, 520)[0], y: artPoint(400, 520)[1], width: 70, height: 24, event: 'TARGET_HIT' },
        { id: 'target-exhibit-b', kind: 'target', x: artPoint(400, 620)[0], y: artPoint(400, 620)[1], width: 70, height: 24, event: 'TARGET_HIT' },
        { id: 'target-exhibit-c', kind: 'target', x: artPoint(540, 740)[0], y: artPoint(540, 740)[1], width: 84, height: 26, event: 'TARGET_HIT' },

        { id: 'left-sling', kind: 'sling', x: artPoint(235, 1255)[0], y: artPoint(235, 1255)[1], width: 128, height: 28, angle: 0.58, event: 'SLINGSHOT_HIT' },
        { id: 'right-sling', kind: 'sling', x: artPoint(845, 1255)[0], y: artPoint(845, 1255)[1], width: 128, height: 28, angle: -0.58, event: 'SLINGSHOT_HIT' },

        { id: 'left-post', kind: 'post', x: artPoint(300, 980)[0], y: artPoint(300, 980)[1], radius: 14 },
        { id: 'right-post', kind: 'post', x: artPoint(780, 980)[0], y: artPoint(780, 980)[1], radius: 14 },
        { id: 'gavel-post', kind: 'post', x: artPoint(540, 300)[0], y: artPoint(540, 300)[1], radius: 16 },
        { id: 'exhibit-post', kind: 'post', x: artPoint(540, 880)[0], y: artPoint(540, 880)[1], radius: 14 },
        { id: 'left-apron-post', kind: 'post', x: artPoint(360, 1185)[0], y: artPoint(360, 1185)[1], radius: 13 },
        { id: 'right-apron-post', kind: 'post', x: artPoint(720, 1185)[0], y: artPoint(720, 1185)[1], radius: 13 }
    ];
}

/**
 * Supplemental Stadium — S-curve neon ramps, cyan bunker, missile silo solid.
 */
function stadiumShell(): TableObject[] {
    return [
        ...cabinetFrame(),
        ...rampChannel('left-stadium',
            [[205, 1098], [155, 1050], [120, 909], [88, 872], [94, 818], [107, 767], [155, 731], [157, 706], [188, 647], [163, 613], [196, 562], [203, 529], [229, 491], [241, 464], [247, 434], [250, 370], [240, 300], [220, 230], [215, 170]],
            [[255, 1042], [225, 1020], [191, 881], [159, 848], [169, 832], [167, 813], [215, 779], [228, 734], [263, 653], [239, 617], [263, 598], [272, 561], [296, 529], [313, 486], [322, 446], [325, 380], [310, 300], [295, 230], [290, 170]]
        ),
        ...rampChannel('right-stadium',
            [[875, 1086], [941, 949], [948, 895], [948, 825], [940, 760], [920, 700], [910, 640], [920, 580], [905, 520], [860, 460], [800, 400], [760, 340]],
            [[807, 1054], [876, 911], [900, 860], [900, 800], [880, 740], [860, 680], [850, 620], [845, 560], [830, 500], [790, 440], [740, 380], [700, 340]]
        ),
        wall('left-return', artPts([150, 1100], [145, 1280], [130, 1360])),
        wall('right-return', artPts([900, 1100], [910, 1280], [920, 1360])),
        wall('left-apron', artPts([70, 1310], [200, 1380], [270, 1415])),
        wall('right-apron', artPts([948, 1310], [870, 1380], [810, 1415])),
        wall('left-apron-inner', artPts([150, 1280], [255, 1388])),
        wall('right-apron-inner', artPts([900, 1280], [825, 1388])),

        { id: 'skill-gate', kind: 'target', x: artPoint(540, 230)[0], y: artPoint(540, 230)[1], width: 190, height: 36, event: 'SKILL_SHOT' },
        { id: 'target-north', kind: 'target', x: artPoint(540, 400)[0], y: artPoint(540, 400)[1], width: 76, height: 26, event: 'TARGET_HIT' },
        { id: 'target-west', kind: 'target', x: artPoint(420, 540)[0], y: artPoint(420, 540)[1], width: 66, height: 24, event: 'TARGET_HIT' },
        { id: 'target-east', kind: 'target', x: artPoint(660, 540)[0], y: artPoint(660, 540)[1], width: 66, height: 24, event: 'TARGET_HIT' },
        { id: 'target-south', kind: 'target', x: artPoint(540, 680)[0], y: artPoint(540, 680)[1], width: 76, height: 26, event: 'TARGET_HIT' },
        { id: 'target-bleacher-l', kind: 'target', x: artPoint(340, 880)[0], y: artPoint(340, 880)[1], width: 60, height: 22, event: 'TARGET_HIT' },
        { id: 'target-bleacher-r', kind: 'target', x: artPoint(740, 880)[0], y: artPoint(740, 880)[1], width: 60, height: 22, event: 'TARGET_HIT' },

        { id: 'left-sling', kind: 'sling', x: artPoint(225, 1250)[0], y: artPoint(225, 1250)[1], width: 135, height: 30, angle: 0.52, event: 'SLINGSHOT_HIT' },
        { id: 'right-sling', kind: 'sling', x: artPoint(855, 1250)[0], y: artPoint(855, 1250)[1], width: 135, height: 30, angle: -0.52, event: 'SLINGSHOT_HIT' },

        { id: 'left-post', kind: 'post', x: artPoint(300, 1000)[0], y: artPoint(300, 1000)[1], radius: 15 },
        { id: 'right-post', kind: 'post', x: artPoint(780, 1000)[0], y: artPoint(780, 1000)[1], radius: 15 },
        { id: 'arena-post-n', kind: 'post', x: artPoint(540, 340)[0], y: artPoint(540, 340)[1], radius: 15 },
        { id: 'arena-post-s', kind: 'post', x: artPoint(540, 960)[0], y: artPoint(540, 960)[1], radius: 15 },
        { id: 'arena-post-w', kind: 'post', x: artPoint(400, 700)[0], y: artPoint(400, 700)[1], radius: 13 },
        { id: 'arena-post-e', kind: 'post', x: artPoint(680, 700)[0], y: artPoint(680, 700)[1], radius: 13 },
        { id: 'left-apron-post', kind: 'post', x: artPoint(350, 1190)[0], y: artPoint(350, 1190)[1], radius: 14 },
        { id: 'right-apron-post', kind: 'post', x: artPoint(730, 1190)[0], y: artPoint(730, 1190)[1], radius: 14 }
    ];
}

/** Expand polyline table objects into consecutive edge segments for physics/render. */
export function polylineSegments(points: Array<[number, number]>): Array<[[number, number], [number, number]]> {
    const segments: Array<[[number, number], [number, number]]> = [];
    for (let i = 0; i < points.length - 1; i++) {
        segments.push([points[i], points[i + 1]]);
    }
    return segments;
}

/** Build full table objects from a board shell + bumper list. */
export function buildTable(
    bumpers: readonly ProcurementBumper[],
    shell: readonly TableObject[]
): TableObject[] {
    return [
        ...shell.filter((e) => e.kind !== 'flipper'),
        ...bumpers.map(({ id, x, y, radius }) => ({
            id, kind: 'bumper' as const, x, y, radius, event: 'BUMPER_HIT' as const
        })),
        ...shell.filter((e) => e.kind === 'flipper')
    ];
}

export function countDropTargets(table: readonly TableObject[]): number {
    return table.filter((e) => e.kind === 'target' && e.event === 'TARGET_HIT').length;
}

export function skillGateFromTable(table: readonly TableObject[]): TableObject | undefined {
    return table.find((e) => e.kind === 'target' && e.event === 'SKILL_SHOT');
}

export function flipperFromTable(table: readonly TableObject[], side: 'left' | 'right'): TableObject | undefined {
    return table.find((e) => e.kind === 'flipper' && e.id === `${side}-flipper`);
}

/** Fingerprint rail geometry so boards can be proven distinct in tests. */
export function layoutFingerprint(table: readonly TableObject[]): string {
    return table
        .filter((e) => e.kind === 'wall' || e.kind === 'slide' || e.kind === 'target' || e.kind === 'post')
        .map((e) => `${e.id}:${e.x},${e.y}:${(e.points ?? []).flat().join(',')}`)
        .join('|');
}

/** True when every rail/slide point sits inside the mapped playfield image. */
export function railsAlignedToPlayfield(table: readonly TableObject[]): boolean {
    const { originX, originY, artWidth, artHeight } = PLAYFIELD_LAYOUT;
    const minX = originX + 40;
    // Outer shooter wall sits near the art edge (1052).
    const maxX = originX + artWidth - 10;
    const minY = originY + 20;
    const maxY = originY + artHeight + 40;
    return table
        .filter((e) => (e.kind === 'wall' || e.kind === 'slide') && e.points)
        .every((e) => e.points!.every(([x, y]) => x >= minX && x <= maxX && y >= minY && y <= maxY));
}

// Bumpers in art-mapped game space (open felt between painted ramps).

const APPROPRIATIONS_BUMPERS: readonly ProcurementBumper[] = [
    { id: 'jackpot', x: artPoint(540, 400)[0], y: artPoint(540, 400)[1], radius: 46, label: 'JACKPOT', value: 100_000_000_000, delay: 2, color: 0xffca4f, weapon: WeaponType.INTERCEPTOR_BLOCK_II, quantity: 20, outcome: 'inflate', badgeFrame: 0 },
    { id: 'sole-source', x: artPoint(455, 640)[0], y: artPoint(455, 640)[1], radius: 32, label: 'SOLE SOURCE', value: 35_000_000_000, delay: 1.2, color: 0xff8a3d, weapon: WeaponType.INTERCEPTOR_BLOCK_II, quantity: 6, outcome: 'inflate', badgeFrame: 4 },
    { id: 'requirements-creep', x: artPoint(625, 640)[0], y: artPoint(625, 640)[1], radius: 32, label: 'REQ CREEP', value: 28_000_000_000, delay: 0.8, color: 0xff8a3d, weapon: WeaponType.INTERCEPTOR, quantity: 15, outcome: 'inflate', badgeFrame: 5 },
    { id: 'emergency-supplemental', x: artPoint(540, 195)[0], y: artPoint(540, 195)[1], radius: 22, label: 'EMERGENCY', value: 55_000_000_000, delay: 1.8, color: 0xff5544, weapon: WeaponType.INTERCEPTOR, quantity: 25, outcome: 'inflate', badgeFrame: 7 },
    { id: 'audit-failed', x: artPoint(470, 1040)[0], y: artPoint(470, 1040)[1], radius: 30, label: 'AUDIT FAILED', value: 50_000_000_000, delay: 1, color: 0xff5544, weapon: WeaponType.INTERCEPTOR, quantity: 50, outcome: 'inflate', badgeFrame: 1 },
    { id: 'fixed-price', x: artPoint(610, 1040)[0], y: artPoint(610, 1040)[1], radius: 28, label: 'FIXED PRICE', value: -2_000_000_000, delay: -0.2, color: 0x79e66a, weapon: WeaponType.GUN, quantity: 0, outcome: 'efficiency', badgeFrame: 9 }
];

const AUDIT_BUMPERS: readonly ProcurementBumper[] = [
    { id: 'hearing-jackpot', x: artPoint(540, 300)[0], y: artPoint(540, 300)[1], radius: 56, label: 'HEARING', value: 80_000_000_000, delay: 1.5, color: 0xd4a017, weapon: WeaponType.RAILGUN, quantity: 12, outcome: 'inflate', badgeFrame: 0 },
    { id: 'lost-receipts', x: artPoint(480, 480)[0], y: artPoint(480, 480)[1], radius: 32, label: 'LOST RECEIPTS', value: 45_000_000_000, delay: 1.0, color: 0xff5544, weapon: WeaponType.HYDRA, quantity: 5, outcome: 'inflate', badgeFrame: 1 },
    { id: 'classified-annex', x: artPoint(600, 580)[0], y: artPoint(600, 580)[1], radius: 32, label: 'ANNEX B', value: 32_000_000_000, delay: 0.9, color: 0xc084fc, weapon: WeaponType.SEEKER, quantity: 6, outcome: 'inflate', badgeFrame: 6 },
    { id: 'emergency-audit', x: artPoint(540, 1000)[0], y: artPoint(540, 1000)[1], radius: 44, label: 'EMERGENCY', value: 60_000_000_000, delay: 1.6, color: 0xff5544, weapon: WeaponType.INTERCEPTOR_BLOCK_II, quantity: 10, outcome: 'inflate', badgeFrame: 7 },
    { id: 'whistleblower', x: artPoint(300, 700)[0], y: artPoint(300, 700)[1], radius: 28, label: 'WHISTLE', value: -3_500_000_000, delay: -0.3, color: 0x79e66a, weapon: WeaponType.GUN, quantity: 0, outcome: 'efficiency', badgeFrame: 8 },
    { id: 'gao-report', x: artPoint(760, 720)[0], y: artPoint(760, 720)[1], radius: 30, label: 'GAO', value: -2_500_000_000, delay: -0.25, color: 0x79e66a, weapon: WeaponType.GUN, quantity: 0, outcome: 'efficiency', badgeFrame: 9 },
    { id: 'sole-source-audit', x: artPoint(320, 980)[0], y: artPoint(320, 980)[1], radius: 36, label: 'SOLE SOURCE', value: 38_000_000_000, delay: 1.1, color: 0xff8a3d, weapon: WeaponType.RAILGUN, quantity: 7, outcome: 'inflate', badgeFrame: 4 },
    { id: 'cost-plus', x: artPoint(760, 1080)[0], y: artPoint(760, 1080)[1], radius: 36, label: 'COST-PLUS', value: 42_000_000_000, delay: 1.3, color: 0xff8a3d, weapon: WeaponType.HYDRA, quantity: 8, outcome: 'inflate', badgeFrame: 5 },
    { id: 'urgent-audit', x: artPoint(540, 1300)[0], y: artPoint(540, 1300)[1], radius: 40, label: 'URGENT', value: 12_000_000_000, delay: 0.4, color: 0x8dff74, weapon: WeaponType.INTERCEPTOR, quantity: 14, outcome: 'inflate', badgeFrame: 3 },
    { id: 'fixed-ceiling', x: artPoint(470, 820)[0], y: artPoint(470, 820)[1], radius: 26, label: 'CEILING', value: -1_500_000_000, delay: -0.15, color: 0x57b8ff, weapon: WeaponType.JAMMER, quantity: 0, outcome: 'efficiency', badgeFrame: 11 },
    { id: 'risk-pool', x: artPoint(620, 880)[0], y: artPoint(620, 880)[1], radius: 26, label: 'RISK POOL', value: 6_000_000_000, delay: 0.25, color: 0x57b8ff, weapon: WeaponType.SEEKER, quantity: 3, outcome: 'inflate', badgeFrame: 10 },
    { id: 'competitive-audit', x: artPoint(400, 1140)[0], y: artPoint(400, 1140)[1], radius: 28, label: 'COMP BID', value: -1_200_000_000, delay: -0.1, color: 0x57b8ff, weapon: WeaponType.JAMMER, quantity: 0, outcome: 'efficiency', badgeFrame: 11 }
];
void AUDIT_BUMPERS;

const STADIUM_BUMPERS: readonly ProcurementBumper[] = [
    { id: 'stadium-jackpot', x: artPoint(540, 260)[0], y: artPoint(540, 260)[1], radius: 58, label: 'SUPER BOWL', value: 120_000_000_000, delay: 2.2, color: 0xffca4f, weapon: WeaponType.SEEKER, quantity: 15, outcome: 'inflate', badgeFrame: 0 },
    // Keep bumpers clear of dual-edge ramp channels (they were wedging the ball).
    { id: 'halftime', x: artPoint(420, 520)[0], y: artPoint(420, 520)[1], radius: 32, label: 'HALFTIME', value: 30_000_000_000, delay: 0.7, color: 0xff66aa, weapon: WeaponType.HYDRA, quantity: 9, outcome: 'inflate', badgeFrame: 5 },
    { id: 'luxury-box', x: artPoint(660, 520)[0], y: artPoint(660, 520)[1], radius: 32, label: 'LUXURY BOX', value: 50_000_000_000, delay: 1.4, color: 0xc084fc, weapon: WeaponType.RAILGUN, quantity: 10, outcome: 'inflate', badgeFrame: 6 },
    { id: 'emergency-stadium', x: artPoint(540, 1080)[0], y: artPoint(540, 1080)[1], radius: 48, label: 'EMERGENCY', value: 70_000_000_000, delay: 1.9, color: 0xff5544, weapon: WeaponType.INTERCEPTOR_BLOCK_II, quantity: 18, outcome: 'inflate', badgeFrame: 7 },
    { id: 'crowd-surge', x: artPoint(420, 780)[0], y: artPoint(420, 780)[1], radius: 34, label: 'SURGE', value: 22_000_000_000, delay: 0.5, color: 0xff8a3d, weapon: WeaponType.INTERCEPTOR, quantity: 20, outcome: 'inflate', badgeFrame: 4 },
    { id: 'naming-rights', x: artPoint(660, 780)[0], y: artPoint(660, 780)[1], radius: 34, label: 'NAMING', value: 33_000_000_000, delay: 1.0, color: 0xff8a3d, weapon: WeaponType.SEEKER, quantity: 5, outcome: 'inflate', badgeFrame: 2 },
    { id: 'ticket-price', x: artPoint(400, 1040)[0], y: artPoint(400, 1040)[1], radius: 28, label: 'TICKETS', value: -2_200_000_000, delay: -0.2, color: 0x79e66a, weapon: WeaponType.GUN, quantity: 0, outcome: 'efficiency', badgeFrame: 8 },
    { id: 'salary-cap', x: artPoint(680, 1040)[0], y: artPoint(680, 1040)[1], radius: 28, label: 'SALARY CAP', value: -2_800_000_000, delay: -0.25, color: 0x79e66a, weapon: WeaponType.GUN, quantity: 0, outcome: 'efficiency', badgeFrame: 9 },
    { id: 'overtime', x: artPoint(540, 1310)[0], y: artPoint(540, 1310)[1], radius: 42, label: 'OVERTIME', value: 15_000_000_000, delay: 0.6, color: 0x8dff74, weapon: WeaponType.RAILGUN, quantity: 6, outcome: 'inflate', badgeFrame: 3 },
    { id: 'replay-review', x: artPoint(450, 640)[0], y: artPoint(450, 640)[1], radius: 26, label: 'REPLAY', value: 4_000_000_000, delay: 0.15, color: 0x57b8ff, weapon: WeaponType.JAMMER, quantity: 3, outcome: 'inflate', badgeFrame: 10 },
    { id: 'fair-play', x: artPoint(630, 640)[0], y: artPoint(630, 640)[1], radius: 26, label: 'FAIR PLAY', value: -1_000_000_000, delay: -0.1, color: 0x57b8ff, weapon: WeaponType.JAMMER, quantity: 0, outcome: 'efficiency', badgeFrame: 11 },
    { id: 'audit-booth', x: artPoint(540, 920)[0], y: artPoint(540, 920)[1], radius: 30, label: 'AUDIT BOOTH', value: -1_800_000_000, delay: -0.2, color: 0x79e66a, weapon: WeaponType.GUN, quantity: 0, outcome: 'efficiency', badgeFrame: 8 }
];
void STADIUM_BUMPERS;

const APPROPRIATIONS_SHELL = appropriationsShell();
const AUDIT_SHELL = auditChamberShell();
const STADIUM_SHELL = stadiumShell();

/** Kit is the live playfield; legacy shells remain for reference/fingerprint tests only. */
void APPROPRIATIONS_SHELL;
void AUDIT_SHELL;
void STADIUM_SHELL;

function liveBumpers(raw: readonly ProcurementBumper[]): ProcurementBumper[] {
    return mergeBumpersFromKit(raw);
}

/** One kit-assembled table for all boards this milestone. */
function liveTable(bumpers: readonly ProcurementBumper[]): TableObject[] {
    return buildTable(bumpers, kitTableObjects());
}

const LIVE_BUMPERS = liveBumpers(APPROPRIATIONS_BUMPERS);

export const PINBALL_BOARDS: Record<PinballBoardId, PinballBoardDef> = {
    appropriations: {
        id: 'appropriations',
        name: 'APPROPRIATIONS TABLE',
        subtitle: 'Kit playfield • ramps • tunnels',
        playfieldKey: 'pinball_playfield',
        accent: 0x5de6ff,
        bumpers: LIVE_BUMPERS,
        table: liveTable(LIVE_BUMPERS)
    },
    audit_chamber: {
        id: 'audit_chamber',
        name: 'AUDIT CHAMBER',
        subtitle: 'Kit playfield • audit satire',
        playfieldKey: 'pinball_playfield_audit',
        accent: 0xd4a017,
        unlockFy: 2027,
        unlockMansions: 2,
        bumpers: LIVE_BUMPERS,
        table: liveTable(LIVE_BUMPERS)
    },
    supplemental_stadium: {
        id: 'supplemental_stadium',
        name: 'SUPPLEMENTAL STADIUM',
        subtitle: 'Kit playfield • stadium satire',
        playfieldKey: 'pinball_playfield_stadium',
        accent: 0xff66aa,
        unlockFy: 2028,
        unlockMansions: 6,
        bumpers: LIVE_BUMPERS,
        table: liveTable(LIVE_BUMPERS)
    }
};

export const PINBALL_BOARD_ORDER: PinballBoardId[] = [
    'appropriations',
    'audit_chamber',
    'supplemental_stadium'
];

export function isBoardUnlocked(
    id: PinballBoardId,
    fy: number,
    mansions: number,
    unlocked: PinballBoardId[]
): boolean {
    if (id === 'appropriations' || unlocked.includes(id)) return true;
    const board = PINBALL_BOARDS[id];
    const fyOk = board.unlockFy !== undefined && fy >= board.unlockFy;
    const mansionOk = board.unlockMansions !== undefined && mansions >= board.unlockMansions;
    return fyOk || mansionOk;
}

export const PINBALL_SIZING = {
    ballRadiusPx: 28,
    ballCircleMeters: 28 / 48,
    flipperWidthPx: FLIPPER_W,
    flipperHeightPx: FLIPPER_H,
    flipperHalfLengthMeters: (FLIPPER_W / 2) / 48,
    flipperHeightMeters: (FLIPPER_H / 2) / 48,
    flipperTipOffsetPx: 125,
    /** Cabinet rail slab half-thickness (px). */
    railHalfThicknessPx: 5,
    /** Ramp/slide edge half-thickness — keep thin so dual channels stay rideable. */
    slideHalfThicknessPx: 2,
    /** Minimum outer/inner midline gap for dual-edge ramps (art px). */
    minChannelGapPx: MIN_CHANNEL_GAP
};
