import { AudioManager } from '../managers/AudioManager';
import * as Phaser from 'phaser';

export class PreloaderScene extends Phaser.Scene {
    private progressBar!: Phaser.GameObjects.Graphics;
    private progressBox!: Phaser.GameObjects.Graphics;
    private percentText!: Phaser.GameObjects.Text;

    constructor() {
        super('PreloaderScene');
    }

    preload() {
        const { width, height } = this.scale;
        this.setupProgressBar(width, height);

        this.load.crossOrigin = 'anonymous';

        this.load.on('progress', (value: number) => {
            this.percentText.setText(`${Math.floor(value * 100)}%`);
            this.progressBar.clear();
            this.progressBar.fillStyle(0x00ff00, 1);
            this.progressBar.fillRect(width / 2 - 150, height / 2 - 20, 300 * value, 40);
        });

        this.load.on('complete', () => {
            this.scene.start('DoctrineScene');
        });
        
        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            console.error(`Error loading asset: ${file.key} - ${file.url}`);
        });

        this.loadAllAssets();
    }

    private setupProgressBar(width: number, height: number) {
        this.progressBox = this.add.graphics();
        this.progressBox.fillStyle(0x333333, 0.8);
        this.progressBox.fillRect(width / 2 - 160, height / 2 - 30, 320, 60);
        
        this.progressBar = this.add.graphics();

        this.add.text(width / 2, height / 2 - 80, 'SECURING FUNDING...', {
            fontSize: '42px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.percentText = this.add.text(width / 2, height / 2, '0%', {
            fontSize: '36px', color: '#ffffff'
        }).setOrigin(0.5);
    }

    private loadAllAssets() {
        // === SCENE BACKGROUNDS ===
        this.load.image('combat_bg', 'assets/combat_bg.png');
        this.load.image('doctrine_bg', 'assets/doctrine_bg.png');
        this.load.image('mansion_bg', 'assets/mansion_bg.png');
        this.load.image('procurement_bg', 'assets/procurement_bg.png');
        this.load.image('readiness_bg', 'assets/readiness_bg.png');
        this.load.image('event_bg', 'assets/event_bg.png');

        // === WEAPON SPRITES ===
        this.load.image('interceptor_sm3', 'assets/interceptor_sm3.png');
        this.load.image('interceptor_sm6', 'assets/interceptor_sm6.png');
        
        // === THREAT SPRITES ===
        this.load.image('threat_shahed', 'assets/threat_shahed.png');
        this.load.image('threat_scooter', 'assets/threat_scooter.png');
        this.load.image('threat_missile', 'assets/threat_missile.png');
        this.load.image('threat_balloon', 'assets/threat_balloon.png');
        
        // === UI & VFX SPRITES ===
        this.load.image('money_bill', 'assets/money_bill.png');
        this.load.image('luxury_mansion', 'assets/luxury_mansion.png');

        // === AUDIO ===
        AudioManager.preload(this);
    }

}
