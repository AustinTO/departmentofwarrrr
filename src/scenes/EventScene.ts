import * as Phaser from 'phaser';
import { currentRun } from '../state/RunState';
import { ProductionSystem } from '../game/ProductionSystem';

export class EventScene extends Phaser.Scene {
    constructor() {
        super('EventScene');
    }

    create() {
        const { width, height } = this.scale;

        this.add.image(width / 2, height / 2, 'event_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);

        this.add.text(width / 2, 150, 'CONGRESSIONAL HEARING', {
            fontSize: '56px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.triggerRandomEvent(width, height);
    }

    private triggerRandomEvent(width: number, height: number) {
        const events = [
            {
                title: 'AUDIT SUCCESSFUL?',
                desc: 'The Pentagon failed another audit. $500M was "found" in the sofa cushions.',
                choice: 'SPEND IT',
                effect: () => { currentRun.taxpayerBurn += 500000000; currentRun.contractorProfit += 75000000; }
            },
            {
                title: 'LOBBYIST GIFT',
                desc: 'A donor sends you a new "Research and Development" yacht.',
                choice: 'THANK YOU',
                effect: () => { currentRun.contractorProfit += 50000000; }
            },
            {
                title: 'THREAT INFLATION',
                desc: 'A think tank claims balloons are actually stealth nukes.',
                choice: 'BUY MORE SM-6s',
                effect: () => { 
                    const active = currentRun.theaters['active'];
                    active.inventory['GOD-EYE SM-6 BLOCK IB'] = (active.inventory['GOD-EYE SM-6 BLOCK IB'] || 0) + 10;
                }
            }
        ];

        const event = events[Math.floor(Math.random() * events.length)];

        this.add.text(width / 2, height / 2 - 100, event.title, {
            fontSize: '48px',
            color: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2, event.desc, {
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: width - 200 }
        }).setOrigin(0.5);

        this.add.rectangle(width / 2, height / 2 + 200, 400, 100, 0x006600)
            .setInteractive()
            .on('pointerdown', () => {
                event.effect();
                new ProductionSystem().processEndOfYear();
                currentRun.save();
                this.scene.start('PressReleaseScene');
            });
        
        this.add.text(width / 2, height / 2 + 200, event.choice, { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    }
}
