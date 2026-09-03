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
            this.scene.start(window.location.hash === '#procurement' ? 'ProcurementScene' : 'DoctrineScene');
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

        // Fictional composite cast portraits.
        this.load.image('peter_kegsbreath', 'assets/characters/peter-kegsbreath.png');
        this.load.image('general_ledger', 'assets/characters/general-ledger.png');
        this.load.image('miranda_margin', 'assets/characters/miranda-margin.png');
        this.load.image('senator_addington', 'assets/characters/senator-addington.png');
        this.load.image('avery_audit', 'assets/characters/avery-audit.png');

        this.load.image('threat_heavy', 'assets/threats/heavy.png');
        this.load.image('threat_scout', 'assets/threats/scout.png');
        this.load.image('threat_swarm_leader', 'assets/threats/swarm-leader.png');
        this.load.image('threat_balloon_cluster', 'assets/threats/balloon-cluster.png');
        this.load.image('threat_stealth_anomaly', 'assets/threats/stealth-anomaly.png');
        this.load.image('flipper_left', 'assets/ui/flipper-left.svg');
        this.load.image('flipper_right', 'assets/ui/flipper-right.svg');
        this.load.image('pinball_bumper', 'assets/ui/pinball-bumper.svg');
        this.load.image('pinball_plunger', 'assets/ui/pinball-plunger.svg');
        this.load.image('pinball_drain', 'assets/ui/pinball-drain.svg');
        this.load.image('pinball_target', 'assets/ui/pinball-target.svg');
        this.load.image('pinball_sling', 'assets/ui/pinball-sling.svg');
        this.load.image('pinball_ball', 'assets/ui/pinball-ball.svg');
        this.load.image('scenario_desert', 'assets/scenarios/desert-base.png');
        this.load.image('scenario_island', 'assets/scenarios/island-base.png');
        this.load.image('scenario_homeland', 'assets/scenarios/homeland-base.png');

        // === AUDIO ===
        AudioManager.preload(this);
    }

}
