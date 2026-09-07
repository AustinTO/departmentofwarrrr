import * as planck from 'planck-js';
import type { ProcurementBumper, TableObject } from './ProcurementTableDefinition';
import { PINBALL_BOARDS, PINBALL_SIZING, PLAYFIELD_LAYOUT, SHOOTER_LANE, polylineSegments, type PinballBoardId } from './PinballBoards';
import { kitTunnels } from './pinballKit';

export type ProcurementBallState = 'ready' | 'playing' | 'drained';
export type ProcurementPhysicsEvent = {
    type: 'BUMPER_HIT' | 'TARGET_HIT' | 'SLINGSHOT_HIT' | 'BALL_DRAINED' | 'SKILL_SHOT' | 'POST_HIT' | 'LANE_HIT' | 'LANE_ENTER' | 'LANE_EXIT' | 'SHOOTER_RETURN' | 'TUNNEL_ENTER' | 'TUNNEL_EXIT';
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
    /** Ball hidden while warping through a tunnel. */
    private tunnelTransit: { linkId: string; framesLeft: number } | null = null;
    /** Deferred tunnel start — never deactivate bodies inside contact callbacks. */
    private pendingTunnel: { ball: planck.Body; linkId: string } | null = null;
    /** Riding the elevated cross-wire (otherwise those rails are pass-under). */
    private ballOnOverpass = false;
    private overpassMountX = 0;
    /** Frames remaining to keep pushing uphill while recovering a ramp climb. */
    private laneClimbLockFrames = 0;
    /** Throttle lane boost so impulses don't chatter every physics tick. */
    private laneBoostCooldown = 0;
    /** Defer ramp-center assist until after the contact callback finishes. */
    private pendingRampAssist = false;
    /** Pop the ball out of a ramp spout after exit contact (never mutate in the callback). */
    private pendingRampEject: { ball: planck.Body; linkId: string } | null = null;
    /** Frames the cross-wire mouths will accept a mount after a ramp entry. */
    private crossWireArmedFrames = 0;
    private readonly tunnelLinks: Map<string, { enter: TableObject; exit: TableObject }>;
    private readonly overpassBounds: { minY: number; maxY: number; minX: number; maxX: number; midY: number } | null;
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
        this.tunnelLinks = new Map(kitTunnels());
        // Also discover tunnel pairs from table ids if kit map empty for overrides.
        this.table.forEach((e) => {
            if (e.kind !== 'sensor' || !e.linkId) return;
            if (!e.id.startsWith('tunnel-')) return;
            const pair = this.tunnelLinks.get(e.linkId) ?? { enter: e, exit: e };
            if (e.sensor === 'entrance' || e.id.includes('-enter')) pair.enter = e;
            if (e.sensor === 'exit' || e.id.includes('-exit')) pair.exit = e;
            this.tunnelLinks.set(e.linkId, pair);
        });
        const overpassPts = this.table
            .filter((e) => e.layer === 'overpass' && e.points)
            .flatMap((e) => e.points!);
        if (overpassPts.length) {
            const xs = overpassPts.map(([x]) => x);
            const ys = overpassPts.map(([, y]) => y);
            this.overpassBounds = {
                minX: Math.min(...xs) - 20,
                maxX: Math.max(...xs) + 20,
                minY: Math.min(...ys) - 10,
                maxY: Math.max(...ys) + 10,
                midY: (Math.min(...ys) + Math.max(...ys)) / 2
            };
        } else {
            this.overpassBounds = null;
        }
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
            const isOverpass = entry.layer === 'overpass';
            // Slides must be ice-slick — any friction sandwiches the ball between dual rails.
            const restitution = isSlide ? 0.15 : 0.75;
            const friction = isSlide ? 0 : 0.02;
            const halfThick = isSlide ? PINBALL_SIZING.slideHalfThicknessPx : PINBALL_SIZING.railHalfThicknessPx;
            const base = entry.id === 'shooter-oneway'
                ? `GATE:${entry.id}`
                : isSlide ? `LANE:${entry.id}` : `WALL:${entry.id}`;
            const prefix = isOverpass ? `OVERPASS:${base}` : base;
            const pts = entry.points;
            // Caps only on cabinet walls — slide vertex caps were pinching channels shut.
            if (!isSlide) {
                pts.forEach(([x, y]) => {
                    const cap = this.world.createBody({ position: v(x, y), userData: prefix });
                    cap.createFixture(planck.Circle(halfThick / scale), { restitution, friction });
                });
                polylineSegments(pts).forEach(([a, b], seg) => {
                    addRailSegment(a, b, restitution, friction, halfThick, `${prefix}:${seg}`);
                });
                return;
            }
            // Continuous edge chain. Box2D chains are one-sided — mirror the winding so
            // the ball cannot tunnel in from the playfield mid-ramp (only mouths are open).
            const body = this.world.createBody({ userData: prefix });
            const verts = pts.map(([x, y]) => planck.Vec2(x / scale, y / scale));
            if (verts.length >= 2) {
                body.createFixture(planck.Chain(verts, false), { restitution, friction });
                body.createFixture(planck.Chain(verts.slice().reverse(), false), { restitution, friction });
            }
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

        // Entrance / exit / lane sensors — circular holes when radius is set.
        this.table.filter((e) => e.kind === 'sensor').forEach((sensor) => {
            const role = sensor.sensor ?? 'lane';
            const link = sensor.linkId ?? sensor.id;
            const tag = `SENSOR:${role}:${link}:${sensor.id}`;
            const body = this.world.createBody({ position: v(sensor.x, sensor.y), userData: tag });
            if (sensor.radius && sensor.radius > 0) {
                body.createFixture(planck.Circle(sensor.radius / scale), { isSensor: true });
            } else {
                const hw = ((sensor.width ?? 72) / 2) / scale;
                const hh = ((sensor.height ?? 34) / 2) / scale;
                body.createFixture(planck.Box(hw, hh, planck.Vec2(0, 0), sensor.angle ?? 0), {
                    isSensor: true
                });
            }
        });

        const readyY = SHOOTER_LANE.readyY;
        this.balls.push(this.createBallBody(SHOOTER_LANE.readyX, readyY, false));
        const leftFlip = this.table.find((e) => e.id === 'left-flipper');
        const rightFlip = this.table.find((e) => e.id === 'right-flipper');
        this.flippers = {
            left: this.createFlipper(v, 'left', leftFlip?.x ?? 270, leftFlip?.y ?? 1660, 0.42, -0.72),
            right: this.createFlipper(v, 'right', rightFlip?.x ?? width - 270, rightFlip?.y ?? 1660, -0.42, 0.72)
        };

        // One-way plunger gate + elevated overpass filtering.
        this.world.on('pre-solve', (contact) => {
            const a = contact.getFixtureA().getBody();
            const b = contact.getFixtureB().getBody();
            const ballBody = a.getUserData() === 'BALL' ? a : b.getUserData() === 'BALL' ? b : undefined;
            const other = ballBody === a ? b : ballBody === b ? a : undefined;
            const tag = String(other?.getUserData() ?? '');
            if (!ballBody || !tag) return;
            if (tag.startsWith('GATE:')) {
                if (ballBody.getLinearVelocity().x < 0) contact.setEnabled(false);
                return;
            }
            // Playfield balls pass under elevated wire rails.
            if (tag.startsWith('OVERPASS:') && !this.ballOnOverpass) {
                contact.setEnabled(false);
                return;
            }
            // While riding the wire, ignore ground hardware under the span.
            if (this.ballOnOverpass && (
                tag.startsWith('BUMPER:')
                || tag.startsWith('POST:')
                || tag.startsWith('TARGET:')
                || tag.startsWith('SLING:')
                || tag.startsWith('SKILL:')
            )) {
                contact.setEnabled(false);
            }
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
                if (linkId === 'cross-wire') {
                    this.handleCrossWireSensor(ballBody, role);
                    return;
                }
                if (role === 'entrance' && this.tunnelLinks.has(linkId) && linkId !== 'shooter') {
                    const isTunnel = this.table.some(
                        (e) => e.linkId === linkId && e.id.startsWith('tunnel-')
                    );
                    if (isTunnel) {
                        if (!this.tunnelTransit && !this.pendingTunnel) {
                            this.pendingTunnel = { ball: ballBody, linkId };
                        }
                        return;
                    }
                }
                if (role === 'entrance') {
                    // Riding a side ramp briefly arms the cross-wire overpass.
                    if (linkId === 'left-ramp' || linkId === 'right-ramp') {
                        this.crossWireArmedFrames = 150;
                        this.laneClimbLockFrames = Math.max(this.laneClimbLockFrames, 90);
                        this.pendingRampAssist = true;
                        // Arm event once per climb — re-entry from climb nudges was flashing the camera.
                        const armKey = `ARM:${linkId}`;
                        if ((this.lastKickAt.get(armKey) ?? 0) + 900 < now) {
                            this.lastKickAt.set(armKey, now);
                            this.events.push({ type: 'LANE_ENTER', id: 'cross-wire-armed' });
                        }
                    }
                    const enterKey = `ENTER:${linkId}`;
                    if ((this.lastKickAt.get(enterKey) ?? 0) + 500 < now) {
                        this.lastKickAt.set(enterKey, now);
                        this.events.push({ type: 'LANE_ENTER', id: linkId });
                    }
                } else if (role === 'exit') {
                    // Right ramp is bidirectional — dropping into the top mouth counts as entry.
                    if (linkId === 'right-ramp' && ballBody.getLinearVelocity().y > 1.2) {
                        this.crossWireArmedFrames = Math.max(this.crossWireArmedFrames, 150);
                        const enterKey = `ENTER:${linkId}:top`;
                        if ((this.lastKickAt.get(enterKey) ?? 0) + 500 < now) {
                            this.lastKickAt.set(enterKey, now);
                            this.events.push({ type: 'LANE_ENTER', id: linkId });
                            this.events.push({ type: 'LANE_ENTER', id: 'cross-wire-armed' });
                        }
                        return;
                    }
                    // Finished a climb up the right ramp — pop out the top spout onto the board.
                    if (linkId === 'right-ramp' && !this.pendingRampEject) {
                        this.pendingRampEject = { ball: ballBody, linkId };
                    }
                    const exitKey = `EXIT:${linkId}`;
                    if ((this.lastKickAt.get(exitKey) ?? 0) + 500 < now) {
                        this.lastKickAt.set(exitKey, now);
                        this.events.push({ type: 'LANE_EXIT', id: linkId });
                    }
                } else this.events.push({ type: 'LANE_HIT', id: linkId });
                return;
            }

            if (tag.startsWith('OVERPASS:')) return;

            const impulse = ballBody.getPosition().clone().sub(other!.getPosition());
            if (!impulse.lengthSquared()) return;
            impulse.normalize();

            if (tag.startsWith('BUMPER:')) {
                // Always kick so stuck balls don't glue; throttle scoring/VFX separately.
                ballBody.applyLinearImpulse(impulse.mul(7.8), ballBody.getWorldCenter(), true);
                const bumperKey = `BUMPER_ONLY:${tag.split(':')[1]}:${this.balls.indexOf(ballBody)}`;
                if ((this.lastKickAt.get(bumperKey) ?? 0) + 160 > now) return;
                this.lastKickAt.set(bumperKey, now);
                this.events.push({ type: 'BUMPER_HIT', index: Number(tag.split(':')[1]) });
            } else if (tag.startsWith('SLING:')) {
                this.events.push({ type: 'SLINGSHOT_HIT', id: tag.split(':')[1] });
                // Rubber-band kick — mostly up-table with a mild center shove.
                const side = tag.includes('left') ? 1 : -1;
                ballBody.applyLinearImpulse(
                    planck.Vec2(side * 2.8, -7.2),
                    ballBody.getWorldCenter(),
                    true
                );
            } else if (tag.startsWith('TARGET:')) {
                this.events.push({ type: 'TARGET_HIT', id: tag.split(':')[1] });
                ballBody.applyLinearImpulse(impulse.mul(3.2), ballBody.getWorldCenter(), true);
            } else if (tag.startsWith('POST:')) {
                this.events.push({ type: 'POST_HIT', id: tag.split(':')[1] });
                ballBody.applyLinearImpulse(impulse.mul(2.2), ballBody.getWorldCenter(), true);
            } else if (tag.startsWith('LANE:')) {
                // Slide rail scrapes are silent — emitting LANE_HIT here strobes the board
                // whenever climb-assist recenters the ball against the channel walls.
            } else if (tag.startsWith('SKILL:') && this.skillShotArmed && !this.skillShotConsumed) {
                this.skillShotConsumed = true;
                this.skillShotArmed = false;
                this.events.push({ type: 'SKILL_SHOT', id: tag.split(':')[1] });
                ballBody.applyLinearImpulse(impulse.mul(4.6), ballBody.getWorldCenter(), true);
            }
            // WALL:* contacts are silent structural rails — no event spam.
        });
    }

    /** Mount/dismount the elevated cross-wire at either mouth. */
    private handleCrossWireSensor(ball: planck.Body, role: string) {
        if (!this.ballOnOverpass) {
            // Occasional ride: only while armed from a recent ramp entry.
            if (this.crossWireArmedFrames <= 0) {
                this.events.push({ type: 'LANE_HIT', id: 'cross-wire-cold' });
                return;
            }
            const vel = ball.getLinearVelocity();
            const up = -vel.y;
            const lateral = Math.abs(vel.x);
            // Steep committed climb continues up the ramp; a graze / slower / sideways
            // pass at the in-ramp mouth catches the wire (the intended "chance").
            const steepClimb = up > 9 && lateral < up * 0.4;
            if (steepClimb) {
                this.events.push({ type: 'LANE_HIT', id: 'cross-wire-bypass' });
                return;
            }
            this.crossWireArmedFrames = 0;
            this.mountOverpass(ball, role === 'exit' ? -1 : 1);
            this.events.push({ type: 'LANE_ENTER', id: 'cross-wire' });
            return;
        }
        // Already riding — dismount when we reach a mouth after traveling.
        const px = ball.getPosition().x * ProcurementPlanckPhysics.scale;
        if (Math.abs(px - this.overpassMountX) > 280) {
            this.dismountOverpass(ball);
            this.events.push({ type: 'LANE_EXIT', id: 'cross-wire' });
        }
    }

    private mountOverpass(ball: planck.Body, dir: number) {
        if (!this.overpassBounds) return;
        const scale = ProcurementPlanckPhysics.scale;
        const p = ball.getPosition();
        const px = p.x * scale;
        this.ballOnOverpass = true;
        this.overpassMountX = px;
        ball.setTransform(planck.Vec2(px / scale, this.overpassBounds.midY / scale), 0);
        const speed = Math.max(10, Math.abs(ball.getLinearVelocity().x) + 6);
        ball.setLinearVelocity(planck.Vec2(dir * speed, 0));
        ball.setAwake(true);
    }

    private dismountOverpass(ball: planck.Body) {
        this.ballOnOverpass = false;
        const vel = ball.getLinearVelocity();
        // Drop back onto the playfield with a mild downward dump.
        ball.setLinearVelocity(planck.Vec2(vel.x * 0.7, Math.max(6, vel.y + 4)));
    }

    private tickOverpass() {
        if (!this.ballOnOverpass || !this.overpassBounds) return;
        const ball = this.balls.find((b) => b.isActive());
        if (!ball) {
            this.ballOnOverpass = false;
            return;
        }
        const p = ball.getPosition();
        const px = p.x * ProcurementPlanckPhysics.scale;
        const py = p.y * ProcurementPlanckPhysics.scale;
        const b = this.overpassBounds;
        if (py < b.minY - 40 || py > b.maxY + 40 || px < b.minX - 40 || px > b.maxX + 40) {
            this.dismountOverpass(ball);
            this.events.push({ type: 'LANE_EXIT', id: 'cross-wire' });
            return;
        }
        // Keep the ride horizontal and in-channel.
        const vel = ball.getLinearVelocity();
        if (Math.abs(vel.x) < 6) {
            const dir = px >= this.overpassMountX ? 1 : -1;
            ball.setLinearVelocity(planck.Vec2(dir * 9, vel.y * 0.2));
        } else if (Math.abs(vel.y) > 4) {
            ball.setLinearVelocity(planck.Vec2(vel.x, vel.y * 0.35));
        }
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
            if (this.pendingTunnel) {
                const pending = this.pendingTunnel;
                this.pendingTunnel = null;
                this.beginTunnel(pending.ball, pending.linkId);
            }
            this.tickTunnel();
            this.tickOverpass();
            if (this.pendingRampAssist) {
                this.pendingRampAssist = false;
                const ball = this.balls.find((b) => b.isActive());
                if (ball) {
                    const p = ball.getPosition();
                    this.nudgeBallAlongNearestRamp(
                        ball,
                        p.x * ProcurementPlanckPhysics.scale,
                        p.y * ProcurementPlanckPhysics.scale,
                        true
                    );
                }
            }
            if (this.pendingRampEject) {
                const pending = this.pendingRampEject;
                this.pendingRampEject = null;
                this.ejectRampSpout(pending.ball, pending.linkId);
            }
            if (this.crossWireArmedFrames > 0) this.crossWireArmedFrames -= 1;
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

        if (this.tunnelTransit) anyActive = true;

        // Failed plunge: ball fell back / jammed in the tube — park for another shot.
        if (anyActive && this.getActiveBallCount() === 1 && !this.tunnelTransit && this.tryParkFailedShooterLaunch()) {
            return;
        }

        // Global unstick: motionless ball anywhere for ~0.75s gets a downward nudge,
        // or parks if it's still in the shooter column.
        if (anyActive && this.getActiveBallCount() === 1 && !this.tunnelTransit) {
            this.tryEjectNearRampExit();
            this.boostSlowLaneBalls();
            if (this.tryUnstickIdleBall()) return;
        }

        if (!anyActive || (this.balls.every((ball) => !ball.isActive()) && !this.tunnelTransit)) {
            this.ballState = 'drained';
            this.events.push({ type: 'BALL_DRAINED' });
        }
    }

    private beginTunnel(ball: planck.Body, linkId: string) {
        if (this.tunnelTransit) return;
        ball.setActive(false);
        ball.setLinearVelocity(planck.Vec2(0, 0));
        this.tunnelTransit = { linkId, framesLeft: 28 };
        this.events.push({ type: 'TUNNEL_ENTER', id: linkId });
    }

    private tickTunnel() {
        if (!this.tunnelTransit) return;
        this.tunnelTransit.framesLeft -= 1;
        if (this.tunnelTransit.framesLeft > 0) return;
        const linkId = this.tunnelTransit.linkId;
        const pair = this.tunnelLinks.get(linkId);
        this.tunnelTransit = null;
        const ball = this.balls[0];
        if (!ball || !pair?.exit) return;
        const scale = ProcurementPlanckPhysics.scale;
        ball.setTransform(planck.Vec2(pair.exit.x / scale, pair.exit.y / scale), 0);
        // Kick toward the nearer flipper so the dump isn't a free drain through the tip gap.
        const towardLeft = pair.exit.x <= this.tableWidth / 2;
        ball.setLinearVelocity(planck.Vec2(towardLeft ? -5.5 : 5.5, 10));
        ball.setActive(true);
        ball.setAwake(true);
        this.events.push({ type: 'TUNNEL_EXIT', id: linkId });
    }

    isInTunnel() {
        return Boolean(this.tunnelTransit);
    }

    isCrossWireArmed() {
        return this.crossWireArmedFrames > 0 && !this.ballOnOverpass;
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
        // If wedged in a dual ramp, recover up the channel — never yank downhill.
        if (this.nudgeBallAlongNearestRamp(ball, px, py, true)) {
            return false;
        }

        const towardCenter = px < 540 ? 3.4 : -3.4;
        ball.setLinearVelocity(planck.Vec2(towardCenter * 0.4, Math.max(8, vel.y + 6)));
        ball.applyLinearImpulse(planck.Vec2(towardCenter, 8), ball.getWorldCenter(), true);
        ball.setAwake(true);
        return false;
    }

    /**
     * Blast the ball out of a ramp exit spout onto the upper playfield.
     * Clears climb-assist so we don't immediately suck it back into the channel.
     */
    private ejectRampSpout(ball: planck.Body, linkId: string) {
        const exit = this.table.find((e) => e.id === `${linkId}-exit`);
        if (!exit) return;
        const scale = ProcurementPlanckPhysics.scale;
        const towardCenter = exit.x >= this.tableWidth / 2 ? -1 : 1;
        // Place just past the mouth into open air at the top of the board.
        const outX = exit.x + towardCenter * 70;
        const outY = Math.max(320, exit.y - 70);
        ball.setTransform(planck.Vec2(outX / scale, outY / scale), 0);
        ball.setLinearVelocity(planck.Vec2(towardCenter * 11, -16));
        ball.setAwake(true);
        this.laneClimbLockFrames = 0;
        this.laneBoostCooldown = 45;
        this.pendingRampAssist = false;
    }

    /** If the ball stalls near a free ramp spout (right ramp), pop it onto the board. */
    private tryEjectNearRampExit() {
        if (this.pendingRampEject) return;
        const ball = this.balls.find((b) => b.isActive());
        if (!ball || this.ballState !== 'playing') return;
        const exit = this.table.find((e) => e.id === 'right-ramp-exit');
        if (!exit) return;
        const p = ball.getPosition();
        const px = p.x * ProcurementPlanckPhysics.scale;
        const py = p.y * ProcurementPlanckPhysics.scale;
        const dist = Math.hypot(px - exit.x, py - exit.y);
        const vel = ball.getLinearVelocity();
        // Near the spout and either climbing or already climb-locked from the mouth.
        if (dist > 95) return;
        if (py > exit.y + 110) return;
        if (vel.y > 4 && this.laneClimbLockFrames <= 0) return;
        this.ejectRampSpout(ball, 'right-ramp');
        this.events.push({ type: 'LANE_EXIT', id: 'right-ramp' });
    }

    /**
     * Center the ball in a dual-edge ramp and push toward the exit (up the table).
     * Climb-lock prevents alternating up/down impulses (the stutter).
     */
    private nudgeBallAlongNearestRamp(
        ball: planck.Body,
        px: number,
        py: number,
        force = false
    ): boolean {
        const pairs = new Map<string, { outer?: TableObject; inner?: TableObject }>();
        for (const entry of this.table) {
            if (entry.kind !== 'slide' || !entry.points || entry.layer === 'overpass') continue;
            const link = entry.linkId ?? entry.id;
            if (!link.includes('ramp')) continue;
            if (!entry.id.endsWith('-outer') && !entry.id.endsWith('-inner')) continue;
            const pair = pairs.get(link) ?? {};
            if (entry.id.endsWith('-outer')) pair.outer = entry;
            if (entry.id.endsWith('-inner')) pair.inner = entry;
            pairs.set(link, pair);
        }

        let best: { dist: number; mx: number; my: number; tx: number; ty: number } | null = null;

        for (const pair of pairs.values()) {
            if (!pair.outer?.points || !pair.inner?.points) continue;
            const n = Math.min(pair.outer.points.length, pair.inner.points.length);
            for (let i = 0; i < n - 1; i++) {
                const ax = (pair.outer.points[i][0] + pair.inner.points[i][0]) / 2;
                const ay = (pair.outer.points[i][1] + pair.inner.points[i][1]) / 2;
                const bx = (pair.outer.points[i + 1][0] + pair.inner.points[i + 1][0]) / 2;
                const by = (pair.outer.points[i + 1][1] + pair.inner.points[i + 1][1]) / 2;
                const dx = bx - ax;
                const dy = by - ay;
                const len2 = dx * dx + dy * dy || 1;
                let t = ((px - ax) * dx + (py - ay) * dy) / len2;
                t = Math.max(0, Math.min(1, t));
                const cx = ax + dx * t;
                const cy = ay + dy * t;
                const dist = Math.hypot(px - cx, py - cy);
                // Only consider samples already inside the trough — outside playfield
                // balls must bounce off the rails, not get sucked in mid-ramp.
                if (dist > 40) continue;
                const len = Math.sqrt(len2);
                let tx = dx / len;
                let ty = dy / len;
                // Uphill = toward decreasing screen Y (ramp exit at top).
                if (ty > 0) {
                    tx = -tx;
                    ty = -ty;
                }
                // Skip flat segments — those are bridges, not climbs.
                if (ty > -0.35) continue;
                if (!best || dist < best.dist) best = { dist, mx: cx, my: cy, tx, ty };
            }
        }

        if (!best) return false;
        // Mouth assist may recenter from slightly outside; idle boost must stay inside.
        if (!force && best.dist > 36) return false;
        if (force && best.dist > 70) return false;

        const scale = ProcurementPlanckPhysics.scale;
        const pos = ball.getPosition();
        // Stronger recenter when pressed into a rail — weak mixes never leave the grind.
        const mix = force ? Math.min(0.55, 0.2 + best.dist / 120) : Math.min(0.28, 0.1 + best.dist / 160);
        ball.setTransform(
            planck.Vec2(pos.x * (1 - mix) + (best.mx / scale) * mix, pos.y * (1 - mix) + (best.my / scale) * mix),
            ball.getAngle()
        );
        const speed = force ? 15 : 12;
        const cur = ball.getLinearVelocity();
        // Prefer the uphill component; kill lateral scrape so we don't rail-grind forever.
        const upVx = best.tx * speed;
        const upVy = best.ty * speed;
        const blend = force ? 0.95 : 0.7;
        ball.setLinearVelocity(
            planck.Vec2(
                cur.x * (1 - blend) * 0.2 + upVx * blend,
                Math.min(cur.y * (1 - blend) + upVy * blend, upVy)
            )
        );
        ball.setAwake(true);
        this.laneClimbLockFrames = 55;
        return true;
    }

    /**
     * Keep slow balls climbing dual ramps — never shove them downhill.
     */
    private boostSlowLaneBalls() {
        const ball = this.balls.find((b) => b.isActive());
        if (!ball) return;
        if (this.laneBoostCooldown > 0) {
            this.laneBoostCooldown -= 1;
            return;
        }
        const vel = ball.getLinearVelocity();
        const p = ball.getPosition();
        const px = p.x * ProcurementPlanckPhysics.scale;
        const py = p.y * ProcurementPlanckPhysics.scale;

        if (vel.y < -1.0) this.laneClimbLockFrames = Math.max(this.laneClimbLockFrames, 45);
        else if (this.laneClimbLockFrames > 0) this.laneClimbLockFrames -= 1;

        // Riding down a ramp (e.g. right-ramp top entry) — don't force uphill.
        if (vel.y > 2 && this.laneClimbLockFrames <= 0) return;

        // Sideways scrape at full speed is still stuck — don't treat |v| alone as healthy climb.
        const climbingWell = vel.y < -5;
        if (climbingWell && this.laneClimbLockFrames <= 0) return;

        const helped = this.nudgeBallAlongNearestRamp(
            ball,
            px,
            py,
            this.laneClimbLockFrames > 0 || vel.length() < 3.5 || vel.y > -2
        );
        if (helped) this.laneBoostCooldown = 8;
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
        this.laneClimbLockFrames = 0;
        this.laneBoostCooldown = 0;
        this.pendingRampAssist = false;
        this.pendingRampEject = null;
        this.tunnelTransit = null;
        this.pendingTunnel = null;
        this.ballOnOverpass = false;
        this.crossWireArmedFrames = 0;
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
        const live = this.balls.filter((ball) => ball.isActive()).length;
        return live + (this.tunnelTransit ? 1 : 0);
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
        this.tunnelTransit = null;
        this.pendingTunnel = null;
        this.ballOnOverpass = false;
        this.crossWireArmedFrames = 0;
        this.laneClimbLockFrames = 0;
        this.laneBoostCooldown = 0;
        this.pendingRampAssist = false;
        this.pendingRampEject = null;
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
