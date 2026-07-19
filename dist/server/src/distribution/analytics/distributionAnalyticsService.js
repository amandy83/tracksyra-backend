export class DistributionAnalyticsService {
    db;
    constructor(db) {
        this.db = db;
    }
    async refreshPlatformMetrics(platform) {
        const rows = await this.db.query(`SELECT
         COUNT(DISTINCT release_id)::int AS total_releases_submitted,
         COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'PUBLISHED'))::int AS successful_deliveries,
         COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_deliveries,
         COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_deliveries,
         AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))) FILTER (WHERE delivered_at IS NOT NULL) AS avg_delivery_seconds
       FROM platform_deliveries
       WHERE platform = :platform`, { platform });
        const failures = await this.db.query(`SELECT COALESCE(error_code, 'UNKNOWN') AS error_code, COUNT(*)::int AS count
       FROM platform_deliveries
       WHERE platform = :platform AND status IN ('FAILED', 'REJECTED')
       GROUP BY COALESCE(error_code, 'UNKNOWN')`, { platform });
        const row = rows[0] ?? {
            total_releases_submitted: 0,
            successful_deliveries: 0,
            rejected_deliveries: 0,
            failed_deliveries: 0,
            avg_delivery_seconds: null,
        };
        const totalTerminal = row.successful_deliveries + row.rejected_deliveries + row.failed_deliveries;
        const snapshot = {
            platform,
            totalReleasesSubmitted: row.total_releases_submitted,
            platformSuccessRate: totalTerminal ? row.successful_deliveries / totalTerminal : 0,
            averageDeliveryTimeSeconds: row.avg_delivery_seconds,
            rejectionRate: totalTerminal ? row.rejected_deliveries / totalTerminal : 0,
            failureClassificationMetrics: Object.fromEntries(failures.map((item) => [item.error_code, item.count])),
        };
        await this.db.query(`INSERT INTO distribution_analytics (
         platform, total_releases_submitted, platform_success_rate, average_delivery_time_seconds,
         rejection_rate, failure_classification_metrics
       ) VALUES (
         :platform, :totalReleasesSubmitted, :platformSuccessRate, :averageDeliveryTimeSeconds,
         :rejectionRate, CAST(:failureClassificationMetrics AS jsonb)
       )`, {
            platform: snapshot.platform,
            totalReleasesSubmitted: snapshot.totalReleasesSubmitted,
            platformSuccessRate: snapshot.platformSuccessRate,
            averageDeliveryTimeSeconds: snapshot.averageDeliveryTimeSeconds,
            rejectionRate: snapshot.rejectionRate,
            failureClassificationMetrics: JSON.stringify(snapshot.failureClassificationMetrics),
        });
        return snapshot;
    }
}
