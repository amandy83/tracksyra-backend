export class GeoImpossibilityRule {
    code = "GEO_IMPOSSIBILITY";
    evaluate(features) {
        if (features.distinct_countries_last_5m < 5)
            return null;
        return {
            rule: this.code,
            severity: features.distinct_countries_last_5m >= 8 ? "high" : "medium",
            scoreImpact: features.distinct_countries_last_5m >= 8 ? 30 : 20,
            explanation: "Streams arrived from an unrealistic number of countries in a short window",
            metadata: { distinct_countries_last_5m: features.distinct_countries_last_5m },
        };
    }
}
