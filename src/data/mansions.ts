export interface MansionVariant {
    name: string;
    subtitle: string;
    tint: number;
    accent: number;
}

export const MANSION_VARIANTS: MansionVariant[] = [
    { name: 'PATRIOTIC COLONIAL', subtitle: 'FOUR-CAR SECURITY GARAGE', tint: 0xffffff, accent: 0xd6c680 },
    { name: 'BRUTALIST COMPOUND', subtitle: 'HARDENED WINE CELLAR', tint: 0xd6e3ec, accent: 0x9edcff },
    { name: 'INFINITY POOL BUNKER', subtitle: 'WATER FEATURE: CLASSIFIED', tint: 0xbfe7ff, accent: 0x57b8ff },
    { name: 'HEARING ROOM ESTATE', subtitle: 'BIPARTISAN BARREL VAULT', tint: 0xffead1, accent: 0xffca4f },
    { name: 'GAZEBO OF READINESS', subtitle: 'STRATEGIC OUTDOOR KITCHEN', tint: 0xd8f0cf, accent: 0xa8ff93 },
    { name: 'PROCUREMENT PALAZZO', subtitle: 'SOLE-SOURCE MOTOR COURT', tint: 0xf0d8ff, accent: 0xdb8dff }
];
