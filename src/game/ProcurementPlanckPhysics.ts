import * as planck from 'planck-js';
import { PROCUREMENT_BUMPERS, PROCUREMENT_TABLE } from './ProcurementTableDefinition';

export type ProcurementBallState = 'ready' | 'playing' | 'drained';
export type ProcurementPhysicsEvent = { type: 'BUMPER_HIT' | 'TARGET_HIT' | 'SLINGSHOT_HIT' | 'BALL_DRAINED'; index?: number };

/** Planck-only simulation layer; Phaser owns all drawing and gameplay effects. */
export class ProcurementPlanckPhysics {
    static readonly scale = 48;
    private readonly world = new planck.World(planck.Vec2(0, 18));
    private accumulator = 0;
    private readonly ball: planck.Body;
    private readonly flippers: Record<'left' | 'right', { body: planck.Body; rest: number; active: number; target: number }>;
    private events: ProcurementPhysicsEvent[] = [];
    private lastKickAt = new Map<string, number>();
    private ballState: ProcurementBallState = 'ready';

    constructor(private readonly tableWidth: number, _height: number) {
        const width = tableWidth;
        const v = (x: number, y: number) => planck.Vec2(x / ProcurementPlanckPhysics.scale, y / ProcurementPlanckPhysics.scale);
        const wall = (a: [number, number], b: [number, number]) => this.world.createBody().createFixture(planck.Edge(v(...a), v(...b)), { restitution: 0.72, friction: 0.04 });
        PROCUREMENT_TABLE
            .filter((entry) => entry.kind === 'wall' && entry.points)
            .forEach((entry) => wall(entry.points![0], entry.points![1]));
        PROCUREMENT_BUMPERS.forEach(({ x, y, radius }, index) => {
            const bumper = this.world.createBody({ position: v(x, y), userData: `BUMPER:${index}` });
            bumper.createFixture(planck.Circle(radius / ProcurementPlanckPhysics.scale), { restitution: 1.1, friction: 0 });
        });
        // Slingshots are physical angled wedges with an explicit arcade kick.
        [[250, 1500, 1], [width - 250, 1500, -1]].forEach(([x, y, direction]) => {
            const sling = this.world.createBody({ position: v(x, y), userData: 'SLING' });
            sling.createFixture(planck.Box(1.15, 0.22, planck.Vec2(0, 0), direction * 0.58), { restitution: 1.05, friction: 0 });
        });
        // Posts make the lower table lively and protect the flipper lanes.
        [[155, 1320], [width - 280, 1320], [380, 1430], [width - 380, 1430]].forEach(([x, y]) => {
            const post = this.world.createBody({ position: v(x, y), userData: 'POST' });
            post.createFixture(planck.Circle(0.28), { restitution: 0.95, friction: 0 });
        });
        [[360, 820], [width - 360, 820], [330, 930], [width - 330, 930], [width / 2, 820], [360, 1160], [width - 360, 1160], [350, 1390], [width - 350, 1390]].forEach(([x, y]) => {
            const target = this.world.createBody({ position: v(x, y), userData: 'TARGET' });
            target.createFixture(planck.Box(0.7, 0.16), { restitution: 0.86, friction: 0 });
        });
        this.ball = this.world.createDynamicBody({ position: v(width - 173, 1365), bullet: true, linearDamping: 0.015, userData: 'BALL' });
        this.ball.createFixture(planck.Circle(0.4), { density: 1, restitution: 0.78, friction: 0.02 });
        this.ball.setActive(false);
        this.flippers = {
            left: this.createFlipper(v, 'left', 270, 1660, 0.42, -0.72),
            // The right blade is mirrored by its local fixture, so its body
            // uses the same screen-space angles as the rendered container.
            right: this.createFlipper(v, 'right', width - 270, 1660, -0.42, 0.72)
        };
        this.world.on('begin-contact', (contact) => {
            const a = contact.getFixtureA().getBody(); const b = contact.getFixtureB().getBody();
            const other = a.getUserData() === 'BALL' ? b : b.getUserData() === 'BALL' ? a : undefined;
            const tag = other?.getUserData() as string | undefined;
            if (!tag || tag === 'FLIPPER' || tag === 'POST') return;
            const now = performance.now();
            if ((this.lastKickAt.get(tag) ?? 0) + 90 > now) return;
            this.lastKickAt.set(tag, now);
            const impulse = this.ball.getPosition().clone().sub(other!.getPosition());
            if (!impulse.lengthSquared()) return;
            impulse.normalize();
            if (tag.startsWith('BUMPER:')) { this.events.push({ type: 'BUMPER_HIT', index: Number(tag.split(':')[1]) }); this.ball.applyLinearImpulse(impulse.mul(7.5), this.ball.getWorldCenter(), true); }
            if (tag === 'SLING') { this.events.push({ type: 'SLINGSHOT_HIT' }); this.ball.applyLinearImpulse(impulse.mul(5.6), this.ball.getWorldCenter(), true); }
            if (tag === 'TARGET') { this.events.push({ type: 'TARGET_HIT' }); this.ball.applyLinearImpulse(impulse.mul(2.8), this.ball.getWorldCenter(), true); }
        });
    }

    private createFlipper(v: (x: number, y: number) => planck.Vec2, side: 'left' | 'right', x: number, y: number, rest: number, active: number) {
        const body = this.world.createKinematicBody({ position: v(x, y), angle: rest, userData: 'FLIPPER' });
        // This covers the complete rendered blade from its pivot-side overhang
        // through its tip, rather than approximating only the center segment.
        const halfLength = 110 / ProcurementPlanckPhysics.scale;
        const pivotOffset = 90.2 / ProcurementPlanckPhysics.scale;
        body.createFixture(planck.Box(halfLength, 0.64, v(side === 'left' ? pivotOffset : -pivotOffset, 0)), { restitution: 0.78, friction: 0.01 });
        // A dedicated rounded tip removes the last gap between the rectangular
        // blade fixture and the pointed end visible to the player.
        body.createFixture(planck.Circle(v(side === 'left' ? 200 : -200, 0), 0.64), { restitution: 0.82, friction: 0.01 });
        return { body, rest, active, target: rest };
    }

    step(deltaMs: number) {
        this.accumulator += Math.min(deltaMs, 100) / 1000;
        while (this.accumulator >= 1 / 60) {
            this.updateFlipperMotors();
            this.world.step(1 / 60, 8, 3);
            this.accumulator -= 1 / 60;
        }
        if (this.ballState !== 'playing') return;
        const velocity = this.ball.getLinearVelocity();
        if (velocity.length() > 34) this.ball.setLinearVelocity(velocity.mul(34 / velocity.length()));
        const position = this.ball.getPosition();
        if (position.y * ProcurementPlanckPhysics.scale > 1800 || position.x * ProcurementPlanckPhysics.scale < 45 || position.x * ProcurementPlanckPhysics.scale > this.tableWidth - 45) {
            this.ballState = 'drained';
            this.ball.setActive(false);
            this.events.push({ type: 'BALL_DRAINED' });
        }
    }
    private updateFlipperMotors() {
        (Object.keys(this.flippers) as Array<'left' | 'right'>).forEach((side) => {
            const flipper = this.flippers[side];
            const current = flipper.body.getAngle();
            const error = Math.atan2(Math.sin(flipper.target - current), Math.cos(flipper.target - current));
            if (Math.abs(error) < 0.008) {
                flipper.body.setTransform(flipper.body.getPosition(), flipper.target);
                flipper.body.setAngularVelocity(0);
                return;
            }
            // A real flipper takes a noticeable fraction of a second to swing;
            // limiting angular speed keeps contact angle controllable instead
            // of teleporting the paddle through the ball in one frame.
            const angularVelocity = Math.max(-6, Math.min(6, error * 24));
            flipper.body.setAngularVelocity(angularVelocity);
            flipper.body.setTransform(flipper.body.getPosition(), current + angularVelocity / 60);
        });
    }
    setFlipper(side: 'left' | 'right', active: boolean) { this.flippers[side].target = active ? this.flippers[side].active : this.flippers[side].rest; }
    getBall() { const p = this.ball.getPosition(); return { x: p.x * ProcurementPlanckPhysics.scale, y: p.y * ProcurementPlanckPhysics.scale }; }
    getBallVelocity() { const velocity = this.ball.getLinearVelocity(); return { x: velocity.x, y: velocity.y }; }
    getFlipperAngles() { return { left: this.flippers.left.body.getAngle(), right: this.flippers.right.body.getAngle() }; }
    getBallState() { return this.ballState; }
    relaunch(x: number, y: number, power = 18, aim = 0.3) {
        if (this.ballState === 'playing') return false;
        this.ball.setActive(true);
        this.ball.setTransform(planck.Vec2(x / ProcurementPlanckPhysics.scale, y / ProcurementPlanckPhysics.scale), 0);
        const horizontalSpeed = 4 + Math.max(0, Math.min(1, aim)) * 5;
        this.ball.setLinearVelocity(planck.Vec2(-horizontalSpeed, -power));
        this.ball.setAngularVelocity(0);
        this.ball.setAwake(true);
        this.ballState = 'playing';
        this.events = [];
        return true;
    }
    consumeEvents() { const events = this.events; this.events = []; return events; }
}
