export var PaymentState;
(function (PaymentState) {
    PaymentState["INITIATED"] = "INITIATED";
    PaymentState["VALIDATING"] = "VALIDATING";
    PaymentState["QUEUED"] = "QUEUED";
    PaymentState["PROCESSING_SANDBOX"] = "PROCESSING_SANDBOX";
    PaymentState["PROCESSING_LIVE"] = "PROCESSING_LIVE";
    PaymentState["SUCCESS"] = "SUCCESS";
    PaymentState["FAILED"] = "FAILED";
    PaymentState["REVERSED"] = "REVERSED";
})(PaymentState || (PaymentState = {}));
