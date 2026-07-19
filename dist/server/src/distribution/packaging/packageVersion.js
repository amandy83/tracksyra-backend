export const CURRENT_PACKAGE_VERSION = "1.0";
export class PackageVersionInfo {
    value;
    constructor(value = CURRENT_PACKAGE_VERSION) {
        this.value = value;
    }
    toString() {
        return this.value;
    }
}
