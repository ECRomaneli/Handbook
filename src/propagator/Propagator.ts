import { IsDebug } from '@/data/Constants';
import { app } from 'electron';
import { EventEmitter } from 'events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventListener = (...args: any[]) => void;

abstract class Propagator<T extends EventEmitter = EventEmitter> {
  protected static readonly IS_DEBUG = IsDebug.propagator;
  private initialized = false;
  protected abstract getEventPrefix(): string;
  protected abstract registerEvents(emitter: T): void;
  protected initialize(): void { }

  private emitter: EventEmitter = new EventEmitter();

  constructor() {
    Propagator.IS_DEBUG && console.debug(`Initializing propagator: ${this.constructor.name}`);
    app.on('quit', () => { this.getEmitter().removeAllListeners(); });
  }

  private getEmitter(): EventEmitter {
    return this.emitter;
  }

  protected getEventName(eventName: string): string {
    return `${this.getEventPrefix()}:${eventName}`;
  }

  private static lastMessage: string = '';
  protected emit(eventName: string, ...eventArgs: unknown[]): void {
    const event = this.getEventName(eventName);
    if (Propagator.lastMessage !== event) {
      Propagator.lastMessage = event;
      Propagator.IS_DEBUG && console.debug(`Emitting event: ${event}`, event === 'state:change' ? eventArgs[0] : '');
    }
    this.getEmitter().emit(this.getEventName(eventName), ...eventArgs);
  }

  public on(eventName: string, listener: EventListener) {
    this.initializeOnce();
    this.getEmitter().on(this.getEventName(eventName), listener);
  }

  public prependListener(eventName: string, listener: EventListener) {
    this.initializeOnce();
    this.getEmitter().prependListener(this.getEventName(eventName), listener);
  }

  public once(eventName: string, listener: EventListener) {
    this.initializeOnce();
    this.getEmitter().once(this.getEventName(eventName), listener);
  }

  public prependOnceListener(eventName: string, listener: EventListener) {
    this.initializeOnce();
    this.getEmitter().prependOnceListener(this.getEventName(eventName), listener);
  }

  public off(eventName: string, listener: EventListener) {
    this.getEmitter().off(this.getEventName(eventName), listener);
  }

  public propagate(sourceEmitter?: T & { __propagated__?: true }): T | undefined {
    this.initializeOnce();
    if (sourceEmitter === undefined) { return undefined; }
    if (sourceEmitter.__propagated__) { return sourceEmitter; }
    sourceEmitter.__propagated__ = true;
    this.registerEvents(sourceEmitter);
    return sourceEmitter;
  }

  private initializeOnce() {
    if (!this.initialized) {
      this.initialize();
      this.initialized = true;
    }
  }

  // private addListener(eventName: string, listener: EventListener): void {
  //   const listeners = this.listeners.get(eventName) || [];
  //   listeners.push(listener);
  //   this.listeners.set(eventName, listeners);
  // }

  // private removeListener(eventName: string, listener: EventListener): void {
  //   const listeners = this.listeners.get(eventName) || [];
  //   const index = listeners.indexOf(listener);
  //   if (index !== -1) {
  //     listeners.splice(index, 1);
  //     this.listeners.set(eventName, listeners);
  //   }
  // }
}

export default Propagator;
