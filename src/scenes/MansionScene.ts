import * as Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { NewsTicker } from '../ui/NewsTicker';
import { currentRun } from '../state/RunState';

export class MansionScene extends Phaser.Scene {
    constructor() {
        super('MansionScene');
    }

    create() {
        const { width, height } = this.scale;

        // Background
        this.add.image(width / 2, height / 2, 'mansion_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.2).setOrigin(0);

        audioManager.setScene(this);
        audioManager.play('menu_music', { loop: true });

        this.add.text(width / 2, 80, 'MCLEAN, VIRGINIA', {
            fontSize: '64px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        currentRun.reconcileMansions();
        currentRun.save();
        this.renderNeighborhood(width, height);

        // HUD
        this.add.text(40, 160, `CONTRACTOR PROFIT: $${(currentRun.contractorProfit / 1e6).toFixed(1)}M`, {
            fontSize: '42px',
            color: '#00ff00'
        });

        // Navigation
        this.add.rectangle(width / 2, height - 100, 400, 100, 0x004400)
            .setInteractive()
            .on('pointerdown', () => {
                this.sound.stopAll();
                this.scene.start('EventScene');
            });
        this.add.text(width / 2, height - 100, 'NEXT FISCAL YEAR', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5);

        new NewsTicker(this, height - 180);
    }

    private renderNeighborhood(width: number, _height: number) {
        // Grid of mansion plots
        const cols = 3;
        const spacing = width / (cols + 1);
        const startY = 350;
        const rowSpacing = 250;

        const mansionCount = currentRun.mansionsBuilt;

        const plotCount = Math.max(15, mansionCount + 1);
        for (let i = 0; i < plotCount; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = spacing * (col + 1);
            const y = startY + row * rowSpacing;

            // Plot
            this.add.rectangle(x, y, 200, 180, 0x336633).setStrokeStyle(4, 0x113311);

            if (i < mansionCount) {
                this.buildMansion(x, y);
            } else if (i === mansionCount) {
                // Construction zone for next mansion
                this.add.text(x, y, `NEXT\n$${(currentRun.mansionCost() / 1e6).toFixed(1)}M`, { fontSize: '24px', color: '#ffff00', align: 'center' }).setOrigin(0.5);
            }
        }
    }

    private buildMansion(x: number, y: number) {
        const container = this.add.container(x, y);
        
        const sprite = this.add.sprite(0, 0, 'luxury_mansion');
        sprite.setDisplaySize(220, 180);
        container.add(sprite);
        
        // Bloom/Glow for the "Achievement"
        const glow = this.add.circle(0, 0, 120, 0xffff00, 0.2);
        container.addAt(glow, 0);
        
        container.setScale(0);
        this.tweens.add({
            targets: container,
            scale: 1,
            duration: 1200,
            ease: 'Back.out'
        });
    }
}
