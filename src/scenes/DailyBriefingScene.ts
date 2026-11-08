import * as Phaser from 'phaser';
import { dailyDefinition, loadDailyBest } from '../game/DailyChallenge';
import { beginDaily } from '../game/DailySession';
import { dailyBackdrop, dailyButton } from '../ui/DailySceneUI';

export class DailyBriefingScene extends Phaser.Scene {
    constructor() { super('DailyBriefingScene'); }

    create(): void {
        const { width } = this.scale;
        const definition = dailyDefinition();
        const best = loadDailyBest(localStorage)[definition.day];
        dailyBackdrop(this, 'title_keyart');

        this.add.text(width / 2, 210, 'DAILY BUDGET CRISIS', {
            fontSize: '68px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#007f9d', strokeThickness: 7
        }).setOrigin(0.5);
        this.add.text(width / 2, 305, 'ONE DAY. ONE DEFENSE. TWO REQUISITIONS.', {
            fontSize: '28px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 387, definition.day + ' UTC   •   SEED ' + definition.seed, {
            fontSize: '24px', color: '#a0ccda', fontStyle: 'bold'
        }).setOrigin(0.5);

        const lines = [
            ['01  DEFEND FOR 60 SECONDS', definition.scenarioName + '\n' + definition.objective],
            ['02  MAKE ONE POLICY CHOICE', 'Rush the contract at a readiness cost, or preserve the audit trail.'],
            ['03  PLAY 2 PINBALL REQUIREMENTS', 'Authorize a procurement contract or discard the draft.'],
            ['04  SHARE YOUR DOSSIER', 'Beat your local best. Everyone gets the same daily scenario and doctrine.']
        ];
        lines.forEach(([title, description], i) => {
            const y = 500 + i * 194;
            this.add.rectangle(width / 2, y + 48, width - 110, 168, 0x092636, 0.95)
                .setStrokeStyle(2, 0x406f82);
            this.add.text(110, y - 13, title, {
                fontSize: '27px', color: '#80eafa', fontStyle: 'bold'
            });
            this.add.text(110, y + 32, description, {
                fontSize: '23px', color: '#e9f6fc', lineSpacing: 8,
                wordWrap: { width: width - 210 }
            });
        });

        this.add.text(width / 2, 1334, 'TODAY’S DOCTRINE: ' + definition.doctrineName, {
            fontSize: '25px', color: '#ffe3a0', fontStyle: 'bold', wordWrap: { width: width - 130 },
            align: 'center'
        }).setOrigin(0.5);
        this.add.text(width / 2, 1389, best
            ? 'YOUR BEST TODAY: ' + best.score.toLocaleString('en-US') + ' POINTS'
            : 'NO LOCAL SCORE RECORDED TODAY', {
            fontSize: '23px', color: '#c9f5e1', fontStyle: 'bold'
        }).setOrigin(0.5);

        let started = false;
        dailyButton(this, 1540, 'START TODAY’S CRISIS', () => {
            if (started) return;
            started = true;
            beginDaily();
            this.sound.stopAll();
            this.scene.start('CombatScene');
        });
        dailyButton(this, 1705, 'BACK TO CAMPAIGN', () => this.scene.start('TitleScene'),
            { color: 0x324856, outline: 0x8aa9b9, fontSize: 30 });
        this.add.text(width / 2, 1818, 'Local scores only. No purchases, no competitive server, no ad interruptions.', {
            fontSize: '19px', color: '#9cb9c5', wordWrap: { width: width - 130 }, align: 'center'
        }).setOrigin(0.5);
    }
}
