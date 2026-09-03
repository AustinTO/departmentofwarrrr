import * as Phaser from 'phaser';
import { currentRun } from '../state/RunState';
import type { DeliveryBatch } from '../state/RunState';
import { WeaponType } from '../game/config';
import { CHARACTERS, characterLine } from '../game/Characters';
import { ProcurementPlanckPhysics } from '../game/ProcurementPlanckPhysics';
import { PROCUREMENT_BUMPERS } from '../game/ProcurementTableDefinition';
import type { ProcurementBumper } from '../game/ProcurementTableDefinition';

type FlipperSide = 'left' | 'right';

interface Rail {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface Obstacle {
    x: number;
    y: number;
    radius: number;
    label: string;
    color: number;
}

interface Slide {
    name: string;
    width: number;
    points: Array<{ x: number; y: number }>;
    color: number;
}

/** A deterministic touch-first pinball minigame that avoids a second physics plugin. */
export class ProcurementScene extends Phaser.Scene {
    private ball?: Phaser.GameObjects.Image;
    private ballVelocity = new Phaser.Math.Vector2();
    private procurementList: Partial<Record<WeaponType, number>> = {};
    private leadTimeDelay = 0;
    private score = 0;
    private valueText!: Phaser.GameObjects.Text;
    private delayText!: Phaser.GameObjects.Text;
    private profitText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private authorizeButton!: Phaser.GameObjects.Rectangle;
    private bumpers: readonly ProcurementBumper[] = [];
    private lastBumperHit = new Map<string, number>();
    private leftFlipper!: Phaser.GameObjects.Container;
    private rightFlipper!: Phaser.GameObjects.Container;
    private flipperPulse: Record<FlipperSide, number> = { left: 0, right: 0 };
    private plunger?: Phaser.GameObjects.Image;
    private plungerPull = 0;
    private plungerDragging = false;
    private contractAuthorized = false;
    private rails: Rail[] = [];
    private obstacles: Obstacle[] = [];
    private slides: Slide[] = [];
    private slideCooldown = new Map<string, number>();
    private returnLaneCooldown = new Map<FlipperSide, number>();
    private bumperHits = 0;
    private launchAge = 0;
    private spaceCharging = false;
    private launchChargeStartedAt = 0;
    private combo = 0;
    private comboExpiresAt = 0;
    private comboText!: Phaser.GameObjects.Text;
    private adviserPortrait!: Phaser.GameObjects.Image;
    private adviserName!: Phaser.GameObjects.Text;
    private adviserLine!: Phaser.GameObjects.Text;
    private planck?: ProcurementPlanckPhysics;

    private readonly flipperY = 1660;
    private readonly flipperLength = 190;
    private readonly ballRadius = 19;
    private readonly maxBumperHitsPerBall = 12;

    constructor() {
        super('ProcurementScene');
    }

    create() {
        const { width, height } = this.scale;
        this.createBoardShell(width, height);
        this.add.rectangle(0, 0, width, 430, 0x02070d, 0.72).setOrigin(0);
        this.createHud(width);
        this.createBumpers(width);
        this.createRails(width);
        this.createFlippers(width);
        this.createControls(width, height);
        this.planck = new ProcurementPlanckPhysics(width, height);
        this.ball = this.add.image(width - 135, 1605, 'pinball_ball').setDisplaySize(this.ballRadius * 2, this.ballRadius * 2).setDepth(8);
        this.showAdviser('peter', 'procurement');
    }

    /** The table is layered in Phaser so art, input, and collision guides stay aligned. */
    private createBoardShell(width: number, height: number) {
        this.add.rectangle(width / 2, height / 2, width, height, 0x07121e);
        this.add.rectangle(width / 2, height / 2 + 130, width - 54, height - 160, 0x102f3e)
            .setStrokeStyle(8, 0x5de6ff, 0.8);
        this.add.rectangle(width / 2, height / 2 + 130, width - 88, height - 194, 0x071b28)
            .setStrokeStyle(3, 0x254f63, 0.9);

        const lines = this.add.graphics();
        lines.lineStyle(2, 0x2e7188, 0.45);
        for (let y = 470; y < height - 220; y += 150) lines.lineBetween(80, y, width - 80, y);
        lines.lineStyle(4, 0xff3d45, 0.7);
        lines.lineBetween(118, 460, 118, 1515);
        lines.lineBetween(width - 118, 460, width - 118, 1515);
        lines.lineStyle(4, 0x5de6ff, 0.75);
        lines.lineBetween(185, 1140, 185, 1510);
        lines.lineBetween(width - 185, 1140, width - 185, 1510);

        this.add.text(width / 2, 455, 'APPROPRIATIONS TABLE • KEEP THE REQUIREMENT IN PLAY', {
            fontSize: '16px', color: '#6fcbe7', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    private createHud(width: number) {
        this.add.text(width / 2, 42, 'PROCUREMENT PINBALL', {
            fontSize: '46px', color: '#f3ca67', fontStyle: 'bold', stroke: '#000000', strokeThickness: 7
        }).setOrigin(0.5);
        this.profitText = this.add.text(42, 95, '', { fontSize: '24px', color: '#9fffa6', wordWrap: { width: 310 } });
        this.valueText = this.add.text(42, 138, '', { fontSize: '22px', color: '#ffffff', wordWrap: { width: 310 } });
        this.delayText = this.add.text(width - 42, 95, '', { fontSize: '22px', color: '#ffd47c', align: 'right', wordWrap: { width: 310 } }).setOrigin(1, 0);
        this.statusText = this.add.text(width / 2, 405, 'LAUNCH A REQUIREMENT TO START A CONTRACT', {
            fontSize: '20px', color: '#a7dfff', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);
        this.comboText = this.add.text(width - 42, 178, 'INFLATION COMBO x1', {
            fontSize: '22px', color: '#ffd47c', fontStyle: 'bold'
        }).setOrigin(1, 0);

        // The secretary sits in the centered chairman's chair above the board.
        this.add.rectangle(width / 2, 284, 160, 154, 0x321d16, 0.96).setStrokeStyle(6, 0xb98745);
        this.add.rectangle(width / 2, 357, 210, 28, 0x1d1110, 0.98).setStrokeStyle(3, 0xb98745);
        this.adviserPortrait = this.add.image(width / 2, 348, CHARACTERS.peter.portraitKey).setDisplaySize(122, 154).setOrigin(0.5, 1);
        this.adviserName = this.add.text(width / 2, 366, '', { fontSize: '17px', fontStyle: 'bold', color: '#f3ca67', align: 'center' }).setOrigin(0.5);
        this.adviserLine = this.add.text(width / 2, 385, '', { fontSize: '15px', color: '#eaf6ff', align: 'center', wordWrap: { width: 560 }, lineSpacing: 2 }).setOrigin(0.5, 0);
        this.updateHUD();
    }

    private createBumpers(width: number) {
        this.bumpers = PROCUREMENT_BUMPERS;

        this.bumpers.forEach((bumper) => {
            this.add.image(bumper.x, bumper.y, 'pinball_bumper').setDisplaySize(bumper.radius * 2, bumper.radius * 2).setTint(bumper.color);
            this.add.text(bumper.x, bumper.y, bumper.label, {
                fontSize: bumper.radius > 60 ? '22px' : '14px', color: '#fff4c9', fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5);
        });

        this.add.text(width / 2, 1110, 'KEEP THE REQUIREMENT MOVING', {
            fontSize: '16px', color: '#9bcbd4', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    private createFlippers(width: number) {
        this.leftFlipper = this.createVisibleFlipper(270, 'left');
        this.rightFlipper = this.createVisibleFlipper(width - 270, 'right');
        this.add.image(250, this.flipperY - 160, 'pinball_sling').setDisplaySize(112, 86);
        this.add.image(width - 250, this.flipperY - 160, 'pinball_sling').setDisplaySize(112, 86).setFlipX(true);
        this.add.text(220, this.flipperY + 88, 'LEFT FLIPPER\nTAP TO FLIP', { fontSize: '18px', color: '#d8efff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
        this.add.text(width - 220, this.flipperY + 88, 'RIGHT FLIPPER\nTAP TO FLIP', { fontSize: '18px', color: '#d8efff', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    }

    /** The highlighted envelope is the playable surface, including the tip. */
    private createVisibleFlipper(x: number, side: FlipperSide) {
        const container = this.add.container(x, this.flipperY);
        const blade = this.add.graphics();
        const left = side === 'left' ? -20 : -200;
        blade.fillStyle(0xf6d99c, 1);
        blade.fillRoundedRect(left, -28, 220, 56, 22);
        blade.lineStyle(7, 0x30150e, 1);
        blade.strokeRoundedRect(left, -28, 220, 56, 22);
        blade.lineStyle(3, 0x5de6ff, 0.95);
        blade.strokeRoundedRect(left + 4, -24, 212, 48, 19);
        blade.fillStyle(0x5de6ff, 0.95);
        blade.fillCircle(side === 'left' ? 200 : -200, 0, 9);
        blade.lineStyle(3, 0x171014, 1);
        blade.strokeCircle(0, 0, 17);
        blade.fillStyle(0x171014, 1);
        blade.fillCircle(0, 0, 11);
        container.add(blade);
        container.setRotation(side === 'left' ? Phaser.Math.DegToRad(18) : Phaser.Math.DegToRad(-18));
        return container;
    }

    private createRails(width: number) {
        // These are collision-only guides over the red return lanes in the artwork.
        // Keeping them as line segments makes the slides functional without a second physics plugin.
        this.rails = [
            { x1: 92, y1: 430, x2: 92, y2: 1515 },
            { x1: width - 92, y1: 430, x2: width - 92, y2: 1515 },
            { x1: 180, y1: 1140, x2: 180, y2: 1510 },
            { x1: width - 180, y1: 1140, x2: width - 180, y2: 1510 }
        ];

        this.obstacles = [
            { x: 360, y: 820, radius: 32, label: 'LEFT BANK', color: 0x4e8dff },
            { x: width - 360, y: 820, radius: 32, label: 'RIGHT BANK', color: 0x4e8dff },
            { x: 330, y: 930, radius: 28, label: 'LEFT BANK LOW', color: 0x63d66b },
            { x: width - 330, y: 930, radius: 28, label: 'RIGHT BANK LOW', color: 0x63d66b },
            { x: width / 2, y: 820, radius: 38, label: 'CENTER SLINGSHOT', color: 0xffca4f },
            { x: 360, y: 1160, radius: 28, label: 'LEFT RETURN', color: 0x63d66b },
            { x: width - 360, y: 1160, radius: 28, label: 'RIGHT RETURN', color: 0x63d66b },
            { x: 350, y: 1390, radius: 32, label: 'LEFT DIVERTER', color: 0xff765e },
            { x: width - 350, y: 1390, radius: 32, label: 'RIGHT DIVERTER', color: 0xff765e }
        ];

        this.obstacles.forEach((obstacle) => {
            this.add.image(obstacle.x, obstacle.y, 'pinball_target').setDisplaySize(obstacle.radius * 2.4, obstacle.radius * 2.4).setTint(obstacle.color);
            this.add.text(obstacle.x, obstacle.y + obstacle.radius + 5, '◆', {
                fontSize: '12px', color: '#eaffed'
            }).setOrigin(0.5);
        });

        this.slides = [
            { name: 'LEFT RED SLIDE', width: 88, points: [{ x: 175, y: 470 }, { x: 125, y: 650 }, { x: 140, y: 820 }, { x: 215, y: 940 }], color: 0xff3d45 },
            { name: 'RIGHT RED SLIDE', width: 88, points: [{ x: width - 175, y: 470 }, { x: width - 125, y: 650 }, { x: width - 140, y: 820 }, { x: width - 215, y: 940 }], color: 0xff3d45 },
            { name: 'LEFT RETURN SLIDE', width: 82, points: [{ x: 205, y: 1130 }, { x: 150, y: 1300 }, { x: 175, y: 1460 }], color: 0x5de6ff },
            { name: 'RIGHT RETURN SLIDE', width: 82, points: [{ x: width - 205, y: 1130 }, { x: width - 150, y: 1300 }, { x: width - 175, y: 1460 }], color: 0x5de6ff }
        ];
        this.slides.forEach((slide) => {
            const guide = this.add.graphics();
            guide.lineStyle(3, slide.color, 0.42);
            guide.beginPath();
            guide.moveTo(slide.points[0].x, slide.points[0].y);
            slide.points.slice(1).forEach((point) => guide.lineTo(point.x, point.y));
            guide.strokePath();
            this.add.text(slide.points[0].x, slide.points[0].y + 18, 'SLIDE', {
                fontSize: '13px', color: slide.color === 0xff3d45 ? '#ffb2b6' : '#b7f5ff', fontStyle: 'bold'
            }).setOrigin(0.5);
        });
    }

    private createControls(width: number, height: number) {
        const plungerX = width - 82;
        const plungerY = height - 182;
        this.plunger = this.add.image(plungerX, plungerY, 'pinball_plunger').setDisplaySize(118, 220).setInteractive({ useHandCursor: true });
        this.add.text(plungerX, plungerY - 6, 'PULL\n& FIRE', {
            fontSize: '21px', color: '#d8efff', align: 'center', fontStyle: 'bold', stroke: '#00111f', strokeThickness: 3
        }).setOrigin(0.5);
        this.add.text(plungerX, plungerY + 135, 'PULL DOWN\nRELEASE TO LAUNCH', {
            fontSize: '14px', color: '#b7eaff', align: 'center', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, height - 35, 'TAP LEFT / RIGHT TO FLIP   •   HOLD SPACE: CHARGE LAUNCH', {
            fontSize: '18px', color: '#d8efff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.plunger.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => {
            event.stopPropagation();
            if (this.planck?.getBallState() === 'playing' || this.contractAuthorized) return;
            this.plungerDragging = true;
            this.updatePlungerPull(pointer, plungerY);
        });

        this.authorizeButton = this.add.rectangle(width / 2, height - 112, 430, 84, 0x087a42, 0.92).setStrokeStyle(3, 0xa8ff93).setInteractive({ useHandCursor: true });
        this.add.text(width / 2, height - 112, 'AUTHORIZE CONTRACT', { fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.authorizeButton.on('pointerdown', () => this.authorizeContract());

        // The trough belongs behind the paddles: balls pass the flippers before
        // they drain, and the visible drain never covers the active sprites.
        this.add.image(width / 2, this.flipperY + 48, 'pinball_drain').setDisplaySize(310, 76).setDepth(-1);

        this.add.text(116, height - 48, 'EXIT TO MCLEAN', { fontSize: '18px', color: '#d3dce4', fontStyle: 'bold' }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('MansionScene'));

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < height - 430 || pointer.x > width - 280) return;
            this.pressFlipper(pointer.x < width / 2 ? 'left' : 'right', width);
        });
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.releaseFlipper(pointer.x < width / 2 ? 'left' : 'right', width));
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.plungerDragging) this.updatePlungerPull(pointer, plungerY);
        });
        this.input.on('pointerup', () => this.finishPlungerPull(plungerY));
        this.input.on('pointerupoutside', () => this.finishPlungerPull(plungerY));
        this.input.on('gameout', () => this.finishPlungerPull(plungerY));
        this.input.keyboard?.on('keydown-F', () => this.pressFlipper('left', width));
        this.input.keyboard?.on('keydown-J', () => this.pressFlipper('right', width));
        this.input.keyboard?.on('keyup-F', () => this.releaseFlipper('left', width));
        this.input.keyboard?.on('keyup-J', () => this.releaseFlipper('right', width));
        this.input.keyboard?.on('keydown-SPACE', () => {
            if (this.planck?.getBallState() !== 'playing' && !this.contractAuthorized && !this.spaceCharging) {
                this.spaceCharging = true;
                this.launchChargeStartedAt = this.time.now;
                this.statusText.setText('HOLD SPACE — CHARGE THE LAUNCH');
            }
        });
        this.input.keyboard?.on('keyup-SPACE', () => {
            if (!this.spaceCharging) return;
            this.spaceCharging = false;
            this.launchBall(undefined, this.getLaunchCharge());
        });
        this.input.keyboard?.on('keydown-ENTER', () => this.authorizeContract());
        this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MansionScene'));
    }

    private getLaunchCharge() {
        return Phaser.Math.Clamp((this.time.now - this.launchChargeStartedAt) / 1200, 0, 1);
    }

    private updatePlungerPull(pointer: Phaser.Input.Pointer, baseY: number) {
        this.plungerPull = Phaser.Math.Clamp(pointer.y - baseY + 34, 0, 155);
        this.plunger?.setY(baseY + this.plungerPull);
        this.statusText.setText(`PLUNGER PULLED ${Math.round(this.plungerPull / 155 * 100)}% — RELEASE TO FIRE`);
    }

    private finishPlungerPull(baseY: number) {
        if (!this.plungerDragging) return;
        this.plungerDragging = false;
        const charge = Phaser.Math.Clamp(this.plungerPull / 155, 0, 1);
        this.launchBall(undefined, charge);
        this.tweens.add({ targets: this.plunger, y: baseY, duration: 100, ease: 'Quad.easeOut' });
        this.plungerPull = 0;
    }

    private launchBall(pointer?: Phaser.Input.Pointer, charge = 0.35) {
        if (this.planck) {
            if (this.contractAuthorized || this.planck.getBallState() === 'playing') return;
            // The physical shooter exit is above the lower slingshot bank, so
            // every pull gets a clean, upward route into the scoring field.
            this.planck.relaunch(this.scale.width - 130, 1400, Phaser.Math.Linear(22, 34, charge), 0);
            this.ball?.setVisible(true);
            this.lastBumperHit.clear();
            this.statusText.setText('PLANCK LAUNCH — INFLATE THE REQUIREMENT');
            return;
        }
        if (this.ball || this.contractAuthorized) return;
        const { width } = this.scale;
        this.ball = this.add.image(width - 173, 1365, 'pinball_ball').setDisplaySize(this.ballRadius * 2, this.ballRadius * 2);
        // Tapping higher/lower on the launch lane changes the aim. A small bounded
        // variance prevents identical launches from repeating the same route.
        const launchY = Phaser.Math.Clamp(pointer?.y ?? 1450, 1340, 1560);
        const playerAim = Phaser.Math.Linear(-760, 200, (launchY - 1340) / 220);
        const launchSpeed = Phaser.Math.Linear(950, 1650, charge);
        this.ballVelocity.set(playerAim * (0.8 + charge * 0.35) + Phaser.Math.Between(-70, 70), -launchSpeed);
        this.bumperHits = 0;
        this.launchAge = 0;
        this.slideCooldown.clear();
        this.returnLaneCooldown.clear();
        this.lastBumperHit.clear();
        this.statusText.setText('HIT BUMPERS TO INFLATE THE REQUIREMENT');
    }

    private pressFlipper(side: FlipperSide, width: number) {
        if (this.planck) {
            const pulse = ++this.flipperPulse[side];
            this.planck.setFlipper(side, true);
            // A touch tap must never leave a motor latched if Android delays
            // or drops pointer-up while the browser scrolls or loses focus.
            this.time.delayedCall(110, () => {
                if (this.flipperPulse[side] === pulse) this.planck?.setFlipper(side, false);
            });
            return;
        }
        if (side === 'left') {
            this.leftFlipper.setAngle(-42);
        } else {
            this.rightFlipper.setAngle(42);
        }
        this.kickBall(side, width);
    }

    private releaseFlipper(side: FlipperSide, _width: number) {
        if (this.planck) {
            // Tap duration is owned by pressFlipper so release timing cannot
            // leave a Planck motor in its raised state.
            return;
        }
        if (side === 'left') {
            this.leftFlipper.setAngle(18);
        } else {
            this.rightFlipper.setAngle(-18);
        }
    }

    private kickBall(side: FlipperSide, width: number) {
        if (!this.ball || this.ball.y < this.flipperY - 115 || this.ball.y > this.flipperY + 85) return;
        const pivotX = side === 'left' ? 270 : width - 270;
        if (Math.abs(this.ball.x - pivotX) > this.flipperLength + 45) return;
        this.ballVelocity.set(side === 'left' ? 760 : -760, -1320);
    }

    update(_time: number, delta: number) {
        if (this.combo > 0 && this.time.now > this.comboExpiresAt) {
            this.combo = 0;
            this.comboText.setText('INFLATION COMBO x1');
        }
        if (this.spaceCharging) {
            this.statusText.setText(`HOLD SPACE — LAUNCH POWER ${Math.round(this.getLaunchCharge() * 100)}%`);
        }
        if (this.planck) {
            this.planck.step(delta);
            const ball = this.planck.getBall();
            this.ball?.setPosition(ball.x, ball.y);
            const angles = this.planck.getFlipperAngles();
            this.leftFlipper.setRotation(angles.left);
            this.rightFlipper.setRotation(angles.right);
            this.planck.consumeEvents().forEach((event) => {
                if (event.type === 'BUMPER_HIT') {
                    const bumper = this.bumpers[event.index ?? 0];
                    this.addToProcurement(bumper.weapon, bumper.quantity, bumper.delay, bumper.value);
                    this.showBumperHit(bumper);
                }
                if (event.type === 'SLINGSHOT_HIT') this.statusText.setText('SLINGSHOT KICK — REQUIREMENT ACCELERATING');
                if (event.type === 'TARGET_HIT') {
                    const bumper = this.bumpers.find((entry) => entry.outcome === 'inflate')!;
                    this.addToProcurement(bumper.weapon, 1, 0.05, 1_000_000_000);
                    this.statusText.setText('TARGET BANK HIT — REQUIREMENT REWRITTEN');
                }
                if (event.type === 'BALL_DRAINED') {
                    this.ball?.setVisible(false);
                    this.statusText.setText(this.score > 0 ? 'BALL DRAINED — AUTHORIZE OR LAUNCH ANOTHER' : 'BALL DRAINED — TAP LAUNCH REQ TO REDEPLOY');
                }
            });
            return;
        }
        if (!this.ball) return;
        const step = Math.min(delta, 34) / 1000;
        const { width, height } = this.scale;
        this.launchAge += step;
        this.ballVelocity.y += 980 * step;
        this.ballVelocity.limit(1250);
        this.ball.x += this.ballVelocity.x * step;
        this.ball.y += this.ballVelocity.y * step;

        this.checkRails(width);
        if (this.ball.y < 405) {
            this.ball.y = 405;
            this.ballVelocity.y = Math.abs(this.ballVelocity.y) * 0.9;
        }

        this.checkFlippers(width);
        this.checkSlides();
        this.checkObstacles();
        this.checkBumpers();
        this.checkReturnFunnels(width);
        // A pinball should eventually return to the player. This prevents a perfect
        // bumper orbit from farming one contract forever while preserving skillful play.
        if (this.launchAge > 18 || this.bumperHits >= this.maxBumperHitsPerBall) {
            this.ballVelocity.y = Math.max(this.ballVelocity.y, 700);
            this.statusText.setText('BOARD TILT — BALL RETURNING TO PLUNGER');
        }
        this.checkDrain(height, width);
    }

    private checkDrain(height: number, width: number) {
        if (!this.ball || this.ball.y <= height - 170) return;

        // The only opening is the center trough between the two paddles.
        const drainLeft = 455;
        const drainRight = width - 455;
        if (this.ball.x >= drainLeft && this.ball.x <= drainRight) {
            this.drainBall();
            return;
        }

        // The lower side aprons return balls to the playfield instead of allowing
        // them to vanish at the bottom edge.
        this.ball.y = height - 170;
        this.ballVelocity.y = -Math.max(520, Math.abs(this.ballVelocity.y) * 0.72);
        this.ballVelocity.x *= 0.92;
    }

    private checkReturnFunnels(width: number) {
        if (!this.ball || this.ball.y < 1460 || this.ball.y > this.flipperY + 35 || this.ballVelocity.y <= 0) return;

        const side: FlipperSide | undefined = this.ball.x < width / 2 - 170
            ? 'left'
            : this.ball.x > width / 2 + 170 ? 'right' : undefined;
        if (!side || (this.returnLaneCooldown.get(side) ?? 0) > this.time.now) return;

        // The painted lower aprons feed inward toward the paddle tips.
        this.returnLaneCooldown.set(side, this.time.now + 500);
        this.ballVelocity.x = side === 'left' ? 560 : -560;
        this.ballVelocity.y = 520;
        this.statusText.setText(`${side.toUpperCase()} RETURN LANE — FEEDING FLIPPER`);
    }

    private checkRails(width: number) {
        if (!this.ball) return;
        for (const rail of this.rails) {
            const closestX = Phaser.Math.Clamp(this.ball.x, Math.min(rail.x1, rail.x2), Math.max(rail.x1, rail.x2));
            const closestY = Phaser.Math.Clamp(this.ball.y, Math.min(rail.y1, rail.y2), Math.max(rail.y1, rail.y2));
            const dx = this.ball.x - closestX;
            const dy = this.ball.y - closestY;
            if (dx * dx + dy * dy > (this.ballRadius + 10) ** 2) continue;

            if (rail.x1 === rail.x2) {
                const leftRail = rail.x1 < width / 2;
                this.ball.x = rail.x1 + (leftRail ? 30 : -30);
                this.ballVelocity.x = Math.abs(this.ballVelocity.x) * (leftRail ? 1 : -1);
            } else {
                this.ballVelocity.y = -Math.abs(this.ballVelocity.y);
            }
        }
    }

    private checkFlippers(width: number) {
        if (!this.ball) return;
        const flippers = [
            { side: 'left' as FlipperSide, pivotX: 270, angle: this.leftFlipper.rotation },
            { side: 'right' as FlipperSide, pivotX: width - 270, angle: this.rightFlipper.rotation }
        ];
        for (const flipper of flippers) {
            const direction = flipper.side === 'left' ? 1 : -1;
            const endX = flipper.pivotX + Math.cos(flipper.angle) * this.flipperLength * direction;
            const endY = this.flipperY + Math.sin(flipper.angle) * this.flipperLength * direction;
            const dx = endX - flipper.pivotX;
            const dy = endY - this.flipperY;
            const lengthSq = dx * dx + dy * dy;
            const t = Phaser.Math.Clamp(((this.ball.x - flipper.pivotX) * dx + (this.ball.y - this.flipperY) * dy) / lengthSq, 0, 1);
            const closestX = flipper.pivotX + dx * t;
            const closestY = this.flipperY + dy * t;
            if (Phaser.Math.Distance.Between(this.ball.x, this.ball.y, closestX, closestY) > this.ballRadius + 23) continue;
            this.ball.x = closestX;
            this.ball.y = closestY - this.ballRadius - 8;
            const power = flipper.side === 'left' ? 820 : -820;
            this.ballVelocity.set(power + (t - 0.5) * 300, -900 - t * 520);
        }
    }

    private checkObstacles() {
        if (!this.ball) return;
        for (const obstacle of this.obstacles) {
            const dx = this.ball.x - obstacle.x;
            const dy = this.ball.y - obstacle.y;
            const distance = Math.hypot(dx, dy);
            if (distance > obstacle.radius + this.ballRadius || distance === 0) continue;

            const normal = new Phaser.Math.Vector2(dx, dy).normalize();
            this.ball.x = obstacle.x + normal.x * (obstacle.radius + this.ballRadius + 2);
            this.ball.y = obstacle.y + normal.y * (obstacle.radius + this.ballRadius + 2);
            const speed = Math.max(650, this.ballVelocity.length());
            this.ballVelocity.copy(normal.scale(speed));
            this.ballVelocity.y = Math.min(this.ballVelocity.y, -300);
            const key = `obstacle-${obstacle.label}`;
            if ((this.lastBumperHit.get(key) ?? 0) + 160 > this.time.now) continue;
            this.lastBumperHit.set(key, this.time.now);
        }
    }

    private checkSlides() {
        if (!this.ball) return;
        for (const slide of this.slides) {
            const centerX = this.slideCenterAtY(slide, this.ball.y);
            const inside = centerX !== undefined && this.ballVelocity.y > 0
                && Math.abs(this.ball.x - centerX) < slide.width / 2;
            if (!inside || (this.slideCooldown.get(slide.name) ?? 0) > this.time.now) continue;

            this.slideCooldown.set(slide.name, this.time.now + 650);
            this.ball.x = centerX;
            this.ballVelocity.set(0, 760);
            this.statusText.setText(`${slide.name} ENGAGED — BALL ROUTED DOWN-LANE`);
            const pulse = this.add.rectangle(centerX, this.ball.y, slide.width, 8, slide.color, 0.85);
            this.tweens.add({
                targets: pulse,
                alpha: 0,
                scaleX: 0.25,
                duration: 420,
                onComplete: () => pulse.destroy()
            });
        }
    }

    private slideCenterAtY(slide: Slide, y: number): number | undefined {
        for (let i = 0; i < slide.points.length - 1; i++) {
            const start = slide.points[i];
            const end = slide.points[i + 1];
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);
            if (y < minY || y > maxY) continue;
            const progress = (y - start.y) / (end.y - start.y || 1);
            return Phaser.Math.Linear(start.x, end.x, progress);
        }
        return undefined;
    }

    private checkBumpers() {
        if (!this.ball) return;
        for (const bumper of this.bumpers) {
            const key = bumper.label;
            const distance = Phaser.Math.Distance.Between(this.ball.x, this.ball.y, bumper.x, bumper.y);
            if (distance > bumper.radius + 22 || (this.lastBumperHit.get(key) ?? 0) + 180 > this.time.now) continue;
            this.lastBumperHit.set(key, this.time.now);
            const normal = new Phaser.Math.Vector2(this.ball.x - bumper.x, this.ball.y - bumper.y);
            if (normal.lengthSq() === 0) normal.set(0, 1);
            normal.normalize();
            this.ball.x = bumper.x + normal.x * (bumper.radius + this.ballRadius + 2);
            this.ball.y = bumper.y + normal.y * (bumper.radius + this.ballRadius + 2);
            this.ballVelocity.copy(normal.scale(850));
            this.ballVelocity.y = Math.min(this.ballVelocity.y, -420);
            this.bumperHits++;
            this.addToProcurement(bumper.weapon, bumper.quantity, bumper.delay, bumper.value);
            this.showBumperHit(bumper);
        }
    }

    private showBumperHit(bumper: ProcurementBumper) {
        const multiplier = bumper.outcome === 'inflate' ? Math.min(4, 1 + Math.floor(this.combo / 3)) : 1;
        const flash = this.add.text(bumper.x, bumper.y - bumper.radius - 22, `${bumper.value >= 0 ? '+' : '-'}${this.formatBudget(Math.abs(bumper.value) * multiplier)}${multiplier > 1 ? `  x${multiplier}` : ''}`, {
            fontSize: '30px', color: bumper.outcome === 'inflate' ? '#9dff8e' : '#ff9b9b', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.tweens.add({ targets: flash, y: flash.y - 65, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
        const pulse = this.add.circle(bumper.x, bumper.y, bumper.radius, bumper.color, 0.35).setStrokeStyle(5, 0xffffff, 0.9);
        this.tweens.add({ targets: pulse, scale: 1.55, alpha: 0, duration: 360, onComplete: () => pulse.destroy() });
        this.combo = bumper.outcome === 'inflate' ? this.combo + 1 : 0;
        this.comboExpiresAt = this.time.now + 2200;
        this.comboText.setText(this.combo > 0 ? `INFLATION COMBO x${Math.min(4, 1 + Math.floor(this.combo / 3))}` : 'EFFICIENCY INCIDENT');
        const adviser = bumper.label === 'AUDIT FAILED'
            ? 'audit'
            : bumper.label === 'TARGET ACQUIRED'
                ? 'addington'
                : bumper.label === 'JACKPOT' || bumper.label === 'COST OVERRUN'
                    ? 'margin'
                    : 'ledger';
        this.showAdviser(adviser, 'procurement');
    }

    private addToProcurement(weapon: WeaponType, quantity: number, delay: number, value: number) {
        const multiplier = value > 0 ? Math.min(4, 1 + Math.floor(this.combo / 3)) : 1;
        if (quantity > 0) this.procurementList[weapon] = (this.procurementList[weapon] ?? 0) + quantity;
        this.leadTimeDelay += delay;
        this.score = Math.max(0, this.score + value * multiplier);
        currentRun.taxpayerBurn = Math.max(0, currentRun.taxpayerBurn + value * multiplier);
        currentRun.contractorProfit = Math.max(0, currentRun.contractorProfit + value * multiplier * 0.15);
        this.statusText.setText(value > 0 ? 'EMERGENCY REQUIREMENT EXPANDED — KEEP HITTING BUMPERS' : 'EFFICIENCY DETECTED — CONTRACT SHRINKING');
        this.updateHUD();
    }

    private showAdviser(characterId: keyof typeof CHARACTERS, scene: 'procurement') {
        const adviser = CHARACTERS[characterId];
        this.adviserPortrait.setTexture(adviser.portraitKey);
        this.adviserName.setText(`${adviser.name} — ${adviser.title}`).setColor(adviser.color);
        this.adviserLine.setText(`“${characterLine(characterId, scene)}”`);
        this.adviserPortrait.setAlpha(0.55);
        this.tweens.add({ targets: this.adviserPortrait, alpha: 1, duration: 180 });
    }

    private drainBall() {
        this.ball?.destroy();
        this.ball = undefined;
        this.ballVelocity.set(0, 0);
        this.statusText.setText(this.score > 0 ? 'REQUIREMENT READY — AUTHORIZE THE CONTRACT' : 'NO REQUIREMENT FILED — LAUNCH AGAIN');
    }

    private updateHUD() {
        const items = Object.entries(this.procurementList).map(([weapon, quantity]) => `${weapon}: ${quantity}`).join('  •  ') || 'NO CONTRACT ITEMS YET';
        this.valueText.setText(`CONTRACT: ${items}`);
        this.delayText.setText(`VALUE: ${this.formatBudget(this.score)}  •  DELIVERY DELAY: +${this.leadTimeDelay.toFixed(1)} YEARS`);
        this.profitText.setText(`CONTRACTOR PROFIT: ${this.formatBudget(currentRun.contractorProfit)}`);
        this.authorizeButton?.setFillStyle(this.score > 0 ? 0x087a42 : 0x3c4a55, this.score > 0 ? 0.92 : 0.6);
    }

    private formatBudget(value: number) {
        return value >= 1e12 ? `$${(value / 1e12).toFixed(2)}T` : `$${(value / 1e9).toFixed(1)}B`;
    }

    private authorizeContract() {
        if (this.contractAuthorized || this.score <= 0) {
            if (!this.contractAuthorized) this.statusText.setText('HIT A BUMPER BEFORE AUTHORIZING A CONTRACT');
            return;
        }
        this.contractAuthorized = true;
        this.ball?.destroy();
        this.ball = undefined;
        for (const weapon in this.procurementList) {
            currentRun.productionQueue.push({
                fiscalYear: currentRun.currentFY + Math.ceil(this.leadTimeDelay),
                weaponType: weapon as WeaponType,
                quantity: this.procurementList[weapon as WeaponType]!
            } satisfies DeliveryBatch);
        }
        currentRun.save();
        this.cameras.main.flash(500, 0, 255, 0);
        this.statusText.setText('CONTRACT AUTHORIZED — EXECUTIVES NOTIFIED');
        this.add.text(this.scale.width / 2, this.scale.height / 2, 'CONTRACT AUTHORIZED', {
            fontSize: '58px', color: '#a8ff93', fontStyle: 'bold', stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5);
        this.time.delayedCall(1400, () => this.scene.start('MansionScene'));
    }
}
