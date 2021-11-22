import { FlowBlock } from '../flow/models/flow-block'
import { FlowEvent } from '../flow/models/flow-event'
import { FlowClientInterface } from '../flow/flow-client'

export class MockFlowClient implements FlowClientInterface {
  constructor (private latestBlock: FlowBlock, private events: FlowEvent[], private onGetEvents?: (eventType: string, startHeight: number, endHeight: number) => void) {
  }

  getEvents = async (eventType: string, startHeight: number, endHeight: number): Promise<FlowEvent[]> => {
    if (this.onGetEvents) {
      this.onGetEvents(eventType, startHeight, endHeight)
    }
    return this.events.filter(e => e.type === eventType && e.blockHeight >= startHeight && e.blockHeight <= endHeight)
  }

  getLatestBlock = async (): Promise<FlowBlock> => {
    return this.latestBlock
  }

  setLatestBlock = (latestBlock: FlowBlock) => this.latestBlock = latestBlock
  setEvents = (events: FlowEvent[]) => this.events = events
}
