export class DefaultStorageMigration {
    migrate(fromVersion, toVersion, metadata = {}) {
        return {
            migrated: true,
            fromVersion,
            toVersion,
            metadata: Object.freeze({ ...metadata }),
        };
    }
}
