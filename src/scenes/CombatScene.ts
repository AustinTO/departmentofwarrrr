import * as Phaser from 'phaser';
import { WeaponType, ThreatType, WEAPON_CONFIGS, THREAT_CONFIGS } from '../game/config';
import type { ThreatConfig } from '../game/config';
import { CombatSystem } from '../game/CombatSystem';
import { WaveDirector } from '../game/WaveDirector';
import { audioManager } from '../managers/AudioManager';
import { currentRun } from '../state/RunState';
import { getArcControlPoint, quadraticBezier } from '../game/Trajectory';
import { CHARACTERS, characterLine } from '../game/Characters';
import { scenarioForFiscalYear } from '../game/CombatScenarios';
import type { CombatScenario } from '../game/CombatScenarios';
import { PauseMenu } from '../ui/PauseMenu';
import { SHEETS } from '../game/Sprites';
import { hostileThreatsNear, pickDistinctTargets, steerSeeker } from '../game/SeekingProjectiles';
import type { SeekerShotData } from '../game/SeekingProjectiles';

export class CombatScene extends Phaser.Scene {
    private playerBase!: Phaser.GameObjects.Image;
    private threats!: Phaser.Physics.Arcade.Group;
    private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
    
    private combatSystem: CombatSystem = new CombatSystem();
    private waveDirector: WaveDirector = new WaveDirector(1);
    
    private currentWeapon: WeaponType = WeaponType.INTERCEPTOR;
    private lastFired: number = 0;
    private spawnTimer?: Phaser.Time.TimerEvent;
    private waveTimer?: Phaser.Time.TimerEvent;
    private remainingTime: number = 60;
    private timeText!: Phaser.GameObjects.Text;
    private isShaking: boolean = false;
    private isFinishingWave: boolean = false;
    private interceptorShots = new Set<Phaser.GameObjects.Container>();
    private seekerShots = new Set<Phaser.GameObjects.Container>();
    private combo = 0;
    private comboExpiresAt = 0;
    private weaponButtons = new Map<WeaponType, Phaser.GameObjects.Rectangle>();
    private reloadText!: Phaser.GameObjects.Text;
    private scenario!: CombatScenario;
    private strikeIntegrity = 100;
    private moneyPool: Phaser.GameObjects.Sprite[] = [];
    private popupPool: Phaser.GameObjects.Container[] = [];
    private pendingShake = 0;
    private pendingShakeDuration = 0;
    private shakeFlushScheduled = false;
    private hitStopUntil = 0;
    private hitStopTimer?: Phaser.Time.TimerEvent;
    private lastExplosionSoundAt = -Infinity;
    private explosionSoundsThisBurst = 0;
    private paused = false;
    private pauseMenu?: PauseMenu;
    private restraintText!: Phaser.GameObjects.Text;

    private hudTexts!: { 
        burn: Phaser.GameObjects.Text; 
        mansions: Phaser.GameObjects.Text; 
        readiness: Phaser.GameObjects.Text; 
        weapon: Phaser.GameObjects.Text;
        pressure: Phaser.GameObjects.Text;
        ammo: Phaser.GameObjects.Text;
        combo: Phaser.GameObjects.Text;
    };

    constructor() {
        super('CombatScene');
    }

    create() {
        const { width, height } = this.scale;
        this.combatSystem.reset();
        this.remainingTime = 60;
        this.isFinishingWave = false;
        this.combo = 0;
        this.comboExpiresAt = 0;
        this.interceptorShots.clear();
        this.seekerShots.clear();
        currentRun.syncUnlocks();
        this.pendingShake = 0;
        this.pendingShakeDuration = 0;
        this.shakeFlushScheduled = false;
        this.hitStopUntil = 0;
        this.hitStopTimer = undefined;
        this.lastExplosionSoundAt = -Infinity;
        this.explosionSoundsThisBurst = 0;
        this.paused = false;
        this.pauseMenu = undefined;
        this.waveDirector = new WaveDirector(Math.max(1, currentRun.currentFY - 2025));
        this.scenario = scenarioForFiscalYear(currentRun.currentFY);

        // Background
        this.add.image(width / 2, height / 2, this.scenario.backgroundKey ?? 'combat_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.3).setOrigin(0); // Darken for readability

        audioManager.setScene(this);
        audioManager.playMusic('combat_music', true);

        // Player Base — painted scenario platform instead of graybox rectangles.
        this.playerBase = this.add.image(width / 2, height - 150, this.scenario.baseKey)
            .setDisplaySize(460, 230)
            .setDepth(3);
        this.add.text(width / 2, height - 268, this.scenario.baseName, {
            fontSize: '19px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5).setDepth(4);
        this.physics.add.existing(this.playerBase, true);
        if (this.scenario.mode === 'strike') this.createStrikeTarget(width);

        // Groups
        this.threats = this.physics.add.group();

        // Particles
        if (!this.textures.exists('particle')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffffff);
            graphics.fillRect(0, 0, 4, 4);
            graphics.generateTexture('particle', 4, 4);
            graphics.destroy();
        }
        
        this.particles = this.add.particles(0, 0, 'particle', {
            speed: { min: 50, max: 200 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            maxAliveParticles: 180,
            emitting: false
        });
        // Cosmetic effects are deliberately bounded and recycled. This keeps mass
        // kills from creating hundreds of display objects and canvas textures.
        this.moneyPool = [];
        this.popupPool = [];
        for (let i = 0; i < 36; i++) {
            this.moneyPool.push(this.add.sprite(0, 0, 'money_bill').setVisible(false).setActive(false));
        }
        for (let i = 0; i < 10; i++) {
            const popup = this.add.container(0, 0).setDepth(100).setVisible(false).setActive(false);
            popup.add(this.add.circle(0, 0, 40, 0xffffff, 0.3));
            popup.add(this.add.text(0, 0, '', { fontSize: '48px', color: '#ffff00', align: 'center', fontStyle: 'bold', stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5));
            this.popupPool.push(popup);
        }

        // HUD
        this.setupHUD(width, height);
        this.add.text(width / 2, 122, this.scenario.location, { fontSize: '22px', color: '#a7dfff', fontStyle: 'bold' }).setOrigin(0.5);
        this.timeText = this.add.text(width / 2, 80, 'FY END: 60s', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        // Wave Timer
        this.waveTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.remainingTime--;
                this.timeText.setText(`FY END: ${this.remainingTime}s`);
                if (this.remainingTime <= 0) this.finishWave();
            },
            loop: true
        });

        // Director-based Spawner
        this.scheduleNextSpawn();

        // Controls
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.handleInput(pointer);
        });

        // Weapon switching
        this.setupWeaponButtons(width, height);

        this.add.rectangle(width - 155, 190, 260, 74, 0x123f55, 0.95)
            .setStrokeStyle(3, 0x5de6ff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.finishWave());
        this.add.text(width - 155, 190, 'END YEAR\nLOGISTICS', {
            fontSize: '22px', color: '#dffbff', fontStyle: 'bold', align: 'center'
        }).setOrigin(0.5);

        this.add.rectangle(90, 190, 120, 74, 0x2a3a4a, 0.95)
            .setStrokeStyle(3, 0xffd166)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.togglePause());
        this.add.text(90, 190, 'PAUSE', {
            fontSize: '26px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.input.keyboard?.on('keydown-ESC', () => this.togglePause());

        this.showDoctrineBanner();
    }

    private showDoctrineBanner() {
        const { width } = this.scale;
        const banner = this.add.container(width / 2, 430).setDepth(80).setAlpha(0);
        banner.add(this.add.rectangle(0, 0, width - 100, 110, 0x0a2a18, 0.94).setStrokeStyle(4, 0x44ff88));
        banner.add(this.add.text(0, -22, 'GREEN CONTACTS ARE ALLIED', {
            fontSize: '34px', color: '#44ff88', fontStyle: 'bold'
        }).setOrigin(0.5));
        banner.add(this.add.text(0, 22, 'LET THEM PASS — SHOOTING THEM STARTS A HEARING', {
            fontSize: '22px', color: '#d6ffe8', fontStyle: 'bold'
        }).setOrigin(0.5));
        this.tweens.add({
            targets: banner, alpha: 1, duration: 220, yoyo: true, hold: 2800,
            onComplete: () => banner.destroy()
        });
    }

    private togglePause() {
        if (this.isFinishingWave) return;
        if (this.paused) {
            this.resumeFromPause();
            return;
        }
        this.paused = true;
        this.physics.world.pause();
        if (this.spawnTimer) this.spawnTimer.paused = true;
        if (this.waveTimer) this.waveTimer.paused = true;
        this.pauseMenu = new PauseMenu(this, {
            title: 'COMBAT PAUSED',
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
        this.physics.world.resume();
        if (this.spawnTimer) this.spawnTimer.paused = false;
        if (this.waveTimer) this.waveTimer.paused = false;
    }

    private finishWave() {
        if (this.isFinishingWave) return;
        this.isFinishingWave = true;
        this.sound.stopAll();
        if (this.spawnTimer) this.spawnTimer.remove();
        if (this.waveTimer) this.waveTimer.remove();
        this.input.enabled = false;
        
        const { width, height } = this.scale;
        const stats = this.combatSystem.getStats();
        const grade = this.combatSystem.getGrade();
        const profitMargin = currentRun.activeDoctrine?.effect.profitMargin || 1.0;
        const combatProfit = (stats.taxpayerBurn * 0.15) * profitMargin;
        const gradeBonus = grade === 'S' ? 40_000_000 : grade === 'A' ? 20_000_000 : grade === 'B' ? 8_000_000 : 0;
        
        // Finalize stats to global run
        currentRun.taxpayerBurn += stats.taxpayerBurn;
        currentRun.contractorProfit += combatProfit + stats.restraintBonus + gradeBonus;
        currentRun.reconcileMansions();
        currentRun.save();

        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0).setDepth(1000);
        this.add.text(width / 2, height / 2 - 260, 'FISCAL YEAR CONCLUDED', {
            fontSize: '64px',
            color: '#00ffff',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1001);

        const gradeColor = grade === 'S' || grade === 'A' ? '#a8ff93' : grade === 'B' ? '#ffd166' : '#ff765e';
        this.add.text(width / 2, height / 2 - 140, `GRADE ${grade}`, {
            fontSize: '96px', color: gradeColor, fontStyle: 'bold', stroke: '#000000', strokeThickness: 10
        }).setOrigin(0.5).setDepth(1001);

        this.add.text(width / 2, height / 2 + 20, [
            `BURN: ${this.formatCurrency(stats.taxpayerBurn)}`,
            `PROFIT: ${this.formatCurrency(combatProfit + stats.restraintBonus + gradeBonus)}`,
            `THREATS DOWN: ${stats.threatsDestroyed}  •  ALLIES SPARED: ${stats.friendliesSpared}`,
            stats.friendliesHit > 0 ? `FRIENDLY FIRE INCIDENTS: ${stats.friendliesHit}` : 'NO FRIENDLY FIRE — CONGRESS APPLAUDS',
            `BEST CHAIN: x${stats.comboPeak}`
        ].join('\n'), {
            fontSize: '36px',
            color: '#ffffff',
            align: 'center',
            lineSpacing: 12
        }).setOrigin(0.5).setDepth(1001);

        this.time.delayedCall(3800, () => {
            this.input.enabled = true;
            this.scene.start('ReadinessScene');
        });
    }

    private scheduleNextSpawn() {
        const baseSpawn = this.waveDirector.getNextSpawn(this.time.now);
        const freqMultiplier = currentRun.activeDoctrine?.effect.threatFrequency || 1.0;
        const adjustedDelay = baseSpawn.delay / (freqMultiplier * this.scenario.spawnRate);

        this.spawnTimer = this.time.delayedCall(adjustedDelay, () => {
            this.spawnThreat(baseSpawn.type);
            this.scheduleNextSpawn();
        });
    }

    private createStrikeTarget(width: number) {
        const target = this.add.container(width / 2, 470).setDepth(4).setSize(300, 160).setInteractive({ useHandCursor: true });
        target.add(this.add.rectangle(0, 0, 300, 160, 0x8b3a32, 0.9).setStrokeStyle(4, 0xffd27a));
        target.add(this.add.rectangle(0, -46, 150, 44, 0x49444a, 0.95));
        target.add(this.add.text(0, 0, this.scenario.strikeTarget ?? 'OBJECTIVE', { fontSize: '24px', color: '#fff4cf', fontStyle: 'bold', align: 'center', wordWrap: { width: 260 } }).setOrigin(0.5));
        target.on('pointerdown', () => {
            this.strikeIntegrity = Math.max(0, this.strikeIntegrity - 10);
            this.hudTexts.combo.setText(`OBJECTIVE INTEGRITY: ${this.strikeIntegrity}%`);
            this.cameras.main.flash(80, 255, 160, 80);
            if (this.strikeIntegrity === 0) {
                this.add.text(width / 2, 570, 'OBJECTIVE NEUTRALIZED\nPROCUREMENT JUSTIFICATION SECURED', { fontSize: '34px', color: '#ffdf6b', fontStyle: 'bold', align: 'center' }).setOrigin(0.5).setDepth(10);
                target.destroy();
            }
        });
    }

    private spawnThreat(type: ThreatType) {
        // Allied contacts stay allied — scenario bias only remixes hostiles.
        if (type !== ThreatType.FRIENDLY && Math.random() < 0.35) {
            type = Phaser.Math.RND.pick(this.scenario.threatBias);
        }
        const config = THREAT_CONFIGS[type];
        if (type === ThreatType.SWARM) {
            this.spawnSwarm(config);
        } else {
            this.createThreat(config);
        }
    }

    private createThreat(config: ThreatConfig, x?: number, y?: number) {
        const posX = x ?? Phaser.Math.Between(100, this.scale.width - 100);
        const posY = y ?? -50;
        
        const isMystery = config.type === ThreatType.MYSTERY;
        const isFriendly = !!config.friendly;
        const container = this.add.container(posX, posY);
        const visual = this.resolveThreatVisual(config);

        const sprite = visual.sheet
            ? this.add.sprite(0, 0, visual.sheet, 0)
            : this.add.sprite(0, 0, visual.texture);
        sprite.setDisplaySize(config.radius * (isFriendly ? 4.2 : 3.6), config.radius * (isFriendly ? 4.2 : 3.6));
        if (visual.anim) sprite.play(visual.anim);
        if (config.type === ThreatType.LAWN_MOWER && !visual.sheet) sprite.setTint(Phaser.Math.RND.pick([0xffffff, 0xc6d8bf, 0xe4cfaa]));
        if ((config.type === ThreatType.SCOOTER || config.type === ThreatType.SWARM) && !visual.sheet) {
            sprite.setTint(Phaser.Math.RND.pick([0xffffff, 0xffc49b, 0xa7dfff]));
        }
        if (config.type === ThreatType.MYSTERY && !visual.sheet) sprite.setTint(0xa98cff);
        container.add(sprite);

        if (isFriendly) {
            const ring = this.add.circle(0, 0, config.radius * 2.4, 0x44ff88, 0.14)
                .setStrokeStyle(4, 0x44ff88, 0.95);
            container.add(ring);
            container.add(this.add.text(0, -config.radius * 2.8, 'ALLIED', {
                fontSize: '20px', color: '#44ff88', fontStyle: 'bold', stroke: '#001a0c', strokeThickness: 4
            }).setOrigin(0.5));
            this.tweens.add({
                targets: ring, scaleX: 1.25, scaleY: 1.25, alpha: 0.35,
                duration: 700, yoyo: true, repeat: -1
            });
        }

        // The new heavy Shahed-style drone art is already nose-down. Legacy
        // missile art still needs rotation to travel toward the player.
        if (config.type === ThreatType.MISSILE) sprite.setRotation(Math.PI);
        if (config.type === ThreatType.DECOY) {
            this.tweens.add({
                targets: sprite,
                x: { from: -5, to: 5 },
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        }
        
        if (isMystery) container.setAlpha(0.3);

        container.setData('config', config);
        const weaving = config.type === ThreatType.SCOOTER || config.type === ThreatType.MYSTERY || config.type === ThreatType.SWARM || isFriendly;
        if (weaving) {
            container.setData('motion', {
                originX: posX,
                phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
                amplitude: config.type === ThreatType.SCOOTER ? 90 : isFriendly ? 55 : 45,
                frequency: config.type === ThreatType.SCOOTER ? 0.004 : 0.0025
            });
        }
        this.physics.add.existing(container);
        this.threats.add(container);
        
        const body = container.body as Phaser.Physics.Arcade.Body;
        body.setCircle(config.radius, -config.radius, -config.radius);
        body.setVelocityY(config.speed);

        if (isMystery) {
            this.time.delayedCall(2000, () => {
                if (container.active) {
                    container.setAlpha(1);
                    this.tweens.add({
                        targets: container,
                        alpha: { from: 0.5, to: 1 },
                        duration: 200,
                        yoyo: true,
                        repeat: 2
                    });
                }
            });
        }
    }

    private resolveThreatVisual(config: ThreatConfig): { sheet?: string; texture: string; anim?: string } {
        if (config.friendly) {
            return { sheet: SHEETS.friendlyCourier.key, texture: SHEETS.friendlyCourier.key, anim: 'anim_friendly' };
        }
        switch (config.type) {
            case ThreatType.LAWN_MOWER:
                return { sheet: SHEETS.threatHeavy.key, texture: SHEETS.threatHeavy.key, anim: 'anim_threat_heavy' };
            case ThreatType.SCOOTER:
            case ThreatType.SWARM:
                return { sheet: SHEETS.threatScout.key, texture: SHEETS.threatScout.key, anim: 'anim_threat_scout' };
            case ThreatType.DECOY:
                return { texture: 'threat_pack_balloon' };
            case ThreatType.MYSTERY:
                return { texture: 'threat_pack_mystery' };
            case ThreatType.MISSILE:
                return { texture: 'threat_pack_jet' };
            default:
                return { texture: 'threat_heavy' };
        }
    }

    private setupHUD(width: number, _height: number) {
        const style = { fontSize: '42px', color: '#ffffff', fontStyle: 'bold' };
        
        this.hudTexts = {
            burn: this.add.text(40, 40, 'TAXPAYER BURN: $0', style),
            mansions: this.add.text(40, 100, `MANSIONS: ${currentRun.mansionsBuilt}`, style),
            readiness: this.add.text(width - 40, 40, `READINESS: ${currentRun.globalReadiness}%`, style).setOrigin(1, 0),
            weapon: this.add.text(width / 2, 160, `WEAPON: ${this.currentWeapon}`, style).setOrigin(0.5, 0),
            pressure: this.add.text(width - 40, 100, 'PRESSURE: 0', style).setOrigin(1, 0),
            ammo: this.add.text(width / 2, 220, 'AMMO: UNLIMITED', style).setOrigin(0.5, 0),
            combo: this.add.text(width / 2, 285, 'CHAIN READY', { ...style, color: '#ffd166' }).setOrigin(0.5, 0)
        };
        this.reloadText = this.add.text(width / 2, 345, 'SYSTEM READY', { fontSize: '22px', color: '#9dff8e', fontStyle: 'bold' }).setOrigin(0.5);
        this.restraintText = this.add.text(width / 2, 385, 'RESTRAINT: 0 ALLIES SPARED', {
            fontSize: '22px', color: '#44ff88', fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    private setupWeaponButtons(width: number, height: number) {
        const weapons = currentRun.availableWeapons();
        const visible = Math.min(4, weapons.length);
        const buttonWidth = width / visible;
        let scrollOffset = 0;

        this.add.image(width / 2, height - 52, SHEETS.uiChrome.key, 3)
            .setDisplaySize(width - 20, 118)
            .setAlpha(0.9)
            .setDepth(8);

        const tray = this.add.container(0, 0).setDepth(9);
        const rebuild = () => {
            tray.removeAll(true);
            this.weaponButtons.clear();
            const page = weapons.slice(scrollOffset, scrollOffset + visible);
            page.forEach((type, i) => {
                const x = i * buttonWidth + buttonWidth / 2;
                const y = height - 50;
                const config = WEAPON_CONFIGS[type];
                const button = this.add.rectangle(x, y, buttonWidth - 10, 98, 0x333333, 0.55)
                    .setStrokeStyle(3, 0x5c6770)
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.setWeapon(type));
                this.weaponButtons.set(type, button);
                const icon = this.add.image(x, y - 18, SHEETS.weaponIcons.key, config.iconFrame)
                    .setDisplaySize(54, 54);
                const label = this.add.text(x, y + 22, config.shortLabel, {
                    fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
                }).setOrigin(0.5);
                const cost = this.add.text(x, y + 42, this.weaponCostLabel(type), {
                    fontSize: '15px', color: '#b9d5e6'
                }).setOrigin(0.5);
                tray.add([button, icon, label, cost]);
            });
            this.updateWeaponSelectionFeedback();
        };

        if (weapons.length > visible) {
            const cycle = this.add.rectangle(width - 36, height - 160, 64, 44, 0x1a3344, 0.95)
                .setStrokeStyle(2, 0x7df4ff)
                .setDepth(12)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    scrollOffset = (scrollOffset + visible) % weapons.length;
                    rebuild();
                });
            this.add.text(width - 36, height - 160, 'MORE', {
                fontSize: '16px', color: '#7df4ff', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(13);
            void cycle;
        }

        if (!weapons.includes(this.currentWeapon) && weapons[0]) {
            this.currentWeapon = weapons[0];
        }
        rebuild();
    }

    private setWeapon(type: WeaponType) {
        this.currentWeapon = type;
        this.hudTexts.weapon.setText(`WEAPON: ${this.currentWeapon}`);
        this.updateWeaponSelectionFeedback();
        this.updateHUD();
    }

    private weaponCostLabel(type: WeaponType) {
        const cost = WEAPON_CONFIGS[type].cost;
        return cost >= 1_000_000 ? `$${(cost / 1_000_000).toFixed(1)}M` : `$${(cost / 1_000).toFixed(1)}K`;
    }

    private updateWeaponSelectionFeedback() {
        const config = WEAPON_CONFIGS[this.currentWeapon];
        this.weaponButtons.forEach((button, type) => {
            const selected = type === this.currentWeapon;
            button.setFillStyle(selected ? 0x126a87 : 0x333333, selected ? 0.98 : 0.9);
            button.setStrokeStyle(selected ? 5 : 3, selected ? 0x7df4ff : 0x5c6770);
            button.setScale(selected ? 1.035 : 1);
        });
        this.showCombatCallout(config);
    }

    private showCombatCallout(config: { name: string }) {
        const { width, height } = this.scale;
        const card = this.add.container(0, height - 435).setDepth(50);
        const panel = this.add.rectangle(width / 2, 0, width - 90, 128, 0x06111d, 0.94).setStrokeStyle(3, 0xf3ca67);
        const portrait = this.add.image(104, 58, CHARACTERS.peter.portraitKey).setDisplaySize(106, 158).setOrigin(0.5, 1);
        const ammo = WEAPON_CONFIGS[this.currentWeapon].limitedAmmo
            ? currentRun.theaters.active.inventory[this.currentWeapon] ?? 0
            : 'UNLIMITED';
        const detail = this.add.text(178, -43, `${config.name}  •  ${this.weaponCostLabel(this.currentWeapon)} / SHOT  •  AMMO: ${ammo}`, {
            fontSize: '19px', color: '#dff7ff', fontStyle: 'bold'
        });
        const line = this.add.text(178, -5, `PETER KEGSBREATH: “${characterLine('peter', 'combat')}”`, {
            fontSize: '17px', color: '#f3ca67', wordWrap: { width: width - 275 }
        });
        card.add([panel, portrait, detail, line]);
        card.setAlpha(0);
        this.tweens.add({
            targets: card, alpha: 1, y: height - 455, duration: 160, yoyo: true, hold: 1700,
            onComplete: () => card.destroy()
        });
    }

    private handleInput(pointer: Phaser.Input.Pointer) {
        if (this.paused) return;
        if (pointer.y < 240 && pointer.x > this.scale.width - 310) return;
        if (pointer.y < 240 && pointer.x < 160) return;
        if (pointer.y > this.scale.height - 120) return;

        const now = this.time.now;
        const config = WEAPON_CONFIGS[this.currentWeapon];

        if (now - this.lastFired < config.reloadTime) return;

        // Check ammo for limited munitions
        if (WEAPON_CONFIGS[this.currentWeapon].limitedAmmo) {
            const doctrineAmmo = currentRun.activeDoctrine?.effect.ammoCapacity;
            if (doctrineAmmo === undefined) {
                const theater = currentRun.theaters['active'];
                if ((theater.inventory[this.currentWeapon] || 0) <= 0) {
                    this.showOutOfAmmo();
                    return;
                }
                theater.inventory[this.currentWeapon]--;
            }
        }

        this.lastFired = now;
        this.combatSystem.recordWeaponFire(this.currentWeapon);

        if (this.currentWeapon === WeaponType.INTERCEPTOR || this.currentWeapon === WeaponType.INTERCEPTOR_BLOCK_II) {
            this.fireInterceptor(pointer.x, pointer.y, config);
        } else if (this.currentWeapon === WeaponType.GUN) {
            this.fireGun(pointer.x, pointer.y, config);
        } else if (this.currentWeapon === WeaponType.JAMMER) {
            this.fireJammer(pointer.x, pointer.y, config);
        } else if (this.currentWeapon === WeaponType.HYDRA) {
            this.fireHydra(pointer.x, pointer.y, config);
        } else if (this.currentWeapon === WeaponType.RAILGUN) {
            this.fireRailgun(pointer.x, pointer.y, config);
        } else if (this.currentWeapon === WeaponType.SEEKER) {
            this.fireSeekerSwarm(pointer.x, pointer.y, config);
        }

        this.updateHUD();
    }

    private fireInterceptor(targetX: number, targetY: number, config: any) {
        audioManager.play('interceptor_fire');
        const startX = this.playerBase.x;
        const startY = this.playerBase.y;

        const container = this.add.container(startX, startY);
        
        const isBlockII = config.name.includes('BLOCK II');
        const spriteKey = isBlockII ? 'interceptor_sm6' : 'interceptor_sm3';
        
        const sprite = this.add.sprite(0, 0, spriteKey);
        sprite.setDisplaySize(40, 80);
        container.add(sprite);

        // Keep Arcade Physics for the projectile body, but steer its position along
        // a curved, fast flight path so every launch has a little personality.
        const speed = isBlockII ? 2100 : 1800;
        const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
        const duration = Math.max(120, (distance / speed) * 1000);
        const arc = Phaser.Math.Clamp((targetX - startX) * 0.22, -180, 180);
        const radiusMult = currentRun.activeDoctrine?.effect.explosionRadius ?? 1;
        container.setData('trajectory', {
            start: { x: startX, y: startY },
            control: getArcControlPoint({ x: startX, y: startY }, { x: targetX, y: targetY }, arc),
            target: { x: targetX, y: targetY },
            elapsed: 0,
            duration,
            radius: config.radius * radiusMult,
            weaponName: config.name
        });
        this.interceptorShots.add(container);
    }


    private fireGun(targetX: number, targetY: number, config: any) {
        const startX = this.playerBase.x;
        const startY = this.playerBase.y;

        const container = this.add.container(startX, startY);
        const graphics = this.add.graphics();
        
        // Stylized bullet (tracer)
        graphics.lineStyle(4, config.color, 0.8);
        graphics.lineBetween(0, 0, 0, 20);
        container.add(graphics);

        this.physics.add.existing(container);
        this.physics.moveTo(container, targetX, targetY, 1500);
        
        // Rotate to face target
        const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);
        container.setRotation(angle + Math.PI / 2);

        this.time.delayedCall(400, () => container.destroy());

        this.physics.add.overlap(container, this.threats, (b: any, t: any) => {
            b.destroy();
            this.destroyThreat(t, WeaponType.GUN);
        });
    }

    private fireJammer(targetX: number, targetY: number, config: any) {
        const container = this.add.container(targetX, targetY);
        const graphics = this.add.graphics();
        const radiusMult = currentRun.activeDoctrine?.effect.explosionRadius ?? 1;
        const jamRadius = config.radius * radiusMult;
        
        // Stylized jamming wave
        graphics.lineStyle(2, config.color, 0.8);
        graphics.strokeCircle(0, 0, 10);
        container.add(graphics);

        this.tweens.add({
            targets: graphics,
            scaleX: jamRadius / 10,
            scaleY: jamRadius / 10,
            alpha: 0,
            duration: 1000,
            onComplete: () => container.destroy()
        });

        // Add some "interference" particles
        this.particles.emitParticleAt(targetX, targetY, 20);

        this.threats.getChildren().forEach((threat: any) => {
            const dist = Phaser.Math.Distance.Between(targetX, targetY, threat.x, threat.y);
            if (dist < jamRadius) {
                const body = threat.body as Phaser.Physics.Arcade.Body;
                body.setVelocityY(body.velocity.y * 0.18);
                threat.setTint(0x00ffff);
                threat.setAlpha(0.38);
                threat.setData('jammed', true);
                const label = this.add.text(threat.x, threat.y - 34, 'LINK LOST', { fontSize: '18px', color: '#74ffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(5);
                this.tweens.add({ targets: label, y: label.y - 35, alpha: 0, duration: 800, onComplete: () => label.destroy() });
                this.time.delayedCall(850, () => {
                    if (threat.active && threat.getData('jammed')) this.destroyThreat(threat, WeaponType.JAMMER);
                });
            }
        });
    }

    /** Cluster MIRV: flies toward aim, then splits into heat-seeking submunitions. */
    private fireHydra(targetX: number, targetY: number, config: { radius: number; color: number; name: string }) {
        audioManager.play('interceptor_fire');
        const startX = this.playerBase.x;
        const startY = this.playerBase.y;
        const container = this.add.container(startX, startY);
        const sprite = this.add.image(0, 0, 'proj_hydra_missile').setDisplaySize(48, 72);
        container.add(sprite);
        const data: SeekerShotData = {
            mode: 'seek',
            weapon: WeaponType.HYDRA,
            speed: 900,
            radius: config.radius,
            life: 3200,
            turnRate: 2.2,
            aimX: targetX,
            aimY: targetY,
            isCluster: true,
            splitAt: 0.42,
            splitDone: false
        };
        container.setData('seek', data);
        container.setRotation(Phaser.Math.Angle.Between(startX, startY, targetX, targetY) + Math.PI / 2);
        this.seekerShots.add(container);
        this.showFloatingLabel(startX, startY - 80, 'HYDRA LOFT', '#ff8855');
    }

    private splitHydra(parent: Phaser.GameObjects.Container, data: SeekerShotData) {
        const targets = pickDistinctTargets(this.threats, parent.x, parent.y, 3);
        const radiusMult = currentRun.activeDoctrine?.effect.explosionRadius ?? 1;
        const count = Math.max(3, targets.length || 3);
        for (let i = 0; i < count; i++) {
            const sub = this.add.container(parent.x, parent.y);
            const sprite = this.add.image(0, 0, 'proj_hydra_sub').setDisplaySize(36, 48);
            sub.add(sprite);
            const target = targets[i];
            const aimX = target?.x ?? (data.aimX ?? parent.x) + (i - 1) * 90;
            const aimY = target?.y ?? (data.aimY ?? parent.y - 200);
            const subData: SeekerShotData = {
                mode: 'seek',
                weapon: WeaponType.HYDRA,
                speed: 1100 + i * 40,
                radius: data.radius * 0.7 * radiusMult,
                life: 2800,
                turnRate: 5.5,
                target,
                aimX,
                aimY
            };
            sub.setData('seek', subData);
            sub.setRotation(Phaser.Math.Angle.Between(parent.x, parent.y, aimX, aimY) + Math.PI / 2);
            this.seekerShots.add(sub);
        }
        this.showFloatingLabel(parent.x, parent.y, 'MIRV SPLIT', '#ffd166');
        this.particles.emitParticleAt(parent.x, parent.y, 24);
        parent.destroy();
        this.seekerShots.delete(parent);
    }

    /** Piercing rail slug — hits every threat along the aim line. */
    private fireRailgun(targetX: number, targetY: number, config: { radius: number; color: number }) {
        audioManager.play('interceptor_fire');
        const startX = this.playerBase.x;
        const startY = this.playerBase.y;
        const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);
        const endX = startX + Math.cos(angle) * 2400;
        const endY = startY + Math.sin(angle) * 2400;

        const beam = this.add.graphics().setDepth(35);
        beam.lineStyle(10, 0x9fe8ff, 0.95);
        beam.lineBetween(startX, startY, endX, endY);
        beam.lineStyle(3, 0xffffff, 0.9);
        beam.lineBetween(startX, startY, endX, endY);
        this.tweens.add({ targets: beam, alpha: 0, duration: 220, onComplete: () => beam.destroy() });

        const slug = this.add.image(startX, startY, 'proj_railgun_slug')
            .setDisplaySize(28, 64)
            .setRotation(angle + Math.PI / 2)
            .setDepth(36);
        this.tweens.add({
            targets: slug, x: endX, y: endY, duration: 180, ease: 'Cubic.easeOut',
            onComplete: () => slug.destroy()
        });

        const hitWidth = Math.max(36, config.radius);
        this.threats.getChildren().forEach((threat: any) => {
            if (!threat.active) return;
            const dist = this.distanceToSegment(threat.x, threat.y, startX, startY, endX, endY);
            if (dist <= hitWidth) this.destroyThreat(threat, WeaponType.RAILGUN);
        });
        this.cameras.main.flash(60, 180, 230, 255);
        this.showFloatingLabel(targetX, targetY - 40, 'RAIL THROUGH', '#9fe8ff');
    }

    private distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy || 1;
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Phaser.Math.Clamp(t, 0, 1);
        const sx = x1 + t * dx;
        const sy = y1 + t * dy;
        return Phaser.Math.Distance.Between(px, py, sx, sy);
    }

    /** Independent heat-seeking micro-drone swarm. */
    private fireSeekerSwarm(targetX: number, targetY: number, config: { radius: number }) {
        audioManager.play('interceptor_fire');
        const startX = this.playerBase.x;
        const startY = this.playerBase.y;
        const targets = pickDistinctTargets(this.threats, targetX, targetY, 5);
        const radiusMult = currentRun.activeDoctrine?.effect.explosionRadius ?? 1;
        const swarmCount = 5;
        for (let i = 0; i < swarmCount; i++) {
            const drone = this.add.container(startX + (i - 2) * 18, startY - 10);
            const sprite = this.add.image(0, 0, 'proj_seeker_drone').setDisplaySize(40, 40);
            drone.add(sprite);
            const target = targets[i % Math.max(1, targets.length)] ?? targets[0];
            const data: SeekerShotData = {
                mode: 'seek',
                weapon: WeaponType.SEEKER,
                speed: 780 + i * 55,
                radius: config.radius * radiusMult,
                life: 4200,
                turnRate: 6.2,
                target,
                aimX: target?.x ?? targetX + (i - 2) * 70,
                aimY: target?.y ?? targetY
            };
            drone.setData('seek', data);
            this.seekerShots.add(drone);
        }
        this.showFloatingLabel(startX, startY - 90, 'SEEKER SWARM', '#44ffcc');
    }

    private updateSeekerShots(delta: number) {
        const doomed: Phaser.GameObjects.Container[] = [];
        this.seekerShots.forEach((shot) => {
            if (!shot.active) {
                doomed.push(shot);
                return;
            }
            const data = shot.getData('seek') as SeekerShotData | undefined;
            if (!data) {
                doomed.push(shot);
                return;
            }

            if (data.isCluster && !data.splitDone) {
                // Fly toward aim; split mid-course into heat-seekers.
                const aimX = data.aimX ?? shot.x;
                const aimY = data.aimY ?? shot.y;
                const startDist = Phaser.Math.Distance.Between(this.playerBase.x, this.playerBase.y, aimX, aimY);
                const traveled = Phaser.Math.Distance.Between(this.playerBase.x, this.playerBase.y, shot.x, shot.y);
                const progress = startDist > 1 ? traveled / startDist : 1;
                const detonate = steerSeeker(shot, data, delta);
                if (progress >= (data.splitAt ?? 0.4) || detonate) {
                    data.splitDone = true;
                    this.splitHydra(shot, data);
                    return;
                }
                return;
            }

            // Retarget if current target died.
            if (!data.target?.active) {
                const next = hostileThreatsNear(this.threats, shot.x, shot.y)[0];
                data.target = next;
                if (next) {
                    data.aimX = next.x;
                    data.aimY = next.y;
                }
            }

            const boomAt = steerSeeker(shot, data, delta);
            if (boomAt) {
                doomed.push(shot);
                this.detonate(shot, boomAt.x, boomAt.y, data.radius, WEAPON_CONFIGS[data.weapon].name, data.weapon);
            }
        });
        doomed.forEach((shot) => this.seekerShots.delete(shot));
    }

    private detonate(interceptor: Phaser.GameObjects.GameObject, x: number, y: number, radius: number, weaponName: string, weaponOverride?: WeaponType) {
        interceptor.destroy();

        const isBlockII = weaponName.includes('BLOCK II');
        const color = isBlockII ? 0xff4400 : 0xffa500;

        // Painted explosion spritesheet instead of a flat circle flash.
        const boom = this.add.sprite(x, y, SHEETS.explosion.key, 0)
            .setDisplaySize(Math.max(180, radius * 1.7), Math.max(180, radius * 1.7))
            .setDepth(40)
            .setTint(isBlockII ? 0xff8855 : 0xffffff);
        boom.play('anim_explosion');
        boom.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => boom.destroy());

        const flash = this.add.circle(x, y, radius * 0.15, 0xffffff, 0.85).setDepth(39);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2.4,
            duration: 120,
            onComplete: () => flash.destroy()
        });

        // Keep a soft color wash under the sheet for readability on busy backgrounds.
        const explosion = this.add.circle(x, y, 10, color, 0.35).setDepth(38);
        
        // Hit Stop effect
        const stopDuration = isBlockII ? 100 : 50;
        this.physics.world.pause();
        this.hitStopUntil = Math.max(this.hitStopUntil, this.time.now + stopDuration);
        if (!this.hitStopTimer) {
            this.hitStopTimer = this.time.delayedCall(stopDuration, () => {
                this.hitStopTimer = undefined;
                if (this.time.now >= this.hitStopUntil) this.physics.world.resume();
                else this.hitStopTimer = this.time.delayedCall(this.hitStopUntil - this.time.now, () => {
                    this.hitStopTimer = undefined;
                    this.physics.world.resume();
                });
            });
        }
        this.pendingShake = Math.min(0.035, this.pendingShake + (isBlockII ? 0.02 : 0.01));
        this.pendingShakeDuration = Math.max(this.pendingShakeDuration, isBlockII ? 400 : 200);
        if (!this.shakeFlushScheduled) {
            this.shakeFlushScheduled = true;
            this.time.delayedCall(0, () => {
                this.cameras.main.shake(this.pendingShakeDuration, this.pendingShake);
                this.pendingShake = 0;
                this.pendingShakeDuration = 0;
                this.shakeFlushScheduled = false;
            });
        }
        this.particles.emitParticleAt(x, y, Math.min(isBlockII ? 100 : 40, 120));

        this.tweens.add({
            targets: explosion,
            radius: radius,
            alpha: 0,
            duration: isBlockII ? 800 : 600,
            onComplete: () => explosion.destroy()
        });

        const weaponType = weaponOverride
            ?? (weaponName.includes('BLOCK II') ? WeaponType.INTERCEPTOR_BLOCK_II
                : weaponName.includes('HYDRA') ? WeaponType.HYDRA
                    : weaponName.includes('SEEKER') ? WeaponType.SEEKER
                        : WeaponType.INTERCEPTOR);
        this.threats.getChildren().forEach((threat: any) => {
            const dist = Phaser.Math.Distance.Between(x, y, threat.x, threat.y);
            if (dist < radius) {
                this.destroyThreat(threat, weaponType);
            }
        });
    }

    private destroyThreat(threat: any, weapon: WeaponType) {
        const now = this.time.now;
        if (now - this.lastExplosionSoundAt > 80) {
            audioManager.play('threat_explode');
            this.lastExplosionSoundAt = now;
            this.explosionSoundsThisBurst = 1;
        } else if (this.explosionSoundsThisBurst < 3) {
            audioManager.play('threat_explode', { volume: 0.55 });
            this.explosionSoundsThisBurst++;
        }
        const threatConfig = threat.getData('config') as ThreatConfig;

        if (threatConfig.friendly) {
            this.handleFriendlyFire(threat, weapon);
            return;
        }

        const ratio = this.combatSystem.recordThreatDestroyed(threatConfig.type, weapon);

        this.combo = this.time.now <= this.comboExpiresAt ? this.combo + 1 : 1;
        this.comboExpiresAt = this.time.now + 2200;
        this.combatSystem.noteCombo(this.combo);
        this.grantComboMilestoneReward();

        if (weapon === WeaponType.GUN && threatConfig.type === ThreatType.MISSILE) {
            this.showFloatingLabel(threat.x, threat.y, 'EFFICIENT KILL\nBUDGET APPROVES', '#a8ff93');
        } else if (weapon === WeaponType.HYDRA) {
            this.showFloatingLabel(threat.x, threat.y, 'MIRV LOCK', '#ff8855');
        } else if (weapon === WeaponType.RAILGUN) {
            this.showFloatingLabel(threat.x, threat.y, 'PIERCED', '#9fe8ff');
        } else if (weapon === WeaponType.SEEKER) {
            this.showFloatingLabel(threat.x, threat.y, 'SWARM HIT', '#44ffcc');
        } else if (weapon === WeaponType.INTERCEPTOR || weapon === WeaponType.INTERCEPTOR_BLOCK_II) {
            this.showOvermatchPopup(threat.x, threat.y, ratio, weapon);
        }

        threat.destroy();
        this.updateHUD();
    }

    private handleFriendlyFire(threat: Phaser.GameObjects.Container, weapon: WeaponType) {
        this.combatSystem.recordThreatDestroyed(ThreatType.FRIENDLY, weapon);
        this.combo = 0;
        this.comboExpiresAt = 0;

        const activeTheater = currentRun.theaters.active;
        activeTheater.readiness = Math.max(0, activeTheater.readiness - 12);
        currentRun.updateGlobalReadiness();
        this.combatSystem.recordReadinessLoss(12);

        this.cameras.main.flash(220, 255, 40, 40);
        this.showFloatingLabel(threat.x, threat.y, 'FRIENDLY FIRE\nCONGRESS NOTIFIED', '#ff765e');
        this.showAuditCallout();
        threat.destroy();
        this.updateHUD();
        if (currentRun.globalReadiness === 0) this.gameOver();
    }

    private spareFriendly(threat: Phaser.GameObjects.Container) {
        this.combatSystem.recordFriendlySpared();
        const activeTheater = currentRun.theaters.active;
        activeTheater.readiness = Math.min(100, activeTheater.readiness + 3);
        currentRun.updateGlobalReadiness();
        this.showFloatingLabel(threat.x, threat.y - 20, 'RESTRAINT BONUS\n+ALLIANCE CREDIT', '#44ff88');
        threat.destroy();
        this.updateHUD();
    }

    private grantComboMilestoneReward() {
        if (this.combo === 0 || this.combo % 5 !== 0) return;
        const theater = currentRun.theaters.active;
        theater.inventory[WeaponType.INTERCEPTOR] = (theater.inventory[WeaponType.INTERCEPTOR] || 0) + 1;
        this.showFloatingLabel(this.scale.width / 2, 480, `CHAIN x${this.combo}\n+1 SM-3 RELOAD`, '#ffd166');
    }

    private showFloatingLabel(x: number, y: number, text: string, color: string) {
        const label = this.add.text(x, y, text, {
            fontSize: '34px', color, fontStyle: 'bold', align: 'center',
            stroke: '#000000', strokeThickness: 7
        }).setOrigin(0.5).setDepth(120);
        this.tweens.add({
            targets: label, y: y - 120, alpha: 0, duration: 1100,
            onComplete: () => label.destroy()
        });
    }

    private showAuditCallout() {
        const { width, height } = this.scale;
        const card = this.add.container(0, height - 435).setDepth(50);
        const panel = this.add.rectangle(width / 2, 0, width - 90, 128, 0x2a0d0d, 0.94).setStrokeStyle(3, 0xff765e);
        const portrait = this.add.image(104, 58, CHARACTERS.audit.portraitKey).setDisplaySize(106, 158).setOrigin(0.5, 1);
        const detail = this.add.text(178, -43, 'AVERY AUDIT — FRIENDLY FIRE INCIDENT', {
            fontSize: '19px', color: '#ff9b9b', fontStyle: 'bold'
        });
        const line = this.add.text(178, -5, `“${characterLine('audit', 'combat')}”`, {
            fontSize: '17px', color: '#ffd0d0', wordWrap: { width: width - 275 }
        });
        card.add([panel, portrait, detail, line]);
        card.setAlpha(0);
        this.tweens.add({
            targets: card, alpha: 1, y: height - 455, duration: 160, yoyo: true, hold: 1900,
            onComplete: () => card.destroy()
        });
    }

    private showOvermatchPopup(x: number, y: number, ratio: number, _weapon: WeaponType) {
        let label = 'OVERMATCH';
        let color = '#ffff00';
        let scale = 1;

        let particleCount = 5;

        if (ratio > 100000) {
            label = 'FISCAL DOMINANCE';
            color = '#ff00ff';
            scale = 1.5;
            particleCount = 20;
        } else if (ratio > 50000) {
            label = 'CONTRACT INFLATED';
            color = '#00ffff';
            scale = 1.3;
            particleCount = 15;
        } else if (ratio > 10000) {
            label = 'FREEDOM DELIVERY';
            color = '#ff4400';
            scale = 1.2;
            particleCount = 10;
        } else if (ratio > 1000) {
            label = 'EXCESSIVE FORCE';
            color = '#ffff00';
            scale = 1.1;
        }
        
        const container = this.popupPool.find((candidate) => !candidate.active) ?? this.popupPool[0];
        this.tweens.killTweensOf(container);
        const text = container.list[1] as Phaser.GameObjects.Text;
        text.setText(`${label}\n${ratio.toLocaleString()}x COST RATIO`).setColor(color);
        container.setPosition(x, y).setScale(0).setAlpha(1).setVisible(true).setActive(true);

        container.setScale(0);
        container.setDepth(100);

        this.tweens.add({
            targets: container,
            scale: scale,
            y: y - 100,
            duration: 300,
            ease: 'Back.out'
        });

        this.tweens.add({
            targets: container,
            alpha: 0,
            y: y - 250,
            delay: 1500,
            duration: 500,
            onComplete: () => container.setVisible(false).setActive(false)
        });

        // Add some money particles? (Optional but fits the satire)
        this.showMoneyParticles(x, y, particleCount);
    }

    private showMoneyParticles(x: number, y: number, count: number = 5) {
        for (let i = 0; i < Math.min(count, this.moneyPool.length); i++) {
            const money = this.moneyPool.find((candidate) => !candidate.active);
            if (!money) break;
            money.setPosition(x, y).setScale(0.2).setAlpha(1).setVisible(true).setActive(true).setRotation(Phaser.Math.FloatBetween(-0.3, 0.3));
            this.tweens.add({
                targets: money,
                x: x + Phaser.Math.Between(-150, 150),
                y: y + Phaser.Math.Between(-150, 150),
                alpha: 0,
                duration: 1200,
                ease: 'Power1',
                onComplete: () => money.setVisible(false).setActive(false)
            });
        }
    }

    private showOutOfAmmo() {
        const text = this.add.text(this.scale.width / 2, this.scale.height / 2, 'OUT OF AMMO!\nCHECK LOGISTICS', {
            fontSize: '64px',
            color: '#ff0000',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });
    }

    private spawnSwarm(config: ThreatConfig) {
        const centerX = Phaser.Math.Between(100, this.scale.width - 100);
        for (let i = 0; i < 5; i++) {
            const x = centerX + Phaser.Math.Between(-50, 50);
            const y = -50 - Phaser.Math.Between(0, 100);
            this.createThreat(config, x, y);
        }
    }

    private updateHUD() {
        const stats = this.combatSystem.getStats();
        this.hudTexts.burn.setText(`TAXPAYER BURN: ${this.formatCurrency(stats.taxpayerBurn)}`);
        this.hudTexts.mansions.setText(`MANSIONS: ${currentRun.mansionsBuilt}`);
        this.hudTexts.readiness.setText(`READINESS: ${currentRun.globalReadiness}%`);
        
        const pressure = Math.floor(stats.procurementPressure);
        this.hudTexts.pressure.setText(`PRESSURE: ${pressure}`);
        this.hudTexts.combo.setText(this.combo > 1 ? `CHAIN x${this.combo}  •  KEEP FIRING` : 'CHAIN READY');
        this.hudTexts.combo.setColor(this.combo > 1 ? '#ffdf6b' : '#ffd166');
        this.restraintText.setText(`RESTRAINT: ${stats.friendliesSpared} SPARED  •  FF: ${stats.friendliesHit}`);
        this.restraintText.setColor(stats.friendliesHit > 0 ? '#ff765e' : '#44ff88');
        
        // Pressure warning effect
        if (pressure > 100) {
            this.hudTexts.pressure.setColor('#ff0000');
            if (!this.isShaking) {
                this.isShaking = true;
                this.cameras.main.shake(2000, 0.005, false, (_camera: any, progress: number) => {
                    if (progress === 1) {
                        this.isShaking = false;
                    }
                });
            }
            if (pressure > 150 && this.hudTexts.pressure.scale === 1) {
                this.tweens.add({
                    targets: this.hudTexts.pressure,
                    scale: 1.1,
                    duration: 200,
                    yoyo: true,
                    repeat: -1
                });
            }
        } else {
            this.hudTexts.pressure.setColor('#ffffff');
            this.tweens.killTweensOf(this.hudTexts.pressure);
            this.hudTexts.pressure.setScale(1);
        }
        
        if (WEAPON_CONFIGS[this.currentWeapon].limitedAmmo) {
            const doctrineAmmo = currentRun.activeDoctrine?.effect.ammoCapacity;
            if (doctrineAmmo !== undefined) {
                this.hudTexts.ammo.setText('AMMO: UNLIMITED (DOCTRINE)');
                this.hudTexts.ammo.setColor('#00ffff');
            } else {
                const ammo = currentRun.theaters['active'].inventory[this.currentWeapon] || 0;
                this.hudTexts.ammo.setText(`AMMO: ${ammo}`);
                if (ammo <= 5) this.hudTexts.ammo.setColor('#ffaa00');
                else this.hudTexts.ammo.setColor('#ffffff');
            }
        } else {
            this.hudTexts.ammo.setText('AMMO: UNLIMITED');
            this.hudTexts.ammo.setColor('#ffffff');
        }
    }

    private formatCurrency(value: number): string {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        return `$${value.toLocaleString()}`;
    }

    update() {
        if (this.paused) return;
        const reloadRemaining = Math.max(0, WEAPON_CONFIGS[this.currentWeapon].reloadTime - (this.time.now - this.lastFired));
        this.reloadText.setText(reloadRemaining > 0 ? `RELOADING ${Math.ceil(reloadRemaining / 100) / 10}s` : 'SYSTEM READY')
            .setColor(reloadRemaining > 0 ? '#ffd47c' : '#9dff8e');
        if (this.currentWeapon === WeaponType.GUN) this.autoFireVulcan();
        const delta = this.game.loop.delta;
        this.interceptorShots.forEach((shot) => {
            if (!shot.active) {
                this.interceptorShots.delete(shot);
                return;
            }
            const trajectory = shot.getData('trajectory') as {
                start: { x: number; y: number };
                control: { x: number; y: number };
                target: { x: number; y: number };
                elapsed: number;
                duration: number;
                radius: number;
                weaponName: string;
            };
            trajectory.elapsed += delta;
            const progress = trajectory.elapsed / trajectory.duration;
            const position = quadraticBezier(trajectory.start, trajectory.control, trajectory.target, progress);
            shot.setPosition(position.x, position.y);
            const next = quadraticBezier(trajectory.start, trajectory.control, trajectory.target, Math.min(1, progress + 0.02));
            shot.setRotation(Phaser.Math.Angle.Between(position.x, position.y, next.x, next.y) + Math.PI / 2);
            if (progress >= 1) {
                this.interceptorShots.delete(shot);
                this.detonate(shot, trajectory.target.x, trajectory.target.y, trajectory.radius, trajectory.weaponName);
            }
        });
        this.updateSeekerShots(delta);

        this.threats.getChildren().forEach((threat: any) => {
            const motion = threat.getData('motion') as { originX: number; phase: number; amplitude: number; frequency: number } | undefined;
            if (motion) threat.x = motion.originX + Math.sin(this.time.now * motion.frequency + motion.phase) * motion.amplitude;
            if (threat.y > this.scale.height) {
                const config = threat.getData('config') as ThreatConfig;
                if (config.friendly) {
                    this.spareFriendly(threat);
                    return;
                }
                audioManager.play('base_hit');
                threat.destroy();
                const activeTheater = currentRun.theaters['active'];
                activeTheater.readiness = Math.max(0, activeTheater.readiness - 5);
                currentRun.updateGlobalReadiness();
                this.combatSystem.recordReadinessLoss(5);
                this.updateHUD();
                if (currentRun.globalReadiness === 0) this.gameOver();
            }
        });
    }

    private autoFireVulcan() {
        if (this.paused) return;
        const config = WEAPON_CONFIGS[WeaponType.GUN];
        if (this.time.now - this.lastFired < config.reloadTime) return;
        const candidates = this.threats.getChildren()
            .filter((threat: Phaser.GameObjects.GameObject) => threat.active)
            .map((threat: Phaser.GameObjects.GameObject) => threat as Phaser.GameObjects.Container)
            .filter((threat) => {
                const config = threat.getData('config') as ThreatConfig | undefined;
                return !config?.friendly;
            })
            .filter((threat) => Phaser.Math.Distance.Between(this.playerBase.x, this.playerBase.y, threat.x, threat.y) <= config.range);
        const target = candidates.sort((a, b) => a.y - b.y)[0];
        if (!target) return;

        this.lastFired = this.time.now;
        this.combatSystem.recordWeaponFire(WeaponType.GUN);
        this.fireGun(target.x, target.y, config);
        this.updateHUD();
    }

    private gameOver() {
        this.sound.stopAll();
        this.scene.pause();
        const { width, height } = this.scale;
        const stats = this.combatSystem.getStats();

        // Save score
        const scores = JSON.parse(localStorage.getItem('warrr_leaderboard_v1') || '[]');
        const newScore = {
            fiscalYear: currentRun.currentFY,
            mansions: currentRun.mansionsBuilt,
            burn: currentRun.taxpayerBurn + stats.taxpayerBurn
        };
        scores.push(newScore);
        scores.sort((a: any, b: any) => b.burn - a.burn);
        localStorage.setItem('warrr_leaderboard_v1', JSON.stringify(scores.slice(0, 10)));

        this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0);
        
        const displayStats = [
            'NATIONAL SECURITY FAILURE',
            '',
            `Taxpayer Burn: ${this.formatCurrency(stats.taxpayerBurn)}`,
            `Procurement Pressure: ${Math.floor(stats.procurementPressure)}`,
            `Overmatch Ratio: ${Math.floor(stats.overmatchTotal / Math.max(1, stats.interceptorsFired))}x`,
            '',
            '[VIEW HALL OF FAME]'
        ];

        this.add.text(width / 2, height / 2, displayStats, {
            fontSize: '56px',
            color: '#ff0000',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive().on('pointerdown', () => {
            this.scene.start('LeaderboardScene');
        });
    }
}
