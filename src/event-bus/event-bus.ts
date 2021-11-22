import EventEmitter from 'events'

export interface RemovableListener {
  remove (): void
}

export class EventBus {
  private eventEmitter = new EventEmitter()

  constructor () {
    this.eventEmitter.setMaxListeners(100)
  }

  addRemovableListener = <T> (eventName: string, listener: (data: T) => void): RemovableListener => {
    this.eventEmitter.on(eventName, listener)
    return {
      remove: () => this.eventEmitter.removeListener(eventName, listener)
    }
  }

  emit = <T> (eventName: string, data: T) => {
    this.eventEmitter.emit(eventName, data)
  }
}
