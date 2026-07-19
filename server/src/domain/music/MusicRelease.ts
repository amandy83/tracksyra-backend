export type MusicReleaseType = "single" | "ep" | "album" | "compilation";

export type MusicReleaseStatus =
  | "draft"
  | "uploaded"
  | "in_review"
  | "under_review"
  | "approved"
  | "delivered"
  | "sent_to_stores"
  | "processing"
  | "live"
  | "rejected";

export type MusicReleaseAudioFile = {
  trackId: string;
  title: string;
  audioUrl: string | null;
  primaryArtistName?: string | null;
  artistMode?: string | null;
  spotifyArtistId?: string | null;
  appleArtistId?: string | null;
  featuredArtists?: string[];
  isrc?: string | null;
  explicit: boolean;
  metadata?: Record<string, unknown>;
  durationSec?: number | null;
  fileSizeBytes?: number | null;
  audioFormat?: string | null;
  trackNumber: number;
};

export type MusicRelease = {
  id: string;
  title: string;
  artistId: string;
  artistMode?: string | null;
  spotifyArtistId?: string | null;
  appleArtistId?: string | null;
  primaryArtistName?: string | null;
  featuredArtists: string[];
  metadata?: Record<string, unknown>;
  genre: string;
  subgenre?: string | null;
  language: string;
  upc?: string | null;
  copyright?: string | null;
  releaseDate: string | null;
  coverUrl: string | null;
  audioFiles: MusicReleaseAudioFile[];
  type: MusicReleaseType;
  status: MusicReleaseStatus;
  createdAt: string;
};

export type MusicReleaseValidationResult =
  | { ok: true; release: MusicRelease }
  | { ok: false; errors: string[] };
