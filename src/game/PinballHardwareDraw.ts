import type { GameObjects, Scene } from 'phaser';
import type { TableObject } from './ProcurementTableDefinition';

export interface HardwareDrawResult {
    graphics: GameObjects.Graphics;
    laneGlows: Map<string, GameObjects.Graphics>;
    pieceImages: GameObjects.Image[];
}

/**
 * Live overlays only — lane flash glows. Rails/ramps/mouths/wires are baked
 * into the playfield skin PNG so play does not look like stroked SVG paths.
 */
export function drawPinballHardware(
    scene: Scene,
    table: readonly TableObject[],
    accent: number,
    depth = 4
): HardwareDrawResult {
    const g = scene.add.graphics().setDepth(depth);
    const laneGlows = new Map<string, GameObjects.Graphics>();
    const pieceImages: GameObjects.Image[] = [];

    const slides = table.filter((e) => e.kind === 'slide' && e.layer !== 'overpass' && e.points);
    const byLink = new Map<string, TableObject[]>();
    slides.forEach((s) => {
        const key = s.linkId ?? s.id;
        const list = byLink.get(key) ?? [];
        list.push(s);
        byLink.set(key, list);
    });
    byLink.forEach((group, linkId) => {
        const outer = group.find((e) => e.id.endsWith('-outer'));
        const inner = group.find((e) => e.id.endsWith('-inner'));
        if (!outer?.points || !inner?.points) return;
        const glow = scene.add.graphics().setDepth(depth).setAlpha(0.0);
        const n = Math.min(outer.points.length, inner.points.length);
        glow.lineStyle(10, accent, 1);
        glow.beginPath();
        for (let i = 0; i < n; i++) {
            const x = (outer.points[i][0] + inner.points[i][0]) / 2;
            const y = (outer.points[i][1] + inner.points[i][1]) / 2;
            if (i === 0) glow.moveTo(x, y);
            else glow.lineTo(x, y);
        }
        glow.strokePath();
        laneGlows.set(linkId, glow);
        laneGlows.set(outer.id, glow);
    });

    table.forEach((entry) => {
        if (entry.kind !== 'sensor' || !entry.radius || entry.radius <= 0) return;
        if (entry.linkId === 'shooter') return;
        const ring = scene.add.graphics().setDepth(depth + 1).setAlpha(0.0);
        ring.fillStyle(accent, 1);
        ring.fillCircle(entry.x, entry.y, entry.radius * 1.4);
        laneGlows.set(entry.id, ring);
    });

    void g;
    void scene;
    return { graphics: g, laneGlows, pieceImages };
}

export function destroyHardwarePieces(result?: HardwareDrawResult) {
    if (!result) return;
    result.graphics.destroy();
    result.laneGlows.forEach((glow) => glow.destroy());
    result.laneGlows.clear();
    result.pieceImages.forEach((img) => img.destroy());
    result.pieceImages.length = 0;
}
