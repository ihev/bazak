import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestBindings {
  requestId: string;
  conversationId?: string;
  turnId?: string;
}

@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<RequestBindings>();

  run(requestId: string, next: () => void): void {
    this.storage.run({ requestId }, next);
  }

  bindTurn(conversationId: string, turnId: string): void {
    const bindings = this.storage.getStore();
    if (bindings) Object.assign(bindings, { conversationId, turnId });
  }

  getBindings(): Readonly<Partial<RequestBindings>> {
    return this.storage.getStore() ?? {};
  }
}
