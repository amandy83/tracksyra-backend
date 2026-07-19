export interface RepositoryProvider {
  get<T>(name: string): T | null;
}

export interface StorageProvider {
  get<T>(name: string): T | null;
}

export interface UnitOfWorkProvider {
  get<T>(name: string): T | null;
}

export interface RuntimeProvider {
  get<T>(name: string): T | null;
}

export interface ServiceProvider {
  get<T>(name: string): T | null;
}

export interface AggregateProvider {
  get<T>(name: string): T | null;
}

export interface DependencyProvider {
  get<T>(name: string): T | null;
}

export interface LifetimeProvider {
  get<T>(name: string): T | null;
}

export interface RuntimeFactoryProvider {
  get<T>(name: string): T | null;
}

export interface AggregateFactoryProvider {
  get<T>(name: string): T | null;
}

export class DefaultRepositoryProvider implements RepositoryProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultStorageProvider implements StorageProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultUnitOfWorkProvider implements UnitOfWorkProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultRuntimeProvider implements RuntimeProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultServiceProvider implements ServiceProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultAggregateProvider implements AggregateProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultDependencyProvider implements DependencyProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultLifetimeProvider implements LifetimeProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultRuntimeFactoryProvider implements RuntimeFactoryProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}

export class DefaultAggregateFactoryProvider implements AggregateFactoryProvider {
  constructor(private readonly resolver: { resolve<T>(name: string): T | null }) {}

  get<T>(name: string): T | null {
    return this.resolver.resolve<T>(name);
  }
}
