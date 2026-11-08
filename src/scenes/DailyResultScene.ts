import * as Phaser from 'phaser';
import { dailyShareText, loadDailyBest, type DailyRecord } from '../game/DailyChallenge';
import { currentDaily, finishDaily } from '../game/DailySession';
import { dailyBackdrop, dailyButton } from '../ui/DailySceneUI';

export class DailyResultScene extends Phaser.Scene {
    private defeated = false;
    constructor() { super('DailyResultScene'); }

    init(data?: { defeated?: boolean }): void {
        this.defeated = Boolean(data?.defeated);
    }

    create(): void {
        const definition = currentDaily();
        const previousBest = definition ? loadDailyBest(localStorage)[definition.day] : null;
        // Record a completed attempt and restore campaign BEFORE any navigation or restart.
        const record = finishDaily(this.defeated, localStorage);
        if (!record) {
            this.scene.start('TitleScene');
            return;
        }
        const improved = record.eligible && (!previousBest || record.score > previousBest.score);
        const currentBest = loadDailyBest(localStorage)[record.day] ?? previousBest;
        const { width } = this.scale;
        dailyBackdrop(this, 'event_bg');

        this.add.text(width / 2, 190, record.defeated ? 'DEFENSE COLLAPSED' : 'DAILY DOSSIER FILED', {
            fontSize: '58px', color: record.defeated ? '#ff927c' : '#eafaff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 260, record.day + ' UTC  •  SEED ' + record.seed, {
            fontSize: '22px', color: '#c6d9e4', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 400, record.score.toLocaleString('en-US'), {
            fontSize: '125px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 500, 'DAILY POINTS  •  COMBAT GRADE ' + record.grade, {
            fontSize: '28px', color: '#b9effc', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 573, improved
            ? 'NEW LOCAL PERSONAL BEST'
            : currentBest ? 'LOCAL BEST: ' + currentBest.score.toLocaleString('en-US') : 'UNRANKED ATTEMPT', {
            fontSize: '28px', color: improved ? '#a8ff93' : '#d4e4ed', fontStyle: 'bold'
        }).setOrigin(0.5);
        const rows = [
            'THREATS INTERCEPTED  ' + record.threats,
            'ALLIED CONTACTS SPARED  ' + record.alliesSpared + '   •   HIT  ' + record.alliesHit,
            'ACTIVE READINESS  ' + Math.floor(record.readiness) + '%',
            'TAXPAYER BURN  ' + this.budget(record.taxpayerBurn),
            'CONTRACT VALUE  ' + this.budget(record.contractValue),
            'CONTRACTOR PROFIT  ' + this.budget(record.contractorProfit),
            'COMMITTEE POLICY  ' + (record.policy === 'fast-track' ? 'FAST-TRACK' : record.policy === 'audit' ? 'OVERSIGHT' : 'NONE'),
            'PROCUREMENT  ' + (record.authorized ? 'AUTHORIZED' : 'NO CONTRACT SIGNED')
        ];
        this.add.rectangle(width / 2, 967, width - 115, 685, 0x0d2936, 0.98)
            .setStrokeStyle(3, 0x6b9fb1);
        this.add.text(width / 2, 960, rows.join('\n'), {
            fontSize: '28px', color: '#f0f7fa', align: 'center',
            lineSpacing: 23, wordWrap: { width: width - 170 }
        }).setOrigin(0.5);
        if (!record.eligible) {
            this.add.text(width / 2, 1352, record.defeated
                ? 'DEFENSE LOST • FINISH BOTH PHASES TO POST A LOCAL BEST'
                : record.endedEarly ? 'EARLY EXIT • THIS ATTEMPT CANNOT SET A BEST'
                    : 'INCOMPLETE DAILY ATTEMPT', {
                fontSize: '23px', color: '#ffca9e', fontStyle: 'bold',
                align: 'center', wordWrap: { width: width - 120 }
            }).setOrigin(0.5);
        }
        const feedback = this.add.text(width / 2, 1440, '', {
            fontSize: '21px', color: '#9ef5e1', fontStyle: 'bold'
        }).setOrigin(0.5);
        dailyButton(this, 1535, 'SHARE DAILY DOSSIER', () => {
            void this.share(record, feedback);
        }, { color: 0x176480, outline: 0x7df4ff });
        dailyButton(this, 1680, 'PLAY AGAIN', () => this.scene.start('DailyBriefingScene'),
            { color: 0x176b4c, outline: 0xa8ff93 });
        dailyButton(this, 1815, 'RETURN TO CAMPAIGN', () => this.scene.start('TitleScene'),
            { color: 0x35404f, outline: 0x92aab8, fontSize: 27 });
    }

    private budget(value: number): string {
        return value >= 1e12 ? '$' + (value / 1e12).toFixed(2) + 'T'
            : value >= 1e9 ? '$' + (value / 1e9).toFixed(2) + 'B'
                : '$' + (value / 1e6).toFixed(1) + 'M';
    }

    private async share(record: DailyRecord, feedback: Phaser.GameObjects.Text): Promise<void> {
        const text = dailyShareText(record);
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ title: 'Department of WARRR • Daily Crisis', text });
                feedback.setText('DOSSIER SHARED');
                return;
            } catch {
                // A dismissed share sheet may be retried using the copy action.
            }
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                feedback.setText('DOSSIER COPIED TO CLIPBOARD');
                return;
            } catch { /* Browser may deny clipboard access in an embedded frame. */ }
        }
        feedback.setText('SHARING UNAVAILABLE IN THIS BROWSER');
    }
}
