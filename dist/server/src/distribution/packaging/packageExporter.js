export class FileSystemPackageExporter {
    writer;
    constructor(writer) {
        this.writer = writer;
    }
    export(context) {
        return this.writer.write(context);
    }
}
