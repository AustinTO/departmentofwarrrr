import * as Phaser from 'phaser';
import { currentRun } from '../state/RunState';
import { ProductionSystem } from '../game/ProductionSystem';
import { WeaponType } from '../game/config';

function improveReadiness(amount: number) {
    Object.values(currentRun.theaters).forEach((theater) => {
        theater.readiness = Math.min(100, theater.readiness + amount);
    });
    currentRun.updateGlobalReadiness();
}

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
                choices: [
                    { label: 'SPEND IT: +$500M burn, +$75M margin', consequence: 'The sofa-cushion audit will be cited as precedent.', effect: () => { currentRun.taxpayerBurn += 500000000; currentRun.contractorProfit += 75000000; } },
                    { label: 'RETURN IT: readiness +5', consequence: 'Auditors expect the recovered funds to improve readiness.', effect: () => { improveReadiness(5); } }
                ]
            },
            {
                title: 'LOBBYIST GIFT',
                desc: 'A donor sends you a new "Research and Development" yacht.',
                choices: [
                    { label: 'ACCEPT: +$50M margin', consequence: 'The yacht is now listed as a strategic asset.', effect: () => { currentRun.contractorProfit += 50000000; } },
                    { label: 'DECLINE: readiness +3', consequence: 'The declined gift earns a temporary readiness commendation.', effect: () => { improveReadiness(3); } }
                ]
            },
            {
                title: 'THREAT INFLATION',
                desc: 'A think tank claims balloons are actually stealth nukes.',
                choices: [
                    { label: 'BUY 10 SM-6: active stock +10', consequence: 'The balloon assessment will shape next year’s threat brief.', effect: () => {
                    const active = currentRun.theaters['active'];
                    active.inventory[WeaponType.INTERCEPTOR_BLOCK_II] =
                        (active.inventory[WeaponType.INTERCEPTOR_BLOCK_II] || 0) + 10;
                    } },
                    { label: 'CHALLENGE THE STUDY: readiness +6', consequence: 'The threat study is under review; readiness confidence improves.', effect: () => { improveReadiness(6); } }
                ]
            },
            {
                title: 'MIRV PILOT PROGRAM',
                desc: 'Industry gifts a Hydra cluster demo loadout "for evaluation".',
                choices: [
                    { label: 'ACCEPT: 4 HYDRA, unlock weapon', consequence: 'The Hydra demo is now a permanent line item.', effect: () => {
                    const active = currentRun.theaters.active;
                    active.inventory[WeaponType.HYDRA] = (active.inventory[WeaponType.HYDRA] || 0) + 4;
                    if (!currentRun.unlockedWeapons.includes(WeaponType.HYDRA)) {
                        currentRun.unlockedWeapons.push(WeaponType.HYDRA);
                    }
                    currentRun.syncUnlocks();
                    } },
                    { label: 'DECLINE: readiness +4', consequence: 'The pilot is deferred pending a cost effectiveness review.', effect: () => { improveReadiness(4); } }
                ]
            },
            {
                title: 'RAILGUN EARMARK',
                desc: 'A senator sneaks electromagnetic kinetic funding into the bill.',
                choices: [
                    { label: 'ACCEPT: 8 RAILGUN, unlock weapon', consequence: 'Capacitor maintenance is now a recurring concern.', effect: () => {
                    const active = currentRun.theaters.active;
                    active.inventory[WeaponType.RAILGUN] = (active.inventory[WeaponType.RAILGUN] || 0) + 8;
                    if (!currentRun.unlockedWeapons.includes(WeaponType.RAILGUN)) {
                        currentRun.unlockedWeapons.push(WeaponType.RAILGUN);
                    }
                    currentRun.syncUnlocks();
                    } },
                    { label: 'REDIRECT FUNDS: readiness +4', consequence: 'The earmark was redirected to maintenance crews.', effect: () => { improveReadiness(4); } }
                ]
            }
        ];

        const event = events[Math.floor(currentRun.nextRandom() * events.length)];

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

        event.choices.forEach((choice, index) => {
            const y = height / 2 + 125 + index * 115;
            const button = this.add.rectangle(width / 2, y, Math.min(width - 80, 900), 90, index ? 0x554411 : 0x006600)
                .setInteractive({ useHandCursor: true });
            this.add.text(width / 2, y, choice.label, { fontSize: '27px', color: '#ffffff', align: 'center', wordWrap: { width: width - 120 } }).setOrigin(0.5);
            button.on('pointerdown', () => {
                choice.effect();
                currentRun.lastEventConsequence = choice.consequence;
                currentRun.eventHistory.push(`${currentRun.currentFY}: ${event.title} — ${choice.label}`);
                currentRun.eventHistory = currentRun.eventHistory.slice(-6);
                currentRun.updateGlobalReadiness();
                new ProductionSystem().processEndOfYear();
                currentRun.save();
                this.scene.start('PressReleaseScene');
            });
        });
    }
}
