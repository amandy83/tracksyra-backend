export class RevenueAnalyticsService {
    db;
    constructor(db) {
        this.db = db;
    }
    async getSnapshot(limit = 10) {
        const [total_platform_revenue, revenue_per_artist, revenue_per_track, top_earning_releases, payoutStats,] = await Promise.all([
            this.db.query(`SELECT platform, SUM(total_revenue)::text AS total_revenue, SUM(streams_count)::int AS streams_count
         FROM royalty_records
         GROUP BY platform
         ORDER BY SUM(total_revenue) DESC`),
            this.db.query(`SELECT artist_id, SUM(total_revenue)::text AS total_revenue
         FROM royalty_records
         GROUP BY artist_id
         ORDER BY SUM(total_revenue) DESC
         LIMIT :limit`, { limit }),
            this.db.query(`SELECT track_id, SUM(total_revenue)::text AS total_revenue, SUM(streams_count)::int AS streams_count
         FROM royalty_records
         GROUP BY track_id
         ORDER BY SUM(total_revenue) DESC
         LIMIT :limit`, { limit }),
            this.db.query(`SELECT release_id, SUM(total_revenue)::text AS total_revenue
         FROM royalty_records
         GROUP BY release_id
         ORDER BY SUM(total_revenue) DESC
         LIMIT :limit`, { limit }),
            this.db.query(`SELECT
           COUNT(*) FILTER (WHERE state = 'COMPLETED')::int AS completed_count,
           COUNT(*) FILTER (WHERE state IN ('COMPLETED', 'FAILED', 'REJECTED'))::int AS terminal_count
         FROM payout_requests`),
        ]);
        const stats = payoutStats[0] ?? { completed_count: 0, terminal_count: 0 };
        return {
            total_platform_revenue,
            revenue_per_artist,
            revenue_per_track,
            top_earning_releases,
            payout_success_rate: stats.terminal_count ? stats.completed_count / stats.terminal_count : 0,
        };
    }
    async persistSnapshot() {
        const snapshot = await this.getSnapshot();
        await this.db.query(`INSERT INTO revenue_analytics_snapshots (
         total_platform_revenue, revenue_per_artist, revenue_per_track,
         top_earning_releases, payout_success_rate
       ) VALUES (
         CAST(:totalPlatformRevenue AS jsonb), CAST(:revenuePerArtist AS jsonb),
         CAST(:revenuePerTrack AS jsonb), CAST(:topEarningReleases AS jsonb),
         :payoutSuccessRate
       )`, {
            totalPlatformRevenue: JSON.stringify(snapshot.total_platform_revenue),
            revenuePerArtist: JSON.stringify(snapshot.revenue_per_artist),
            revenuePerTrack: JSON.stringify(snapshot.revenue_per_track),
            topEarningReleases: JSON.stringify(snapshot.top_earning_releases),
            payoutSuccessRate: snapshot.payout_success_rate,
        });
        return snapshot;
    }
}
