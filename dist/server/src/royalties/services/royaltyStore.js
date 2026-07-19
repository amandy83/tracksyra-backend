import { splitFeaturedArtists } from "../../domain/music/index.js";
export class RoyaltyStore {
    db;
    constructor(db) {
        this.db = db;
    }
    async getTrackContext(trackId) {
        const rows = await this.db.query(`SELECT t.id AS track_id,
              t.release_id,
              COALESCE(t.artist_id, t.user_id) AS artist_id,
              t.featured_artists,
              r.genre,
              r.language
       FROM tracks t
       JOIN releases r ON r.id = t.release_id
       WHERE t.id = :trackId
       LIMIT 1`, { trackId });
        const row = rows[0];
        if (!row)
            return null;
        return {
            track_id: row.track_id,
            release_id: row.release_id,
            artist_id: row.artist_id,
            featured_artists: splitFeaturedArtists(row.featured_artists),
            genre: row.genre,
            language: row.language,
        };
    }
    async getStreamCountsByPlatform(input) {
        return this.db.query(`SELECT platform, COALESCE(SUM(streams), 0)::int AS streams_count
       FROM song_analytics
       WHERE song_id = :trackId
         AND (:periodStart IS NULL OR date >= CAST(:periodStart AS date))
         AND (:periodEnd IS NULL OR date <= CAST(:periodEnd AS date))
       GROUP BY platform`, {
            trackId: input.trackId,
            periodStart: input.periodStart ?? null,
            periodEnd: input.periodEnd ?? null,
        });
    }
    async upsertRoyaltyRecord(input) {
        const rows = await this.db.query(`INSERT INTO royalty_records (
         track_id, release_id, platform, streams_count, revenue_per_stream,
         total_revenue, artist_id, calculation_key, metadata
       ) VALUES (
         :track_id, :release_id, :platform, :streams_count, :revenue_per_stream,
         :total_revenue, :artist_id, :calculation_key, CAST(:metadata AS jsonb)
       )
       ON CONFLICT (calculation_key) DO UPDATE SET
         streams_count = EXCLUDED.streams_count,
         revenue_per_stream = EXCLUDED.revenue_per_stream,
         total_revenue = EXCLUDED.total_revenue,
         metadata = EXCLUDED.metadata
       RETURNING id, track_id, release_id, platform, streams_count, revenue_per_stream,
         total_revenue, artist_id, calculation_key, metadata, created_at`, {
            ...input,
            metadata: JSON.stringify(input.metadata ?? {}),
        });
        return rows[0];
    }
    async getSplits(trackId) {
        return this.db.query(`SELECT track_id, user_id, percentage_share
       FROM royalty_splits
       WHERE track_id = :trackId
       ORDER BY user_id`, { trackId });
    }
}
