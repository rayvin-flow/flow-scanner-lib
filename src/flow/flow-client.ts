import sdk from '@onflow/sdk'
import { FlowBlock } from './models/flow-block'
import { FlowEvent } from './models/flow-event'

export interface FlowClientInterface {
  getLatestBlock (): Promise<FlowBlock>

  getEvents (eventType: string, startHeight: number, endHeight: number): Promise<FlowEvent[]>
}

export class FlowClient implements FlowClientInterface {
  constructor (private readonly accessNode: string) {
  }

  getLatestBlock = async (): Promise<FlowBlock> => {
    const latestBlock = await sdk.send(
      await sdk.build([
        sdk.getBlock(true),
      ]), {
        node: this.accessNode,
      }).then(sdk.decode)

    return {
      id: latestBlock.id,
      height: latestBlock.height,
    }
  }

  getEvents = async (eventType: string, startHeight: number, endHeight: number): Promise<FlowEvent[]> => {
    const events: any[] = await sdk.send(
      await sdk.build([
        sdk.getEventsAtBlockHeightRange(eventType, startHeight, endHeight),
      ]), {
        node: this.accessNode,
      }
    ).then(sdk.decode)

    return events.map((e: any) => ({
      blockId: e.blockId,
      blockHeight: e.blockHeight,
      blockTimestamp: e.blockTimestamp,
      transactionId: e.transactionId,
      transactionIndex: e.transactionIndex,
      eventIndex: e.eventIndex,
      type: e.type,
      data: e.data,
    }))
  }
}
