export interface MansionVariant {
    id: string;
    name: string;
    subtitle: string;
    tint: number;
    accent: number;
    frame: number;
    /** Preferred district ids for thematic placement. */
    districts: string[];
}

export interface DistrictDef {
    id: string;
    name: string;
    unlockAt: number;
    color: number;
    subtitle: string;
    capacity: number;
}

export interface InfraUnlock {
    id: string;
    label: string;
    unlockAt: number;
    frame: number;
}

export const MANSION_VARIANTS: MansionVariant[] = [
    { id: 'colonial', name: 'PATRIOTIC COLONIAL', subtitle: 'FOUR-CAR SECURITY GARAGE', tint: 0xffffff, accent: 0xd6c680, frame: 0, districts: ['original', 'culdesac'] },
    { id: 'brutalist', name: 'BRUTALIST COMPOUND', subtitle: 'HARDENED WINE CELLAR', tint: 0xffffff, accent: 0x9edcff, frame: 1, districts: ['procurement', 'greater'] },
    { id: 'missile_pool', name: 'MISSILE POOL ESTATE', subtitle: 'WATER FEATURE: CLASSIFIED', tint: 0xffffff, accent: 0x57b8ff, frame: 2, districts: ['culdesac', 'club'] },
    { id: 'gazebo', name: 'CLASSIFIED GAZEBO', subtitle: 'STRATEGIC OUTDOOR KITCHEN', tint: 0xffffff, accent: 0xa8ff93, frame: 3, districts: ['original', 'culdesac'] },
    { id: 'hearing_cellar', name: 'HEARING ROOM CELLAR', subtitle: 'BIPARTISAN BARREL VAULT', tint: 0xffffff, accent: 0xffca4f, frame: 4, districts: ['procurement', 'greater'] },
    { id: 'helipad', name: 'HELIPAD COMPOUND', subtitle: 'STRATEGIC AIRLIFT DRIVEWAY', tint: 0xffffff, accent: 0xff8a3d, frame: 5, districts: ['heli', 'greater'] },
    { id: 'terminal', name: 'PRIVATE TERMINAL', subtitle: 'SOLE-SOURCE TARMAC', tint: 0xffffff, accent: 0xdb8dff, frame: 6, districts: ['heli', 'greater'] },
    { id: 'club', name: 'COUNTRY CLUB ANNEX', subtitle: 'BIPARTISAN TENNIS COURT', tint: 0xffffff, accent: 0x8dff74, frame: 7, districts: ['club', 'greater'] }
];

export const DISTRICTS: DistrictDef[] = [
    { id: 'original', name: 'ORIGINAL ESTATE', unlockAt: 0, color: 0x4f7d54, subtitle: 'ONE TASTEFULLY DEFENSIBLE MANSION', capacity: 4 },
    { id: 'culdesac', name: 'CUL-DE-SAC OF NECESSITY', unlockAt: 3, color: 0x658f59, subtitle: 'THREE HOMES, ZERO QUESTIONS', capacity: 6 },
    { id: 'procurement', name: 'GATED PROCUREMENT HEIGHTS', unlockAt: 8, color: 0x847a4b, subtitle: 'ACCESS RESTRICTED FOR SECURITY', capacity: 8 },
    { id: 'heli', name: 'HELICOPTER ENCLAVE', unlockAt: 16, color: 0x73546e, subtitle: 'NOW WITH STRATEGIC AIRLIFT', capacity: 8 },
    { id: 'club', name: 'COUNTRY CLUB CORRIDOR', unlockAt: 28, color: 0x5a6e4a, subtitle: 'MEMBERSHIP IS A LINE ITEM', capacity: 10 },
    { id: 'greater', name: 'GREATER MCLEAN ESTATE ZONE', unlockAt: 40, color: 0x5a667d, subtitle: 'THE MAP HAS BEEN REZONED', capacity: 12 }
];

export const INFRA_UNLOCKS: InfraUnlock[] = [
    { id: 'road', label: 'PRIVATE ROAD NETWORK', unlockAt: 2, frame: 0 },
    { id: 'pool', label: 'CLASSIFIED POOLS', unlockAt: 5, frame: 1 },
    { id: 'gate', label: 'SECURITY GATES', unlockAt: 8, frame: 2 },
    { id: 'helicopter', label: 'HELICOPTER FLEET', unlockAt: 16, frame: 3 },
    { id: 'terminal', label: 'PRIVATE TERMINAL', unlockAt: 28, frame: 4 },
    { id: 'command', label: 'COMMAND ENCROACHMENT', unlockAt: 40, frame: 5 }
];

export interface EstateRecord {
    index: number;
    variantId: string;
    districtId: string;
    fiscalYear: number;
    program: string;
}
