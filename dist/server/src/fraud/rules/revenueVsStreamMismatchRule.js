export class RevenueVsStreamMismatchRule {
    code = "REVENUE_VS_STREAM_MISMATCH";
    evaluate(features) {
        if (features.streams_last_day <= 0 || features.revenue_last_day <= 0)
            return null;
        const revenuePerStream = features.revenue_last_day / features.streams_last_day;
        if (revenuePerStream <= 0.02)
            return null;
        return {
            rule: this.code,
            severity: revenuePerStream > 0.05 ? "high" : "medium",
            scoreImpact: revenuePerStream > 0.05 ? 30 : 18,
            explanation: "Revenue is high without proportional stream volume",
            metadata: { revenue_last_day: features.revenue_last_day, streams_last_day: features.streams_last_day, revenue_per_stream: revenuePerStream },
        };
    }
}
