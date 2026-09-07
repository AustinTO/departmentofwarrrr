import { describe, expect, it } from 'vitest';
import { ProcurementPlanckPhysics } from './ProcurementPlanckPhysics';
import { PROCUREMENT_BUMPERS, PROCUREMENT_TABLE } from './ProcurementTableDefinition';
import { PLAYFIELD_LAYOUT, PINBALL_BOARDS, PINBALL_SIZING, SHOOTER_LANE, railsAlignedToPlayfield } from './PinballBoards';
import { kitTableObjects, resetAppropriationsKitCache } from './pinballKit';

const LAUNCH_X = SHOOTER_LANE.launchX;
const LAUNCH_Y = SHOOTER_LANE.launchY;
const DRAIN_Y = PLAYFIELD_LAYOUT.bottom + 50;

describe('ProcurementPlanckPhysics', () => {
    it('waits in the shooter lane until the player launches', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const start = physics.getBall();

        physics.step(2_000);

        expect(physics.getBallState()).toBe('ready');
        expect(physics.getBall()).toEqual(start);
        expect(start.x).toBeCloseTo(SHOOTER_LANE.readyX, 0);
    });

    it('allows only one active launch and advances the ball deterministically', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);

        expect(physics.relaunch(LAUNCH_X, LAUNCH_Y, 24, 0)).toBe(true);
        expect(physics.relaunch(LAUNCH_X, LAUNCH_Y, 24, 0)).toBe(false);
        physics.step(250);

        expect(physics.getBallState()).toBe('playing');
        expect(physics.getBall().y).toBeLessThan(LAUNCH_Y);
    });

    it('shoots straight up the plunger lane without immediately jamming', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 36, 0);

        for (let frame = 0; frame < 45; frame++) physics.step(1000 / 60);

        const ball = physics.getBall();
        expect(physics.getBallState()).toBe('playing');
        // Cleared the lower shooter and reached the upper exit / playfield
        expect(ball.y).toBeLessThan(PLAYFIELD_LAYOUT.originY + 500);
    });

    it('exits the shooter into the open playfield', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        // Vertical plunge — hood feeds left. Left aim scrapes the divider.
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 40, 0);

        let enteredPlay = false;
        for (let frame = 0; frame < 120; frame++) {
            physics.step(1000 / 60);
            const ball = physics.getBall();
            if (ball.x < SHOOTER_LANE.artInnerX - 40) enteredPlay = true;
        }

        expect(physics.getBallState()).toBe('playing');
        expect(enteredPlay).toBe(true);
        expect(physics.getBall().x).toBeLessThan(SHOOTER_LANE.artInnerX - 20);
    });

    it('clamps launch aim so a hard pull still clears the tube', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        // Scene used to pass aim up to 0.12 on full charge; that must not jam.
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 52, 0.12);

        let enteredPlay = false;
        for (let frame = 0; frame < 120; frame++) {
            physics.step(1000 / 60);
            if (physics.getBall().x < SHOOTER_LANE.artInnerX - 40) enteredPlay = true;
        }
        expect(enteredPlay).toBe(true);
    });

    it('parks a failed plunge back in the tube so the player can fire again', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        // Weak shot that cannot clear the hood — falls back down the lane.
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 12, 0);
        const events = [];
        for (let frame = 0; frame < 200; frame++) {
            physics.step(1000 / 60);
            events.push(...physics.consumeEvents());
            if (physics.getBallState() === 'ready') break;
        }
        expect(events.some((e) => e.type === 'SHOOTER_RETURN')).toBe(true);
        expect(physics.getBallState()).toBe('ready');
        expect(physics.relaunch(LAUNCH_X, LAUNCH_Y, 42, 0.05)).toBe(true);
    });

    it('parks a motionless jam in the shooter instead of soft-locking the plunger', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 0, 0);
        const events = [];
        for (let frame = 0; frame < 40; frame++) {
            physics.step(1000 / 60);
            events.push(...physics.consumeEvents());
            if (physics.getBallState() === 'ready') break;
        }
        expect(physics.getBallState()).toBe('ready');
        expect(events.some((e) => e.type === 'SHOOTER_RETURN')).toBe(true);
        expect(physics.relaunch(LAUNCH_X, LAUNCH_Y, 40, 0)).toBe(true);
    });

    it('routes a standard launch through a scoring object', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const events = [];
        // Launch from mid-playfield so we reliably strike table hardware.
        physics.relaunch(540, PLAYFIELD_LAYOUT.originY + 700, 18, 0.2);

        for (let frame = 0; frame < 180; frame++) {
            physics.step(1000 / 60);
            events.push(...physics.consumeEvents());
        }

        expect(events.some(({ type }) =>
            type === 'BUMPER_HIT' || type === 'TARGET_HIT' || type === 'SLINGSHOT_HIT' || type === 'POST_HIT' || type === 'LANE_HIT'
        )).toBe(true);
    });

    it('clears the lower board from the pull-back launcher lane', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 38, 0);

        for (let frame = 0; frame < 30; frame++) physics.step(1000 / 60);

        expect(physics.getBallState()).toBe('playing');
        expect(physics.getBall().y, JSON.stringify({ ball: physics.getBall(), velocity: physics.getBallVelocity() })).toBeLessThan(LAUNCH_Y - 80);
    });

    it('drives both flipper motors while the ball is in play', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const rest = physics.getFlipperAngles();
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 24);

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
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 24);
        physics.setFlipper('left', true);
        physics.step(1000 / 60);

        const moved = Math.abs(Math.atan2(
            Math.sin(physics.getFlipperAngles().left - rest.left),
            Math.cos(physics.getFlipperAngles().left - rest.left),
        ));
        expect(moved).toBeGreaterThan(0.05);
        expect(moved).toBeLessThan(0.38);
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
        physics.relaunch(540, DRAIN_Y, 0);
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
        physics.relaunch(130, PLAYFIELD_LAYOUT.originY + 1100, 0, 0);

        physics.step(300);

        expect(physics.getBallState()).toBe('playing');
        expect(physics.getBall().x).toBeGreaterThan(90);
    });

    it('emits one drain event and becomes relaunchable', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(540, DRAIN_Y, 0);

        physics.step(17);

        expect(physics.getBallState()).toBe('drained');
        expect(physics.consumeEvents()).toEqual([{ type: 'BALL_DRAINED' }]);
        physics.step(1_000);
        expect(physics.consumeEvents()).toEqual([]);
        expect(physics.relaunch(LAUNCH_X, LAUNCH_Y, 18)).toBe(true);
    });

    it('contains the ball on every board layout', () => {
        (['appropriations', 'audit_chamber', 'supplemental_stadium'] as const).forEach((boardId) => {
            const physics = new ProcurementPlanckPhysics(1080, 1920, boardId);
            physics.relaunch(LAUNCH_X, LAUNCH_Y, 30, 0);
            for (let i = 0; i < 90; i++) physics.step(1000 / 60);
            const ball = physics.getBall();
            expect(ball.x).toBeGreaterThan(50);
            expect(ball.x).toBeLessThan(1060);
            expect(ball.y).toBeGreaterThan(PLAYFIELD_LAYOUT.originY);
        });
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

describe('upgraded pinball rails', () => {
    it('aligns every board rail polyline to the 1080x1600 playfield map', () => {
        Object.values(PINBALL_BOARDS).forEach((board) => {
            expect(railsAlignedToPlayfield(board.table)).toBe(true);
        });
    });

    it('builds dual-edge ramp channels so slides are rideable, not blocked', () => {
        Object.values(PINBALL_BOARDS).forEach((board) => {
            const outers = board.table.filter(
                (e) => e.id.endsWith('-outer') && e.kind === 'slide' && e.points
            );
            const inners = board.table.filter(
                (e) => e.id.endsWith('-inner') && e.kind === 'slide' && e.points
            );
            expect(outers.length).toBeGreaterThanOrEqual(2);
            expect(inners.length).toBeGreaterThanOrEqual(2);
            outers.forEach((outer) => {
                expect(outer.kind).toBe('slide');
                const inner = board.table.find((e) => e.id === outer.id.replace('-outer', '-inner'));
                expect(inner?.kind).toBe('slide');
                expect(inner?.points?.length).toBeGreaterThan(3);
                const midOuter = outer.points![Math.floor(outer.points!.length / 2)];
                const midInner = inner!.points![Math.floor(inner!.points!.length / 2)];
                // Mid run may taper; still must clear the ball + margin.
                expect(Math.hypot(midOuter[0] - midInner[0], midOuter[1] - midInner[1]))
                    .toBeGreaterThanOrEqual(PINBALL_SIZING.ballRadiusPx * 2 + 8);
            });
        });
    });

    it('keeps true segment clearance wider than the ball on every ramp', () => {
        Object.values(PINBALL_BOARDS).forEach((board) => {
            board.table.filter((e) => e.id.endsWith('-outer') && e.kind === 'slide' && e.points).forEach((outer) => {
                const inner = board.table.find((e) => e.id === outer.id.replace('-outer', '-inner'));
                let min = Infinity;
                for (let i = 0; i < outer.points!.length - 1; i++) {
                    for (let j = 0; j < inner!.points!.length - 1; j++) {
                        const a = outer.points![i];
                        const b = outer.points![i + 1];
                        const c = inner!.points![j];
                        const d = inner!.points![j + 1];
                        for (let s = 0; s <= 4; s++) {
                            const t = s / 4;
                            const ox = a[0] + (b[0] - a[0]) * t;
                            const oy = a[1] + (b[1] - a[1]) * t;
                            for (let u = 0; u <= 4; u++) {
                                const v = u / 4;
                                const ix = c[0] + (d[0] - c[0]) * v;
                                const iy = c[1] + (d[1] - c[1]) * v;
                                min = Math.min(min, Math.hypot(ox - ix, oy - iy));
                            }
                        }
                    }
                }
                const clear = min - 2 * PINBALL_SIZING.slideHalfThicknessPx;
                expect(clear, `${board.id}:${outer.id}`).toBeGreaterThan(PINBALL_SIZING.ballRadiusPx * 2 + 8);
            });
        });
    });

    it('keeps playfield rails clear of the plunger channel', () => {
        const reserved = new Set([
            'shooter-left', 'shooter-oneway', 'shooter-exit', 'right-rail', 'right-bottom-rail',
            'right-tunnel-hood'
        ]);
        Object.values(PINBALL_BOARDS).forEach((board) => {
            board.table
                .filter((e) => (e.kind === 'wall' || e.kind === 'slide') && e.points)
                .filter((e) => !reserved.has(e.id))
                .forEach((e) => {
                    e.points!.forEach(([x]) => {
                        expect(x, `${board.id}:${e.id}`).toBeLessThan(SHOOTER_LANE.artInnerX - 8);
                    });
                });
        });
    });

    it('defines chrome walls, slides, posts, and expanded target banks', () => {
        const kinds = new Set(PROCUREMENT_TABLE.map((entry) => entry.kind));
        expect(kinds.has('wall')).toBe(true);
        expect(kinds.has('slide')).toBe(true);
        expect(kinds.has('post')).toBe(true);
        expect(kinds.has('sling')).toBe(true);
        expect(PROCUREMENT_TABLE.filter((e) => e.kind === 'target').length).toBeGreaterThanOrEqual(3);
        expect(PROCUREMENT_TABLE.filter((e) => e.kind === 'target' && e.event === 'TARGET_HIT').length).toBeGreaterThanOrEqual(2);
        expect(PROCUREMENT_TABLE.filter((e) => e.kind === 'wall').length).toBeGreaterThanOrEqual(10);
    });

    it('builds physics fixtures from table posts and slings', () => {
        resetAppropriationsKitCache();
        const table = kitTableObjects();
        const physics = new ProcurementPlanckPhysics(1080, 1920, 'appropriations', table);
        const sling = table.find((e) => e.id === 'left-sling')!;
        // Rest on the rubber face so contact is reliable.
        physics.relaunch(sling.x + 10, sling.y - 20, 0, 0);
        const events = [];
        for (let i = 0; i < 120; i++) {
            physics.step(1000 / 60);
            events.push(...physics.consumeEvents());
        }
        expect(events.some((e) =>
            e.type === 'SLINGSHOT_HIT' || e.type === 'POST_HIT' || e.type === 'BUMPER_HIT'
        )).toBe(true);
    });
});
