import { FlowEvent } from '../flow/models/flow-event'

export enum EventType {
  LatestBlockHeightUpdated = 'LatestBlockHeightUpdated',
  ProcessedBlockHeightUpdated = 'ProcessedBlockHeightUpdated',
  FlowEventsFetched = 'FlowEventsFetched',
}

export namespace EventPayloads {
  export type LatestBlockHeightUpdated = {
    blockHeight: number
  }

  export type ProcessedBlockHeightUpdated = {
    blockHeight: number
  }

  export type FlowEventsFetched = {
    eventType: string
    blockHeight: number
    events: FlowEvent[]
  }
}
