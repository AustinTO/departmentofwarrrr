import * as planck from 'planck-js';
import type { ProcurementBumper, TableObject } from './ProcurementTableDefinition';
import { PINBALL_BOARDS, PINBALL_SIZING, PLAYFIELD_LAYOUT, SHOOTER_LANE, polylineSegments, type PinballBoardId } from './PinballBoards';

export type ProcurementBallState = 'ready' | 'playing' | 'drained';
export type ProcurementPhysicsEvent = {
    type: 'BUMPER_HIT' | 'TARGET_HIT' | 'SLINGSHOT_HIT' | 'BALL_DRAINED' | 'SKILL_SHOT' | 'POST_HIT' | 'LANE_HIT' | 'LANE_ENTER' | 'LANE_EXIT' | 'SHOOTER_RETURN';
    index?: number;
    id?: string;
};

const MAX_BALLS = 3;

/** Planck-only simulation layer; Phaser owns all drawing and gameplay effects. */
export class ProcurementPlanckPhysics {
    static readonly scale = 48;
        private readonly world = new planck.World(planck.Vec2(0, 24));
    private accumulator = 0;
    private readonly balls: planck.Body[] = [];
    private readonly flippers: Record<'left' | 'right', { body: planck.Body; rest: number; active: number; target: number }>;
    private events: ProcurementPhysicsEvent[] = [];
    private lastKickAt = new Map<string, number>();
    private ballState: ProcurementBallState = 'ready';
    private skillShotArmed = false;
    private skillShotConsumed = false;
    /** Frames the primary ball has been idling inside the plunger tube after a failed shot. */
    private shooterReturnFrames = 0;
    /** Frames the active ball has been nearly motionless anywhere on the table. */
    private idleStuckFrames = 0;
    private lastBallPx = 0;
    private lastBallPy = 0;
    readonly bumpers: readonly ProcurementBumper[];
    readonly table: readonly TableObject[];

    constructor(
        private readonly tableWidth: number,
        _height: number,
        boardId: PinballBoardId = 'appropriations',
        tableOverride?: readonly TableObject[]
    ) {
        const board = PINBALL_BOARDS[boardId];
        this.bumpers = board.bumpers;
        this.table = tableOverride ?? board.table;
        const width = tableWidth;
        const v = (x: number, y: number) => planck.Vec2(x / ProcurementPlanckPhysics.scale, y / ProcurementPlanckPhysics.scale);
        const scale = ProcurementPlanckPhysics.scale;

        const addRailSegment = (
            a: [number, number],
            b: [number, number],
            restitution: number,
            friction: number,
            halfThickPx: number,
            userData?: string
        ) => {
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const len = Math.hypot(dx, dy) || 1;
            const body = this.world.createBody({ userData });
            const mid = planck.Vec2(((a[0] + b[0]) / 2) / scale, ((a[1] + b[1]) / 2) / scale);
            const angle = Math.atan2(dy, dx);
            const halfLen = (len / 2) / scale;
            const halfThick = halfThickPx / scale;
            body.createFixture(planck.Box(halfLen, halfThick, mid, angle), { restitution, friction });
            return body;
        };

        // Rails + slide polylines from table data (art-aligned).
        this.table.forEach((entry) => {
            if ((entry.kind !== 'wall' && entry.kind !== 'slide') || !entry.points || entry.points.length < 2) return;
            const isSlide = entry.kind === 'slide';
            // Slides must be ice-slick — any friction sandwiches the ball between dual rails.
            const restitution = isSlide ? 0.15 : 0.75;
            const friction = isSlide ? 0 : 0.02;
            const halfThick = isSlide ? PINBALL_SIZING.slideHalfThicknessPx : PINBALL_SIZING.railHalfThicknessPx;
            const prefix = entry.id === 'shooter-oneway'
                ? `GATE:${entry.id}`
                : isSlide ? `LANE:${entry.id}` : `WALL:${entry.id}`;
            const pts = entry.points;
            // Caps only on cabinet walls — slide vertex caps were pinching channels shut.
            if (!isSlide) {
                pts.forEach(([x, y]) => {
                    const cap = this.world.createBody({ position: v(x, y), userData: prefix });
                    cap.createFixture(planck.Circle(halfThick / scale), { restitution, friction });
                });
            }
            polylineSegments(pts).forEach(([a, b], seg) => {
                addRailSegment(a, b, restitution, friction, halfThick, `${prefix}:${seg}`);
            });
        });

        this.bumpers.forEach(({ x, y, radius }, index) => {
            const bumper = this.world.createBody({ position: v(x, y), userData: `BUMPER:${index}` });
            bumper.createFixture(planck.Circle(radius / scale), { restitution: 1.05, friction: 0 });
        });

        this.table.filter((e) => e.kind === 'sling').forEach((sling) => {
            const body = this.world.createBody({
                position: v(sling.x, sling.y),
                userData: `SLING:${sling.id}`
            });
            const hw = ((sling.width ?? 120) / 2) / scale;
            const hh = ((sling.height ?? 28) / 2) / scale;
            body.createFixture(
                planck.Box(hw, hh, planck.Vec2(0, 0), sling.angle ?? 0),
                { restitution: 1.08, friction: 0 }
            );
        });

        this.table.filter((e) => e.kind === 'post').forEach((post) => {
            const body = this.world.createBody({
                position: v(post.x, post.y),
                userData: `POST:${post.id}`
            });
            body.createFixture(planck.Circle((post.radius ?? 14) / scale), {
                restitution: 0.98,
                friction: 0.01
            });
        });

        this.table.filter((e) => e.kind === 'target').forEach((target) => {
            const tag = target.event === 'SKILL_SHOT' ? `SKILL:${target.id}` : `TARGET:${target.id}`;
            const body = this.world.createBody({ position: v(target.x, target.y), userData: tag });
            const hw = ((target.width ?? 64) / 2) / scale;
            const hh = ((target.height ?? 28) / 2) / scale;
            body.createFixture(planck.Box(hw, hh, planck.Vec2(0, 0), target.angle ?? 0), {
                restitution: 0.88, friction: 0.02
            });
        });

        // Entrance / exit / lane sensors — trigger only, no solid collision.
        this.table.filter((e) => e.kind === 'sensor').forEach((sensor) => {
            const role = sensor.sensor ?? 'lane';
            const link = sensor.linkId ?? sensor.id;
            const tag = `SENSOR:${role}:${link}:${sensor.id}`;
            const body = this.world.createBody({ position: v(sensor.x, sensor.y), userData: tag });
            const hw = ((sensor.width ?? 72) / 2) / scale;
            const hh = ((sensor.height ?? 34) / 2) / scale;
            body.createFixture(planck.Box(hw, hh, planck.Vec2(0, 0), sensor.angle ?? 0), {
                isSensor: true
            });
        });

        const readyY = SHOOTER_LANE.readyY;
        this.balls.push(this.createBallBody(SHOOTER_LANE.readyX, readyY, false));
        const leftFlip = this.table.find((e) => e.id === 'left-flipper');
        const rightFlip = this.table.find((e) => e.id === 'right-flipper');
        this.flippers = {
            left: this.createFlipper(v, 'left', leftFlip?.x ?? 270, leftFlip?.y ?? 1660, 0.42, -0.72),
            right: this.createFlipper(v, 'right', rightFlip?.x ?? width - 270, rightFlip?.y ?? 1660, -0.42, 0.72)
        };

        // One-way plunger gate: allow the ball to leave left, block re-entry.
        this.world.on('pre-solve', (contact) => {
            const a = contact.getFixtureA().getBody();
            const b = contact.getFixtureB().getBody();
            const ballBody = a.getUserData() === 'BALL' ? a : b.getUserData() === 'BALL' ? b : undefined;
            const other = ballBody === a ? b : ballBody === b ? a : undefined;
            const tag = String(other?.getUserData() ?? '');
            if (!ballBody || !tag.startsWith('GATE:')) return;
            if (ballBody.getLinearVelocity().x < 0) contact.setEnabled(false);
        });

        this.world.on('begin-contact', (contact) => {
            const a = contact.getFixtureA().getBody();
            const b = contact.getFixtureB().getBody();
            const ballBody = a.getUserData() === 'BALL' ? a : b.getUserData() === 'BALL' ? b : undefined;
            const other = ballBody === a ? b : ballBody === b ? a : undefined;
            const tag = other?.getUserData() as string | undefined;
            if (!ballBody || !tag || tag === 'FLIPPER') return;

            const now = performance.now();
            const kickKey = `${tag}:${this.balls.indexOf(ballBody)}`;
            if ((this.lastKickAt.get(kickKey) ?? 0) + 75 > now) return;
            this.lastKickAt.set(kickKey, now);

            if (tag.startsWith('SENSOR:')) {
                const parts = tag.split(':');
                const role = parts[1];
                const linkId = parts[2];
                if (role === 'entrance') this.events.push({ type: 'LANE_ENTER', id: linkId });
                else if (role === 'exit') this.events.push({ type: 'LANE_EXIT', id: linkId });
                else this.events.push({ type: 'LANE_HIT', id: linkId });
                return;
            }

            const impulse = ballBody.getPosition().clone().sub(other!.getPosition());
            if (!impulse.lengthSquared()) return;
            impulse.normalize();

            if (tag.startsWith('BUMPER:')) {
                this.events.push({ type: 'BUMPER_HIT', index: Number(tag.split(':')[1]) });
                ballBody.applyLinearImpulse(impulse.mul(7.2), ballBody.getWorldCenter(), true);
            } else if (tag.startsWith('SLING:')) {
                this.events.push({ type: 'SLINGSHOT_HIT', id: tag.split(':')[1] });
                ballBody.applyLinearImpulse(impulse.mul(6.4), ballBody.getWorldCenter(), true);
            } else if (tag.startsWith('TARGET:')) {
                this.events.push({ type: 'TARGET_HIT', id: tag.split(':')[1] });
                ballBody.applyLinearImpulse(impulse.mul(3.2), ballBody.getWorldCenter(), true);
            } else if (tag.startsWith('POST:')) {
                this.events.push({ type: 'POST_HIT', id: tag.split(':')[1] });
                ballBody.applyLinearImpulse(impulse.mul(2.2), ballBody.getWorldCenter(), true);
            } else if (tag.startsWith('LANE:')) {
                const laneId = tag.split(':')[1];
                this.events.push({ type: 'LANE_HIT', id: laneId });
            } else if (tag.startsWith('SKILL:') && this.skillShotArmed && !this.skillShotConsumed) {
                this.skillShotConsumed = true;
                this.skillShotArmed = false;
                this.events.push({ type: 'SKILL_SHOT', id: tag.split(':')[1] });
                ballBody.applyLinearImpulse(impulse.mul(4.6), ballBody.getWorldCenter(), true);
            }
            // WALL:* contacts are silent structural rails — no event spam.
        });
    }

    private createBallBody(x: number, y: number, active: boolean) {
        const body = this.world.createDynamicBody({
            position: planck.Vec2(x / ProcurementPlanckPhysics.scale, y / ProcurementPlanckPhysics.scale),
            bullet: true,
            linearDamping: 0,
            angularDamping: 0.4,
            userData: 'BALL'
        });
        body.createFixture(planck.Circle(PINBALL_SIZING.ballCircleMeters), {
            density: 1.0, restitution: 0.55, friction: 0.01
        });
        body.setActive(active);
        return body;
    }

    private createFlipper(v: (x: number, y: number) => planck.Vec2, side: 'left' | 'right', x: number, y: number, rest: number, active: number) {
        const body = this.world.createKinematicBody({ position: v(x, y), angle: rest, userData: 'FLIPPER' });
        const halfLength = PINBALL_SIZING.flipperHalfLengthMeters;
        const pivotOffset = (PINBALL_SIZING.flipperTipOffsetPx - 20) / ProcurementPlanckPhysics.scale;
        const halfH = PINBALL_SIZING.flipperHeightMeters;
        body.createFixture(
            planck.Box(halfLength, halfH, v(side === 'left' ? pivotOffset : -pivotOffset, 0)),
            { restitution: 0.86, friction: 0.02 }
        );
        const tip = PINBALL_SIZING.flipperTipOffsetPx;
        body.createFixture(
            planck.Circle(v(side === 'left' ? tip : -tip, 0), halfH * 1.05),
            { restitution: 0.9, friction: 0.02 }
        );
        return { body, rest, active, target: rest };
    }

    step(deltaMs: number) {
        this.accumulator += Math.min(deltaMs, 100) / 1000;
        while (this.accumulator >= 1 / 60) {
            this.updateFlipperMotors();
            this.world.step(1 / 60, 10, 4);
            this.accumulator -= 1 / 60;
        }
        if (this.ballState !== 'playing') return;

        let anyActive = false;
        this.balls.forEach((ball) => {
            if (!ball.isActive()) return;
            anyActive = true;
            const velocity = ball.getLinearVelocity();
            if (velocity.length() > 36) ball.setLinearVelocity(velocity.mul(36 / velocity.length()));
            const position = ball.getPosition();
            const px = position.x * ProcurementPlanckPhysics.scale;
            const py = position.y * ProcurementPlanckPhysics.scale;
            if (py > PLAYFIELD_LAYOUT.bottom - 20 || px < 40 || px > this.tableWidth - 15) {
                ball.setActive(false);
            }
        });

        // Failed plunge: ball fell back / jammed in the tube — park for another shot.
        if (anyActive && this.getActiveBallCount() === 1 && this.tryParkFailedShooterLaunch()) {
            return;
        }

        // Global unstick: motionless ball anywhere for ~0.75s gets a downward nudge,
        // or parks if it's still in the shooter column.
        if (anyActive && this.getActiveBallCount() === 1) {
            this.boostSlowLaneBalls();
            if (this.tryUnstickIdleBall()) return;
        }

        if (!anyActive || this.balls.every((ball) => !ball.isActive())) {
            this.ballState = 'drained';
            this.events.push({ type: 'BALL_DRAINED' });
        }
    }

    /** True when the only ball is idling back inside the plunger channel. */
    private tryParkFailedShooterLaunch(): boolean {
        const ball = this.balls.find((b) => b.isActive());
        if (!ball) return false;
        const p = ball.getPosition();
        const px = p.x * ProcurementPlanckPhysics.scale;
        const py = p.y * ProcurementPlanckPhysics.scale;
        const vel = ball.getLinearVelocity();
        const speed = vel.length();
        const inTube =
            px >= SHOOTER_LANE.artInnerX - 4 &&
            px <= SHOOTER_LANE.artOuterX + 4;
        // Anywhere below the exit hood inside the tube (not only the launch cup).
        const inShooterColumn = inTube && py >= PLAYFIELD_LAYOUT.originY + SHOOTER_LANE.artExitY + 20;
        // Falling back OR completely jammed (speed ~0).
        const settling = speed < 14 && (vel.y > 0.4 || speed < 1.2);
        if (!(inShooterColumn && settling)) {
            this.shooterReturnFrames = 0;
            return false;
        }
        this.shooterReturnFrames += 1;
        if (this.shooterReturnFrames < 14) return false;
        this.parkInShooter();
        this.events.push({ type: 'SHOOTER_RETURN' });
        return true;
    }

    /** Nudge or recover a ball that has wedged motionless on the playfield. */
    private tryUnstickIdleBall(): boolean {
        const ball = this.balls.find((b) => b.isActive());
        if (!ball || this.ballState !== 'playing') {
            this.idleStuckFrames = 0;
            return false;
        }
        const p = ball.getPosition();
        const px = p.x * ProcurementPlanckPhysics.scale;
        const py = p.y * ProcurementPlanckPhysics.scale;
        const vel = ball.getLinearVelocity();
        const moved = Math.hypot(px - this.lastBallPx, py - this.lastBallPy);
        this.lastBallPx = px;
        this.lastBallPy = py;
        // Position-based idle catches "vibrating in a pocket" as well as true rest.
        if (moved >= 2.5 && vel.length() >= 1.2) {
            this.idleStuckFrames = 0;
            return false;
        }
        this.idleStuckFrames += 1;
        if (this.idleStuckFrames < 35) return false;

        const inTube =
            px >= SHOOTER_LANE.artInnerX - 4 &&
            px <= SHOOTER_LANE.artOuterX + 4;
        if (inTube) {
            this.parkInShooter();
            this.events.push({ type: 'SHOOTER_RETURN' });
            return true;
        }

        this.idleStuckFrames = 0;
        const towardCenter = px < 540 ? 3.4 : -3.4;
        ball.setLinearVelocity(planck.Vec2(towardCenter * 0.4, Math.max(8, vel.y + 6)));
        ball.applyLinearImpulse(planck.Vec2(towardCenter, 8), ball.getWorldCenter(), true);
        ball.setAwake(true);
        return false;
    }

    /**
     * If the ball is crawling between dual slide rails, shove it downhill
     * along the nearest channel so gravity can take over.
     */
    private boostSlowLaneBalls() {
        const ball = this.balls.find((b) => b.isActive());
        if (!ball) return;
        const vel = ball.getLinearVelocity();
        if (vel.length() >= 5.5) return;
        const p = ball.getPosition();
        const px = p.x * ProcurementPlanckPhysics.scale;
        const py = p.y * ProcurementPlanckPhysics.scale;
        let best: { dist: number; tx: number; ty: number } | null = null;
        for (const entry of this.table) {
            if (entry.kind !== 'slide' || !entry.points || entry.points.length < 2) continue;
            for (let i = 0; i < entry.points.length - 1; i++) {
                const a = entry.points[i];
                const bpt = entry.points[i + 1];
                const dx = bpt[0] - a[0];
                const dy = bpt[1] - a[1];
                const len2 = dx * dx + dy * dy || 1;
                let t = ((px - a[0]) * dx + (py - a[1]) * dy) / len2;
                t = Math.max(0, Math.min(1, t));
                const cx = a[0] + dx * t;
                const cy = a[1] + dy * t;
                const dist = Math.hypot(px - cx, py - cy);
                if (dist > 80) continue;
                const len = Math.sqrt(len2);
                let tx = dx / len;
                let ty = dy / len;
                if (ty < 0) {
                    tx = -tx;
                    ty = -ty;
                }
                if (!best || dist < best.dist) best = { dist, tx, ty };
            }
        }
        if (!best) return;
        const ix = best.tx * 2.6;
        const iy = Math.max(4.0, best.ty * 4.0);
        ball.applyLinearImpulse(planck.Vec2(ix, iy), ball.getWorldCenter(), true);
        ball.setAwake(true);
    }

    /** Snap the primary ball back to the plunger rest pose (ready to fire). */
    parkInShooter() {
        const ball = this.balls[0];
        if (!ball) return;
        ball.setActive(false);
        ball.setTransform(
            planck.Vec2(SHOOTER_LANE.readyX / ProcurementPlanckPhysics.scale, SHOOTER_LANE.readyY / ProcurementPlanckPhysics.scale),
            0
        );
        ball.setLinearVelocity(planck.Vec2(0, 0));
        ball.setAngularVelocity(0);
        this.balls.forEach((b, i) => { if (i > 0) b.setActive(false); });
        this.ballState = 'ready';
        this.skillShotArmed = false;
        this.skillShotConsumed = false;
        this.shooterReturnFrames = 0;
        this.idleStuckFrames = 0;
    }

    private updateFlipperMotors() {
        (Object.keys(this.flippers) as Array<'left' | 'right'>).forEach((side) => {
            const flipper = this.flippers[side];
            const current = flipper.body.getAngle();
            const error = Math.atan2(Math.sin(flipper.target - current), Math.cos(flipper.target - current));
            if (Math.abs(error) < 0.006) {
                flipper.body.setTransform(flipper.body.getPosition(), flipper.target);
                flipper.body.setAngularVelocity(0);
                return;
            }
            // Snappier hold-to-flip response while staying controllable per-frame.
            const angularVelocity = Math.max(-9.5, Math.min(9.5, error * 32));
            flipper.body.setAngularVelocity(angularVelocity);
            flipper.body.setTransform(flipper.body.getPosition(), current + angularVelocity / 60);
        });
    }

    setFlipper(side: 'left' | 'right', active: boolean) {
        this.flippers[side].target = active ? this.flippers[side].active : this.flippers[side].rest;
    }

    getBall() {
        const active = this.balls.find((ball) => ball.isActive()) ?? this.balls[0];
        const p = active.getPosition();
        return { x: p.x * ProcurementPlanckPhysics.scale, y: p.y * ProcurementPlanckPhysics.scale };
    }

    getBalls() {
        return this.balls
            .filter((ball) => ball.isActive())
            .map((ball) => {
                const p = ball.getPosition();
                return { x: p.x * ProcurementPlanckPhysics.scale, y: p.y * ProcurementPlanckPhysics.scale };
            });
    }

    getActiveBallCount() {
        return this.balls.filter((ball) => ball.isActive()).length;
    }

    getBallVelocity() {
        const active = this.balls.find((ball) => ball.isActive()) ?? this.balls[0];
        const velocity = active.getLinearVelocity();
        return { x: velocity.x, y: velocity.y };
    }

    getFlipperAngles() {
        return { left: this.flippers.left.body.getAngle(), right: this.flippers.right.body.getAngle() };
    }

    getBallState() {
        return this.ballState;
    }

    isSkillArmed() {
        return this.skillShotArmed && !this.skillShotConsumed;
    }

    relaunch(x: number, y: number, power = 18, aim = 0) {
        if (this.ballState === 'playing') return false;
        this.balls.forEach((ball, index) => {
            if (index === 0) {
                ball.setActive(true);
                ball.setTransform(planck.Vec2(x / ProcurementPlanckPhysics.scale, y / ProcurementPlanckPhysics.scale), 0);
                // Keep shots nearly vertical. Aim above ~0.06 scrapes the shooter
                // divider and never clears; the exit hood is what feeds left into play.
                const aimClamped = Math.max(0, Math.min(0.06, aim));
                const horizontalSpeed = aimClamped * 4.2;
                ball.setLinearVelocity(planck.Vec2(-horizontalSpeed, -power * 1.2));
                ball.setAngularVelocity(0);
                ball.setAwake(true);
            } else {
                ball.setActive(false);
            }
        });
        this.ballState = 'playing';
        this.skillShotArmed = true;
        this.skillShotConsumed = false;
        this.shooterReturnFrames = 0;
        this.idleStuckFrames = 0;
        this.events = [];
        return true;
    }

    spawnExtraBalls(count: number) {
        const primary = this.getBall();
        let spawned = 0;
        for (let i = 0; i < count; i++) {
            if (this.getActiveBallCount() >= MAX_BALLS) break;
            let body = this.balls.find((ball) => !ball.isActive());
            if (!body) {
                body = this.createBallBody(primary.x, primary.y, true);
                this.balls.push(body);
            }
            const offsetX = (i % 2 === 0 ? -1 : 1) * (40 + i * 18);
            body.setActive(true);
            body.setTransform(
                planck.Vec2((primary.x + offsetX) / ProcurementPlanckPhysics.scale, (primary.y - 30) / ProcurementPlanckPhysics.scale),
                0
            );
            body.setLinearVelocity(planck.Vec2((i % 2 === 0 ? -1 : 1) * (6 + i), -16 - i * 2));
            body.setAwake(true);
            spawned++;
        }
        return spawned;
    }

    consumeEvents() {
        const events = this.events;
        this.events = [];
        return events;
    }
}
