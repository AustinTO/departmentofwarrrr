
import { currentRun } from "../state/RunState";

// A collection of mad-libs style templates for press releases.
const templates = [
    {
        headline: "Department of WARRR Announces Unprecedented Readiness Gains",
        body: "In Fiscal Year {FY}, the Department of WARRR successfully executed its global mission, burning approximately ${burn} in taxpayer funds. This critical investment has led to a significant increase in contractor profits, estimated at ${profit}, and the successful construction of {mansions} new luxury contractor mansions. A spokesperson stated, 'Our commitment to overmatch is absolute. We have spent an historic amount of money, which is the best metric for security.' The Department looks forward to building on this success in the coming year."
    },
    {
        headline: "Strategic Investments Yield Key Infrastructure Growth",
        body: "Fiscal Year {FY} was a banner year for strategic national security infrastructure. The Department of Warrr is pleased to report the construction of {mansions} new executive estates, a vital component of our contractor retention program. While navigating complex global threats, we efficiently allocated ${burn} to critical defense needs. Our partners in the private sector have been instrumental, realizing profits of around ${profit}. 'These are rookie numbers, but it's a start,' commented one industry leader."
    },
    {
        headline: "Fiscal Responsibility Demonstrated Through Aggressive Spending",
        body: "The Department of WARRR has once again proven its commitment to fiscal strength by spending ${burn} in FY{FY}. This decisive action has stimulated the defense sector, with our valued partners earning ${profit}. This has directly translated into tangible assets, including {mansions} new homes for deserving executives. When asked about the audit, a senior official noted, 'The best way to account for money is to spend it. And we are very, very good at accounting.'"
    },
];

function formatCurrency(amount: number): string {
    if (amount >= 1000000000) {
        return `$${(amount / 1000000000).toFixed(2)}B`;
    }
    if (amount >= 1000000) {
        return `$${(amount / 1000000).toFixed(2)}M`;
    }
    return `$${amount.toLocaleString()}`;
}

export function generatePressRelease(): { headline: string, body: string } {
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    const filledBody = template.body
        .replace("{FY}", currentRun.currentFY.toString())
        .replace("{burn}", formatCurrency(currentRun.taxpayerBurn))
        .replace("{profit}", formatCurrency(currentRun.contractorProfit))
        .replace("{mansions}", currentRun.mansionsBuilt.toString());

    return {
        headline: template.headline,
        body: filledBody
    };
}
