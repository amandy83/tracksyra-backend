export var DistributionStatus;
(function (DistributionStatus) {
    DistributionStatus["PENDING"] = "PENDING";
    DistributionStatus["PROCESSING"] = "PROCESSING";
    DistributionStatus["SUBMITTED"] = "SUBMITTED";
    DistributionStatus["IN_REVIEW"] = "IN_REVIEW";
    DistributionStatus["APPROVED"] = "APPROVED";
    DistributionStatus["DELIVERED"] = "DELIVERED";
    DistributionStatus["PUBLISHED"] = "PUBLISHED";
    DistributionStatus["REJECTED"] = "REJECTED";
    DistributionStatus["FAILED"] = "FAILED";
    DistributionStatus["DEAD_LETTER"] = "DEAD_LETTER";
})(DistributionStatus || (DistributionStatus = {}));
const transitions = {
    [DistributionStatus.PENDING]: [DistributionStatus.PROCESSING, DistributionStatus.FAILED, DistributionStatus.DEAD_LETTER],
    [DistributionStatus.PROCESSING]: [
        DistributionStatus.SUBMITTED,
        DistributionStatus.IN_REVIEW,
        DistributionStatus.APPROVED,
        DistributionStatus.DELIVERED,
        DistributionStatus.FAILED,
        DistributionStatus.REJECTED,
        DistributionStatus.DEAD_LETTER,
    ],
    [DistributionStatus.SUBMITTED]: [
        DistributionStatus.IN_REVIEW,
        DistributionStatus.APPROVED,
        DistributionStatus.DELIVERED,
        DistributionStatus.FAILED,
        DistributionStatus.REJECTED,
        DistributionStatus.DEAD_LETTER,
    ],
    [DistributionStatus.IN_REVIEW]: [
        DistributionStatus.APPROVED,
        DistributionStatus.DELIVERED,
        DistributionStatus.FAILED,
        DistributionStatus.REJECTED,
        DistributionStatus.DEAD_LETTER,
    ],
    [DistributionStatus.APPROVED]: [DistributionStatus.DELIVERED, DistributionStatus.PUBLISHED, DistributionStatus.FAILED, DistributionStatus.DEAD_LETTER],
    [DistributionStatus.DELIVERED]: [DistributionStatus.PUBLISHED],
    [DistributionStatus.PUBLISHED]: [],
    [DistributionStatus.REJECTED]: [DistributionStatus.PROCESSING, DistributionStatus.DEAD_LETTER],
    [DistributionStatus.FAILED]: [DistributionStatus.PROCESSING, DistributionStatus.DEAD_LETTER],
    [DistributionStatus.DEAD_LETTER]: [DistributionStatus.PROCESSING],
};
export function canTransitionDistributionStatus(previous, next) {
    if (!previous)
        return next !== DistributionStatus.DEAD_LETTER;
    if (previous === next)
        return true;
    return transitions[previous]?.includes(next) ?? false;
}
export function assertDistributionStatusTransition(previous, next) {
    if (!canTransitionDistributionStatus(previous, next)) {
        throw new Error(`Invalid distribution transition ${previous ?? "null"} -> ${next}`);
    }
}
export function mapProviderStatus(value) {
    const normalized = value.trim().toUpperCase();
    if (normalized in DistributionStatus)
        return DistributionStatus[normalized];
    if (normalized === "LIVE")
        return DistributionStatus.PUBLISHED;
    if (normalized === "PUBLISHED")
        return DistributionStatus.PUBLISHED;
    if (normalized === "DELIVERY_FAILED")
        return DistributionStatus.FAILED;
    if (normalized === "SCHEDULED")
        return DistributionStatus.PROCESSING;
    if (normalized === "DRAFT" || normalized === "PENDING" || normalized === "UNKNOWN")
        return DistributionStatus.PENDING;
    if (normalized === "TAKEDOWN_REQUESTED" || normalized === "TAKEDOWN" || normalized === "CANCELLED")
        return DistributionStatus.REJECTED;
    return DistributionStatus.PROCESSING;
}
