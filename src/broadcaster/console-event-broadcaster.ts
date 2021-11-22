import { EventBroadcasterInterface } from './event-broadcaster'
import { FlowEvent } from '../flow/models/flow-event'

export class ConsoleEventBroadcaster implements EventBroadcasterInterface {
  broadcastEvents = async (blockHeight: number, events: FlowEvent[]) => {
    console.log(`Broadcasting ${events.length} events`)
  }
}
