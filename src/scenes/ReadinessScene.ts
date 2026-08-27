import * as Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { currentRun } from '../state/RunState';
import { NewsTicker } from '../ui/NewsTicker';
import { WeaponType } from '../game/config';

export class ReadinessScene extends Phaser.Scene {
    constructor() {
        super('ReadinessScene');
    }

    create() {
        this.input.enabled = true;
        const { width, height } = this.scale;

        // Background
        this.add.image(width / 2, height / 2, 'readiness_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0);

        audioManager.setScene(this);
        audioManager.playMusic('menu_music', true);

        this.add.text(width / 2, 80, 'THEATER READINESS', {
            fontSize: '64px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.renderTheaters(width, height);

        // Navigation
        this.add.rectangle(width / 2 + 220, height - 100, 400, 100, 0x006600)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.sound.stopAll();
                this.scene.start('ProcurementScene');
            });
        this.add.text(width / 2 + 220, height - 100, 'PROCUREMENT', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5);

        this.add.rectangle(width / 2 - 220, height - 100, 400, 100, 0x444444)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.sound.stopAll();
                this.scene.start('MansionScene');
            });
        this.add.text(width / 2 - 220, height - 100, 'TO MCLEAN', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5);

        new NewsTicker(this, height - 180);
    }

    private renderTheaters(width: number, _height: number) {
        const theaters = Object.values(currentRun.theaters);
        const startY = 200;
        const spacing = 280;

        theaters.forEach((theater, i) => {
            const y = startY + i * spacing;
            this.add.rectangle(width / 2, y, width - 80, 240, 0x2a3a4a).setOrigin(0.5);
            
            this.add.text(60, y - 80, theater.name.toUpperCase(), {
                fontSize: '48px',
                color: '#00ffff',
                fontStyle: 'bold'
            });

            const readinessColor = theater.readiness > 70 ? '#00ff00' : theater.readiness > 40 ? '#ffff00' : '#ff0000';
            this.add.text(width - 60, y - 80, `READINESS: ${Math.floor(theater.readiness)}%`, {
                fontSize: '42px',
                color: readinessColor,
                fontStyle: 'bold'
            }).setOrigin(1, 0);

            // Munition counts
            const interceptors = theater.inventory[WeaponType.INTERCEPTOR] || 0;
            const blockII = theater.inventory[WeaponType.INTERCEPTOR_BLOCK_II] || 0;

            this.add.text(80, y + 20, `FREEDOM INTERCEPTOR: ${interceptors}`, { fontSize: '36px', color: '#ffffff' });
            this.add.text(80, y + 80, `BLOCK II: ${blockII}`, { fontSize: '36px', color: '#ffaa00' });

            // Transfer buttons (Simplified for prototype)
            if (theater.id !== 'active') {
                this.add.rectangle(width - 120, y + 20, 180, 60, 0x006666)
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.handleTransfer(theater.id, 'active', WeaponType.INTERCEPTOR));
                this.add.text(width - 120, y + 20, 'TRANSFER F-INT', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);

                this.add.rectangle(width - 120, y + 90, 180, 60, 0x666600)
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.handleTransfer(theater.id, 'active', WeaponType.INTERCEPTOR_BLOCK_II));
                this.add.text(width - 120, y + 90, 'TRANSFER B-II', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
            }
        });
    }

    private handleTransfer(fromId: string, toId: string, weaponType: WeaponType) {
        // Transfer up to a fixed batch, allowing smaller inventories to transfer too.
        const available = currentRun.theaters[fromId]?.inventory[weaponType] || 0;
        const quantity = Math.min(10, available);
        if (quantity <= 0) return;

        const success = currentRun.transferInventory(fromId, toId, weaponType, quantity);
        if (success) {
            this.cameras.main.flash(200, 0, 255, 255);
            this.scene.restart(); // Refresh UI
        }
    }
}
