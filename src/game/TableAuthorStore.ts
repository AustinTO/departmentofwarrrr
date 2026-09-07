import type { TableObject } from './ProcurementTableDefinition';
import {
    PINBALL_BOARDS,
    PLAYFIELD_LAYOUT,
    type PinballBoardId
} from './PinballBoards';
import authoredAppropriations from './authored/appropriations.json';
import authoredAudit from './authored/audit_chamber.json';
import authoredStadium from './authored/supplemental_stadium.json';

export type AuthorLayer =
    | 'physics'
    | 'rails'
    | 'sensors'
    | 'anchors'
    | 'points'
    | 'trajectory';

export interface AuthoredBoardPatch {
    boardId: PinballBoardId;
    version: 1;
    updatedAt: string;
    /** Patches keyed by table object id. Points/x/y are art-space (0..1080, 0..1600). */
    objects: Record<string, {
        kind?: string;
        /** When true, stock object is removed from the live table. */
        deleted?: boolean;
        points?: Array<[number, number]>;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        radius?: number;
        angle?: number;
        sensor?: 'entrance' | 'exit' | 'lane';
        linkId?: string;
        event?: string;
    }>;
}

const STORAGE_KEY = 'warrr_pinball_author_v1';

const BUNDLED: Record<PinballBoardId, AuthoredBoardPatch | null> = {
    appropriations: normalizePatch(authoredAppropriations),
    audit_chamber: normalizePatch(authoredAudit),
    supplemental_stadium: normalizePatch(authoredStadium)
};

function normalizePatch(raw: unknown): AuthoredBoardPatch | null {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Partial<AuthoredBoardPatch>;
    if (!p.boardId || !p.objects || typeof p.objects !== 'object') return null;
    return {
        boardId: p.boardId,
        version: 1,
        updatedAt: p.updatedAt ?? '',
        objects: p.objects
    };
}

export function gameToArt(x: number, y: number): [number, number] {
    return [x - PLAYFIELD_LAYOUT.originX, y - PLAYFIELD_LAYOUT.originY];
}

export function artToGame(x: number, y: number): [number, number] {
    return [PLAYFIELD_LAYOUT.originX + x, PLAYFIELD_LAYOUT.originY + y];
}

function cloneTable(table: readonly TableObject[]): TableObject[] {
    return table.map((entry) => ({
        ...entry,
        points: entry.points?.map(([x, y]) => [x, y] as [number, number])
    }));
}

function applyPatch(table: TableObject[], patch: AuthoredBoardPatch | null | undefined): TableObject[] {
    if (!patch?.objects) return table;
    const deleted = new Set(
        Object.entries(patch.objects)
            .filter(([, edit]) => edit?.deleted)
            .map(([id]) => id)
    );
    const next = table
        .filter((entry) => !deleted.has(entry.id))
        .map((entry) => {
            const edit = patch.objects[entry.id];
            if (!edit || edit.deleted) return entry;
            const updated: TableObject = { ...entry };
            if (edit.points) {
                updated.points = edit.points.map(([ax, ay]) => artToGame(ax, ay));
                const mid = updated.points[Math.floor(updated.points.length / 2)];
                updated.x = mid[0];
                updated.y = mid[1];
            }
            if (edit.x !== undefined) updated.x = artToGame(edit.x, edit.y ?? gameToArt(entry.x, entry.y)[1])[0];
            if (edit.y !== undefined) updated.y = artToGame(edit.x ?? gameToArt(entry.x, entry.y)[0], edit.y)[1];
            if (edit.width !== undefined) updated.width = edit.width;
            if (edit.height !== undefined) updated.height = edit.height;
            if (edit.radius !== undefined) updated.radius = edit.radius;
            if (edit.angle !== undefined) updated.angle = edit.angle;
            if (edit.sensor) updated.sensor = edit.sensor;
            if (edit.linkId) updated.linkId = edit.linkId;
            return updated;
        });
    // Authored sensors (or other objects) that aren't in the stock table yet.
    Object.entries(patch.objects).forEach(([id, edit]) => {
        if (edit.deleted || next.some((e) => e.id === id)) return;
        if (edit.kind !== 'sensor' || edit.x === undefined || edit.y === undefined) return;
        const [x, y] = artToGame(edit.x, edit.y);
        next.push({
            id,
            kind: 'sensor',
            x,
            y,
            width: edit.width ?? 78,
            height: edit.height ?? 34,
            angle: edit.angle ?? 0,
            sensor: edit.sensor ?? 'lane',
            linkId: edit.linkId,
            event: edit.sensor === 'entrance' ? 'LANE_ENTER' : edit.sensor === 'exit' ? 'LANE_EXIT' : 'LANE_HIT'
        });
    });
    return next;
}

function readLocalPatches(): Partial<Record<PinballBoardId, AuthoredBoardPatch>> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<Record<PinballBoardId, AuthoredBoardPatch>>;
        return parsed ?? {};
    } catch {
        return {};
    }
}

function writeLocalPatches(all: Partial<Record<PinballBoardId, AuthoredBoardPatch>>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/** Resolve live table = base board + bundled authored JSON + localStorage (wins). */
export function resolveBoardTable(boardId: PinballBoardId): TableObject[] {
    const base = cloneTable(PINBALL_BOARDS[boardId].table);
    const withBundle = applyPatch(base, BUNDLED[boardId]);
    const local = readLocalPatches()[boardId];
    return applyPatch(withBundle, local);
}

export function resolveBoardBumpers(boardId: PinballBoardId) {
    return PINBALL_BOARDS[boardId].bumpers;
}

/** Build a patch from a working game-space table vs the stock board. */
export function buildPatchFromTable(boardId: PinballBoardId, table: readonly TableObject[]): AuthoredBoardPatch {
    const stock = PINBALL_BOARDS[boardId].table;
    const objects: AuthoredBoardPatch['objects'] = {};
    const liveIds = new Set(table.map((e) => e.id));

    // Stock objects removed in the working table.
    stock.forEach((original) => {
        if (!liveIds.has(original.id)) {
            objects[original.id] = { kind: original.kind, deleted: true };
        }
    });

    table.forEach((entry) => {
        const original = stock.find((o) => o.id === entry.id);
        if (!original) {
            if (entry.kind !== 'sensor') return;
            const [ax, ay] = gameToArt(entry.x, entry.y);
            objects[entry.id] = {
                kind: 'sensor',
                x: Math.round(ax),
                y: Math.round(ay),
                width: entry.width,
                height: entry.height,
                angle: entry.angle,
                sensor: entry.sensor,
                linkId: entry.linkId,
                event: entry.event
            };
            return;
        }
        const patch: AuthoredBoardPatch['objects'][string] = {};
        if (entry.points && original.points) {
            const artPts = entry.points.map(([x, y]) => gameToArt(x, y));
            const same =
                artPts.length === original.points.length &&
                artPts.every(([x, y], i) => {
                    const [ox, oy] = gameToArt(original.points![i][0], original.points![i][1]);
                    return Math.abs(x - ox) < 0.5 && Math.abs(y - oy) < 0.5;
                });
            if (!same) patch.points = artPts.map(([x, y]) => [Math.round(x), Math.round(y)]);
        }
        const [ax, ay] = gameToArt(entry.x, entry.y);
        const [ox, oy] = gameToArt(original.x, original.y);
        if (Math.abs(ax - ox) > 0.5 || Math.abs(ay - oy) > 0.5) {
            if (!entry.points || entry.kind === 'sensor' || entry.kind === 'post' || entry.kind === 'target' || entry.kind === 'sling' || entry.kind === 'flipper') {
                patch.x = Math.round(ax);
                patch.y = Math.round(ay);
            }
        }
        if (entry.radius !== undefined && entry.radius !== original.radius) patch.radius = entry.radius;
        if (entry.width !== undefined && entry.width !== original.width) patch.width = entry.width;
        if (entry.height !== undefined && entry.height !== original.height) patch.height = entry.height;
        if (entry.angle !== undefined && entry.angle !== original.angle) patch.angle = entry.angle;
        if (entry.sensor && entry.sensor !== original.sensor) patch.sensor = entry.sensor;
        if (entry.linkId && entry.linkId !== original.linkId) patch.linkId = entry.linkId;
        if (Object.keys(patch).length) {
            if (entry.kind === 'sensor') patch.kind = 'sensor';
            objects[entry.id] = patch;
        }
    });
    return {
        boardId,
        version: 1,
        updatedAt: new Date().toISOString(),
        objects
    };
}

export function savePatchLocal(patch: AuthoredBoardPatch) {
    const all = readLocalPatches();
    all[patch.boardId] = patch;
    writeLocalPatches(all);
}

export function clearLocalPatch(boardId: PinballBoardId) {
    const all = readLocalPatches();
    delete all[boardId];
    writeLocalPatches(all);
}

export function hasLocalPatch(boardId: PinballBoardId): boolean {
    return Boolean(readLocalPatches()[boardId]);
}

export function downloadText(filename: string, contents: string, mime = 'application/json') {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function exportPatchJson(patch: AuthoredBoardPatch): string {
    return `${JSON.stringify(patch, null, 2)}\n`;
}

/** TypeScript artPts snippet for pasting back into PinballBoards shells. */
export function exportArtPtsSnippet(patch: AuthoredBoardPatch): string {
    const lines = Object.entries(patch.objects).map(([id, edit]) => {
        if (edit.deleted) return `// DELETED ${id}`;
        if (!edit.points?.length) {
            return `// ${id}: x=${edit.x} y=${edit.y}`;
        }
        const pts = edit.points.map(([x, y]) => `[${x}, ${y}]`).join(', ');
        return `// ${id}\nartPts(${pts})`;
    });
    return `// Authored ${patch.boardId} @ ${patch.updatedAt}\n${lines.join('\n\n')}\n`;
}

export function isAuthorHashEnabled(): boolean {
    const hash = window.location.hash;
    return hash.includes('author') || hash === '#author' || hash.includes('procurement-author');
}

export const AUTHOR_LAYER_KEYS: Record<string, AuthorLayer> = {
    D: 'physics',
    R: 'rails',
    S: 'sensors',
    A: 'anchors',
    P: 'points',
    B: 'trajectory'
};
