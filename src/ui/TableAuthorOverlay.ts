import * as Phaser from 'phaser';
import type { SensorRole, TableObject } from '../game/ProcurementTableDefinition';
import type { PinballBoardId } from '../game/PinballBoards';
import { PLAYFIELD_LAYOUT } from '../game/PinballBoards';
import {
    AUTHOR_LAYER_KEYS,
    type AuthorLayer,
    buildPatchFromTable,
    clearLocalPatch,
    downloadText,
    exportArtPtsSnippet,
    exportPatchJson,
    savePatchLocal
} from '../game/TableAuthorStore';

export type AuthorRebuildFn = (table: TableObject[]) => void;
export type AuthorBallResetFn = () => void;

type DragState =
    | { mode: 'point'; id: string; index: number }
    | { mode: 'sensor'; id: string }
    | { mode: 'anchor'; id: string };

/**
 * In-scene pinball table authoring: toggle debug layers, drag rail vertices
 * and entrance/exit sensors, save patches for the next build.
 */
export class TableAuthorOverlay {
    private readonly root: Phaser.GameObjects.Container;
    private readonly gfx: Phaser.GameObjects.Graphics;
    private readonly hud: Phaser.GameObjects.Text;
    private readonly help: Phaser.GameObjects.Text;
    private readonly sensorLabels: Phaser.GameObjects.Text[] = [];
    private handles: Phaser.GameObjects.Arc[] = [];
    private layers: Record<AuthorLayer, boolean> = {
        physics: true,
        rails: true,
        sensors: true,
        anchors: true,
        points: true,
        trajectory: true
    };
    private selectedId: string | null = null;
    private drag: DragState | null = null;
    private trajectory: Array<{ x: number; y: number }> = [];
    private dirty = false;
    private enabled = true;
    private table: TableObject[];
    private lastPointer = { x: 540, y: 1000 };

    constructor(
        private readonly scene: Phaser.Scene,
        private readonly boardId: PinballBoardId,
        table: TableObject[],
        private readonly onRebuild: AuthorRebuildFn,
        private readonly onBallReset?: AuthorBallResetFn
    ) {
        this.table = table.map((e) => ({
            ...e,
            points: e.points?.map(([x, y]) => [x, y] as [number, number])
        }));
        this.root = scene.add.container(0, 0).setDepth(90);
        this.gfx = scene.add.graphics().setDepth(88);
        this.hud = scene.add.text(16, 8, '', {
            fontSize: '16px',
            color: '#e8fff4',
            backgroundColor: '#041018cc',
            padding: { x: 10, y: 6 },
            fontStyle: 'bold'
        }).setDepth(91).setScrollFactor(0);
        this.help = scene.add.text(16, 1760, '', {
            fontSize: '15px',
            color: '#b7d7e4',
            backgroundColor: '#041018cc',
            padding: { x: 10, y: 6 },
            wordWrap: { width: 1048 }
        }).setDepth(91);
        this.root.add([this.hud, this.help]);
        this.bindKeys();
        this.bindPointer();
        this.rebuildHandles();
        this.redraw();
        this.refreshHud();
    }

    getTable() {
        return this.table;
    }

    isEnabled() {
        return this.enabled;
    }

    setEnabled(on: boolean) {
        this.enabled = on;
        this.root.setVisible(on);
        this.gfx.setVisible(on);
        this.handles.forEach((h) => h.setVisible(on));
        this.sensorLabels.forEach((t) => t.setVisible(on && this.layers.sensors));
        if (!on) this.drag = null;
        this.refreshHud();
    }

    sampleBall(x: number, y: number) {
        if (!this.layers.trajectory) return;
        const last = this.trajectory[this.trajectory.length - 1];
        if (last && Math.hypot(last.x - x, last.y - y) < 6) return;
        this.trajectory.push({ x, y });
        if (this.trajectory.length > 240) this.trajectory.shift();
    }

    clearTrajectory() {
        this.trajectory = [];
        this.redraw();
    }

    destroy() {
        this.handles.forEach((h) => h.destroy());
        this.handles = [];
        this.sensorLabels.forEach((t) => t.destroy());
        this.sensorLabels.length = 0;
        this.gfx.destroy();
        this.root.destroy();
        this.scene.input.keyboard?.off('keydown', this.onKey);
    }

    private bindKeys() {
        this.scene.input.keyboard?.on('keydown', this.onKey);
    }

    private readonly onKey = (event: KeyboardEvent) => {
        if (!this.enabled) return;
        if (event.repeat) return;
        const key = event.key.toUpperCase();
        if (key === 'H') {
            this.setEnabled(false);
            return;
        }
        if ((event.ctrlKey || event.metaKey) && key === 'S') {
            event.preventDefault();
            this.saveAll();
            return;
        }
        if (key === 'E' && !event.ctrlKey && !event.metaKey) {
            this.exportFiles();
            return;
        }
        if (key === 'C') {
            this.clearTrajectory();
            return;
        }
        if (key === 'X') {
            clearLocalPatch(this.boardId);
            this.dirty = false;
            this.refreshHud('Cleared local author patch — reload to restore stock table');
            return;
        }
        if (key === '0') {
            this.focusShooterLane();
            return;
        }
        if (key === '[' || key === ']') {
            this.cycleEditable(key === ']' ? 1 : -1);
            return;
        }
        if (key === 'TAB') {
            event.preventDefault();
            this.cycleEditable(event.shiftKey ? -1 : 1);
            return;
        }
        if (key === '1') {
            this.ensureLaneSensor('entrance');
            return;
        }
        if (key === '2') {
            this.ensureLaneSensor('exit');
            return;
        }
        if (key === 'N') {
            this.placeFreeSensor();
            return;
        }
        if (key === 'T' || key === 'HOME') {
            event.preventDefault();
            this.onBallReset?.();
            this.clearTrajectory();
            this.refreshHud('BALL RESET — parked on plunger, ready to fire');
            return;
        }
        if (key === 'DELETE' || key === 'BACKSPACE') {
            this.deleteSelected();
            return;
        }
        if (key === 'Q' || key === 'W') {
            this.nudgeSelectedSensorAngle(key === 'Q' ? -0.08 : 0.08);
            return;
        }
        const layer = AUTHOR_LAYER_KEYS[key];
        if (layer) {
            this.layers[layer] = !this.layers[layer];
            this.rebuildHandles();
            this.redraw();
            this.refreshHud();
        }
    };

    private bindPointer() {
        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!this.enabled) return;
            // Full playfield including top rails / exit hood (game HUD no longer blocks).
            if (pointer.y < PLAYFIELD_LAYOUT.originY - 10 || pointer.y > PLAYFIELD_LAYOUT.bottom + 20) return;
            this.lastPointer = { x: pointer.x, y: pointer.y };

            const sensorHit = this.pickSensor(pointer.x, pointer.y);
            if (sensorHit && (this.layers.sensors || this.layers.points)) {
                this.drag = { mode: 'sensor', id: sensorHit };
                this.selectedId = sensorHit;
                this.rebuildHandles();
                this.redraw();
                return;
            }

            if (this.layers.points) {
                const hit = this.pickHandle(pointer.x, pointer.y);
                if (hit) {
                    this.drag = { mode: 'point', id: hit.id, index: hit.index };
                    this.selectedId = hit.id;
                    this.rebuildHandles();
                    this.redraw();
                    return;
                }
                const rail = this.pickRail(pointer.x, pointer.y);
                if (rail) {
                    this.selectedId = rail;
                    this.rebuildHandles();
                    this.redraw();
                    return;
                }
            }

            if (this.layers.anchors) {
                const anchor = this.pickAnchor(pointer.x, pointer.y);
                if (anchor) {
                    this.drag = { mode: 'anchor', id: anchor };
                    this.selectedId = anchor;
                    this.rebuildHandles();
                    this.redraw();
                }
            }
        });
        this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.lastPointer = { x: pointer.x, y: pointer.y };
            if (!this.drag || !pointer.isDown) return;
            const x = Phaser.Math.Clamp(pointer.x, 40, 1060);
            const y = Phaser.Math.Clamp(pointer.y, PLAYFIELD_LAYOUT.originY + 10, PLAYFIELD_LAYOUT.bottom - 20);
            if (this.drag.mode === 'point') {
                const entry = this.table.find((e) => e.id === this.drag!.id);
                if (!entry?.points) return;
                entry.points[this.drag.index] = [x, y];
                const mid = entry.points[Math.floor(entry.points.length / 2)];
                entry.x = mid[0];
                entry.y = mid[1];
            } else if (this.drag.mode === 'sensor') {
                const sensor = this.table.find((e) => e.id === this.drag!.id);
                if (!sensor || sensor.kind !== 'sensor') return;
                sensor.x = x;
                sensor.y = y;
            } else {
                const anchor = this.table.find((e) => e.id === this.drag!.id);
                if (!anchor) return;
                if (anchor.kind !== 'post' && anchor.kind !== 'target' && anchor.kind !== 'sling' && anchor.kind !== 'flipper') return;
                anchor.x = x;
                anchor.y = y;
            }
            this.dirty = true;
            this.syncHandlePositions();
            this.redraw();
        });
        this.scene.input.on('pointerup', () => {
            if (!this.drag) return;
            this.drag = null;
            this.commitGeometry();
        });
    }

    /** [0] — jump selection to cabinet/shooter geometry (including top rails). */
    private focusShooterLane() {
        this.selectedId = 'top-rail';
        this.layers.rails = true;
        this.layers.physics = true;
        this.layers.sensors = true;
        this.layers.points = true;
        this.rebuildHandles();
        this.redraw();
        this.refreshHud(
            'CABINET — [ ] cycles top-rail → shooter-exit → shooter-left → … Drag ANY vertex including top of table.'
        );
    }

    /** Cycle every editable rail/sensor/anchor, including top-of-table cabinet pieces. */
    private cycleEditable(dir: 1 | -1) {
        const ids = this.table
            .filter((e) =>
                ((e.kind === 'wall' || e.kind === 'slide') && e.points) ||
                e.kind === 'sensor' ||
                e.kind === 'post' ||
                e.kind === 'target' ||
                e.kind === 'sling' ||
                e.kind === 'flipper'
            )
            .map((e) => e.id);
        if (!ids.length) return;
        const idx = Math.max(0, ids.indexOf(this.selectedId ?? ''));
        const next = ids[(idx + dir + ids.length * 8) % ids.length];
        this.selectedId = next;
        this.layers.points = true;
        this.rebuildHandles();
        this.redraw();
        this.refreshHud(`Selected ${next} — drag handles or press [ ] / Tab to cycle`);
    }

    private ensureLaneSensor(role: SensorRole) {
        const linkId = this.resolveLinkId(this.selectedId);
        if (!linkId) {
            this.refreshHud('Select a rail first, then press 1=ENTRANCE or 2=EXIT');
            return;
        }
        const id = `${linkId}-${role === 'entrance' ? 'enter' : 'exit'}`;
        let sensor = this.table.find((e) => e.id === id);
        if (!sensor) {
            sensor = {
                id,
                kind: 'sensor',
                x: this.lastPointer.x,
                y: this.lastPointer.y,
                width: 78,
                height: 34,
                angle: 0,
                sensor: role === 'lane' ? 'lane' : role,
                linkId,
                event: role === 'entrance' ? 'LANE_ENTER' : role === 'exit' ? 'LANE_EXIT' : 'LANE_HIT'
            };
            this.table.push(sensor);
        } else {
            sensor.sensor = role === 'lane' ? 'lane' : role;
            sensor.linkId = linkId;
            sensor.event = role === 'entrance' ? 'LANE_ENTER' : role === 'exit' ? 'LANE_EXIT' : 'LANE_HIT';
            sensor.x = this.lastPointer.x;
            sensor.y = this.lastPointer.y;
        }
        this.selectedId = id;
        this.layers.sensors = true;
        this.dirty = true;
        this.rebuildHandles();
        this.commitGeometry();
        this.refreshHud(`Placed ${role.toUpperCase()} sensor on ${linkId}`);
    }

    private placeFreeSensor() {
        const id = `sensor-${Date.now().toString(36)}`;
        this.table.push({
            id,
            kind: 'sensor',
            x: this.lastPointer.x,
            y: this.lastPointer.y,
            width: 72,
            height: 32,
            angle: 0,
            sensor: 'lane',
            linkId: this.resolveLinkId(this.selectedId) ?? 'free',
            event: 'LANE_HIT'
        });
        this.selectedId = id;
        this.layers.sensors = true;
        this.dirty = true;
        this.rebuildHandles();
        this.commitGeometry();
        this.refreshHud(`Placed free lane sensor ${id}`);
    }

    private deleteSelected() {
        const entry = this.table.find((e) => e.id === this.selectedId);
        if (!entry) {
            this.refreshHud('Select a rail / sensor / post / target first, then Del');
            return;
        }
        const id = entry.id;
        const kind = entry.kind;
        this.table = this.table.filter((e) => e.id !== id);
        this.selectedId = null;
        this.dirty = true;
        this.rebuildHandles();
        this.commitGeometry();
        this.refreshHud(`Deleted ${kind} ${id} — Ctrl+S to persist`);
    }

    private nudgeSelectedSensorAngle(delta: number) {
        const entry = this.table.find((e) => e.id === this.selectedId);
        if (!entry || entry.kind !== 'sensor') return;
        entry.angle = (entry.angle ?? 0) + delta;
        this.dirty = true;
        this.redraw();
        this.commitGeometry();
        this.refreshHud(`Sensor angle ${(entry.angle * 180 / Math.PI).toFixed(0)}°`);
    }

    private resolveLinkId(selectedId: string | null): string | null {
        if (!selectedId) return null;
        const entry = this.table.find((e) => e.id === selectedId);
        if (!entry) return null;
        if (entry.kind === 'sensor') return entry.linkId ?? entry.id.replace(/-enter$|-exit$/g, '');
        return selectedId.replace(/-outer$|-inner$/g, '');
    }

    private pickHandle(x: number, y: number): { id: string; index: number } | null {
        for (const handle of this.handles) {
            const data = handle.getData('author') as DragState | undefined;
            if (!data || data.mode !== 'point') continue;
            if (Phaser.Math.Distance.Between(x, y, handle.x, handle.y) <= 22) {
                return { id: data.id, index: data.index };
            }
        }
        return null;
    }

    private pickSensor(x: number, y: number): string | null {
        let bestId: string | null = null;
        let bestDist = Infinity;
        this.table.forEach((entry) => {
            if (entry.kind !== 'sensor') return;
            const dist = Phaser.Math.Distance.Between(x, y, entry.x, entry.y);
            const reach = Math.max(24, (entry.width ?? 72) * 0.35);
            if (dist <= reach && dist < bestDist) {
                bestDist = dist;
                bestId = entry.id;
            }
        });
        return bestId;
    }

    private pickRail(x: number, y: number): string | null {
        let bestId: string | null = null;
        let bestDist = Infinity;
        this.table.forEach((entry) => {
            if ((entry.kind !== 'wall' && entry.kind !== 'slide') || !entry.points) return;
            for (let i = 0; i < entry.points.length - 1; i++) {
                const a = entry.points[i];
                const b = entry.points[i + 1];
                const dist = distToSegment(x, y, a[0], a[1], b[0], b[1]);
                if (dist < 18 && dist < bestDist) {
                    bestDist = dist;
                    bestId = entry.id;
                }
            }
        });
        return bestId;
    }

    private pickAnchor(x: number, y: number): string | null {
        let bestId: string | null = null;
        let bestDist = Infinity;
        this.table.forEach((entry) => {
            if (entry.kind !== 'post' && entry.kind !== 'target' && entry.kind !== 'sling' && entry.kind !== 'flipper') return;
            const reach = Math.max(22, (entry.radius ?? 14) + 10, ((entry.width ?? 40) + (entry.height ?? 20)) * 0.2);
            const dist = Phaser.Math.Distance.Between(x, y, entry.x, entry.y);
            if (dist <= reach && dist < bestDist) {
                bestDist = dist;
                bestId = entry.id;
            }
        });
        return bestId;
    }

    private commitGeometry() {
        this.onRebuild(this.table);
        this.refreshHud('Geometry applied — physics rebuilt');
    }

    private saveAll() {
        const patch = buildPatchFromTable(this.boardId, this.table);
        savePatchLocal(patch);
        downloadText(`${this.boardId}.json`, exportPatchJson(patch));
        downloadText(`${this.boardId}.artpts.txt`, exportArtPtsSnippet(patch), 'text/plain');
        this.dirty = false;
        this.refreshHud(
            `Saved localStorage + downloaded src/game/authored/${this.boardId}.json — copy into repo for next build`
        );
    }

    private exportFiles() {
        const patch = buildPatchFromTable(this.boardId, this.table);
        downloadText(`${this.boardId}.json`, exportPatchJson(patch));
        downloadText(`${this.boardId}.artpts.txt`, exportArtPtsSnippet(patch), 'text/plain');
        this.refreshHud('Exported JSON + artPts snippet');
    }

    private rebuildHandles() {
        this.handles.forEach((h) => h.destroy());
        this.handles = [];
        this.sensorLabels.forEach((t) => t.destroy());
        this.sensorLabels.length = 0;

        if (this.layers.points) {
            const entry = this.table.find((e) => e.id === this.selectedId);
            const targets = entry?.points
                ? [entry]
                : this.table.filter((e) => (e.kind === 'wall' || e.kind === 'slide') && e.points);
            targets.forEach((rail) => {
                rail.points!.forEach(([x, y], index) => {
                    const selected = rail.id === this.selectedId;
                    const handle = this.scene.add.circle(x, y, selected ? 12 : 8, selected ? 0xffd166 : 0x5de6ff, 0.95)
                        .setStrokeStyle(2, 0xffffff, 0.9)
                        .setDepth(92)
                        .setData('author', { mode: 'point', id: rail.id, index } satisfies DragState);
                    this.handles.push(handle);
                });
            });
        }

        if (this.layers.sensors || this.layers.points) {
            this.table.filter((e) => e.kind === 'sensor').forEach((sensor) => {
                const selected = sensor.id === this.selectedId;
                const color = sensor.sensor === 'entrance' ? 0x8dff74
                    : sensor.sensor === 'exit' ? 0xff66aa
                        : 0xa8ff93;
                const handle = this.scene.add.circle(sensor.x, sensor.y, selected ? 14 : 11, color, 0.95)
                    .setStrokeStyle(3, selected ? 0xffffff : 0x041018, 0.95)
                    .setDepth(93)
                    .setData('author', { mode: 'sensor', id: sensor.id } satisfies DragState);
                this.handles.push(handle);
                const label = this.scene.add.text(sensor.x, sensor.y - 22, sensorLabel(sensor), {
                    fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
                    backgroundColor: '#041018aa', padding: { x: 4, y: 2 }
                }).setOrigin(0.5).setDepth(94);
                this.sensorLabels.push(label);
            });
        }

        if (this.layers.anchors) {
            this.table.forEach((entry) => {
                if (entry.kind !== 'post' && entry.kind !== 'target' && entry.kind !== 'sling' && entry.kind !== 'flipper') return;
                const selected = entry.id === this.selectedId;
                const handle = this.scene.add.circle(entry.x, entry.y, selected ? 14 : 10, selected ? 0xffd166 : 0xff66aa, 0.95)
                    .setStrokeStyle(2, 0xffffff, 0.9)
                    .setDepth(92)
                    .setData('author', { mode: 'anchor', id: entry.id } satisfies DragState);
                this.handles.push(handle);
            });
        }
    }

    private syncHandlePositions() {
        this.handles.forEach((handle) => {
            const data = handle.getData('author') as DragState;
            if (data.mode === 'point') {
                const entry = this.table.find((e) => e.id === data.id);
                const pt = entry?.points?.[data.index];
                if (pt) handle.setPosition(pt[0], pt[1]);
                return;
            }
            const entry = this.table.find((e) => e.id === data.id);
            if (entry) handle.setPosition(entry.x, entry.y);
        });
        let i = 0;
        this.table.filter((e) => e.kind === 'sensor').forEach((sensor) => {
            const label = this.sensorLabels[i++];
            label?.setPosition(sensor.x, sensor.y - 22).setText(sensorLabel(sensor));
        });
    }

    redraw() {
        this.gfx.clear();
        if (!this.enabled) return;

        if (this.layers.rails || this.layers.physics) {
            this.table.forEach((entry) => {
                if ((entry.kind !== 'wall' && entry.kind !== 'slide') || !entry.points || entry.points.length < 2) return;
                const selected = entry.id === this.selectedId;
                const slide = entry.kind === 'slide';
                if (this.layers.physics) {
                    this.gfx.lineStyle(slide ? 18 : 14, selected ? 0xff8844 : 0x2a6a88, selected ? 0.35 : 0.18);
                    this.strokePoly(entry.points);
                }
                if (this.layers.rails) {
                    this.gfx.lineStyle(slide ? 5 : 3, selected ? 0xffd166 : (slide ? 0x5de6ff : 0xffffff), selected ? 0.95 : 0.55);
                    this.strokePoly(entry.points);
                }
            });
        }

        if (this.layers.sensors) {
            this.table.forEach((entry) => {
                if (entry.kind === 'target') {
                    this.gfx.lineStyle(2, 0xa8ff93, 0.85);
                    const w = entry.width ?? 64;
                    const h = entry.height ?? 28;
                    this.strokeOrientedRect(entry.x, entry.y, w, h, entry.angle ?? 0);
                    return;
                }
                if (entry.kind !== 'sensor') return;
                const selected = entry.id === this.selectedId;
                const color = entry.sensor === 'entrance' ? 0x8dff74
                    : entry.sensor === 'exit' ? 0xff66aa
                        : 0xa8ff93;
                this.gfx.lineStyle(selected ? 4 : 2, color, 0.95);
                this.gfx.fillStyle(color, 0.18);
                const w = entry.width ?? 72;
                const h = entry.height ?? 34;
                this.fillOrientedRect(entry.x, entry.y, w, h, entry.angle ?? 0);
                this.strokeOrientedRect(entry.x, entry.y, w, h, entry.angle ?? 0);
                // Direction tick
                const ang = entry.angle ?? 0;
                this.gfx.lineStyle(3, color, 1);
                this.gfx.lineBetween(
                    entry.x,
                    entry.y,
                    entry.x + Math.cos(ang) * 28,
                    entry.y + Math.sin(ang) * 28
                );
            });
        }

        if (this.layers.anchors) {
            this.table.forEach((entry) => {
                if (entry.kind === 'post' || entry.kind === 'bumper' || entry.kind === 'flipper' || entry.kind === 'sling') {
                    this.gfx.lineStyle(2, 0xff66aa, 0.9);
                    this.gfx.strokeCircle(entry.x, entry.y, entry.radius ?? 14);
                    this.gfx.fillStyle(0xff66aa, 0.5);
                    this.gfx.fillCircle(entry.x, entry.y, 4);
                }
            });
        }

        if (this.layers.trajectory && this.trajectory.length > 1) {
            this.gfx.lineStyle(3, 0xffca4f, 0.7);
            this.gfx.beginPath();
            this.gfx.moveTo(this.trajectory[0].x, this.trajectory[0].y);
            for (let i = 1; i < this.trajectory.length; i++) {
                this.gfx.lineTo(this.trajectory[i].x, this.trajectory[i].y);
            }
            this.gfx.strokePath();
        }
    }

    private strokePoly(points: Array<[number, number]>) {
        this.gfx.beginPath();
        this.gfx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) this.gfx.lineTo(points[i][0], points[i][1]);
        this.gfx.strokePath();
    }

    private strokeOrientedRect(cx: number, cy: number, w: number, h: number, angle: number) {
        const corners = orientedCorners(cx, cy, w, h, angle);
        this.gfx.beginPath();
        this.gfx.moveTo(corners[0][0], corners[0][1]);
        for (let i = 1; i < 4; i++) this.gfx.lineTo(corners[i][0], corners[i][1]);
        this.gfx.closePath();
        this.gfx.strokePath();
    }

    private fillOrientedRect(cx: number, cy: number, w: number, h: number, angle: number) {
        const corners = orientedCorners(cx, cy, w, h, angle);
        this.gfx.beginPath();
        this.gfx.moveTo(corners[0][0], corners[0][1]);
        for (let i = 1; i < 4; i++) this.gfx.lineTo(corners[i][0], corners[i][1]);
        this.gfx.closePath();
        this.gfx.fillPath();
    }

    private refreshHud(status?: string) {
        const flags = (Object.keys(this.layers) as AuthorLayer[])
            .map((k) => `${k[0].toUpperCase()}:${this.layers[k] ? 'ON' : 'off'}`)
            .join('  ');
        const sel = this.selectedId ? `SEL ${this.selectedId}` : 'SEL — click a rail or sensor';
        const dirty = this.dirty ? ' • DIRTY' : '';
        const sensors = this.table.filter((e) => e.kind === 'sensor').length;
        this.hud.setText(
            `AUTHOR ${this.boardId}${dirty}  sensors:${sensors}\n${flags}\n${sel}${status ? `\n${status}` : ''}`
        );
        this.help.setText(
            '[D/R/S/A/P/B] layers  |  click rail  [ ]/Tab cycle  Del=delete anything  [T]/Home=reset ball  [0]cabinet  [1]IN [2]OUT  |  Ctrl+S save  [X]clear patch  [H]hide'
        );
    }
}

function sensorLabel(sensor: TableObject): string {
    const role = sensor.sensor === 'entrance' ? 'IN'
        : sensor.sensor === 'exit' ? 'OUT'
            : 'SNS';
    return `${role} ${sensor.linkId ?? sensor.id}`;
}

function orientedCorners(cx: number, cy: number, w: number, h: number, angle: number): Array<[number, number]> {
    const hw = w / 2;
    const hh = h / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const local: Array<[number, number]> = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    return local.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
