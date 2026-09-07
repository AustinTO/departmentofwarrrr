import * as Phaser from 'phaser';
import { currentRun } from '../state/RunState';
import { CHARACTERS, characterLine } from '../game/Characters';
import { ProcurementPlanckPhysics } from '../game/ProcurementPlanckPhysics';
import type { ProcurementBumper } from '../game/ProcurementTableDefinition';
import { PINBALL_BOARDS, PINBALL_SIZING, PLAYFIELD_LAYOUT, SHOOTER_LANE, countDropTargets, skillGateFromTable, flipperFromTable, type PinballBoardId } from '../game/PinballBoards';
import type { TableObject } from '../game/ProcurementTableDefinition';
import { ProcurementSystem } from '../game/ProcurementSystem';
import { PauseMenu } from '../ui/PauseMenu';
import { ContractCard } from '../ui/ContractCard';
import { TableAuthorOverlay } from '../ui/TableAuthorOverlay';
import { isAuthorHashEnabled, resolveBoardTable } from '../game/TableAuthorStore';
import { audioManager } from '../managers/AudioManager';
import { SHEETS } from '../game/Sprites';

type FlipperSide = 'left' | 'right';

/** When true, next ProcurementScene create shows the board picker even if a board is already selected. */
let forceBoardPicker = false;

/** Touch-first procurement pinball: Planck physics, painted board, contract satire. */
export class ProcurementScene extends Phaser.Scene {
    private ballSprites: Phaser.GameObjects.Image[] = [];
    private contract = new ProcurementSystem();
    private valueText!: Phaser.GameObjects.Text;
    private delayText!: Phaser.GameObjects.Text;
    private profitText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private authorizeButton!: Phaser.GameObjects.Rectangle;
    private bumpers: readonly ProcurementBumper[] = [];
    private bumperSprites = new Map<string, Phaser.GameObjects.Image>();
    private bumperHalos = new Map<string, Phaser.GameObjects.Arc>();
    private slingSprites = new Map<string, Phaser.GameObjects.Image>();
    private targetSprites = new Map<string, Phaser.GameObjects.Image>();
    private postSprites = new Map<string, Phaser.GameObjects.Arc>();
    private laneGlows = new Map<string, Phaser.GameObjects.Graphics>();
    private leftFlipper!: Phaser.GameObjects.Container;
    private rightFlipper!: Phaser.GameObjects.Container;
    private flipperHeld: Record<FlipperSide, Set<number>> = { left: new Set(), right: new Set() };
    private plunger?: Phaser.GameObjects.Image;
    private plungerPull = 0;
    private plungerDragging = false;
    private contractAuthorized = false;
    private spaceCharging = false;
    private launchChargeStartedAt = 0;
    private comboText!: Phaser.GameObjects.Text;
    private multiballText!: Phaser.GameObjects.Text;
    private phaseText!: Phaser.GameObjects.Text;
    private skillLane!: Phaser.GameObjects.Image;
    private skillArmedRing?: Phaser.GameObjects.Arc;
    private targetBankText!: Phaser.GameObjects.Text;
    private targetBankHits = 0;
    private adviserPortrait!: Phaser.GameObjects.Image;
    private adviserName!: Phaser.GameObjects.Text;
    private adviserLine!: Phaser.GameObjects.Text;
    private planck?: ProcurementPlanckPhysics;
    private paused = false;
    private pauseMenu?: PauseMenu;
    private showingCard = false;
    private ballTrail?: Phaser.GameObjects.Particles.ParticleEmitter;
    private boardId: PinballBoardId = 'appropriations';
    private flipperY = PLAYFIELD_LAYOUT.originY + 1420;
    private readonly ballRadius = PINBALL_SIZING.ballRadiusPx;
    private workingTable: TableObject[] = [];
    private railGraphics?: Phaser.GameObjects.Graphics;
    private author?: TableAuthorOverlay;
    private authorEnabled = false;

    constructor() {
        super('ProcurementScene');
    }

    init(_data?: { skipPicker?: boolean }) {
        this.ballSprites = [];
        this.contract.reset();
        this.contractAuthorized = false;
        this.planck = undefined;
        this.plungerPull = 0;
        this.plungerDragging = false;
        this.flipperHeld = { left: new Set(), right: new Set() };
        this.paused = false;
        this.pauseMenu = undefined;
        this.showingCard = false;
        this.targetBankHits = 0;
        this.bumperSprites.clear();
        this.bumperHalos.clear();
        this.slingSprites.clear();
        this.targetSprites.clear();
        this.postSprites.clear();
        this.laneGlows.clear();
        this.author?.destroy();
        this.author = undefined;
        this.railGraphics = undefined;
        this.authorEnabled = isAuthorHashEnabled();
        currentRun.syncUnlocks();
        this.boardId = currentRun.selectedBoard;
    }

    create() {
        this.input.enabled = true;
        this.events.on('wake', () => { this.input.enabled = true; });
        const { width, height } = this.scale;
        const unlocked = currentRun.availableBoards();
        if (!unlocked.includes(this.boardId)) {
            this.boardId = unlocked[0] ?? 'appropriations';
            currentRun.selectedBoard = this.boardId;
        }

        if (forceBoardPicker && unlocked.length > 1) {
            forceBoardPicker = false;
            this.showBoardPicker(width, height, unlocked);
            return;
        }
        forceBoardPicker = false;
        this.startBoard(this.boardId);
    }

    private showBoardPicker(width: number, height: number, boards: PinballBoardId[]) {
        this.add.rectangle(width / 2, height / 2, width, height, 0x061018, 0.96);
        this.add.text(width / 2, 160, 'SELECT PROCUREMENT BOARD', {
            fontSize: '42px', color: '#f3ca67', fontStyle: 'bold', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5);
        this.add.text(width / 2, 220, 'New tables unlock as the campaign escalates.', {
            fontSize: '22px', color: '#9bcbd4'
        }).setOrigin(0.5);

        boards.forEach((id, index) => {
            const board = PINBALL_BOARDS[id];
            const y = 360 + index * 220;
            this.add.rectangle(width / 2, y, width - 120, 180, 0x0d2433, 0.95)
                .setStrokeStyle(4, board.accent)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    currentRun.selectedBoard = id;
                    currentRun.save();
                    this.scene.restart();
                });
            this.add.image(180, y, board.playfieldKey).setDisplaySize(140, 150);
            this.add.text(300, y - 36, board.name, {
                fontSize: '32px', color: '#ffffff', fontStyle: 'bold'
            });
            this.add.text(300, y + 12, board.subtitle, {
                fontSize: '20px', color: '#9bcbd4', wordWrap: { width: width - 380 }
            });
        });
    }

    private startBoard(boardId: PinballBoardId) {
        this.boardId = boardId;
        this.workingTable = resolveBoardTable(boardId);
        const { width, height } = this.scale;
        this.createBoardShell(width, height);
        this.createRails();
        this.createTableHardware();
        this.add.rectangle(0, 0, width, 430, 0x02070d, 0.78).setOrigin(0);
        this.createHud(width);
        this.setPhase('01 LOAD', '#9bcbd4');
        this.createBumpers(width);
        this.createFlippers(width);
        this.createControls(width, height);
        this.planck = new ProcurementPlanckPhysics(width, height, this.boardId, this.workingTable);
        this.ensureBallSprite(0).setPosition(SHOOTER_LANE.readyX, SHOOTER_LANE.readyY).setVisible(true);
        this.createBallTrail();
        this.showAdviser('peter', 'procurement');

        this.add.rectangle(90, 48, 120, 60, 0x2a3a4a, 0.95)
            .setStrokeStyle(3, 0xffd166)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.togglePause());
        this.add.text(90, 48, 'PAUSE', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.addBoardChangeButton(width);
        this.setupAuthorMode();
    }

    private setupAuthorMode() {
        this.input.keyboard?.on('keydown-BACKTICK', () => this.toggleAuthorMode());
        this.input.keyboard?.on('keydown-F1', () => this.toggleAuthorMode());
        this.input.keyboard?.on('keydown-T', () => {
            if (this.author) this.resetBallToPlunger();
        });
        this.input.keyboard?.on('keydown-HOME', () => {
            if (this.author) this.resetBallToPlunger();
        });
        if (!this.authorEnabled) return;
        this.author = new TableAuthorOverlay(
            this,
            this.boardId,
            this.workingTable,
            (table) => this.rebuildFromAuthor(table),
            () => this.resetBallToPlunger()
        );
        this.statusText.setText('AUTHOR MODE — Del deletes • T resets ball • Ctrl+S saves');
    }

    private toggleAuthorMode() {
        if (this.author) {
            const next = !this.author.isEnabled();
            this.author.setEnabled(next);
            this.authorEnabled = next;
            this.statusText.setText(next ? 'AUTHOR MODE ON — Del deletes • T resets ball' : 'AUTHOR MODE OFF');
            return;
        }
        this.authorEnabled = true;
        this.author = new TableAuthorOverlay(
            this,
            this.boardId,
            this.workingTable,
            (table) => this.rebuildFromAuthor(table),
            () => this.resetBallToPlunger()
        );
        this.statusText.setText('AUTHOR MODE ON — Del deletes • T / Home resets ball');
    }

    private resetBallToPlunger() {
        if (!this.planck) return;
        this.planck.parkInShooter();
        this.ensureBallSprite(0).setPosition(SHOOTER_LANE.readyX, SHOOTER_LANE.readyY).setVisible(true);
        this.syncBallSprites();
        this.author?.clearTrajectory();
        this.pulseSkillArmed(false);
        this.skillLane?.setTexture('pinball_lane_off');
        this.statusText.setText('BALL RESET — pull the plunger');
        this.setPhase('01 READY', '#7dff9a');
    }

    private rebuildFromAuthor(table: TableObject[]) {
        this.workingTable = table.map((e) => ({
            ...e,
            points: e.points?.map(([x, y]) => [x, y] as [number, number])
        }));
        const { width, height } = this.scale;
        this.planck = new ProcurementPlanckPhysics(width, height, this.boardId, this.workingTable);
        this.redrawRails();
        // Always park after geometry edits — weak mid-air relaunches were jamming the ball.
        this.resetBallToPlunger();
        this.author?.clearTrajectory();
    }

    private addBoardChangeButton(width: number) {
        if (currentRun.availableBoards().length <= 1) return;
        this.add.rectangle(width - 120, 48, 200, 60, 0x2a3a4a, 0.95)
            .setStrokeStyle(3, PINBALL_BOARDS[this.boardId].accent)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                forceBoardPicker = true;
                this.scene.restart();
            });
        this.add.text(width - 120, 48, 'CHANGE BOARD', {
            fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    private createBoardShell(width: number, height: number) {
        const board = PINBALL_BOARDS[this.boardId];
        // 1:1 art placement — rails are authored in the same coordinate space.
        this.add.image(
            PLAYFIELD_LAYOUT.originX + PLAYFIELD_LAYOUT.artWidth / 2,
            PLAYFIELD_LAYOUT.originY + PLAYFIELD_LAYOUT.artHeight / 2,
            board.playfieldKey
        )
            .setDisplaySize(PLAYFIELD_LAYOUT.artWidth, PLAYFIELD_LAYOUT.artHeight)
            .setAlpha(0.96)
            .setDepth(0);
        this.add.rectangle(width / 2, PLAYFIELD_LAYOUT.centerY, width - 40, PLAYFIELD_LAYOUT.artHeight + 20, 0x071b28, 0.12)
            .setStrokeStyle(6, board.accent, 0.35)
            .setDepth(1);
        this.createCabinetLights(width, height);

        const skill = skillGateFromTable(this.workingTable);
        const skillX = skill?.x ?? width / 2;
        const skillY = skill?.y ?? PLAYFIELD_LAYOUT.originY + 180;
        const skillW = Math.max(220, (skill?.width ?? 170) * 1.55);
        this.skillLane = this.add.image(skillX, skillY, 'pinball_skill_gate')
            .setDisplaySize(skillW, 88)
            .setDepth(5);
        this.skillArmedRing = this.add.circle(skillX, skillY, Math.max(80, skillW * 0.36), board.accent, 0)
            .setStrokeStyle(4, board.accent, 0.0)
            .setDepth(4);
        this.add.text(skillX, skillY - 44, 'SKILL SHOT', {
            fontSize: '16px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(6);
        this.add.text(width / 2, 438, board.subtitle.toUpperCase(), {
            fontSize: '15px', color: '#9bcbd4', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(20);
    }

    /**
     * Thin collision outlines only — painted ramps in the art stay the visual rails.
     * Overlay must sit exactly on physics polylines.
     */
    private createRails() {
        this.redrawRails();
    }

    private redrawRails() {
        this.railGraphics?.destroy();
        this.laneGlows.forEach((g) => g.destroy());
        this.laneGlows.clear();
        const accent = PINBALL_BOARDS[this.boardId].accent;
        const table = this.workingTable;
        const outline = this.add.graphics().setDepth(3);
        this.railGraphics = outline;

        const strokePoly = (
            points: Array<[number, number]>,
            width: number,
            color: number,
            alpha: number
        ) => {
            outline.lineStyle(width, color, alpha);
            outline.beginPath();
            outline.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i++) outline.lineTo(points[i][0], points[i][1]);
            outline.strokePath();
        };

        table.forEach((entry) => {
            if ((entry.kind !== 'wall' && entry.kind !== 'slide') || !entry.points || entry.points.length < 2) return;
            const isSlide = entry.kind === 'slide';
            strokePoly(entry.points, isSlide ? 14 : 11, accent, isSlide ? 0.22 : 0.16);
            strokePoly(entry.points, isSlide ? 4 : 3, 0xffffff, 0.28);

            if (isSlide) {
                const lane = this.add.graphics().setDepth(4).setAlpha(0.12);
                lane.lineStyle(12, accent, 1);
                lane.beginPath();
                lane.moveTo(entry.points[0][0], entry.points[0][1]);
                for (let i = 1; i < entry.points.length; i++) {
                    lane.lineTo(entry.points[i][0], entry.points[i][1]);
                }
                lane.strokePath();
                this.laneGlows.set(entry.id, lane);
            }
        });
        this.author?.redraw();
    }

    /** Posts, slings, drop targets — interactive hardware matching Planck fixtures. */
    private createTableHardware() {
        const table = this.workingTable;
        table.forEach((entry) => {
            if (entry.kind === 'sling') this.createSlingVisual(entry);
            if (entry.kind === 'post') this.createPostVisual(entry);
            if (entry.kind === 'target' && entry.event !== 'SKILL_SHOT') this.createTargetVisual(entry);
        });
        const bankTotal = countDropTargets(table);
        const skill = skillGateFromTable(table);
        const bankY = (skill?.y ?? 500) + 270;
        this.targetBankText = this.add.text(this.scale.width / 2, bankY, `TARGET BANK 0/${bankTotal}`, {
            fontSize: '18px', color: '#9bcbd4', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(7);
    }

    private createSlingVisual(entry: TableObject) {
        const sprite = this.add.image(entry.x, entry.y, 'pinball_sling')
            .setDisplaySize((entry.width ?? 120) * 1.15, (entry.height ?? 28) * 3.2)
            .setRotation(entry.angle ?? 0)
            .setDepth(6);
        if ((entry.angle ?? 0) < 0) sprite.setFlipX(true);
        this.slingSprites.set(entry.id, sprite);
    }

    private createPostVisual(entry: TableObject) {
        const r = entry.radius ?? 14;
        const rubber = this.add.circle(entry.x, entry.y, r + 4, 0x1a2430, 0.95)
            .setStrokeStyle(3, 0xd7ecff, 0.95)
            .setDepth(6);
        this.add.circle(entry.x, entry.y, r * 0.45, PINBALL_BOARDS[this.boardId].accent, 0.75).setDepth(7);
        this.postSprites.set(entry.id, rubber);
    }

    private createTargetVisual(entry: TableObject) {
        const sprite = this.add.image(entry.x, entry.y, 'pinball_target')
            .setDisplaySize(entry.width ?? 64, (entry.height ?? 28) * 1.4)
            .setDepth(6)
            .setTint(0xffd166);
        this.targetSprites.set(entry.id, sprite);
    }

    private createCabinetLights(width: number, height: number) {
        const lights: Phaser.GameObjects.Arc[] = [];
        for (let y = 520; y < height - 250; y += 104) {
            [42, width - 42].forEach((x, index) => {
                const light = this.add.circle(x, y, 7, index === 0 ? 0x5de6ff : 0xffd166, 0.72)
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(4);
                lights.push(light);
            });
        }
        lights.forEach((light, index) => {
            this.tweens.add({
                targets: light, alpha: 0.16, scale: 1.85, duration: 480,
                delay: index * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut'
            });
        });
    }

    private createHud(width: number) {
        this.add.image(width / 2, 210, SHEETS.uiChrome.key, 1)
            .setDisplaySize(1000, 300)
            .setAlpha(0.55);

        this.add.text(width / 2, 42, PINBALL_BOARDS[this.boardId].name, {
            fontSize: '40px', color: '#f3ca67', fontStyle: 'bold', stroke: '#000000', strokeThickness: 7
        }).setOrigin(0.5);
        this.profitText = this.add.text(42, 95, '', { fontSize: '24px', color: '#9fffa6', wordWrap: { width: 310 } });
        this.valueText = this.add.text(42, 138, '', { fontSize: '22px', color: '#ffffff', wordWrap: { width: 310 } });
        this.delayText = this.add.text(width - 42, 95, '', {
            fontSize: '22px', color: '#ffd47c', align: 'right', wordWrap: { width: 310 }
        }).setOrigin(1, 0);
        this.statusText = this.add.text(width / 2, 405, 'PULL THE PLUNGER — INFLATE THE REQUIREMENT', {
            fontSize: '20px', color: '#a7dfff', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);
        this.phaseText = this.add.text(width / 2, 428, '01 LOAD  •  02 PLAY  •  03 REVIEW  •  04 AUTHORIZE', {
            fontSize: '14px', color: '#6d9eae', fontStyle: 'bold', letterSpacing: 1
        }).setOrigin(0.5);
        this.comboText = this.add.text(width - 42, 178, 'INFLATION COMBO x1', {
            fontSize: '22px', color: '#ffd47c', fontStyle: 'bold'
        }).setOrigin(1, 0);
        this.multiballText = this.add.text(width / 2, 178, '', {
            fontSize: '22px', color: '#ff765e', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.rectangle(width / 2, 284, 160, 154, 0x321d16, 0.96).setStrokeStyle(6, 0xb98745);
        this.add.rectangle(width / 2, 357, 210, 28, 0x1d1110, 0.98).setStrokeStyle(3, 0xb98745);
        this.adviserPortrait = this.add.image(width / 2, 348, CHARACTERS.peter.portraitKey)
            .setDisplaySize(122, 154).setOrigin(0.5, 1);
        this.adviserName = this.add.text(width / 2, 366, '', {
            fontSize: '17px', fontStyle: 'bold', color: '#f3ca67', align: 'center'
        }).setOrigin(0.5);
        this.adviserLine = this.add.text(width / 2, 385, '', {
            fontSize: '15px', color: '#eaf6ff', align: 'center', wordWrap: { width: 560 }, lineSpacing: 2
        }).setOrigin(0.5, 0);
        this.updateHUD();
    }

    private createBumpers(width: number) {
        this.bumpers = PINBALL_BOARDS[this.boardId].bumpers;
        this.bumpers.forEach((bumper) => {
            const halo = this.add.circle(bumper.x, bumper.y, bumper.radius * 1.42, bumper.outcome === 'inflate' ? 0xffc24d : 0x7dff9d, 0.14)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(5);
            this.bumperHalos.set(bumper.id, halo);
            const badge = this.add.image(bumper.x, bumper.y, 'sheet_pinball_bumpers', bumper.badgeFrame)
                .setDisplaySize(bumper.radius * 2.35, bumper.radius * 2.35)
                .setDepth(6);
            this.bumperSprites.set(bumper.id, badge);
            this.add.text(bumper.x, bumper.y + bumper.radius + 14, bumper.outcome === 'inflate' ? '▲ INFLATE' : '▼ EFFICIENCY', {
                fontSize: '13px',
                color: bumper.outcome === 'inflate' ? '#ffd166' : '#9dff8e',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(6);
        });
        this.add.text(width / 2, 1585, 'GOLD BUMPERS INFLATE  •  GREEN SHRINKS THE CONTRACT', {
            fontSize: '15px', color: '#9bcbd4', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    private createFlippers(width: number) {
        const table = this.workingTable;
        const left = flipperFromTable(table, 'left');
        const right = flipperFromTable(table, 'right');
        this.flipperY = left?.y ?? right?.y ?? PLAYFIELD_LAYOUT.originY + 1420;
        this.leftFlipper = this.createVisibleFlipper(left?.x ?? 270, 'left');
        this.rightFlipper = this.createVisibleFlipper(right?.x ?? width - 270, 'right');
        this.add.text(left?.x ?? 220, this.flipperY + 88, 'LEFT FLIPPER\nHOLD TO FLIP', {
            fontSize: '18px', color: '#d8efff', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);
        this.add.text(right?.x ?? width - 220, this.flipperY + 88, 'RIGHT FLIPPER\nHOLD TO FLIP', {
            fontSize: '18px', color: '#d8efff', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);
    }

    private createVisibleFlipper(x: number, side: FlipperSide) {
        const container = this.add.container(x, this.flipperY).setDepth(12);
        const tip = PINBALL_SIZING.flipperTipOffsetPx;
        const blade = this.add.image(side === 'left' ? tip - 20 : -(tip - 20), 0, side === 'left' ? 'flipper_left' : 'flipper_right')
            .setDisplaySize(290, 90);
        container.add(blade);
        container.setRotation(side === 'left' ? Phaser.Math.DegToRad(18) : Phaser.Math.DegToRad(-18));
        return container;
    }

    private createBallTrail() {
        if (!this.textures.exists('particle')) {
            const g = this.add.graphics();
            g.fillStyle(0xffffff);
            g.fillRect(0, 0, 4, 4);
            g.generateTexture('particle', 4, 4);
            g.destroy();
        }
        this.ballTrail = this.add.particles(0, 0, 'particle', {
            speed: { min: 10, max: 40 },
            scale: { start: 0.9, end: 0 },
            alpha: { start: 0.55, end: 0 },
            lifespan: 280,
            tint: [0x5de6ff, 0xffd166, 0xffffff],
            frequency: 28,
            maxAliveParticles: 60,
            follow: this.ballSprites[0]
        }).setDepth(7);
    }

    private createControls(width: number, height: number) {
        const plungerX = width - 82;
        const plungerY = height - 182;
        this.plunger = this.add.image(plungerX, plungerY, 'pinball_plunger')
            .setDisplaySize(118, 220)
            .setInteractive({ useHandCursor: true })
            .setDepth(15);
        this.add.text(plungerX, plungerY - 6, 'PULL\n& FIRE', {
            fontSize: '21px', color: '#d8efff', align: 'center', fontStyle: 'bold', stroke: '#00111f', strokeThickness: 3
        }).setOrigin(0.5).setDepth(16);
        this.plunger.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Event) => {
            event.stopPropagation();
            if (this.planck?.getBallState() === 'playing' || this.contractAuthorized || this.showingCard) return;
            this.plungerDragging = true;
            this.updatePlungerPull(pointer, plungerY);
        });

        this.authorizeButton = this.add.rectangle(width / 2, height - 112, 430, 84, 0x087a42, 0.92)
            .setStrokeStyle(3, 0xa8ff93)
            .setInteractive({ useHandCursor: true })
            .setDepth(20);
        this.add.text(width / 2, height - 112, 'AUTHORIZE CONTRACT', {
            fontSize: '32px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(21);
        this.authorizeButton.on('pointerdown', () => this.authorizeContract());

        this.add.image(width / 2, this.flipperY + 48, 'pinball_drain').setDisplaySize(310, 76).setDepth(-1);
        this.add.text(116, height - 48, 'EXIT TO MCLEAN', { fontSize: '18px', color: '#d3dce4', fontStyle: 'bold' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MansionScene'));

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.showingCard || this.paused) return;
            if (this.author?.isEnabled()) return;
            if (pointer.y < height - 430 || pointer.x > width - 280) return;
            this.pressFlipper(pointer.x < width / 2 ? 'left' : 'right', pointer.id);
        });
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            this.releaseFlipper(pointer.x < width / 2 ? 'left' : 'right', pointer.id);
            // Also release both if finger lifts anywhere — safer on touch.
            this.releaseFlipper('left', pointer.id);
            this.releaseFlipper('right', pointer.id);
        });
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.plungerDragging) this.updatePlungerPull(pointer, plungerY);
        });
        this.input.on('pointerup', () => this.finishPlungerPull(plungerY));
        this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => {
            this.releaseFlipper('left', pointer.id);
            this.releaseFlipper('right', pointer.id);
            this.finishPlungerPull(plungerY);
        });
        this.input.on('gameout', () => this.finishPlungerPull(plungerY));
        this.input.keyboard?.on('keydown-F', () => this.pressFlipper('left', -1));
        this.input.keyboard?.on('keydown-J', () => this.pressFlipper('right', -2));
        this.input.keyboard?.on('keyup-F', () => this.releaseFlipper('left', -1));
        this.input.keyboard?.on('keyup-J', () => this.releaseFlipper('right', -2));
        this.input.keyboard?.on('keydown-SPACE', () => {
            if (this.planck?.getBallState() !== 'playing' && !this.contractAuthorized && !this.spaceCharging && !this.showingCard) {
                this.spaceCharging = true;
                this.launchChargeStartedAt = this.time.now;
                this.statusText.setText('HOLD SPACE — CHARGE THE LAUNCH');
            }
        });
        this.input.keyboard?.on('keyup-SPACE', () => {
            if (!this.spaceCharging) return;
            this.spaceCharging = false;
            this.launchBall(this.getLaunchCharge());
        });
        this.input.keyboard?.on('keydown-ENTER', () => {
            if (!this.paused && !this.showingCard) this.authorizeContract();
        });
        this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
    }

    private togglePause() {
        if (this.contractAuthorized || this.showingCard) return;
        if (this.paused) {
            this.resumeFromPause();
            return;
        }
        this.paused = true;
        this.pauseMenu = new PauseMenu(this, {
            title: 'PROCUREMENT PAUSED',
            onResume: () => this.resumeFromPause(),
            onQuitToTitle: () => {
                currentRun.save();
                this.sound.stopAll();
                audioManager.stopMusic();
                this.scene.start('TitleScene');
            }
        });
    }

    private resumeFromPause() {
        this.paused = false;
        this.pauseMenu?.destroy();
        this.pauseMenu = undefined;
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
        this.launchBall(charge);
        this.tweens.add({ targets: this.plunger, y: baseY, duration: 100, ease: 'Quad.easeOut' });
        this.plungerPull = 0;
    }

    private launchBall(charge = 0.35) {
        if (this.paused || this.showingCard || !this.planck) return;
        if (this.contractAuthorized || this.planck.getBallState() === 'playing') return;
        // Power only — any meaningful left aim scrapes the divider and dies in the tube.
        // The top exit hood is what feeds the ball into play.
        const power = Phaser.Math.Linear(40, 52, charge);
        this.planck.relaunch(SHOOTER_LANE.launchX, SHOOTER_LANE.launchY, power, 0);
        this.syncBallSprites();
        this.author?.clearTrajectory();
        this.skillLane.setTexture('pinball_lane_on');
        this.pulseSkillArmed(true);
        this.statusText.setText('LAUNCHED — up the tube, hood kicks left into play');
        this.setPhase('02 PLAY', '#7df4ff');
        this.cameras.main.flash(80, 90, 200, 255);
    }

    private pulseSkillArmed(armed: boolean) {
        if (!this.skillArmedRing) return;
        this.tweens.killTweensOf(this.skillArmedRing);
        if (!armed) {
            this.skillArmedRing.setStrokeStyle(4, PINBALL_BOARDS[this.boardId].accent, 0);
            this.skillArmedRing.setScale(1).setAlpha(1);
            return;
        }
        this.skillArmedRing.setStrokeStyle(5, PINBALL_BOARDS[this.boardId].accent, 0.85);
        this.tweens.add({
            targets: this.skillArmedRing, scale: 1.18, alpha: 0.35, duration: 420,
            yoyo: true, repeat: -1, ease: 'Sine.inOut'
        });
    }

    private pressFlipper(side: FlipperSide, pointerId: number) {
        if (this.paused || this.showingCard || !this.planck) return;
        this.flipperHeld[side].add(pointerId);
        this.planck.setFlipper(side, true);
    }

    private releaseFlipper(side: FlipperSide, pointerId: number) {
        this.flipperHeld[side].delete(pointerId);
        if (this.flipperHeld[side].size === 0) {
            this.planck?.setFlipper(side, false);
        }
    }

    private ensureBallSprite(index: number) {
        while (this.ballSprites.length <= index) {
            const sprite = this.add.image(0, 0, 'pinball_ball')
                .setDisplaySize(this.ballRadius * 2, this.ballRadius * 2)
                .setDepth(8)
                .setVisible(false);
            this.ballSprites.push(sprite);
        }
        return this.ballSprites[index];
    }

    private syncBallSprites() {
        const balls = this.planck?.getBalls() ?? [];
        this.ballSprites.forEach((sprite, index) => {
            const ball = balls[index];
            if (!ball) {
                sprite.setVisible(false);
                return;
            }
            sprite.setVisible(true).setPosition(ball.x, ball.y);
        });
        balls.forEach((_ball, index) => this.ensureBallSprite(index));
        if (this.ballTrail && this.ballSprites[0]) {
            this.ballTrail.startFollow(this.ballSprites[0]);
        }
        const count = balls.length;
        this.multiballText.setText(count > 1 ? `MULTIBALL x${count}` : '');
    }

    update(_time: number, delta: number) {
        if (this.paused || this.showingCard) return;
        if (this.contract.state.combo > 0 && this.time.now > this.comboExpiresAt) {
            this.contract.state.combo = 0;
            this.comboText.setText('INFLATION COMBO x1');
        }
        if (this.spaceCharging) {
            this.statusText.setText(`HOLD SPACE — LAUNCH POWER ${Math.round(this.getLaunchCharge() * 100)}%`);
        }
        if (!this.planck) return;

        this.planck.step(delta);
        const angles = this.planck.getFlipperAngles();
        this.leftFlipper.setRotation(angles.left);
        this.rightFlipper.setRotation(angles.right);
        this.syncBallSprites();
        if (this.author?.isEnabled()) {
            const primary = this.planck.getBall();
            this.author.sampleBall(primary.x, primary.y);
            this.author.redraw();
        }

        this.planck.consumeEvents().forEach((event) => {
            if (event.type === 'BUMPER_HIT') {
                const bumper = this.bumpers[event.index ?? 0];
                if (!bumper) return;
                this.handleBumper(bumper);
            }
            if (event.type === 'SLINGSHOT_HIT') {
                this.statusText.setText('SLINGSHOT KICK — REQUIREMENT ACCELERATING');
                this.flashSling(event.id);
                this.cameras.main.shake(70, 0.004);
            }
            if (event.type === 'TARGET_HIT') {
                this.flashTarget(event.id);
                const bankTotal = countDropTargets(this.workingTable);
                this.targetBankHits = Math.min(bankTotal, this.targetBankHits + 1);
                this.targetBankText.setText(`TARGET BANK ${this.targetBankHits}/${bankTotal}`);
                const inflate = this.bumpers.find((entry) => entry.outcome === 'inflate');
                if (inflate) {
                    this.handleBumper({
                        ...inflate,
                        id: event.id ?? 'target-bank',
                        quantity: 1,
                        delay: 0.05,
                        value: 1_000_000_000 + this.targetBankHits * 250_000_000,
                        label: 'TARGET BANK'
                    });
                }
                this.statusText.setText(
                    this.targetBankHits >= bankTotal
                        ? 'TARGET BANK CLEARED — SUPPLEMENTAL BONUS'
                        : 'TARGET BANK HIT — REQUIREMENT REWRITTEN'
                );
                if (this.targetBankHits >= bankTotal && this.planck) {
                    this.targetBankHits = 0;
                    this.targetBankText.setText(`TARGET BANK 0/${bankTotal}`);
                    const spawned = this.planck.spawnExtraBalls(1);
                    if (spawned > 0) this.statusText.setText('TARGET BANK COMPLETE — BONUS BALL');
                }
            }
            if (event.type === 'POST_HIT') {
                this.flashPost(event.id);
            }
            if (event.type === 'LANE_HIT') {
                this.flashLane(event.id);
                this.statusText.setText(`WIRE LANE — ${event.id ?? 'FLOW'}`);
            }
            if (event.type === 'LANE_ENTER') {
                this.flashLane(event.id);
                this.statusText.setText(`ENTER ${event.id?.toUpperCase() ?? 'LANE'}`);
                this.cameras.main.shake(40, 0.002);
            }
            if (event.type === 'LANE_EXIT') {
                this.flashLane(event.id);
                this.statusText.setText(`EXIT ${event.id?.toUpperCase() ?? 'LANE'} — SCORE PATH`);
                this.cameras.main.flash(80, 120, 255, 180);
            }
            if (event.type === 'SKILL_SHOT') {
                const result = this.contract.recordSkillShot();
                this.statusText.setText(result.status);
                this.skillLane.setTexture('pinball_skill_gate');
                this.pulseSkillArmed(false);
                const skill = skillGateFromTable(this.workingTable);
                this.showHitBurst(skill?.x ?? this.scale.width / 2, skill?.y ?? 500, true);
                this.cameras.main.flash(120, 255, 210, 80);
                this.showAdviser('addington', 'procurement');
                this.updateHUD();
            }
            if (event.type === 'BALL_DRAINED') {
                this.pulseSkillArmed(false);
                this.syncBallSprites();
                this.onBallDrained();
            }
            if (event.type === 'SHOOTER_RETURN') {
                this.pulseSkillArmed(false);
                this.ensureBallSprite(0).setPosition(SHOOTER_LANE.readyX, SHOOTER_LANE.readyY).setVisible(true);
                this.statusText.setText('SHOT FELL BACK IN THE TUBE — PULL THE PLUNGER AGAIN');
                this.setPhase('01 LOAD', '#9bcbd4');
            }
        });
    }

    private flashSling(id?: string) {
        const sprite = id ? this.slingSprites.get(id) : undefined;
        if (!sprite) return;
        this.tweens.add({
            targets: sprite, scaleX: sprite.scaleX * 1.18, scaleY: sprite.scaleY * 0.82,
            duration: 70, yoyo: true
        });
        this.showHitBurst(sprite.x, sprite.y, true);
    }

    private flashTarget(id?: string) {
        const sprite = id ? this.targetSprites.get(id) : undefined;
        if (!sprite) return;
        sprite.setTint(0xffffff);
        this.tweens.add({
            targets: sprite, scale: sprite.scale * 1.25, duration: 80, yoyo: true,
            onComplete: () => sprite.setTint(0xffd166)
        });
        this.showHitBurst(sprite.x, sprite.y, true);
    }

    private flashPost(id?: string) {
        const sprite = id ? this.postSprites.get(id) : undefined;
        if (!sprite) return;
        this.tweens.add({
            targets: sprite, scale: 1.35, alpha: 0.55, duration: 90, yoyo: true
        });
    }

    private flashLane(id?: string) {
        if (!id) return;
        const direct = this.laneGlows.get(id);
        const outer = this.laneGlows.get(`${id}-outer`);
        const glow = direct ?? outer;
        if (!glow) return;
        this.tweens.add({
            targets: glow, alpha: 0.85, duration: 120, yoyo: true,
            onComplete: () => glow.setAlpha(0.15)
        });
    }

    private comboExpiresAt = 0;

    private handleBumper(bumper: ProcurementBumper) {
        const result = this.contract.applyBumper(bumper);
        this.comboExpiresAt = this.time.now + 2200;
        this.statusText.setText(result.status);
        this.showBumperHit(bumper, result.scaledValue, result.multiplier);
        if (bumper.id.includes('emergency') && this.planck) {
            const spawned = this.planck.spawnExtraBalls(2);
            if (spawned > 0) {
                this.statusText.setText(`EMERGENCY SUPPLEMENTAL — MULTIBALL x${this.planck.getActiveBallCount()}`);
                this.cameras.main.shake(220, 0.01);
                this.showAdviser('margin', 'procurement');
            }
        }
        this.updateHUD();
    }

    private showBumperHit(bumper: ProcurementBumper, scaledValue: number, multiplier: number) {
        const flash = this.add.text(
            bumper.x,
            bumper.y - bumper.radius - 22,
            `${scaledValue >= 0 ? '+' : '-'}${this.contract.formatBudget(Math.abs(scaledValue))}${multiplier > 1 ? `  x${multiplier}` : ''}`,
            {
                fontSize: '28px',
                color: bumper.outcome === 'inflate' ? '#9dff8e' : '#ff9b9b',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setDepth(30);
        this.tweens.add({ targets: flash, y: flash.y - 65, alpha: 0, duration: 700, onComplete: () => flash.destroy() });

        const badge = this.bumperSprites.get(bumper.id);
        if (badge) {
            this.tweens.add({ targets: badge, scale: badge.scale * 1.18, angle: badge.angle + 14, duration: 90, yoyo: true });
        }
        const halo = this.bumperHalos.get(bumper.id);
        if (halo) {
            halo.setAlpha(0.7).setScale(0.72);
            this.tweens.add({
                targets: halo, alpha: 0.14, scale: 1.65, duration: 300, ease: 'Cubic.out',
                onComplete: () => halo.setScale(1)
            });
        }
        this.showHitBurst(bumper.x, bumper.y, bumper.outcome === 'inflate');
        this.comboText.setText(
            this.contract.state.combo > 0
                ? `INFLATION COMBO x${this.contract.comboMultiplier()}`
                : 'EFFICIENCY INCIDENT'
        );

        const adviser = bumper.id === 'audit-failed'
            ? 'audit'
            : bumper.id === 'jackpot' || bumper.id === 'cost-overrun' || bumper.id === 'emergency-supplemental'
                ? 'margin'
                : bumper.outcome === 'efficiency'
                    ? 'audit'
                    : 'ledger';
        this.showAdviser(adviser, 'procurement');
    }

    private showHitBurst(x: number, y: number, inflate: boolean) {
        const burst = this.add.image(x, y, inflate ? 'pinball_hit_inflate' : 'pinball_hit_efficiency')
            .setDisplaySize(140, 140)
            .setDepth(25)
            .setAlpha(0.95);
        this.tweens.add({
            targets: burst, scale: 1.6, alpha: 0, duration: 320,
            onComplete: () => burst.destroy()
        });
    }

    private onBallDrained() {
        if (this.contractAuthorized || this.showingCard) return;
        this.skillLane.setTexture('pinball_lane_off');
        this.setPhase('03 REVIEW', '#ffd166');
        this.statusText.setText(this.contract.state.value > 0
            ? 'BALL DRAINED — REVIEW THE CONTRACT'
            : 'BALL DRAINED — LAUNCH AGAIN');
        this.showingCard = true;
        new ContractCard(this, this.contract, 'drain', {
            onContinue: () => {
                this.showingCard = false;
                this.statusText.setText(this.contract.state.value > 0
                    ? 'AUTHORIZE FOR MANSIONS — OR LAUNCH ANOTHER BALL'
                    : 'NO REQUIREMENT FILED — PULL THE PLUNGER');
            }
        });
    }

    private showAdviser(characterId: keyof typeof CHARACTERS, scene: 'procurement') {
        const adviser = CHARACTERS[characterId];
        this.adviserPortrait.setTexture(adviser.portraitKey);
        this.adviserName.setText(`${adviser.name} — ${adviser.title}`).setColor(adviser.color);
        this.adviserLine.setText(`“${characterLine(characterId, scene)}”`);
        this.adviserPortrait.setAlpha(0.55);
        this.tweens.add({ targets: this.adviserPortrait, alpha: 1, duration: 180 });
    }

    private updateHUD() {
        const items = Object.entries(this.contract.state.items)
            .map(([weapon, quantity]) => `${weapon}: ${quantity}`)
            .join('  •  ') || 'NO CONTRACT ITEMS YET';
        this.valueText.setText(`CONTRACT: ${items}`);
        this.delayText.setText(
            `VALUE: ${this.contract.formatBudget(this.contract.state.value)}  •  DELAY: +${this.contract.state.leadTimeDelay.toFixed(1)} YR`
        );
        this.profitText.setText(`CONTRACTOR PROFIT: ${this.contract.formatBudget(currentRun.contractorProfit)}`);
        this.authorizeButton?.setFillStyle(this.contract.state.value > 0 ? 0x087a42 : 0x3c4a55, this.contract.state.value > 0 ? 0.92 : 0.6);
    }

    private setPhase(phase: string, color: string) {
        const steps = ['01 LOAD', '02 PLAY', '03 REVIEW', '04 AUTHORIZE'];
        this.phaseText.setText(steps.map((step) => step === phase ? `[${step}]` : step).join('  •  '));
        this.phaseText.setColor(color);
    }

    private authorizeContract() {
        if (this.paused || this.showingCard) return;
        if (this.contractAuthorized || this.contract.state.value <= 0) {
            if (!this.contractAuthorized) this.statusText.setText('HIT A BUMPER BEFORE AUTHORIZING A CONTRACT');
            return;
        }
        this.contractAuthorized = true;
        const { summary } = this.contract.authorize();
        this.cameras.main.flash(500, 0, 255, 0);
        this.statusText.setText(summary);
        this.setPhase('04 AUTHORIZED', '#a8ff93');
        this.showingCard = true;
        new ContractCard(this, this.contract, 'authorize', {
            onContinue: () => this.scene.start('MansionScene')
        });
    }
}
