export class AdminAuditLogger {
    db;
    constructor(db) {
        this.db = db;
    }
    async log(input) {
        const rows = await this.db.query(`INSERT INTO admin_audit_logs (action, actor_admin_id, target_id, metadata)
       VALUES (:action, :actorAdminId, :targetId, CAST(:metadata AS jsonb))
       RETURNING id`, {
            action: input.action,
            actorAdminId: input.actorAdminId,
            targetId: input.targetId,
            metadata: JSON.stringify(input.metadata ?? {}),
        });
        return rows[0]?.id ?? null;
    }
}
