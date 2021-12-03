import { EventBroadcasterInterface } from './event-broadcaster'
import { FlowEvent } from '../flow/models/flow-event'
import { EventBroadcasterProvider } from '../providers/event-broadcaster-provider'
import { LogProvider } from '../providers/log-provider'

export class MulticastEventBroadcaster implements EventBroadcasterInterface {
  constructor (private readonly broadcasterProviders: EventBroadcasterProvider[], private readonly logProvider: LogProvider) {
  }

  broadcastEvents = async (blockHeight: number, events: FlowEvent[]) => {
    try {
      const promises: Promise<any>[] = []

      for (const broadcasterProvider of this.broadcasterProviders) {
        promises.push((await broadcasterProvider()).broadcastEvents(blockHeight, events))
      }

      Promise.allSettled(promises)
    } catch (err) {
      this.logProvider().error(err)
    }
  }

  destroy = async () => {
    for (const broadcasterProvider of this.broadcasterProviders) {
      const broadcaster = await broadcasterProvider()
      broadcaster.destroy && await broadcaster.destroy()
    }
  }
}
