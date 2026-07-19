export interface PackageLogger {
  info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export class ConsolePackageLogger implements PackageLogger {
  info(message: string, metadata: Readonly<Record<string, unknown>> = {}): void {
    console.info(message, metadata);
  }

  warn(message: string, metadata: Readonly<Record<string, unknown>> = {}): void {
    console.warn(message, metadata);
  }

  error(message: string, metadata: Readonly<Record<string, unknown>> = {}): void {
    console.error(message, metadata);
  }
}

