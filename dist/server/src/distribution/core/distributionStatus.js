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
export const DISTRIBUTION_STATUS_VALUES = Object.freeze(Object.values(DistributionStatus));
export function isDistributionStatus(value) {
    return DISTRIBUTION_STATUS_VALUES.includes(value);
}
