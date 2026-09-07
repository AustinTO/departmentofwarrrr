import * as Phaser from 'phaser';
import type { ProcurementSystem } from '../game/ProcurementSystem';

type ContractCardMode = 'drain' | 'authorize';

/** Animated post-ball / post-authorize contract result card. */
export class ContractCard {
    private root: Phaser.GameObjects.Container;

    constructor(
        scene: Phaser.Scene,
        system: ProcurementSystem,
        mode: ContractCardMode,
        options: { onContinue: () => void }
    ) {
        const { width, height } = scene.scale;
        const state = system.state;
        this.root = scene.add.container(0, 0).setDepth(3500);

        this.root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setInteractive());

        const panel = scene.add.image(width / 2, height / 2 - 20, 'pinball_contract_card')
            .setDisplaySize(860, 980)
            .setAlpha(0.96);
        this.root.add(panel);

        const title = mode === 'authorize' ? 'CONTRACT AUTHORIZED' : 'BALL REPORT';
        this.root.add(scene.add.text(width / 2, height / 2 - 420, title, {
            fontSize: '48px', color: '#ffd166', fontStyle: 'bold', stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5));

        const lines = [
            `AUTHORIZATION VALUE: ${system.formatBudget(state.value)}`,
            `CONTRACTOR PROFIT CUT: ${system.formatBudget(state.value * 0.15)}`,
            `DELIVERY DELAY: +${state.leadTimeDelay.toFixed(1)} YEARS`,
            `UNITS ON ORDER: ${Object.values(state.items).reduce((n, q) => n + (q ?? 0), 0)}`,
            `SKILL SHOTS: ${state.skillShots}`,
            '',
            state.consequence,
            '',
            mode === 'authorize'
                ? 'MONEY NOW  /  CAPABILITY LATER'
                : 'AUTHORIZE FOR MANSIONS — OR LAUNCH AGAIN'
        ];

        this.root.add(scene.add.text(width / 2, height / 2 - 40, lines.join('\n'), {
            fontSize: '30px',
            color: '#eaf6ff',
            align: 'center',
            lineSpacing: 10,
            wordWrap: { width: 700 }
        }).setOrigin(0.5));

        const label = mode === 'authorize' ? 'TO MCLEAN' : 'CONTINUE';
        const button = scene.add.rectangle(width / 2, height / 2 + 380, 420, 96, 0x087a42, 0.95)
            .setStrokeStyle(4, 0xa8ff93)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.destroy();
                options.onContinue();
            });
        this.root.add(button);
        this.root.add(scene.add.text(width / 2, height / 2 + 380, label, {
            fontSize: '36px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));

        this.root.setAlpha(0).setScale(0.92);
        scene.tweens.add({ targets: this.root, alpha: 1, scale: 1, duration: 220, ease: 'Back.out' });
    }

    destroy() {
        this.root.destroy(true);
    }
}
