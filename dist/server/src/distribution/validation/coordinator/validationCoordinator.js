import { ValidationCompletedEvent, ValidationFailedEvent, ValidationRequestedEvent, ValidationScheduledEvent, ValidationStartedEvent } from "../events/validationEvents.js";
import { ValidationMetric } from "../metrics/validationMetrics.js";
import { ValidationLogEntry } from "../logging/validationLogger.js";
export class ValidationCoordinatorImpl {
    pipeline;
    scheduler;
    logger;
    metrics;
    events;
    constructor(pipeline, scheduler, logger, metrics, events) {
        this.pipeline = pipeline;
        this.scheduler = scheduler;
        this.logger = logger;
        this.metrics = metrics;
        this.events = events;
    }
    async coordinate(context, plan) {
        const scheduled = this.scheduler.schedule(context, plan ?? null);
        await Promise.resolve(this.events.publish(new ValidationRequestedEvent({
            eventId: `${scheduled.planId}:requested`,
            eventType: "ValidationRequested",
            scope: context.scope,
            validator: null,
            payload: { planId: scheduled.planId, contextId: context.contextId },
            metadata: context.metadata,
        })));
        await Promise.resolve(this.events.publish(new ValidationScheduledEvent({
            eventId: `${scheduled.planId}:scheduled`,
            eventType: "ValidationScheduled",
            scope: context.scope,
            validator: null,
            payload: { validators: scheduled.validators },
            metadata: context.metadata,
        })));
        await Promise.resolve(this.logger.log(new ValidationLogEntry({
            logId: `${scheduled.planId}:log:started`,
            level: "Info",
            message: `Validation started for ${context.scope}`,
            scope: context.scope,
            validator: null,
            metadata: context.metadata,
        })));
        await Promise.resolve(this.events.publish(new ValidationStartedEvent({
            eventId: `${scheduled.planId}:started`,
            eventType: "ValidationStarted",
            scope: context.scope,
            validator: null,
            payload: { scope: context.scope },
            metadata: context.metadata,
        })));
        const report = await this.pipeline.run(context, scheduled);
        await Promise.resolve(this.metrics.record(new ValidationMetric({
            metricId: `${scheduled.planId}:metric:checks`,
            name: "validation.checks",
            scope: context.scope,
            value: report.summary.totalChecks,
            metadata: context.metadata,
        })));
        await Promise.resolve(this.logger.log(new ValidationLogEntry({
            logId: `${scheduled.planId}:log:${report.valid ? "completed" : "failed"}`,
            level: report.valid ? "Info" : "Error",
            message: `Validation ${report.valid ? "completed" : "failed"} for ${context.scope}`,
            scope: context.scope,
            validator: null,
            metadata: { ...context.metadata, valid: report.valid },
        })));
        await Promise.resolve(this.events.publish(report.valid ? new ValidationCompletedEvent({
            eventId: `${scheduled.planId}:completed`,
            eventType: "ValidationCompleted",
            scope: context.scope,
            validator: null,
            payload: { reportId: report.reportId, valid: report.valid },
            metadata: context.metadata,
        }) : new ValidationFailedEvent({
            eventId: `${scheduled.planId}:failed`,
            eventType: "ValidationFailed",
            scope: context.scope,
            validator: null,
            payload: { reportId: report.reportId, errors: report.errors.map((error) => error.code) },
            metadata: context.metadata,
        })));
        return report;
    }
}
