import { currentRun } from '../state/RunState';

const templates = [
    { headline: 'Department Reports {readiness}% Readiness After Record Investment', body: 'In FY{FY}, officials reported {readiness}% global readiness after spending {burn}. Contractor profit reached {profit}, producing {mansions} McLean estates. The Department called the result “fully aligned with the metric.” {callback}' },
    { headline: 'Audit Finds {allies} Allied Contacts Unharmed; Review Declared Ongoing', body: 'The annual operation recorded {threats} threats defeated and {allies} allied contacts spared. Taxpayer burn totaled {burn}; contractor profit reached {profit}. Officials confirmed {mansions} executive estates and said the review would continue until the findings improved. {callback}' },
    { headline: 'Strategic Year Concludes With {threats} Threats Defeated', body: 'The Department of WARRR concluded FY{FY} with {threats} threats defeated, {readiness}% readiness, and {alliesHit} allied contacts struck. The campaign has spent {burn}, generated {profit} in contractor profit, and built {mansions} mansions. {callback}' }
];

function formatCurrency(amount: number): string {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
    return `$${amount.toLocaleString()}`;
}

export function generatePressRelease(): { headline: string; body: string } {
    const metrics = currentRun.combatMetrics;
    const candidates = templates.filter((template) => template.headline !== currentRun.lastPressReleaseHeadline);
    const template = candidates[Math.floor(currentRun.nextRandom() * candidates.length)] || templates[0];
    const callback = currentRun.lastEventConsequence
        ? `Officials also noted: “${currentRun.lastEventConsequence}”`
        : 'No hearing-related operational consequences were reported.';
    const values: Record<string, string> = {
        FY: String(currentRun.currentFY), readiness: String(Math.floor(currentRun.globalReadiness)),
        burn: formatCurrency(currentRun.taxpayerBurn), profit: formatCurrency(currentRun.contractorProfit),
        mansions: String(currentRun.mansionsBuilt), threats: String(metrics.threatsDefeated),
        allies: String(metrics.alliedContactsSpared), alliesHit: String(metrics.alliedContactsHit), callback
    };
    const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '0');
    currentRun.lastPressReleaseHeadline = template.headline;
    currentRun.save();
    return { headline: fill(template.headline), body: fill(template.body) };
}
