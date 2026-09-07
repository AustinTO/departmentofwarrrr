import * as Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { currentRun } from '../state/RunState';
import { SettingsPanel } from '../ui/SettingsPanel';

export class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
    }

    create() {
        const { width, height } = this.scale;
        this.input.enabled = true;

        this.add.image(width / 2, height / 2, 'title_keyart').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x01060b, 0.54).setOrigin(0);
        this.add.rectangle(width / 2, height * 0.32, width, height * 0.62, 0x04101b, 0.64);
        this.createAtmosphere(width, height);

        audioManager.setScene(this);
        audioManager.playMusic('menu_music', true);

        this.add.text(width / 2, 142, 'BUREAU OF EXCESSIVE RESPONSE', {
            fontSize: '21px', color: '#ffd166', fontStyle: 'bold', letterSpacing: 3
        }).setOrigin(0.5);
        this.add.text(width / 2, 220, 'DEPARTMENT OF', {
            fontSize: '44px', color: '#b9e7ee', fontStyle: 'bold', letterSpacing: 8
        }).setOrigin(0.5);

        this.add.text(width / 2, 320, 'WARRR', {
            fontSize: '140px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#00c6ef', strokeThickness: 12,
            shadow: { offsetX: 0, offsetY: 12, color: '#001822', blur: 12, fill: true }
        }).setOrigin(0.5);

        this.add.text(width / 2, 454, 'EXPENSIVE INTERCEPTS. CHEAP THREATS.\nSOMEBODY GETS A MANSION.', {
            fontSize: '28px', color: '#ffe4a0', align: 'center', fontStyle: 'bold', lineSpacing: 8,
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        const canContinue = currentRun.hasProgress();
        let y = 676;

        if (canContinue) {
            this.addCampaignStatus(width / 2, y - 82);
            this.addMenuButton(width / 2, y, 'CONTINUE CAMPAIGN', 0x087a42, 0xa8ff93, () => {
                this.sound.stopAll();
                this.scene.start('DoctrineScene');
            });
            y += 164;
        }

        this.addMenuButton(width / 2, y, canContinue ? 'NEW CAMPAIGN' : 'BEGIN CAMPAIGN', 0x126a87, 0x7df4ff, () => {
            currentRun.reset();
            currentRun.save();
            this.sound.stopAll();
            this.scene.start('DoctrineScene');
        });
        y += 150;

        this.addMenuButton(width / 2, y, 'SETTINGS', 0x2a3a4a, 0x5de6ff, () => {
            new SettingsPanel(this, { onClose: () => undefined });
        });
        y += 150;

        this.addMenuButton(width / 2, y, 'HALL OF FAME', 0x3a2a14, 0xffd166, () => {
            this.sound.stopAll();
            this.scene.start('LeaderboardScene');
        });

        this.add.text(width / 2, height - 72, 'A SATIRICAL DEFENSE PROCUREMENT SIMULATOR', {
            fontSize: '18px', color: '#9ab8c3', fontStyle: 'bold', letterSpacing: 1
        }).setOrigin(0.5);
    }

    private createAtmosphere(width: number, height: number) {
        const lines = this.add.graphics().setDepth(1);
        lines.lineStyle(1, 0x85ddeb, 0.11);
        for (let y = 0; y < height; y += 48) lines.lineBetween(0, y, width, y);
        for (let x = 0; x < width; x += 72) lines.lineBetween(x, 0, x, height);

        const sweep = this.add.rectangle(width * 0.18, height * 0.47, 26, height * 0.85, 0x59e9ff, 0.06)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAngle(-18);
        this.tweens.add({ targets: sweep, x: width * 0.84, duration: 6200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

        const beacon = this.add.circle(width * 0.81, height * 0.15, 9, 0xff4d4d, 0.95).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: beacon, alpha: 0.15, scale: 2.2, duration: 720, yoyo: true, repeat: -1 });
    }

    private addCampaignStatus(x: number, y: number) {
        const readiness = Math.floor(currentRun.globalReadiness);
        const color = readiness >= 65 ? '#a8ff93' : readiness >= 35 ? '#ffd166' : '#ff765e';
        this.add.rectangle(x, y, 774, 58, 0x05131d, 0.88).setStrokeStyle(2, 0x2b7d94, 0.85);
        this.add.text(x, y, `FY ${currentRun.currentFY}   •   ${currentRun.mansionsBuilt} MANSIONS   •   ${readiness}% READINESS`, {
            fontSize: '20px', color, fontStyle: 'bold', letterSpacing: 1
        }).setOrigin(0.5);
    }

    private addMenuButton(
        x: number,
        y: number,
        label: string,
        fill: number,
        stroke: number,
        onClick: () => void
    ) {
        const shadow = this.add.rectangle(x, y + 10, 744, 120, 0x000000, 0.45);
        const button = this.add.rectangle(x, y, 744, 120, fill, 0.96)
            .setStrokeStyle(4, stroke)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', onClick);
        button.on('pointerover', () => { button.setStrokeStyle(6, 0xffffff); shadow.setAlpha(0.65); });
        button.on('pointerout', () => { button.setStrokeStyle(4, stroke); shadow.setAlpha(0.45); });
        this.add.rectangle(x - 342, y, 8, 82, stroke, 0.95);
        this.add.text(x, y, label, {
            fontSize: '38px', color: '#ffffff', fontStyle: 'bold', letterSpacing: 1,
            shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 2, fill: true }
        }).setOrigin(0.5);
    }
}
