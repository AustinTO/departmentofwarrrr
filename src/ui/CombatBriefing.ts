import * as Phaser from 'phaser';

/** Short, skippable field guide shown once per device and available from pause. */
export class CombatBriefing {
    private root: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene, onStart: () => void) {
        const { width, height } = scene.scale;
        const centerY = height / 2 - 25;
        this.root = scene.add.container(0, 0).setDepth(4500);
        this.root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x010811, 0.93)
            .setInteractive());
        this.root.add(scene.add.rectangle(width / 2, centerY, width - 100, 1060, 0x092232, 0.98)
            .setStrokeStyle(4, 0x5de6ff));
        this.root.add(scene.add.text(width / 2, centerY - 470, 'FIRST-YEAR FIELD GUIDE', {
            fontSize: '44px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));
        this.root.add(scene.add.text(width / 2, centerY - 413, 'THE BUDGET IS LARGE. YOUR TIME IS NOT.', {
            fontSize: '21px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0.5));

        const lessons = [
            ['01  DEFEND', 'Tap the battlefield to fire. Intercept hostiles before they reach your base.'],
            ['02  IDENTIFY', 'GREEN contacts are allies. Let them pass or face a friendly-fire hearing.'],
            ['03  SWITCH WEAPONS', 'Use the armory wheel (or Q / E). Check ammo, range and cost per shot.'],
            ['04  SURVIVE 60 SECONDS', 'Keep readiness high. Ending the year early costs 20 grade points and the bonus.'],
            ['05  CASH IN', 'After combat, transfer supplies, play procurement pinball and grow the estate.']
        ];

        lessons.forEach(([title, detail], index) => {
            const y = centerY - 336 + index * 148;
            this.root.add(scene.add.text(width / 2 - 368, y, title, {
                fontSize: '25px', color: '#7df4ff', fontStyle: 'bold'
            }));
            this.root.add(scene.add.text(width / 2 - 368, y + 39, detail, {
                fontSize: '22px', color: '#e6f4fa', wordWrap: { width: width - 350 }
            }));
        });

        const button = scene.add.rectangle(width / 2, centerY + 430, 620, 112, 0x087a42, 1)
            .setStrokeStyle(4, 0xa8ff93)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.destroy();
                onStart();
            });
        this.root.add(button);
        this.root.add(scene.add.text(width / 2, centerY + 430, 'START THE FISCAL YEAR', {
            fontSize: '31px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));
    }

    destroy() {
        this.root.destroy(true);
    }
}
