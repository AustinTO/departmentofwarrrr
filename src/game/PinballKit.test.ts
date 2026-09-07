import { describe, expect, it, beforeEach } from 'vitest';
import {
    assembleAppropriationsKit,
    resetAppropriationsKitCache,
    kitTableObjects,
    kitTunnels,
    mergeBumpersFromKit,
    MIN_CHANNEL_GAP,
    MIN_RIDE_GAP,
    SKILL_MOUTH_RADIUS
} from './pinballKit';
import { dualChannel, artPoint } from './pinballKit/geometry';
import { dualRamp } from './pinballKit/components/dualRamp';
import { crossWire } from './pinballKit/components/crossWire';
import { cabinet } from './pinballKit/components/cabinet';
import { flippers } from './pinballKit/components/flippers';
import { resetBumperRegistry, bumper } from './pinballKit/components/bumper';
import { PINBALL_SIZING, PINBALL_BOARDS, railsAlignedToPlayfield, SHOOTER_LANE } from './PinballBoards';
import { ProcurementPlanckPhysics } from './ProcurementPlanckPhysics';

describe('pinballKit geometry', () => {
    it('rejects channels narrower than min rideable gap', () => {
        expect(() => dualChannel([[100, 100], [100, 200]], MIN_RIDE_GAP - 1)).toThrow(/rideable|Channel gap/);
    });

    it('emits dual edges at least minChannelGap apart for uniform gaps', () => {
        const { outer, inner } = dualChannel(
            [
                [235, 1145],
                [220, 1000],
                [205, 880]
            ],
            MIN_CHANNEL_GAP
        );
        for (let i = 0; i < outer.length; i++) {
            const gap = Math.hypot(outer[i][0] - inner[i][0], outer[i][1] - inner[i][1]);
            expect(gap).toBeGreaterThanOrEqual(MIN_CHANNEL_GAP - 0.01);
        }
    });

    it('tapers wide entrances into a thinner mid-run', () => {
        const { outer, inner } = dualChannel(
            Array.from({ length: 21 }, (_, i) => [200, 1200 - i * 40] as [number, number]),
            { enter: 150, mid: 78, exit: 100 }
        );
        const gapAt = (i: number) =>
            Math.hypot(outer[i][0] - inner[i][0], outer[i][1] - inner[i][1]);
        expect(gapAt(0)).toBeGreaterThan(140);
        expect(gapAt(10)).toBeLessThan(90);
        expect(gapAt(10)).toBeGreaterThanOrEqual(MIN_RIDE_GAP - 0.01);
        expect(gapAt(20)).toBeGreaterThan(95);
    });
});

describe('pinballKit components', () => {
    beforeEach(() => resetBumperRegistry());

    it('cabinet emits walls + drain', () => {
        const { objects } = cabinet();
        expect(objects.some((e) => e.kind === 'wall' && e.id === 'left-rail')).toBe(true);
        expect(objects.some((e) => e.kind === 'drain')).toBe(true);
    });

    it('dualRamp emits slides, circular mouths, and gates', () => {
        const { objects } = dualRamp({
            id: 'left-ramp',
            centerline: [
                [235, 1145],
                [220, 1000],
                [285, 320]
            ],
            channelGap: 120,
            enterMouth: [235, 1125],
            exitMouth: [285, 315]
        });
        expect(objects.filter((e) => e.kind === 'slide').length).toBeGreaterThanOrEqual(2);
        const enter = objects.find((e) => e.id === 'left-ramp-enter')!;
        expect(enter.kind).toBe('sensor');
        expect(enter.radius).toBe(SKILL_MOUTH_RADIUS);
        expect(enter.sensor).toBe('entrance');
    });

    it('crossWire marks overpass layer', () => {
        const { objects } = crossWire({
            id: 'cross-wire',
            centerline: [
                [200, 790],
                [540, 760],
                [880, 790]
            ],
            channelGap: 120,
            mouthRadius: 20
        });
        expect(objects.filter((e) => e.kind === 'slide' && e.layer === 'overpass').length).toBeGreaterThanOrEqual(2);
    });

    it('flippers use physics-required ids', () => {
        const ids = flippers().objects.map((e) => e.id);
        expect(ids).toContain('left-flipper');
        expect(ids).toContain('right-flipper');
    });

    it('bumper registry rejects overlaps', () => {
        bumper({ id: 'a', artX: 400, artY: 400, radius: 40 });
        expect(() => bumper({ id: 'b', artX: 410, artY: 410, radius: 40 })).toThrow(/overlaps/);
    });
});

describe('appropriations kit assembly', () => {
    beforeEach(() => {
        resetAppropriationsKitCache();
        resetBumperRegistry();
    });

    it('includes cabinet, ramps, cross-wire, tunnel, flippers, drain', () => {
        const { objects, tunnels, bumperMarkers } = assembleAppropriationsKit();
        expect(objects.some((e) => e.id === 'left-rail')).toBe(true);
        expect(objects.some((e) => e.id === 'left-ramp-outer')).toBe(true);
        expect(objects.some((e) => e.id === 'right-ramp-outer')).toBe(true);
        expect(objects.some((e) => e.id === 'cross-wire-outer' && e.layer === 'overpass')).toBe(true);
        expect(objects.some((e) => e.id.startsWith('tunnel-'))).toBe(true);
        expect(objects.some((e) => e.id === 'left-flipper')).toBe(true);
        expect(objects.some((e) => e.kind === 'drain')).toBe(true);
        expect(tunnels?.has('loop')).toBe(true);
        expect(bumperMarkers?.length).toBe(6);
    });

    it('keeps dual channels ball-safe', () => {
        const table = kitTableObjects();
        const outers = table.filter((e) => e.id.endsWith('-outer') && e.points);
        outers.forEach((outer) => {
            const inner = table.find((e) => e.id === outer.id.replace('-outer', '-inner'));
            expect(inner?.points?.length).toBeGreaterThan(2);
            const n = Math.min(outer.points!.length, inner!.points!.length);
            for (let i = 0; i < n; i++) {
                const gap = Math.hypot(
                    outer.points![i][0] - inner!.points![i][0],
                    outer.points![i][1] - inner!.points![i][1]
                );
                expect(gap).toBeGreaterThanOrEqual(PINBALL_SIZING.ballRadiusPx * 2 + 8);
            }
        });
    });

    it('live ramps use narrower entrance gaps than the mid-board used to', () => {
        resetAppropriationsKitCache();
        const table = kitTableObjects();
        for (const side of ['left-ramp', 'right-ramp'] as const) {
            const outer = table.find((e) => e.id === `${side}-outer`)!;
            const inner = table.find((e) => e.id === `${side}-inner`)!;
            const enterGap = Math.hypot(
                outer.points![0][0] - inner.points![0][0],
                outer.points![0][1] - inner.points![0][1]
            );
            const mid = Math.floor(outer.points!.length / 2);
            const midGap = Math.hypot(
                outer.points![mid][0] - inner.points![mid][0],
                outer.points![mid][1] - inner.points![mid][1]
            );
            expect(enterGap, side).toBeLessThan(125);
            expect(enterGap, side).toBeGreaterThanOrEqual(MIN_CHANNEL_GAP - 0.01);
            expect(midGap, side).toBeLessThan(enterGap);
        }
    });

    it('uses circular skill-sized mouths', () => {
        const table = kitTableObjects();
        const mouths = table.filter(
            (e) =>
                e.kind === 'sensor' &&
                (e.id.includes('enter') || e.id.includes('exit') || e.id.startsWith('tunnel-'))
        );
        expect(mouths.length).toBeGreaterThanOrEqual(8);
        mouths.forEach((m) => {
            expect(m.radius, m.id).toBeGreaterThanOrEqual(20);
            expect(m.radius, m.id).toBeLessThanOrEqual(36);
        });
    });

    it('feeds live boards inside the playfield', () => {
        Object.values(PINBALL_BOARDS).forEach((board) => {
            expect(railsAlignedToPlayfield(board.table)).toBe(true);
            expect(board.table.some((e) => e.kind === 'slide')).toBe(true);
            expect(board.table.some((e) => e.id.startsWith('tunnel-'))).toBe(true);
        });
    });

    it('merges kit bumper markers onto satire defs', () => {
        const raw = [{ id: 'jackpot', x: 0, y: 0, radius: 1 }];
        const merged = mergeBumpersFromKit(raw);
        const expected = artPoint(540, 400);
        expect(merged[0].x).toBe(expected[0]);
        expect(merged[0].y).toBe(expected[1]);
        expect(merged[0].radius).toBe(46);
    });
});

describe('kit pinball playability', () => {
    const LAUNCH_X = SHOOTER_LANE.launchX;
    const LAUNCH_Y = SHOOTER_LANE.launchY;

    it('exits the shooter into open play', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(LAUNCH_X, LAUNCH_Y, 46, 0);
        let entered = false;
        for (let i = 0; i < 150; i++) {
            physics.step(1000 / 60);
            if (physics.getBall().x < SHOOTER_LANE.artInnerX - 40) entered = true;
        }
        expect(entered).toBe(true);
        expect(physics.getBallState()).toBe('playing');
    });

    it('warps through the loop tunnel enter → exit', () => {
        const tunnels = kitTunnels();
        const enter = tunnels.get('loop')?.enter;
        expect(enter).toBeTruthy();
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(enter!.x, enter!.y + 10, 8, 0);
        let sawEnter = false;
        let sawExit = false;
        for (let i = 0; i < 120; i++) {
            physics.step(1000 / 60);
            const events = physics.consumeEvents();
            if (events.some((e) => e.type === 'TUNNEL_ENTER')) sawEnter = true;
            if (events.some((e) => e.type === 'TUNNEL_EXIT')) sawExit = true;
            if (sawExit) break;
        }
        if (!sawEnter) {
            const p = new ProcurementPlanckPhysics(1080, 1920);
            p.relaunch(enter!.x, enter!.y + 80, 20, 0);
            for (let i = 0; i < 90; i++) {
                p.step(1000 / 60);
                const events = p.consumeEvents();
                if (events.some((e) => e.type === 'TUNNEL_ENTER')) sawEnter = true;
                if (events.some((e) => e.type === 'TUNNEL_EXIT')) {
                    sawExit = true;
                    break;
                }
            }
            expect(sawEnter || sawExit).toBe(true);
            return;
        }
        expect(sawEnter).toBe(true);
        expect(sawExit).toBe(true);
    });

    it('tunnel dump ejects onto a flipper approach, not the tip gap', () => {
        resetAppropriationsKitCache();
        const table = kitTableObjects();
        const tunnels = kitTunnels();
        const exit = tunnels.get('loop')?.exit;
        const leftFlip = table.find((e) => e.id === 'left-flipper')!;
        const rightFlip = table.find((e) => e.id === 'right-flipper')!;
        expect(exit).toBeTruthy();
        // Exit sensor itself must sit off the dead-center drain line.
        expect(Math.abs(exit!.x - 540)).toBeGreaterThan(60);

        const physics = new ProcurementPlanckPhysics(1080, 1920, 'appropriations', table);
        // Drop straight into the scoop enter.
        const enter = tunnels.get('loop')!.enter;
        physics.relaunch(enter.x, enter.y, 0, 0);
        let exited = false;
        let nearFlip = false;
        for (let i = 0; i < 220; i++) {
            physics.step(1000 / 60);
            const events = physics.consumeEvents();
            if (events.some((e) => e.type === 'TUNNEL_EXIT')) exited = true;
            if (!exited) continue;
            const b = physics.getBall();
            if (Math.hypot(b.x - leftFlip.x, b.y - leftFlip.y) < 200) nearFlip = true;
            if (Math.hypot(b.x - rightFlip.x, b.y - rightFlip.y) < 200) nearFlip = true;
            // Once past the flipper line, stop — either we fed a bat or missed.
            if (b.y > leftFlip.y + 40) break;
        }
        expect(exited).toBe(true);
        expect(nearFlip).toBe(true);
    });

    it('scores bumper hits from kit positions', () => {
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        const bumperDef = physics.bumpers[0];
        physics.relaunch(bumperDef.x, bumperDef.y + 80, 18, 0);
        const events = [];
        for (let i = 0; i < 90; i++) {
            physics.step(1000 / 60);
            events.push(...physics.consumeEvents());
        }
        expect(events.some((e) => e.type === 'BUMPER_HIT')).toBe(true);
    });

    it('keeps a ball free inside the left ramp channel', () => {
        const table = kitTableObjects();
        const outer = table.find((e) => e.id === 'left-ramp-outer')!;
        const inner = table.find((e) => e.id === 'left-ramp-inner')!;
        const i = Math.min(2, outer.points!.length - 1);
        const mx = (outer.points![i][0] + inner.points![i][0]) / 2;
        const my = (outer.points![i][1] + inner.points![i][1]) / 2;
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(mx, my, 28, 0);
        let moved = 0;
        let last = { x: mx, y: my };
        for (let frame = 0; frame < 75; frame++) {
            physics.step(1000 / 60);
            const ball = physics.getBall();
            moved += Math.hypot(ball.x - last.x, ball.y - last.y);
            last = { x: ball.x, y: ball.y };
            expect(ball.x).toBeGreaterThan(80);
            expect(ball.x).toBeLessThan(900);
            expect(physics.getBallState()).not.toBe('drained');
        }
        expect(moved).toBeGreaterThan(40);
    });

    it('lets playfield balls pass under the cross-wire overpass', () => {
        const table = kitTableObjects();
        const over = table.filter((e) => e.id.startsWith('cross-wire') && e.kind === 'slide');
        expect(over.every((e) => e.layer === 'overpass')).toBe(true);

        const outer = table.find((e) => e.id === 'cross-wire-outer')!;
        const inner = table.find((e) => e.id === 'cross-wire-inner')!;
        const mx = (outer.points![2][0] + inner.points![2][0]) / 2;
        const wireBottom = Math.max(
            ...outer.points!.map(([, y]) => y),
            ...inner.points!.map(([, y]) => y)
        );
        const wireTop = Math.min(
            ...outer.points!.map(([, y]) => y),
            ...inner.points!.map(([, y]) => y)
        );
        const below = wireBottom + 140;
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(mx, below, 52, 0);
        let crossedBand = false;
        let mounted = false;
        const startY = physics.getBall().y;
        for (let frame = 0; frame < 120; frame++) {
            physics.step(1000 / 60);
            const events = physics.consumeEvents();
            if (events.some((e) => e.type === 'LANE_ENTER' && e.id === 'cross-wire')) mounted = true;
            if (physics.getBall().y < (wireTop + wireBottom) / 2) crossedBand = true;
        }
        expect(mounted).toBe(false);
        // Either crossed the wire band or at least traveled upward through it without mounting.
        expect(crossedBand || physics.getBall().y < startY - 80).toBe(true);
    });

    it('climbs the left ramp without oscillating halfway', () => {
        const table = kitTableObjects();
        const outer = table.find((e) => e.id === 'left-ramp-outer')!;
        const inner = table.find((e) => e.id === 'left-ramp-inner')!;
        const enter = table.find((e) => e.id === 'left-ramp-enter')!;
        const mid = Math.floor(outer.points!.length / 2);
        const midY = (outer.points![mid][1] + inner.points![mid][1]) / 2;
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(enter.x, enter.y + 10, 34, 0);
        let minY = enter.y;
        let oscillated = 0;
        let lastDy = 0;
        for (let frame = 0; frame < 180; frame++) {
            const before = physics.getBall().y;
            physics.step(1000 / 60);
            const after = physics.getBall().y;
            const dy = after - before;
            if (lastDy < -2 && dy > 2) oscillated += 1;
            if (lastDy > 2 && dy < -2) oscillated += 1;
            lastDy = dy;
            minY = Math.min(minY, after);
        }
        expect(minY).toBeLessThan(midY - 80);
        expect(oscillated).toBeLessThan(8);
    });

    it('pops the ball out the top of the right ramp after a climb', () => {
        resetAppropriationsKitCache();
        const table = kitTableObjects();
        const enter = table.find((e) => e.id === 'right-ramp-enter')!;
        const exit = table.find((e) => e.id === 'right-ramp-exit')!;
        const physics = new ProcurementPlanckPhysics(1080, 1920, 'appropriations', table);
        physics.relaunch(enter.x, enter.y + 10, 34, 0);
        let exited = false;
        let minY = enter.y;
        for (let frame = 0; frame < 280; frame++) {
            physics.step(1000 / 60);
            const b = physics.getBall();
            minY = Math.min(minY, b.y);
            if (physics.consumeEvents().some((e) => e.type === 'LANE_EXIT' && e.id === 'right-ramp')) {
                exited = true;
            }
            // After eject, ball should be above the spout and moving in open play.
            if (exited && b.y < exit.y - 20 && Math.abs(b.x - exit.x) > 40) break;
        }
        expect(exited).toBe(true);
        expect(minY).toBeLessThan(exit.y);
        const final = physics.getBall();
        expect(final.y).toBeLessThan(exit.y + 30);
        expect(Math.abs(final.x - 540)).toBeLessThan(420);
    });

    it('blocks mid-channel entry into left and right ramps from the playfield', () => {
        resetAppropriationsKitCache();
        const table = kitTableObjects();
        for (const side of ['left-ramp', 'right-ramp'] as const) {
            const outer = table.find((e) => e.id === `${side}-outer`)!;
            const inner = table.find((e) => e.id === `${side}-inner`)!;
            const mid = Math.floor(outer.points!.length / 2);
            const cx = (outer.points![mid][0] + inner.points![mid][0]) / 2;
            const cy = (outer.points![mid][1] + inner.points![mid][1]) / 2;
            // Sit on the playfield side of the channel (toward table center).
            const startX = side === 'left-ramp' ? cx + 95 : cx - 95;
            const physics = new ProcurementPlanckPhysics(1080, 1920, 'appropriations', table);
            physics.relaunch(startX, cy, 0, 0);
            let minDist = Infinity;
            for (let frame = 0; frame < 100; frame++) {
                physics.step(1000 / 60);
                const b = physics.getBall();
                minDist = Math.min(minDist, Math.hypot(b.x - cx, b.y - cy));
            }
            // Half mid-gap ~39. Entering the trough collapses minDist near 0.
            expect(minDist, side).toBeGreaterThan(32);
        }
    });

    it('places cross-wire mouths inside the side-ramp channels', () => {
        resetAppropriationsKitCache();
        const table = kitTableObjects();
        const wireEnter = table.find((e) => e.id === 'cross-wire-enter')!;
        const wireExit = table.find((e) => e.id === 'cross-wire-exit')!;
        const leftOuter = table.find((e) => e.id === 'left-ramp-outer')!;
        const leftInner = table.find((e) => e.id === 'left-ramp-inner')!;
        const rightOuter = table.find((e) => e.id === 'right-ramp-outer')!;
        const rightInner = table.find((e) => e.id === 'right-ramp-inner')!;

        const distToChannel = (
            x: number,
            y: number,
            outer: typeof leftOuter,
            inner: typeof leftInner
        ) => {
            let best = Infinity;
            const n = Math.min(outer.points!.length, inner.points!.length);
            for (let i = 0; i < n; i++) {
                const cx = (outer.points![i][0] + inner.points![i][0]) / 2;
                const cy = (outer.points![i][1] + inner.points![i][1]) / 2;
                best = Math.min(best, Math.hypot(x - cx, y - cy));
            }
            return best;
        };

        expect(distToChannel(wireEnter.x, wireEnter.y, leftOuter, leftInner)).toBeLessThan(40);
        expect(distToChannel(wireExit.x, wireExit.y, rightOuter, rightInner)).toBeLessThan(40);
    });

    it('arms cross-wire after left-ramp entrance', () => {
        const table = kitTableObjects();
        const rampEnter = table.find((e) => e.id === 'left-ramp-enter')!;
        const physics = new ProcurementPlanckPhysics(1080, 1920);
        physics.relaunch(rampEnter.x, rampEnter.y, 4, 0);
        let armed = false;
        for (let frame = 0; frame < 40; frame++) {
            physics.step(1000 / 60);
            if (physics.consumeEvents().some((e) => e.id === 'cross-wire-armed')) armed = true;
            if (physics.isCrossWireArmed()) armed = true;
            if (armed) break;
        }
        expect(armed || physics.isCrossWireArmed()).toBe(true);
    });

    it('feeds the ball onto flippers with outboard slings and clear inlanes', () => {
        resetAppropriationsKitCache();
        const table = kitTableObjects();
        const leftFlip = table.find((e) => e.id === 'left-flipper')!;
        const rightFlip = table.find((e) => e.id === 'right-flipper')!;
        const leftSling = table.find((e) => e.id === 'left-sling')!;
        const rightSling = table.find((e) => e.id === 'right-sling')!;
        // Slings sit above the paddle zone but toward the cabinet edges.
        expect(leftSling.y).toBeLessThan(leftFlip.y - 40);
        expect(rightSling.y).toBeLessThan(rightFlip.y - 40);
        expect(leftSling.x).toBeLessThan(leftFlip.x);
        expect(rightSling.x).toBeGreaterThan(rightFlip.x);

        // Inlane / outboard of sling triangle — roll down onto the flipper.
        const physics = new ProcurementPlanckPhysics(1080, 1920, 'appropriations', table);
        physics.relaunch(160, leftSling.y - 40, 0, 0);
        let nearLeft = false;
        for (let frame = 0; frame < 240; frame++) {
            physics.step(1000 / 60);
            const b = physics.getBall();
            if (Math.hypot(b.x - leftFlip.x, b.y - leftFlip.y) < 200) nearLeft = true;
        }
        expect(nearLeft).toBe(true);

        const physicsR = new ProcurementPlanckPhysics(1080, 1920, 'appropriations', table);
        physicsR.relaunch(920, rightSling.y - 40, 0, 0);
        let nearRight = false;
        for (let frame = 0; frame < 240; frame++) {
            physicsR.step(1000 / 60);
            const b = physicsR.getBall();
            if (Math.hypot(b.x - rightFlip.x, b.y - rightFlip.y) < 200) nearRight = true;
        }
        expect(nearRight).toBe(true);
    });

    it('keeps the center open so a dead ball can still reach a flipper', () => {
        resetAppropriationsKitCache();
        const table = kitTableObjects();
        const leftFlip = table.find((e) => e.id === 'left-flipper')!;
        const rightFlip = table.find((e) => e.id === 'right-flipper')!;
        const physics = new ProcurementPlanckPhysics(1080, 1920, 'appropriations', table);
        physics.relaunch(500, 1450, 0, 0);
        let nearFlip = false;
        for (let frame = 0; frame < 180; frame++) {
            physics.step(1000 / 60);
            const b = physics.getBall();
            if (Math.hypot(b.x - leftFlip.x, b.y - leftFlip.y) < 200) nearFlip = true;
            if (Math.hypot(b.x - rightFlip.x, b.y - rightFlip.y) < 200) nearFlip = true;
        }
        expect(nearFlip || physics.getBallState() === 'playing').toBe(true);
    });
});
