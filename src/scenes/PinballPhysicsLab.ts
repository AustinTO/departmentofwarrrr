import * as Phaser from 'phaser';
import * as planck from 'planck-js';

const SCALE = 48;
const FIXED_STEP = 1 / 60;
const MAX_SPEED = 34;

type BodyView = { body: planck.Body; view: Phaser.GameObjects.Shape };

/** Isolated Planck prototype. It deliberately does not touch ProcurementScene. */
export class PinballPhysicsLab extends Phaser.Scene {
    private world = new planck.World(planck.Vec2(0, 18));
    private accumulator = 0;
    private ballViews: BodyView[] = [];
    private flippers: Array<{ body: planck.Body; joint: planck.RevoluteJoint; side: 'left' | 'right'; view: Phaser.GameObjects.Rectangle }> = [];
    private debug!: Phaser.GameObjects.Graphics;
    private debugEnabled = true;
    private overlay!: Phaser.GameObjects.Text;
    private lastCollision = 'NONE';
    private physicsSteps = 0;
    private launchPower = 18;

    constructor() { super('PinballPhysicsLab'); }

    create() {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x07131f);
        this.add.text(width / 2, 52, 'PLANCK PINBALL PHYSICS LAB', { fontSize: '38px', color: '#7df4ff', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(width / 2, 92, 'TAP LEFT / RIGHT: FLIPPERS  •  LAUNCH: CENTER  •  3-BALL: TOP RIGHT  •  DEBUG: TOP LEFT', { fontSize: '16px', color: '#ccefff' }).setOrigin(0.5);
        this.debug = this.add.graphics().setDepth(20);
        this.overlay = this.add.text(22, 118, '', { fontSize: '18px', color: '#e8fbff', lineSpacing: 4 }).setDepth(30);
        this.buildTable();
        this.spawnBall();

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < 160 && pointer.x < 220) { this.debugEnabled = !this.debugEnabled; return; }
            if (pointer.y < 160 && pointer.x > width - 260) { this.spawnMultiball(); return; }
            // The visible flippers live in the lower 380px of the logical table.
            // Keep the touch zones broad so mobile players can hit them directly.
            if (pointer.y > height - 420) this.setFlipper(pointer.x < width / 2 ? 'left' : 'right', true);
            else if (pointer.y > height - 500 && pointer.x > width * 0.35 && pointer.x < width * 0.65) this.spawnBall();
        });
        this.input.on('pointerup', () => { this.setFlipper('left', false); this.setFlipper('right', false); });
        this.input.keyboard?.on('keydown-A', () => this.setFlipper('left', true));
        this.input.keyboard?.on('keydown-D', () => this.setFlipper('right', true));
        this.input.keyboard?.on('keyup-A', () => this.setFlipper('left', false));
        this.input.keyboard?.on('keyup-D', () => this.setFlipper('right', false));
        this.input.keyboard?.on('keydown-M', () => this.spawnMultiball());
        this.input.keyboard?.on('keydown-R', () => this.resetBalls());
        this.input.keyboard?.on('keydown-F', () => this.debugEnabled = !this.debugEnabled);
    }

    private px(value: number) { return value / SCALE; }
    private v(x: number, y: number) { return planck.Vec2(this.px(x), this.px(y)); }

    private buildTable() {
        const { width, height } = this.scale;
        const art = this.add.graphics().setDepth(1);
        art.lineStyle(8, 0x2f8aa6, 0.9);
        art.strokeRect(70, 180, width - 140, height - 360);
        art.lineStyle(6, 0x5de6ff, 0.8);
        art.lineBetween(160, 460, 350, 340); art.lineBetween(width - 160, 460, width - 350, 340);
        art.lineStyle(6, 0xff5964, 0.85);
        art.lineBetween(70, height - 180, 430, height - 180); art.lineBetween(650, height - 180, width - 70, height - 180);
        const wall = (a: [number, number], b: [number, number]) => {
            const body = this.world.createBody();
            body.createFixture(planck.Edge(this.v(...a), this.v(...b)), { restitution: 0.72, friction: 0.08 });
        };
        wall([70, 180], [70, height - 180]); wall([width - 70, 180], [width - 70, height - 180]);
        wall([70, 180], [width - 70, 180]); wall([70, height - 180], [430, height - 180]); wall([650, height - 180], [width - 70, height - 180]);
        wall([160, 460], [350, 340]); wall([width - 160, 460], [width - 350, 340]);

        [[width / 2, 500], [280, 690], [width - 280, 690]].forEach(([x, y], index) => this.createBumper(x, y, index));
        [[240, 950], [width - 240, 950], [width / 2, 1080]].forEach(([x, y]) => this.createTarget(x, y));
        this.createFlipper('left', 330, height - 245, 0.42, -0.72);
        this.createFlipper('right', width - 330, height - 245, Math.PI - 0.42, Math.PI + 0.72);
        this.world.on('begin-contact', (contact: planck.Contact) => {
            const a = contact.getFixtureA().getBody().getUserData() as string | undefined;
            const b = contact.getFixtureB().getBody().getUserData() as string | undefined;
            this.lastCollision = a === 'ball' ? b ?? 'TABLE' : b === 'ball' ? a ?? 'TABLE' : 'TABLE';
            if (this.lastCollision === 'BUMPER' || this.lastCollision === 'SLING') {
                const ball = a === 'ball' ? contact.getFixtureA().getBody() : contact.getFixtureB().getBody();
                const source = a === 'ball' ? contact.getFixtureB().getBody() : contact.getFixtureA().getBody();
                const direction = ball.getPosition().clone().sub(source.getPosition());
                if (direction.lengthSquared() > 0) {
                    direction.normalize();
                    ball.applyLinearImpulse(direction.mul(this.lastCollision === 'BUMPER' ? 4.5 : 3), ball.getWorldCenter(), true);
                }
            }
        });
    }

    private createBumper(x: number, y: number, index: number) {
        const body = this.world.createBody({ position: this.v(x, y), userData: 'BUMPER' });
        body.createFixture(planck.Circle(this.px(42)), { restitution: 1.1, friction: 0 });
        const view = this.add.circle(x, y, 42, [0xffd45e, 0xff6b75, 0x75f4ff][index], 0.95).setStrokeStyle(5, 0xffffff);
        this.ballViews.push({ body, view });
    }

    private createTarget(x: number, y: number) {
        const body = this.world.createBody({ position: this.v(x, y), userData: 'TARGET' });
        body.createFixture(planck.Box(this.px(32), this.px(14)), { restitution: 0.85 });
        this.add.rectangle(x, y, 64, 28, 0xa45de8).setStrokeStyle(3, 0xffffff);
    }

    private createFlipper(side: 'left' | 'right', x: number, y: number, rest: number, active: number) {
        const body = this.world.createDynamicBody({ position: this.v(x, y), angle: rest, userData: 'FLIPPER' });
        body.createFixture(planck.Box(this.px(100), this.px(12), this.v(side === 'left' ? 96 : -96, 0)), { density: 6, friction: 0.05, restitution: 0.55 });
        const pivot = this.world.createBody({ position: this.v(x, y) });
        const swing = active - rest;
        const joint = this.world.createJoint(planck.RevoluteJoint({ enableMotor: true, motorSpeed: 0, maxMotorTorque: 900, enableLimit: true, lowerAngle: Math.min(0, swing), upperAngle: Math.max(0, swing) }, pivot, body, pivot.getPosition()))!;
        const view = this.add.rectangle(x, y, 215, 28, 0xf4d697).setOrigin(side === 'left' ? 0 : 1, 0.5).setStrokeStyle(4, 0x5a2618);
        this.flippers.push({ body, joint, side, view });
        this.add.text(x + (side === 'left' ? 85 : -85), y + 72, side.toUpperCase(), { fontSize: '18px', color: '#7df4ff', fontStyle: 'bold' }).setOrigin(0.5);
    }

    private setFlipper(side: 'left' | 'right', active: boolean) {
        const flipper = this.flippers.find((entry) => entry.side === side);
        if (!flipper) return;
        const direction = side === 'left' ? -1 : 1;
        flipper.joint.setMotorSpeed(active ? 36 * direction : -28 * direction);
    }

    private spawnBall(x = this.scale.width - 130, y = this.scale.height - 370) {
        if (this.ballViews.filter((entry) => entry.body.getUserData() === 'ball').length >= 3) return;
        const body = this.world.createDynamicBody({ position: this.v(x, y), bullet: true, linearDamping: 0.02, angularDamping: 0.15, userData: 'ball' });
        body.createFixture(planck.Circle(this.px(18)), { density: 1, restitution: 0.78, friction: 0.02 });
        body.setLinearVelocity(this.v(-2, -this.launchPower));
        this.ballViews.push({ body, view: this.add.circle(x, y, 18, 0xf5f8ff).setStrokeStyle(3, 0xffffff) });
    }

    private spawnMultiball() { this.spawnBall(430, 780); this.spawnBall(650, 760); }
    private resetBalls() { this.ballViews.filter((entry) => entry.body.getUserData() === 'ball').forEach((entry) => { this.world.destroyBody(entry.body); entry.view.destroy(); }); this.ballViews = this.ballViews.filter((entry) => entry.body.getUserData() !== 'ball'); this.spawnBall(); }

    update(_time: number, delta: number) {
        this.accumulator += Math.min(delta, 100) / 1000;
        let steps = 0;
        while (this.accumulator >= FIXED_STEP && steps < 5) { this.world.step(FIXED_STEP, 8, 3); this.accumulator -= FIXED_STEP; steps++; this.physicsSteps++; }
        this.ballViews.forEach((entry) => {
            const position = entry.body.getPosition(); entry.view.setPosition(position.x * SCALE, position.y * SCALE);
            if (entry.body.getUserData() === 'ball') { const velocity = entry.body.getLinearVelocity(); if (velocity.length() > MAX_SPEED) entry.body.setLinearVelocity(velocity.mul(MAX_SPEED / velocity.length())); }
        });
        this.flippers.forEach((entry) => { const p = entry.body.getPosition(); entry.view.setPosition(p.x * SCALE, p.y * SCALE).setRotation(entry.body.getAngle()); });
        this.drawDebug();
        const ball = this.ballViews.find((entry) => entry.body.getUserData() === 'ball')?.body;
        this.overlay.setText(`FPS: ${Math.round(this.game.loop.actualFps)}\nPHYSICS: ${steps * 60} steps/s  • bodies: ${this.world.getBodyCount()}\nBALLS: ${this.ballViews.filter((entry) => entry.body.getUserData() === 'ball').length}\nBALL SPEED: ${ball ? ball.getLinearVelocity().length().toFixed(1) : '0'}\nANGULAR: ${ball ? ball.getAngularVelocity().toFixed(1) : '0'}\nLAST COLLISION: ${this.lastCollision}\nDEBUG: ${this.debugEnabled ? 'ON' : 'OFF'}`);
    }

    private drawDebug() {
        this.debug.clear(); if (!this.debugEnabled) return;
        this.debug.lineStyle(1, 0x43f4ff, 0.55);
        for (let body = this.world.getBodyList(); body; body = body.getNext()) for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
            const shape = fixture.getShape(); if (shape.getType() === 'circle') { const c = shape as planck.CircleShape; const p = body.getWorldPoint(c.m_p); this.debug.strokeCircle(p.x * SCALE, p.y * SCALE, c.m_radius * SCALE); }
        }
    }
}
