export function clampFraudScore(score) {
    return Math.max(0, Math.min(100, Math.round(score)));
}
