import { AudioManager } from '../managers/AudioManager';
import * as Phaser from 'phaser';
import { preloadSpriteSheets, registerGameAnimations } from '../game/Sprites';

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
            registerGameAnimations(this);
            const hash = window.location.hash;
            const next = (hash === '#procurement' || hash.includes('author'))
                ? 'ProcurementScene'
                : hash === '#arsenal'
                    ? 'CombatScene'
                    : 'TitleScene';
            this.scene.start(next);
        });

        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            console.error(`Error loading asset: ${file.key} - ${file.url}`);
        });

        this.loadAllAssets();
    }

    private setupProgressBar(width: number, height: number) {
        this.cameras.main.setBackgroundColor(0x020912);
        const glow = this.add.graphics();
        glow.fillStyle(0x00c2ff, 0.08);
        glow.fillCircle(width / 2, height / 2 - 160, 410);
        glow.lineStyle(2, 0x1a6c83, 0.45);
        for (let y = 140; y < height; y += 70) glow.lineBetween(0, y, width, y);

        this.add.text(width / 2, height / 2 - 290, 'DEPARTMENT OF', {
            fontSize: '36px', color: '#9bcbd4', fontStyle: 'bold', letterSpacing: 8
        }).setOrigin(0.5);
        this.add.text(width / 2, height / 2 - 205, 'WARRR', {
            fontSize: '118px', color: '#ffffff', fontStyle: 'bold', stroke: '#00b8de', strokeThickness: 8
        }).setOrigin(0.5);
        this.progressBox = this.add.graphics();
        this.progressBox.fillStyle(0x091a26, 0.94);
        this.progressBox.fillRoundedRect(width / 2 - 375, height / 2 - 34, 750, 68, 12);
        this.progressBox.lineStyle(3, 0x2a91ae, 0.9);
        this.progressBox.strokeRoundedRect(width / 2 - 375, height / 2 - 34, 750, 68, 12);

        this.progressBar = this.add.graphics();

        this.add.text(width / 2, height / 2 - 92, 'SECURING FUNDING AUTHORIZATION', {
            fontSize: '26px', color: '#ffd166', fontStyle: 'bold', letterSpacing: 2
        }).setOrigin(0.5);

        this.percentText = this.add.text(width / 2, height / 2, '0%', {
            fontSize: '30px', color: '#dffbff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 120, 'MONEY MOVES FAST. MUNITIONS MOVE SLOWLY.', {
            fontSize: '19px', color: '#668897', fontStyle: 'bold', letterSpacing: 1
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
        this.load.image('title_keyart', 'assets/title-keyart-v1.png');

        // === WEAPON SPRITES ===
        this.load.image('interceptor_sm3', 'assets/interceptor_sm3.png');
        this.load.image('interceptor_sm6', 'assets/interceptor_sm6.png');

        // === THREAT SPRITES (legacy singles + pack extracts) ===
        this.load.image('threat_shahed', 'assets/threat_shahed.png');
        this.load.image('threat_scooter', 'assets/threat_scooter.png');
        this.load.image('threat_missile', 'assets/threat_missile.png');
        this.load.image('threat_balloon', 'assets/threat_balloon.png');
        this.load.image('threat_heavy', 'assets/threats/heavy.png');
        this.load.image('threat_scout', 'assets/threats/scout.png');
        this.load.image('threat_swarm_leader', 'assets/threats/swarm-leader.png');
        this.load.image('threat_balloon_cluster', 'assets/threats/balloon-cluster.png');
        this.load.image('threat_stealth_anomaly', 'assets/threats/stealth-anomaly.png');
        this.load.image('threat_pack_jet', 'assets/threats/pack_jet.png');
        this.load.image('threat_pack_scout', 'assets/threats/pack_scout.png');
        this.load.image('threat_pack_swarm', 'assets/threats/pack_swarm.png');
        this.load.image('threat_pack_balloon', 'assets/threats/pack_balloon.png');
        this.load.image('threat_pack_mystery', 'assets/threats/pack_mystery.png');

        // === UI & VFX SPRITES ===
        this.load.image('money_bill', 'assets/money_bill.png');
        this.load.image('luxury_mansion', 'assets/luxury_mansion.png');

        // Fictional composite cast portraits.
        this.load.image('peter_kegsbreath', 'assets/characters/peter-kegsbreath.png');
        this.load.image('general_ledger', 'assets/characters/general-ledger.png');
        this.load.image('miranda_margin', 'assets/characters/miranda-margin.png');
        this.load.image('senator_addington', 'assets/characters/senator-addington.png');
        this.load.image('avery_audit', 'assets/characters/avery-audit.png');

        // Pinball art (painted sheets replace flat SVGs).
        this.load.image('flipper_left', 'assets/pinball/flipper_left.png');
        this.load.image('flipper_right', 'assets/pinball/flipper_right.png');
        this.load.image('pinball_bumper', 'assets/pinball/bumper.png');
        this.load.image('pinball_plunger', 'assets/pinball/plunger.png');
        this.load.image('pinball_drain', 'assets/ui/pinball-drain.svg');
        this.load.image('pinball_target', 'assets/ui/pinball-target.svg');
        this.load.image('pinball_sling', 'assets/pinball/sling.png');
        this.load.image('pinball_ball', 'assets/pinball/ball.png');
        this.load.image('pinball_playfield', 'assets/pinball/playfield_kit.png');
        this.load.image('pinball_playfield_audit', 'assets/pinball/playfield_audit.png');
        this.load.image('pinball_playfield_stadium', 'assets/pinball/playfield_stadium.png');
        this.load.image('pinball_skill_gate', 'assets/pinball/skill_gate.png');
        this.load.image('pinball_lane_on', 'assets/pinball/lane_on.png');
        this.load.image('pinball_lane_off', 'assets/pinball/lane_off.png');
        this.load.image('pinball_hit_inflate', 'assets/pinball/hit_inflate.png');
        this.load.image('pinball_hit_efficiency', 'assets/pinball/hit_efficiency.png');
        this.load.image('pinball_contract_card', 'assets/pinball/contract_card.png');
        this.load.image('pinball_mouth_enter', 'assets/pinball/mouth_enter.png');
        this.load.image('pinball_mouth_exit', 'assets/pinball/mouth_exit.png');
        this.load.image('pinball_mouth_tunnel', 'assets/pinball/mouth_tunnel.png');
        this.load.image('pinball_rail_post', 'assets/pinball/rail_post.png');
        this.load.image('pinball_wire_post', 'assets/pinball/wire_post.png');
        this.load.image('pinball_gate_block', 'assets/pinball/gate_block.png');
        this.load.image('pinball_chrome_rail', 'assets/pinball/chrome_rail.png');
        this.load.image('pinball_ramp_bed', 'assets/pinball/ramp_bed.png');
        this.load.image('pinball_wire_cable', 'assets/pinball/wire_cable.png');

        this.load.image('weapon_hydra', 'assets/weapons/hydra.png');
        this.load.image('weapon_railgun', 'assets/weapons/railgun.png');
        this.load.image('weapon_seeker', 'assets/weapons/seeker.png');
        this.load.image('proj_hydra_missile', 'assets/weapons/hydra_missile.png');
        this.load.image('proj_hydra_sub', 'assets/weapons/hydra_sub.png');
        this.load.image('proj_railgun_slug', 'assets/weapons/railgun_slug.png');
        this.load.image('proj_seeker_drone', 'assets/weapons/seeker_drone.png');

        this.load.image('scenario_desert', 'assets/scenarios/theater_desert.png');
        this.load.image('scenario_island', 'assets/scenarios/theater_island.png');
        this.load.image('scenario_homeland', 'assets/scenarios/theater_homeland.png');
        this.load.image('base_carrier', 'assets/bases/carrier.png');
        this.load.image('base_desert', 'assets/bases/desert.png');
        this.load.image('base_island', 'assets/bases/island.png');
        this.load.image('base_homeland', 'assets/bases/homeland.png');

        preloadSpriteSheets(this);
        AudioManager.preload(this);
    }
}
