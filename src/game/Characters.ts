export interface Character {
    id: string;
    name: string;
    title: string;
    portraitKey: string;
    color: string;
    lines: {
        combat: string[];
        procurement: string[];
    };
}

/** Entirely fictional composite characters used to frame the game's satire. */
export const CHARACTERS: Record<string, Character> = {
    peter: {
        id: 'peter',
        name: 'PETER KEGSBREATH',
        title: 'SECRETARY OF WARRR',
        portraitKey: 'peter_kegsbreath',
        color: '#f3ca67',
        lines: {
            combat: ['Make it expensive enough to be decisive.', 'A modest response is a failure of imagination.'],
            procurement: ['If it fits in one fiscal year, it is not ambitious enough.', 'I want more urgency. Find some.']
        }
    },
    ledger: {
        id: 'ledger',
        name: 'GENERAL LEDGER',
        title: 'CHIEF OF PROCUREMENT',
        portraitKey: 'general_ledger',
        color: '#a8ff93',
        lines: {
            combat: ['Inventory is a suggestion. Readiness is a spreadsheet.', 'We can replace it in several completely normal years.'],
            procurement: ['The binder says this is essential. The binder is very thick.', 'Every delay is a future opportunity.']
        }
    },
    margin: {
        id: 'margin',
        name: 'MIRANDA MARGIN',
        title: 'CONTRACTOR EXECUTIVE',
        portraitKey: 'miranda_margin',
        color: '#ffd47c',
        lines: {
            combat: ['That was a beautiful premium intercept.', 'Please keep the receipts. I mean, the memories.'],
            procurement: ['A cost overrun is just a growth story with paperwork.', 'Have we considered a more luxurious requirement?']
        }
    },
    addington: {
        id: 'addington',
        name: 'SENATOR ADDINGTON',
        title: 'APPROPRIATIONS COMMITTEE',
        portraitKey: 'senator_addington',
        color: '#9edcff',
        lines: {
            combat: ['My district is prepared to support preparedness.', 'Add a line item. Make it a patriotic line item.'],
            procurement: ['I have discovered a very urgent local capability gap.', 'Competitive bidding sounds slow.']
        }
    },
    audit: {
        id: 'audit',
        name: 'AVERY AUDIT',
        title: 'INSPECTOR GENERAL',
        portraitKey: 'avery_audit',
        color: '#ff9b9b',
        lines: {
            combat: ['This is not what "proportional" means.', 'I will need to see every receipt.', 'That was an allied contact. Start writing your apology.'],
            procurement: ['An audit is not a challenge. It is a paperwork ambush.', 'Please stop calling it an innovation surcharge.']
        }
    }
};

export const characterLine = (characterId: keyof typeof CHARACTERS, scene: 'combat' | 'procurement') => {
    const lines = CHARACTERS[characterId].lines[scene];
    return lines[Math.floor(Math.random() * lines.length)];
};
