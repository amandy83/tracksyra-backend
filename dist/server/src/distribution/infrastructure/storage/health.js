export class DefaultStorageHealthChecker {
    checkState;
    constructor(checkState) {
        this.checkState = checkState;
    }
    check() {
        return this.checkState();
    }
}
