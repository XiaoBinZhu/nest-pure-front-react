import type { App } from '../core/App';

export class ServiceModule {
  constructor(public app: App) {}
}

export type IServiceModule = typeof ServiceModule;
