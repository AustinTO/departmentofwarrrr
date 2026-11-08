const STORAGE_KEY = 'warrr_settings_v1';

export interface SettingsData {
    musicVolume: number;
    sfxVolume: number;
    combatBriefingSeen: boolean;
}

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

/** Persistent audio preferences shared across scenes. */
export class GameSettings {
    private static instance: GameSettings;
    musicVolume = 0.7;
    sfxVolume = 0.85;
    combatBriefingSeen = false;

    private constructor() {
        this.load();
    }

    public static getInstance(): GameSettings {
        if (!GameSettings.instance) {
            GameSettings.instance = new GameSettings();
        }
        return GameSettings.instance;
    }

    public setMusicVolume(value: number) {
        this.musicVolume = clamp01(value);
        this.save();
    }

    public setSfxVolume(value: number) {
        this.sfxVolume = clamp01(value);
        this.save();
    }

    /** First-run training is a device preference, not campaign progress. */
    public markCombatBriefingSeen() {
        if (this.combatBriefingSeen) return;
        this.combatBriefingSeen = true;
        this.save();
    }

    public save() {
        const data: SettingsData = {
            musicVolume: this.musicVolume,
            sfxVolume: this.sfxVolume,
            combatBriefingSeen: this.combatBriefingSeen
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    public load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const data = JSON.parse(raw) as Partial<SettingsData>;
            if (typeof data.musicVolume === 'number') this.musicVolume = clamp01(data.musicVolume);
            if (typeof data.sfxVolume === 'number') this.sfxVolume = clamp01(data.sfxVolume);
            if (typeof data.combatBriefingSeen === 'boolean') this.combatBriefingSeen = data.combatBriefingSeen;
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

export const gameSettings = GameSettings.getInstance();
