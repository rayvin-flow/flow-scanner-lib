import { FlowEvent } from '../flow/models/flow-event'

export type EventBroadcast = {
  blockHeight: number
  events: FlowEvent[]
}

export interface EventBroadcasterInterface {
  broadcastEvents: (blockHeight: number, events: FlowEvent[]) => Promise<void>

  destroy?: () => Promise<void>
}
