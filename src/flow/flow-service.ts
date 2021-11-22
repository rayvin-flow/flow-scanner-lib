import { FlowRateLimiterProvider } from '../providers/flow-rate-limiter-provider'
import { FlowBlock } from './models/flow-block'
import { FlowEvent } from './models/flow-event'
import { FlowClientInterface } from './flow-client'

export class FlowService {
  constructor (private readonly flowClient: FlowClientInterface, private readonly rateLimiterProvider?: FlowRateLimiterProvider) {
  }

  getLatestBlock = async (): Promise<FlowBlock> => {
    if (this.rateLimiterProvider) {
      await this.rateLimiterProvider().waitForTickets(1)
    }

    const latestBlock = await this.flowClient.getLatestBlock()

    return {
      id: latestBlock.id,
      height: latestBlock.height,
    }
  }

  getEvents = async (eventType: string, startHeight: number, endHeight: number): Promise<FlowEvent[]> => {
    if (this.rateLimiterProvider) {
      await this.rateLimiterProvider().waitForTickets(1)
    }

    return await this.flowClient.getEvents(eventType, startHeight, endHeight)
  }
}
