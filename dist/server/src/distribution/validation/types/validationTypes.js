function freezeMetadata(value) {
    return Object.freeze({ ...value });
}
function freezeSection(value) {
    return (value ? Object.freeze({ ...value }) : null);
}
function freezeList(values) {
    return Object.freeze([...(values ?? [])]);
}
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
export class ValidationContext {
    contextId;
    scope;
    createdAt;
    composition;
    bootstrap;
    workflow;
    orchestrator;
    execution;
    queue;
    runtime;
    provider;
    connectors;
    statusSync;
    royalty;
    observability;
    security;
    authentication;
    storage;
    repository;
    unitOfWork;
    health;
    recovery;
    checkpoint;
    projection;
    audit;
    metrics;
    logging;
    trace;
    stateMachine;
    compensation;
    performance;
    scalability;
    load;
    concurrency;
    dataIntegrity;
    metadata;
    constructor(input) {
        this.contextId = ensure(input.contextId, "contextId");
        this.scope = input.scope;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.composition = freezeSection(input.composition ?? null);
        this.bootstrap = freezeSection(input.bootstrap ?? null);
        this.workflow = freezeSection(input.workflow ?? null);
        this.orchestrator = freezeSection(input.orchestrator ?? null);
        this.execution = freezeSection(input.execution ?? null);
        this.queue = freezeSection(input.queue ?? null);
        this.runtime = freezeSection(input.runtime ?? null);
        this.provider = freezeSection(input.provider ?? null);
        this.connectors = freezeSection(input.connectors ?? null);
        this.statusSync = freezeSection(input.statusSync ?? null);
        this.royalty = freezeSection(input.royalty ?? null);
        this.observability = freezeSection(input.observability ?? null);
        this.security = freezeSection(input.security ?? null);
        this.authentication = freezeSection(input.authentication ?? null);
        this.storage = freezeSection(input.storage ?? null);
        this.repository = freezeSection(input.repository ?? null);
        this.unitOfWork = freezeSection(input.unitOfWork ?? null);
        this.health = freezeSection(input.health ?? null);
        this.recovery = freezeSection(input.recovery ?? null);
        this.checkpoint = freezeSection(input.checkpoint ?? null);
        this.projection = freezeSection(input.projection ?? null);
        this.audit = freezeSection(input.audit ?? null);
        this.metrics = freezeSection(input.metrics ?? null);
        this.logging = freezeSection(input.logging ?? null);
        this.trace = freezeSection(input.trace ?? null);
        this.stateMachine = freezeSection(input.stateMachine ?? null);
        this.compensation = freezeSection(input.compensation ?? null);
        this.performance = freezeSection(input.performance ?? null);
        this.scalability = freezeSection(input.scalability ?? null);
        this.load = freezeSection(input.load ?? null);
        this.concurrency = freezeSection(input.concurrency ?? null);
        this.dataIntegrity = freezeSection(input.dataIntegrity ?? null);
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ValidationPlan {
    planId;
    contextId;
    scope;
    validators;
    strict;
    scheduledAt;
    metadata;
    constructor(input) {
        this.planId = ensure(input.planId, "planId");
        this.contextId = ensure(input.contextId, "contextId");
        this.scope = input.scope;
        this.validators = freezeList(input.validators);
        this.strict = input.strict ?? true;
        this.scheduledAt = input.scheduledAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ValidationError {
    errorId;
    code;
    message;
    validator;
    severity;
    details;
    createdAt;
    metadata;
    constructor(input) {
        this.errorId = ensure(input.errorId, "errorId");
        this.code = ensure(input.code, "code");
        this.message = ensure(input.message, "message");
        this.validator = ensure(input.validator, "validator");
        this.severity = input.severity ?? "Error";
        this.details = Object.freeze({ ...(input.details ?? {}) });
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ValidationWarning {
    warningId;
    code;
    message;
    validator;
    details;
    createdAt;
    metadata;
    constructor(input) {
        this.warningId = ensure(input.warningId, "warningId");
        this.code = ensure(input.code, "code");
        this.message = ensure(input.message, "message");
        this.validator = ensure(input.validator, "validator");
        this.details = Object.freeze({ ...(input.details ?? {}) });
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ValidationResult {
    resultId;
    validator;
    valid;
    errors;
    warnings;
    checkedAt;
    metadata;
    constructor(input) {
        this.resultId = ensure(input.resultId, "resultId");
        this.validator = ensure(input.validator, "validator");
        this.valid = input.valid;
        this.errors = freezeList(input.errors);
        this.warnings = freezeList(input.warnings);
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ValidationSummary {
    summaryId;
    totalChecks;
    validChecks;
    invalidChecks;
    errorCount;
    warningCount;
    criticalCount;
    metadata;
    constructor(input) {
        this.summaryId = ensure(input.summaryId, "summaryId");
        this.totalChecks = input.totalChecks;
        this.validChecks = input.validChecks;
        this.invalidChecks = input.invalidChecks;
        this.errorCount = input.errorCount ?? 0;
        this.warningCount = input.warningCount ?? 0;
        this.criticalCount = input.criticalCount ?? 0;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ValidationReport {
    reportId;
    scope;
    summary;
    results;
    valid;
    errors;
    warnings;
    generatedAt;
    metadata;
    constructor(input) {
        this.reportId = ensure(input.reportId, "reportId");
        this.scope = input.scope;
        this.summary = input.summary;
        this.results = freezeList(input.results);
        this.valid = input.valid;
        this.errors = freezeList(input.errors);
        this.warnings = freezeList(input.warnings);
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ReadinessReport extends ValidationReport {
    ready;
    constructor(input) {
        super(input);
        this.ready = input.ready;
        Object.freeze(this);
    }
}
export class HealthReport extends ValidationReport {
    healthy;
    health;
    constructor(input) {
        super(input);
        this.healthy = input.healthy;
        this.health = input.health ?? null;
        Object.freeze(this);
    }
}
export class StartupReport extends ValidationReport {
    started;
    startup;
    constructor(input) {
        super(input);
        this.started = input.started;
        this.startup = input.startup ?? null;
        Object.freeze(this);
    }
}
export class ShutdownReport extends ValidationReport {
    stopped;
    shutdown;
    constructor(input) {
        super(input);
        this.stopped = input.stopped;
        this.shutdown = input.shutdown ?? null;
        Object.freeze(this);
    }
}
export class DisasterRecoveryReport extends ValidationReport {
    recovered;
    dependencyValidation;
    constructor(input) {
        super(input);
        this.recovered = input.recovered;
        this.dependencyValidation = input.dependencyValidation ?? null;
        Object.freeze(this);
    }
}
export class PerformanceReport extends ValidationReport {
    performanceScore;
    constructor(input) {
        super(input);
        this.performanceScore = input.performanceScore;
        Object.freeze(this);
    }
}
export class ScalabilityReport extends ValidationReport {
    scalabilityScore;
    constructor(input) {
        super(input);
        this.scalabilityScore = input.scalabilityScore;
        Object.freeze(this);
    }
}
export class SecurityReport extends ValidationReport {
    secure;
    constructor(input) {
        super(input);
        this.secure = input.secure;
        Object.freeze(this);
    }
}
export class ComplianceReport extends ValidationReport {
    compliant;
    constructor(input) {
        super(input);
        this.compliant = input.compliant;
        Object.freeze(this);
    }
}
export class DependencyReport extends ValidationReport {
    dependencyCount;
    dependencies;
    constructor(input) {
        super(input);
        this.dependencyCount = input.dependencyCount;
        this.dependencies = freezeList(input.dependencies);
        Object.freeze(this);
    }
}
export class RuntimeReport extends ValidationReport {
    runtimeId;
    constructor(input) {
        super(input);
        this.runtimeId = ensure(input.runtimeId, "runtimeId");
        Object.freeze(this);
    }
}
export class ProductionReadinessReport extends ValidationReport {
    productionReady;
    bootstrap;
    constructor(input) {
        super(input);
        this.productionReady = input.productionReady;
        this.bootstrap = input.bootstrap ?? null;
        Object.freeze(this);
    }
}
