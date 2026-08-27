import * as Phaser from 'phaser';

export class LeaderboardScene extends Phaser.Scene {
    constructor() {
        super('LeaderboardScene');
    }

    create() {
        const { width, height } = this.scale;

        this.add.image(width / 2, height / 2, 'doctrine_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);

        this.add.text(width / 2, 100, 'HALL OF FAME', {
            fontSize: '72px',
            color: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.displayScores(width, height);

        this.add.container(width / 2 - 220, height - 100)
            .add(this.add.rectangle(0, 0, 400, 100, 0x444444))
            .add(this.add.text(0, 0, 'MAIN MENU', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5))
            .setSize(400, 100)
            .setInteractive()
            .on('pointerdown', () => {
                window.location.reload();
            });

        this.add.container(width / 2 + 220, height - 100)
            .add(this.add.rectangle(0, 0, 400, 100, 0x006600))
            .add(this.add.text(0, 0, 'SHARE', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5))
            .setSize(400, 100)
            .setInteractive()
            .on('pointerdown', () => {
                this.game.renderer.snapshot((image: any) => {
                    const link = document.createElement('a');
                    link.href = image.src;
                    link.download = 'department_of_warrr_scores.png';
                    link.click();
                    console.log('Screenshot captured. In a real app, this would open a share dialog.');
                });
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

    private getScores(): any[] {
        const saved = localStorage.getItem('warrr_leaderboard_v1');
        if (saved) {
            return JSON.parse(saved);
        }
        return [];
    }

    private formatCurrency(value: number): string {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        return `$${value.toLocaleString()}`;
    }
}
