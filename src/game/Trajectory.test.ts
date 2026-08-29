import { describe, expect, it } from 'vitest';
import { getArcControlPoint, quadraticBezier } from './Trajectory';

describe('combat trajectories', () => {
    it('starts and ends exactly at the requested points', () => {
        const start = { x: 100, y: 900 };
        const target = { x: 700, y: 300 };
        const control = getArcControlPoint(start, target, 120);

        expect(quadraticBezier(start, control, target, 0)).toEqual(start);
        expect(quadraticBezier(start, control, target, 1)).toEqual(target);
    });

    it('creates a genuine mid-flight arc when given an offset', () => {
        const start = { x: 0, y: 0 };
        const target = { x: 100, y: 0 };
        const control = getArcControlPoint(start, target, 50);
        const midpoint = quadraticBezier(start, control, target, 0.5);

        expect(midpoint.x).toBeCloseTo(50);
        expect(Math.abs(midpoint.y)).toBeGreaterThan(0);
    });
});
