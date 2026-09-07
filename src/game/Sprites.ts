import * as Phaser from 'phaser';

/** Central sprite-sheet frame sizes used by Preloader + scenes. */
export const SHEETS = {
    friendlyCourier: { key: 'sheet_friendly', path: 'assets/sheets/friendly-courier.png', frameWidth: 256, frameHeight: 256, frames: 4 },
    explosion: { key: 'sheet_explosion', path: 'assets/sheets/explosion.png', frameWidth: 256, frameHeight: 256, frames: 6 },
    playerBases: { key: 'sheet_bases', path: 'assets/sheets/player-bases.png', frameWidth: 512, frameHeight: 256, frames: 4 },
    weaponIcons: { key: 'sheet_weapons', path: 'assets/sheets/weapon-icons.png', frameWidth: 192, frameHeight: 192, frames: 7 },
    weaponProjectiles: { key: 'sheet_projectiles', path: 'assets/sheets/weapon-projectiles.png', frameWidth: 128, frameHeight: 128, frames: 4 },
    threatHeavy: { key: 'sheet_threat_heavy', path: 'assets/sheets/threat-heavy-anim.png', frameWidth: 256, frameHeight: 256, frames: 4 },
    threatScout: { key: 'sheet_threat_scout', path: 'assets/sheets/threat-scout-anim.png', frameWidth: 256, frameHeight: 256, frames: 4 },
    mansions: { key: 'sheet_mansions', path: 'assets/sheets/mansions.png', frameWidth: 320, frameHeight: 220, frames: 6 },
    mansionEstates: { key: 'sheet_mansion_estates', path: 'assets/sheets/mansion-estates.png', frameWidth: 320, frameHeight: 220, frames: 8 },
    mansionInfra: { key: 'sheet_mansion_infra', path: 'assets/sheets/mansion-infra.png', frameWidth: 256, frameHeight: 256, frames: 6 },
    pinball: { key: 'sheet_pinball', path: 'assets/sheets/pinball.png', frameWidth: 256, frameHeight: 256, frames: 6 },
    pinballBumpers: { key: 'sheet_pinball_bumpers', path: 'assets/sheets/pinball-bumpers.png', frameWidth: 256, frameHeight: 256, frames: 12 },
    uiChrome: { key: 'sheet_ui', path: 'assets/sheets/ui-chrome.png', frameWidth: 384, frameHeight: 192, frames: 5 }
} as const;

export function preloadSpriteSheets(scene: Phaser.Scene) {
    Object.values(SHEETS).forEach((sheet) => {
        scene.load.spritesheet(sheet.key, sheet.path, {
            frameWidth: sheet.frameWidth,
            frameHeight: sheet.frameHeight
        });
    });
}

/** Register looping / one-shot animations once textures exist. */
export function registerGameAnimations(scene: Phaser.Scene) {
    const mk = (key: string, sheet: string, end: number, frameRate: number, repeat: number) => {
        if (scene.anims.exists(key)) return;
        scene.anims.create({
            key,
            frames: scene.anims.generateFrameNumbers(sheet, { start: 0, end }),
            frameRate,
            repeat
        });
    };

    mk('anim_friendly', SHEETS.friendlyCourier.key, 3, 10, -1);
    mk('anim_threat_heavy', SHEETS.threatHeavy.key, 3, 8, -1);
    mk('anim_threat_scout', SHEETS.threatScout.key, 3, 12, -1);
    mk('anim_explosion', SHEETS.explosion.key, 5, 14, 0);
}
