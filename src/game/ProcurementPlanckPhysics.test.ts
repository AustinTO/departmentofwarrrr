import { describe, expect, it } from 'vitest';
import { ProcurementPlanckPhysics } from './ProcurementPlanckPhysics';
import { PROCUREMENT_BUMPERS, PROCUREMENT_TABLE } from './ProcurementTableDefinition';

describe('ProcurementPlanckPhysics', () => {
    it('waits in the shooter lane until the player launches', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const start = physics.getBall();

        physics.step(2_000);

        expect(physics.getBallState()).toBe('ready');
        expect(physics.getBall()).toEqual(start);
    });

    it('allows only one active launch and advances the ball deterministically', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);

        expect(physics.relaunch(950, 1250, 24, 0.5)).toBe(true);
        expect(physics.relaunch(950, 1250, 24, 0.5)).toBe(false);
        physics.step(250);

        expect(physics.getBallState()).toBe('playing');
        expect(physics.getBall().y).toBeLessThan(1250);
    });

    it('routes a standard launch through a scoring object', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const events = [];
        physics.relaunch(950, 1250, 25, 0.35);

        for (let frame = 0; frame < 180; frame++) {
            physics.step(1000 / 60);
            events.push(...physics.consumeEvents());
        }

        expect(events.some(({ type }) => type === 'BUMPER_HIT' || type === 'TARGET_HIT')).toBe(true);
    });

    it('clears the lower board from the pull-back launcher lane', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(950, 1400, 34, 0);

        for (let frame = 0; frame < 30; frame++) physics.step(1000 / 60);

        expect(physics.getBallState()).toBe('playing');
        expect(physics.getBall().y, JSON.stringify({ ball: physics.getBall(), velocity: physics.getBallVelocity() })).toBeLessThan(1450);
    });

    it('drives both flipper motors while the ball is in play', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const rest = physics.getFlipperAngles();
        physics.relaunch(950, 1250, 24);

        physics.setFlipper('left', true);
        physics.setFlipper('right', true);
        physics.step(100);
        const active = physics.getFlipperAngles();

        const delta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
        expect(delta(rest.left, active.left)).toBeLessThan(0);
        expect(delta(rest.right, active.right)).toBeGreaterThan(0);
    });

    it('moves flippers at a controllable speed rather than spinning through a frame', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const rest = physics.getFlipperAngles();
        physics.relaunch(950, 1250, 24);
        physics.setFlipper('left', true);
        physics.step(1000 / 60);

        const moved = Math.abs(Math.atan2(
            Math.sin(physics.getFlipperAngles().left - rest.left),
            Math.cos(physics.getFlipperAngles().left - rest.left),
        ));
        expect(moved).toBeGreaterThan(0.05);
        expect(moved).toBeLessThan(0.25);
    });

    it('keeps the right collision blade on the same side as its visible tip', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const rest = physics.getFlipperAngles();

        expect(rest.right).toBeCloseTo(-0.42, 2);
        physics.setFlipper('right', true);
        physics.step(1000 / 60);
        expect(physics.getFlipperAngles().right).toBeGreaterThan(rest.right);
    });

    it('returns flippers to rest even after the ball drains', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const rest = physics.getFlipperAngles();
        physics.relaunch(540, 1801, 0);
        physics.step(17);
        physics.setFlipper('left', true);
        physics.step(100);
        physics.setFlipper('left', false);
        physics.step(250);

        expect(physics.getBallState()).toBe('drained');
        expect(physics.getFlipperAngles().left).toBeCloseTo(rest.left, 1);
    });

    it('keeps a ball inside the extended side rail', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(130, 1500, 0, 0);

        physics.step(300);

        expect(physics.getBallState()).toBe('playing');
        expect(physics.getBall().x).toBeGreaterThan(100);
    });

    it('emits one drain event and becomes relaunchable', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(540, 1801, 0);

        physics.step(17);

        expect(physics.getBallState()).toBe('drained');
        expect(physics.consumeEvents()).toEqual([{ type: 'BALL_DRAINED' }]);
        physics.step(1_000);
        expect(physics.consumeEvents()).toEqual([]);
        expect(physics.relaunch(945, 1605, 18)).toBe(true);
    });
});

describe('procurement table definition', () => {
    it('uses the same stable bumper order for presentation and physics rewards', () => {
        const tableBumpers = PROCUREMENT_TABLE.filter(({ kind }) => kind === 'bumper');

        expect(tableBumpers).toHaveLength(PROCUREMENT_BUMPERS.length);
        expect(tableBumpers.map(({ id }) => id)).toEqual(PROCUREMENT_BUMPERS.map(({ id }) => id));
        expect(new Set(PROCUREMENT_BUMPERS.map(({ id }) => id)).size).toBe(PROCUREMENT_BUMPERS.length);
    });
});
