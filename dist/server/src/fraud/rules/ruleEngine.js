import { StreamSpikeAnomalyRule } from "./streamSpikeAnomalyRule.js";
import { GeoImpossibilityRule } from "./geoImpossibilityRule.js";
import { RepeatEventBurstRule } from "./repeatEventBurstRule.js";
import { LowRetentionPatternRule } from "./lowRetentionPatternRule.js";
import { RevenueVsStreamMismatchRule } from "./revenueVsStreamMismatchRule.js";
export class FraudRuleEngine {
    rules;
    constructor(rules = defaultFraudRules()) {
        this.rules = rules;
    }
    evaluate(features) {
        return this.rules.flatMap((rule) => {
            const result = rule.evaluate(features);
            return result ? [result] : [];
        });
    }
}
export function defaultFraudRules() {
    return [
        new StreamSpikeAnomalyRule(),
        new GeoImpossibilityRule(),
        new RepeatEventBurstRule(),
        new LowRetentionPatternRule(),
        new RevenueVsStreamMismatchRule(),
    ];
}
