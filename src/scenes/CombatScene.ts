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

export class CombatScene extends Phaser.Scene {
    private playerBase!: Phaser.GameObjects.Rectangle;
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
    private combo = 0;
    private comboExpiresAt = 0;
    private weaponButtons = new Map<WeaponType, Phaser.GameObjects.Rectangle>();
    private reloadText!: Phaser.GameObjects.Text;
    private scenario!: CombatScenario;
    private strikeIntegrity = 100;

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
        this.waveDirector = new WaveDirector(Math.max(1, currentRun.currentFY - 2025));
        this.scenario = scenarioForFiscalYear(currentRun.currentFY);

        // Background
        this.add.image(width / 2, height / 2, this.scenario.backgroundKey ?? 'combat_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.3).setOrigin(0); // Darken for readability

        audioManager.setScene(this);
        audioManager.playMusic('combat_music', true);

        // Player Base
        this.playerBase = this.add.rectangle(width / 2, height - 100, 300, 72, this.scenario.baseColor);
        this.playerBase.setStrokeStyle(4, 0xffffff, 0.8);
        this.add.rectangle(width / 2, height - 145, 140, 48, this.scenario.baseColor, 0.7).setStrokeStyle(3, 0xffffff, 0.65);
        this.add.text(width / 2, height - 178, this.scenario.baseName, { fontSize: '19px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.physics.add.existing(this.playerBase, true);
        if (this.scenario.mode === 'strike') this.createStrikeTarget(width);

        // Groups
        this.threats = this.physics.add.group();

        // Particles
        const graphics = this.add.graphics();
        graphics.fillStyle(0xffffff);
        graphics.fillRect(0, 0, 4, 4);
        graphics.generateTexture('particle', 4, 4);
        graphics.destroy();
        
        this.particles = this.add.particles(0, 0, 'particle', {
            speed: { min: 50, max: 200 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            emitting: false
        });

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
        
        // Finalize stats to global run
        currentRun.taxpayerBurn += stats.taxpayerBurn;
        const profitMargin = currentRun.activeDoctrine?.effect.profitMargin || 1.0;
        currentRun.contractorProfit += (stats.taxpayerBurn * 0.15) * profitMargin;
        currentRun.save();

        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0).setDepth(1000);
        this.add.text(width / 2, height / 2 - 100, 'FISCAL YEAR CONCLUDED', {
            fontSize: '72px',
            color: '#00ffff',
            align: 'center',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1001);

        this.add.text(width / 2, height / 2 + 50, `BURN: ${this.formatCurrency(stats.taxpayerBurn)}\nPROFIT: ${this.formatCurrency((stats.taxpayerBurn * 0.15) * profitMargin)}`, {
            fontSize: '48px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setDepth(1001);

        this.time.delayedCall(3000, () => {
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
        if (Math.random() < 0.35) type = Phaser.Math.RND.pick(this.scenario.threatBias);
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
        const container = this.add.container(posX, posY);
        
        let spriteKey = 'threat_shahed';
        switch(config.type) {
            case ThreatType.LAWN_MOWER: spriteKey = 'threat_heavy'; break;
            case ThreatType.SCOOTER: spriteKey = 'threat_scout'; break;
            case ThreatType.MISSILE: spriteKey = 'threat_missile'; break;
            case ThreatType.DECOY: spriteKey = 'threat_balloon_cluster'; break;
            case ThreatType.SWARM: spriteKey = 'threat_swarm_leader'; break;
            case ThreatType.MYSTERY: spriteKey = 'threat_stealth_anomaly'; break;
        }

        const sprite = this.add.sprite(0, 0, spriteKey);
        sprite.setDisplaySize(config.radius * 3.6, config.radius * 3.6);
        if (config.type === ThreatType.LAWN_MOWER) sprite.setTint(Phaser.Math.RND.pick([0xffffff, 0xc6d8bf, 0xe4cfaa]));
        if (config.type === ThreatType.SCOOTER || config.type === ThreatType.SWARM) sprite.setTint(Phaser.Math.RND.pick([0xffffff, 0xffc49b, 0xa7dfff]));
        if (config.type === ThreatType.MYSTERY) sprite.setTint(0xa98cff);
        container.add(sprite);
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
        const weaving = config.type === ThreatType.SCOOTER || config.type === ThreatType.MYSTERY || config.type === ThreatType.SWARM;
        if (weaving) {
            container.setData('motion', {
                originX: posX,
                phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
                amplitude: config.type === ThreatType.SCOOTER ? 90 : 45,
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


    private setupHUD(width: number, _height: number) {
        const style = { fontSize: '42px', color: '#ffffff', fontStyle: 'bold' };
        
        this.hudTexts = {
            burn: this.add.text(40, 40, 'TAXPAYER BURN: $0', style),
            mansions: this.add.text(40, 100, 'MANSIONS: 0', style),
            readiness: this.add.text(width - 40, 40, `READINESS: ${currentRun.globalReadiness}%`, style).setOrigin(1, 0),
            weapon: this.add.text(width / 2, 160, `WEAPON: ${this.currentWeapon}`, style).setOrigin(0.5, 0),
            pressure: this.add.text(width - 40, 100, 'PRESSURE: 0', style).setOrigin(1, 0),
            ammo: this.add.text(width / 2, 220, 'AMMO: UNLIMITED', style).setOrigin(0.5, 0),
            combo: this.add.text(width / 2, 285, 'CHAIN READY', { ...style, color: '#ffd166' }).setOrigin(0.5, 0)
        };
        this.reloadText = this.add.text(width / 2, 345, 'SYSTEM READY', { fontSize: '22px', color: '#9dff8e', fontStyle: 'bold' }).setOrigin(0.5);
    }

    private setupWeaponButtons(width: number, height: number) {
        const weapons = [WeaponType.GUN, WeaponType.JAMMER, WeaponType.INTERCEPTOR, WeaponType.INTERCEPTOR_BLOCK_II];
        const buttonWidth = width / 4;
        
        weapons.forEach((type, i) => {
            const x = i * buttonWidth + buttonWidth / 2;
            const y = height - 50;
            
            const button = this.add.rectangle(x, y, buttonWidth - 10, 98, 0x333333)
                .setStrokeStyle(3, 0x5c6770)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.setWeapon(type));
            this.weaponButtons.set(type, button);
            
            let label = 'VULCAN';
            if (type === WeaponType.JAMMER) label = 'JAMMER';
            if (type === WeaponType.INTERCEPTOR) label = 'SM-3';
            if (type === WeaponType.INTERCEPTOR_BLOCK_II) label = 'SM-6';
            
            this.add.text(x, y - 10, label, { fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
            this.add.text(x, y + 27, this.weaponCostLabel(type), { fontSize: '17px', color: '#b9d5e6' }).setOrigin(0.5);
        });

        this.updateWeaponSelectionFeedback();
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
        const ammo = this.currentWeapon === WeaponType.INTERCEPTOR || this.currentWeapon === WeaponType.INTERCEPTOR_BLOCK_II
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
        if (pointer.y < 240 && pointer.x > this.scale.width - 310) return;
        if (pointer.y > this.scale.height - 120) return;

        const now = this.time.now;
        const config = WEAPON_CONFIGS[this.currentWeapon];

        if (now - this.lastFired < config.reloadTime) return;

        // Check ammo for interceptors
        if (this.currentWeapon === WeaponType.INTERCEPTOR || this.currentWeapon === WeaponType.INTERCEPTOR_BLOCK_II) {
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

        this.physics.add.existing(container);
        
        // Keep Arcade Physics for the projectile body, but steer its position along
        // a curved, fast flight path so every launch has a little personality.
        const speed = isBlockII ? 2100 : 1800;
        const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
        const duration = Math.max(120, (distance / speed) * 1000);
        const arc = Phaser.Math.Clamp((targetX - startX) * 0.22, -180, 180);
        container.setData('trajectory', {
            start: { x: startX, y: startY },
            control: getArcControlPoint({ x: startX, y: startY }, { x: targetX, y: targetY }, arc),
            target: { x: targetX, y: targetY },
            elapsed: 0,
            duration,
            radius: config.radius,
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
        
        // Stylized jamming wave
        graphics.lineStyle(2, config.color, 0.8);
        graphics.strokeCircle(0, 0, 10);
        container.add(graphics);

        this.tweens.add({
            targets: graphics,
            scaleX: config.radius / 10,
            scaleY: config.radius / 10,
            alpha: 0,
            duration: 1000,
            onComplete: () => container.destroy()
        });

        // Add some "interference" particles
        this.particles.emitParticleAt(targetX, targetY, 20);

        this.threats.getChildren().forEach((threat: any) => {
            const dist = Phaser.Math.Distance.Between(targetX, targetY, threat.x, threat.y);
            if (dist < config.radius) {
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

    private detonate(interceptor: Phaser.GameObjects.GameObject, x: number, y: number, radius: number, weaponName: string) {
        interceptor.destroy();

        const isBlockII = weaponName.includes('BLOCK II');
        const color = isBlockII ? 0xff4400 : 0xffa500;
        
        // Add a "flash" before the explosion
        const flash = this.add.circle(x, y, radius * 0.2, 0xffffff, 1);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 100,
            onComplete: () => flash.destroy()
        });

        const explosion = this.add.circle(x, y, 10, color, 0.7);
        
        // Hit Stop effect
        this.physics.world.pause();
        this.time.delayedCall(isBlockII ? 100 : 50, () => {
            this.physics.world.resume();
        });

        this.cameras.main.shake(isBlockII ? 400 : 200, isBlockII ? 0.02 : 0.01);
        this.particles.emitParticleAt(x, y, isBlockII ? 100 : 40);

        this.tweens.add({
            targets: explosion,
            radius: radius,
            alpha: 0,
            duration: isBlockII ? 800 : 600,
            onComplete: () => explosion.destroy()
        });

        const weaponType = isBlockII ? WeaponType.INTERCEPTOR_BLOCK_II : WeaponType.INTERCEPTOR;
        this.threats.getChildren().forEach((threat: any) => {
            const dist = Phaser.Math.Distance.Between(x, y, threat.x, threat.y);
            if (dist < radius) {
                this.destroyThreat(threat, weaponType);
            }
        });
    }

    private destroyThreat(threat: any, weapon: WeaponType) {
        audioManager.play('threat_explode');
        const threatConfig = threat.getData('config') as ThreatConfig;
        const ratio = this.combatSystem.recordThreatDestroyed(threatConfig.type, weapon);

        this.combo = this.time.now <= this.comboExpiresAt ? this.combo + 1 : 1;
        this.comboExpiresAt = this.time.now + 2200;

        if (weapon === WeaponType.INTERCEPTOR || weapon === WeaponType.INTERCEPTOR_BLOCK_II) {
            this.showOvermatchPopup(threat.x, threat.y, ratio, weapon);
        }

        threat.destroy();
        this.updateHUD();
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
        
        const container = this.add.container(x, y);
        
        // Background flare
        const flare = this.add.circle(0, 0, 40, 0xffffff, 0.3);
        container.add(flare);

        const text = this.add.text(0, 0, `${label}\n${ratio.toLocaleString()}x COST RATIO`, {
            fontSize: '48px',
            color: color,
            align: 'center',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);
        container.add(text);

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
            onComplete: () => container.destroy()
        });

        // Add some money particles? (Optional but fits the satire)
        this.showMoneyParticles(x, y, particleCount);
    }

    private showMoneyParticles(x: number, y: number, count: number = 5) {
        for (let i = 0; i < count; i++) {
            const money = this.add.sprite(x, y, 'money_bill');
            money.setScale(0.2);
            this.tweens.add({
                targets: money,
                x: x + Phaser.Math.Between(-150, 150),
                y: y + Phaser.Math.Between(-150, 150),
                alpha: 0,
                duration: 1200,
                ease: 'Power1',
                onComplete: () => money.destroy()
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
        this.hudTexts.readiness.setText(`READINESS: ${currentRun.globalReadiness}%`);
        
        const pressure = Math.floor(stats.procurementPressure);
        this.hudTexts.pressure.setText(`PRESSURE: ${pressure}`);
        this.hudTexts.combo.setText(this.combo > 1 ? `CHAIN x${this.combo}  •  KEEP FIRING` : 'CHAIN READY');
        this.hudTexts.combo.setColor(this.combo > 1 ? '#ffdf6b' : '#ffd166');
        
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
        
        if (this.currentWeapon === WeaponType.INTERCEPTOR || this.currentWeapon === WeaponType.INTERCEPTOR_BLOCK_II) {
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

        this.threats.getChildren().forEach((threat: any) => {
            const motion = threat.getData('motion') as { originX: number; phase: number; amplitude: number; frequency: number } | undefined;
            if (motion) threat.x = motion.originX + Math.sin(this.time.now * motion.frequency + motion.phase) * motion.amplitude;
            if (threat.y > this.scale.height) {
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
        const config = WEAPON_CONFIGS[WeaponType.GUN];
        if (this.time.now - this.lastFired < config.reloadTime) return;
        const candidates = this.threats.getChildren()
            .filter((threat: Phaser.GameObjects.GameObject) => threat.active)
            .map((threat: Phaser.GameObjects.GameObject) => threat as Phaser.GameObjects.Container)
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
