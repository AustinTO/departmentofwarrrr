import { describe, expect, it } from 'vitest';
import { parsePinballSvg, TABLE_V1_SVG } from './PinballSvg';

/** Legacy SVG parser — reference only; live path uses pinballKit. */
describe('PinballSvg legacy reference', () => {
    it('still parses table_v1 for offline reference', () => {
        const { table, tunnels } = parsePinballSvg(TABLE_V1_SVG);
        expect(table.some((e) => e.kind === 'wall' && e.id === 'left-rail')).toBe(true);
        expect(table.filter((e) => e.kind === 'slide').length).toBeGreaterThanOrEqual(4);
        expect(tunnels.has('loop')).toBe(true);
    });
});
