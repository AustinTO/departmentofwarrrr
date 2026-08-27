import * as Phaser from 'phaser';
import { currentRun } from '../state/RunState';
import type { DeliveryBatch } from '../state/RunState';
import { WeaponType } from '../game/config';

type FlipperSide = 'left' | 'right';

interface Bumper {
    x: number;
    y: number;
    radius: number;
    label: string;
    value: number;
    delay: number;
    color: number;
    weapon: WeaponType;
    quantity: number;
}

interface Rail {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/** A deterministic touch-first pinball minigame that avoids a second physics plugin. */
export class ProcurementScene extends Phaser.Scene {
    private ball?: Phaser.GameObjects.Arc;
    private ballVelocity = new Phaser.Math.Vector2();
    private procurementList: Partial<Record<WeaponType, number>> = {};
    private leadTimeDelay = 0;
    private score = 0;
    private valueText!: Phaser.GameObjects.Text;
    private delayText!: Phaser.GameObjects.Text;
    private profitText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private authorizeButton!: Phaser.GameObjects.Rectangle;
    private bumpers: Bumper[] = [];
    private lastBumperHit = new Map<string, number>();
    private leftFlipper!: Phaser.GameObjects.Rectangle;
    private rightFlipper!: Phaser.GameObjects.Rectangle;
    private leftPressed = false;
    private rightPressed = false;
    private contractAuthorized = false;
    private rails: Rail[] = [];
    private bumperHits = 0;
    private launchAge = 0;

    private readonly flipperY = 1660;
    private readonly flipperLength = 190;
    private readonly ballRadius = 19;
    private readonly maxBumperHitsPerBall = 12;

    constructor() {
        super('ProcurementScene');
    }

    create() {
        const { width, height } = this.scale;
        this.add.image(width / 2, height / 2, 'procurement_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, 360, 0x02070d, 0.78).setOrigin(0);
        this.createHud(width);
        this.createBumpers(width);
        this.createRails(width);
        this.createFlippers(width);
        this.createControls(width, height);
    }

    private createHud(width: number) {
        this.add.text(width / 2, 42, 'PROCUREMENT PINBALL', {
            fontSize: '46px', color: '#f3ca67', fontStyle: 'bold', stroke: '#000000', strokeThickness: 7
        }).setOrigin(0.5);
        this.profitText = this.add.text(46, 95, '', { fontSize: '28px', color: '#9fffa6' });
        this.valueText = this.add.text(46, 143, '', { fontSize: '27px', color: '#ffffff', wordWrap: { width: width - 92 } });
        this.delayText = this.add.text(46, 235, '', { fontSize: '27px', color: '#ffd47c' });
        this.statusText = this.add.text(width / 2, 305, 'LAUNCH A REQUIREMENT TO START A CONTRACT', {
            fontSize: '20px', color: '#a7dfff', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);
        this.updateHUD();
    }

    private createBumpers(width: number) {
        this.bumpers = [
            { x: width / 2, y: 1010, radius: 88, label: 'JACKPOT', value: 100_000_000, delay: 2, color: 0xffca4f, weapon: WeaponType.INTERCEPTOR_BLOCK_II, quantity: 20 },
            { x: 210, y: 1000, radius: 46, label: 'AUDIT FAILED', value: 50_000_000, delay: 1, color: 0xff5544, weapon: WeaponType.INTERCEPTOR, quantity: 50 },
            { x: width - 210, y: 1000, radius: 46, label: 'COST OVERRUN', value: 25_000_000, delay: 0.2, color: 0xff5544, weapon: WeaponType.INTERCEPTOR_BLOCK_II, quantity: 5 },
            { x: width / 2, y: 1490, radius: 44, label: 'URGENT NEED', value: 10_000_000, delay: 0.5, color: 0x8dff74, weapon: WeaponType.INTERCEPTOR, quantity: 10 }
        ];

        this.bumpers.forEach((bumper) => {
            this.add.circle(bumper.x, bumper.y, bumper.radius, bumper.color, 0.22).setStrokeStyle(4, bumper.color, 0.95);
            this.add.circle(bumper.x, bumper.y, Math.max(8, bumper.radius - 13), bumper.color, 0.12).setStrokeStyle(2, 0xffffff, 0.38);
            this.add.text(bumper.x, bumper.y, bumper.label, {
                fontSize: bumper.radius > 60 ? '22px' : '14px', color: '#fff4c9', fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 3
            }).setOrigin(0.5);
        });
    }

    private createFlippers(width: number) {
        // The source artwork hinges on the outside ends, not at the rectangle centers.
        this.leftFlipper = this.add.rectangle(270, this.flipperY, this.flipperLength, 38, 0xf5ead5, 0.88)
            .setOrigin(0, 0.5).setStrokeStyle(3, 0x8c5f2e).setAngle(18);
        this.rightFlipper = this.add.rectangle(width - 270, this.flipperY, this.flipperLength, 38, 0xf5ead5, 0.88)
            .setOrigin(1, 0.5).setStrokeStyle(3, 0x8c5f2e).setAngle(-18);
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
    }

    private createControls(width: number, height: number) {
        const launch = this.add.rectangle(width - 173, 1450, 118, 220, 0x78cfff, 0.26).setStrokeStyle(4, 0x9edcff, 0.95).setInteractive({ useHandCursor: true });
        this.add.text(width - 173, 1450, 'LAUNCH\nREQ', {
            fontSize: '21px', color: '#d8efff', align: 'center', fontStyle: 'bold', stroke: '#00111f', strokeThickness: 3
        }).setOrigin(0.5);
        this.add.text(width - 173, 1585, 'TAP HIGH / LOW\nTO AIM', {
            fontSize: '14px', color: '#b7eaff', align: 'center', fontStyle: 'bold'
        }).setOrigin(0.5);
        launch.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => {
            event.stopPropagation();
            this.launchBall(pointer);
        });

        this.authorizeButton = this.add.rectangle(width / 2, height - 112, 430, 84, 0x087a42, 0.92).setStrokeStyle(3, 0xa8ff93).setInteractive({ useHandCursor: true });
        this.add.text(width / 2, height - 112, 'AUTHORIZE CONTRACT', { fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.authorizeButton.on('pointerdown', () => this.authorizeContract());

        this.add.text(116, height - 48, 'EXIT TO MCLEAN', { fontSize: '18px', color: '#d3dce4', fontStyle: 'bold' }).setOrigin(0.5)
            .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('MansionScene'));

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < height - 430 || pointer.x > width - 280) return;
            this.pressFlipper(pointer.x < width / 2 ? 'left' : 'right', width);
        });
        this.input.on('pointerup', () => this.releaseFlippers(width));
        this.input.keyboard?.on('keydown-LEFT', () => this.pressFlipper('left', width));
        this.input.keyboard?.on('keydown-RIGHT', () => this.pressFlipper('right', width));
        this.input.keyboard?.on('keyup-LEFT', () => this.releaseFlipper('left', width));
        this.input.keyboard?.on('keyup-RIGHT', () => this.releaseFlipper('right', width));
        this.input.keyboard?.on('keydown-SPACE', () => this.launchBall());
        this.input.keyboard?.on('keydown-ENTER', () => this.authorizeContract());
        this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MansionScene'));
    }

    private launchBall(pointer?: Phaser.Input.Pointer) {
        if (this.ball || this.contractAuthorized) return;
        const { width } = this.scale;
        this.ball = this.add.circle(width - 173, 1365, 19, 0xf5f1dc).setStrokeStyle(3, 0xffffff);
        // Tapping higher/lower on the launch lane changes the aim. A small bounded
        // variance prevents identical launches from repeating the same route.
        const launchY = Phaser.Math.Clamp(pointer?.y ?? 1450, 1340, 1560);
        const playerAim = Phaser.Math.Linear(-300, 160, (launchY - 1340) / 220);
        this.ballVelocity.set(playerAim + Phaser.Math.Between(-70, 70), -Phaser.Math.Between(1010, 1130));
        this.bumperHits = 0;
        this.launchAge = 0;
        this.lastBumperHit.clear();
        this.statusText.setText('HIT BUMPERS TO INFLATE THE REQUIREMENT');
    }

    private pressFlipper(side: FlipperSide, width: number) {
        if (side === 'left') {
            this.leftPressed = true;
            this.leftFlipper.setAngle(-42);
        } else {
            this.rightPressed = true;
            this.rightFlipper.setAngle(42);
        }
        this.kickBall(side, width);
    }

    private releaseFlipper(side: FlipperSide, _width: number) {
        if (side === 'left') {
            this.leftPressed = false;
            this.leftFlipper.setAngle(18);
        } else {
            this.rightPressed = false;
            this.rightFlipper.setAngle(-18);
        }
    }

    private releaseFlippers(width: number) {
        if (this.leftPressed) this.releaseFlipper('left', width);
        if (this.rightPressed) this.releaseFlipper('right', width);
    }

    private kickBall(side: FlipperSide, width: number) {
        if (!this.ball || this.ball.y < this.flipperY - 180 || this.ball.y > this.flipperY + 110) return;
        const pivotX = side === 'left' ? 270 : width - 270;
        if (Math.abs(this.ball.x - pivotX) > this.flipperLength + 30) return;
        this.ballVelocity.set(side === 'left' ? 620 : -620, -1120);
    }

    update(_time: number, delta: number) {
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
        this.checkBumpers();
        // A pinball should eventually return to the player. This prevents a perfect
        // bumper orbit from farming one contract forever while preserving skillful play.
        if (this.launchAge > 18 || this.bumperHits >= this.maxBumperHitsPerBall) {
            this.ballVelocity.y = Math.max(this.ballVelocity.y, 700);
            this.statusText.setText('BOARD TILT — BALL RETURNING TO PLUNGER');
        }
        if (this.ball.y > height - 170) this.drainBall();
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
            const endX = flipper.pivotX + Math.cos(flipper.angle) * (flipper.side === 'left' ? this.flipperLength : -this.flipperLength);
            const endY = this.flipperY + Math.sin(flipper.angle) * (flipper.side === 'left' ? this.flipperLength : -this.flipperLength);
            const distance = Math.hypot(this.ball.x - endX, this.ball.y - endY);
            if (distance > this.ballRadius + 28 || this.ball.y < this.flipperY - 65 || this.ball.y > this.flipperY + 55) continue;
            this.ball.y = this.flipperY - this.ballRadius - 12;
            this.ballVelocity.set(flipper.side === 'left' ? 620 : -620, -1120);
        }
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

    private showBumperHit(bumper: Bumper) {
        const flash = this.add.text(bumper.x, bumper.y - bumper.radius - 22, `+$${(bumper.value / 1e6).toFixed(0)}M`, {
            fontSize: '30px', color: '#9dff8e', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.tweens.add({ targets: flash, y: flash.y - 65, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
    }

    private addToProcurement(weapon: WeaponType, quantity: number, delay: number, value: number) {
        this.procurementList[weapon] = (this.procurementList[weapon] ?? 0) + quantity;
        this.leadTimeDelay += delay;
        this.score += value;
        currentRun.taxpayerBurn += value;
        currentRun.contractorProfit += value * 0.15;
        this.statusText.setText('EMERGENCY REQUIREMENT EXPANDED — KEEP HITTING BUMPERS');
        this.updateHUD();
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
        this.delayText.setText(`VALUE: $${this.score.toLocaleString()}  •  DELIVERY DELAY: +${this.leadTimeDelay.toFixed(1)} YEARS`);
        this.profitText.setText(`CONTRACTOR PROFIT: $${currentRun.contractorProfit.toLocaleString()}`);
        this.authorizeButton?.setFillStyle(this.score > 0 ? 0x087a42 : 0x3c4a55, this.score > 0 ? 0.92 : 0.6);
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
