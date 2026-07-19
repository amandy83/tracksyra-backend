export class DefaultRepositoryProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultStorageProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultUnitOfWorkProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultRuntimeProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultServiceProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultAggregateProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultDependencyProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultLifetimeProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultRuntimeFactoryProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
export class DefaultAggregateFactoryProvider {
    resolver;
    constructor(resolver) {
        this.resolver = resolver;
    }
    get(name) {
        return this.resolver.resolve(name);
    }
}
