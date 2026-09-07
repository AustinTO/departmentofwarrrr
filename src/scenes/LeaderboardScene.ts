import * as Phaser from 'phaser';
import { currentRun } from '../state/RunState';
import { audioManager } from '../managers/AudioManager';

export class LeaderboardScene extends Phaser.Scene {
    constructor() {
        super('LeaderboardScene');
    }

    create() {
        const { width, height } = this.scale;

        this.add.image(width / 2, height / 2, 'doctrine_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);

        audioManager.setScene(this);
        audioManager.playMusic('menu_music', true);

        this.add.text(width / 2, 100, 'HALL OF FAME', {
            fontSize: '72px',
            color: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, 165, 'THE MORE YOU BURN, THE HIGHER YOU RANK', {
            fontSize: '22px', color: '#ffcf66', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.displayScores(width, height);

        this.add.container(width / 2 - 220, height - 100)
            .add(this.add.rectangle(0, 0, 400, 100, 0x444444))
            .add(this.add.text(0, 0, 'MAIN MENU', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5))
            .setSize(400, 100)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.sound.stopAll();
                audioManager.stopMusic();
                this.scene.start('TitleScene');
            });

        this.add.container(width / 2 + 220, height - 100)
            .add(this.add.rectangle(0, 0, 400, 100, 0x006600))
            .add(this.add.text(0, 0, 'SHARE', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5))
            .setSize(400, 100)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.shareScorecard());
    }

    private async shareScorecard() {
        const top = this.getScores()[0];
        const burn = top?.burn ?? currentRun.taxpayerBurn;
        const mansions = top?.mansions ?? currentRun.mansionsBuilt;
        const fy = top?.fiscalYear ?? currentRun.currentFY;
        const text = `I burned ${this.formatCurrency(burn)} and built ${mansions} McLean mansions by FY ${fy} in Department of WARRR.`;

        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ title: 'Department of WARRR', text });
                return;
            } catch {
                // Fall through to clipboard / screenshot if the user cancels share.
            }
        }

        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                this.flashShareStatus('SCORECARD COPIED');
                return;
            } catch {
                // Last resort: download a screenshot.
            }
        }

        this.game.renderer.snapshot((image) => {
            const link = document.createElement('a');
            // Phaser snapshot returns an HTMLImageElement in the browser build.
            link.href = (image as HTMLImageElement).src;
            link.download = 'department_of_warrr_scores.png';
            link.click();
            this.flashShareStatus('SCREENSHOT SAVED');
        });
    }

    private flashShareStatus(message: string) {
        const { width, height } = this.scale;
        const note = this.add.text(width / 2, height - 220, message, {
            fontSize: '32px', color: '#a8ff93', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({
            targets: note, alpha: 0, y: height - 260, duration: 1200,
            onComplete: () => note.destroy()
        });
    }

    private displayScores(width: number, height: number) {
        const scores = this.getScores();

        if (scores.length === 0) {
            this.add.text(width / 2, height / 2, 'No records yet. Go make some questionable decisions.', {
                fontSize: '32px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            return;
        }

        let y = 250;
        scores.forEach((score, index) => {
            const rank = `${index + 1}.`;
            const scoreText = `FY ${score.fiscalYear} - ${score.mansions} Mansions - BURN: ${this.formatCurrency(score.burn)}`;

            this.add.text(100, y, rank, { fontSize: '42px', color: '#ffff00' });
            this.add.text(200, y, scoreText, { fontSize: '42px', color: '#ffffff' });

            y += 70;
        });
    }

    private getScores(): Array<{ fiscalYear: number; mansions: number; burn: number }> {
        const saved = localStorage.getItem('warrr_leaderboard_v1');
        if (saved) {
            try {
                const scores = JSON.parse(saved);
                return Array.isArray(scores) ? scores : [];
            } catch {
                localStorage.removeItem('warrr_leaderboard_v1');
            }
        }
        return [];
    }

    private formatCurrency(value: number): string {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        return `$${value.toLocaleString()}`;
    }
}
