import { describe, expect, it } from 'vitest';
import {
    artToGame,
    buildPatchFromTable,
    gameToArt,
    resolveBoardTable
} from './TableAuthorStore';
import { PINBALL_BOARDS, PLAYFIELD_LAYOUT } from './PinballBoards';

describe('TableAuthorStore', () => {
    it('round-trips game and art coordinates through the playfield origin', () => {
        const [gx, gy] = artToGame(100, 200);
        expect(gx).toBe(PLAYFIELD_LAYOUT.originX + 100);
        expect(gy).toBe(PLAYFIELD_LAYOUT.originY + 200);
        expect(gameToArt(gx, gy)).toEqual([100, 200]);
    });

    it('resolves a mutable table clone for every board', () => {
        Object.keys(PINBALL_BOARDS).forEach((id) => {
            const table = resolveBoardTable(id as keyof typeof PINBALL_BOARDS);
            expect(table.length).toBe(PINBALL_BOARDS[id as keyof typeof PINBALL_BOARDS].table.length);
            table[0].id = 'mutated-for-test';
            expect(PINBALL_BOARDS[id as keyof typeof PINBALL_BOARDS].table[0].id).not.toBe('mutated-for-test');
        });
    });

    it('builds art-space patches only for changed rail polylines', () => {
        const boardId = 'appropriations';
        const table = resolveBoardTable(boardId);
        const rail = table.find((e) => e.id === 'left-ramp-outer' && e.points);
        expect(rail?.points?.length).toBeGreaterThan(2);
        rail!.points![0] = [rail!.points![0][0] + 12, rail!.points![0][1] - 8];
        const patch = buildPatchFromTable(boardId, table);
        expect(patch.objects['left-ramp-outer']?.points?.[0][0]).toBe(
            Math.round(gameToArt(rail!.points![0][0], rail!.points![0][1])[0])
        );
        expect(Object.keys(patch.objects).length).toBeGreaterThanOrEqual(1);
    });

    it('records deletions so removed rails stay gone after resolve', () => {
        const boardId = 'appropriations';
        const table = resolveBoardTable(boardId).filter((e) => e.id !== 'left-ramp-outer' && e.id !== 'top-rail');
        const patch = buildPatchFromTable(boardId, table);
        expect(patch.objects['left-ramp-outer']?.deleted).toBe(true);
        expect(patch.objects['top-rail']?.deleted).toBe(true);
        const stock = resolveBoardTable(boardId);
        expect(stock.some((e) => e.id === 'left-ramp-outer')).toBe(true);
        const live = stock.filter((e) => !patch.objects[e.id]?.deleted);
        expect(live.some((e) => e.id === 'left-ramp-outer')).toBe(false);
        expect(live.some((e) => e.id === 'top-rail')).toBe(false);
        expect(live.length).toBe(stock.length - 2);
    });

    it('includes entrance and exit sensors on every ramp channel', () => {
        Object.values(PINBALL_BOARDS).forEach((board) => {
            const sensors = board.table.filter((e) => e.kind === 'sensor');
            expect(sensors.length).toBeGreaterThanOrEqual(4);
            expect(sensors.some((s) => s.sensor === 'entrance')).toBe(true);
            expect(sensors.some((s) => s.sensor === 'exit')).toBe(true);
            expect(sensors.every((s) => Boolean(s.linkId))).toBe(true);
        });
    });
});
