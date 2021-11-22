import { EventBroadcasterInterface } from './event-broadcaster'
import { FlowEvent } from '../flow/models/flow-event'

export class NullEventBroadcaster implements EventBroadcasterInterface {
  broadcastEvents = async (blockHeight: number, events: FlowEvent[]) => {
  }
}
