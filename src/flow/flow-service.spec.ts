import { expect } from 'chai'
import { FlowService } from './flow-service'
import { TicketThrottler } from '../helpers/ticket-throttler'
import { MockFlowClient } from '../mocks/mock-flow-client'
import { FlowBlock } from './models/flow-block'
import { FlowEvent } from './models/flow-event'

const latestBlock: FlowBlock = {
  id: '1',
  height: 10,
}

const events: FlowEvent[] = []

describe('Flow service tests', () => {
  it('Check that block height rate limit is respected', async () => {
    let ticketCount = 0
    const throttler = new TicketThrottler(100, 100, count => ticketCount += count)
    const mockFlowClient = new MockFlowClient(latestBlock, events)
    const flowService = new FlowService(mockFlowClient, () => throttler)

    const NUM_REQUESTS = 20

    for (let i = 0; i < NUM_REQUESTS; ++i) {
      await flowService.getLatestBlock()
    }

    expect(ticketCount).equals(NUM_REQUESTS)
  })

  it('Check that event request rate limit is respected', async () => {
    let ticketCount = 0
    const throttler = new TicketThrottler(100, 100, count => ticketCount += count)
    const mockFlowClient = new MockFlowClient(latestBlock, events)
    const flowService = new FlowService(mockFlowClient, () => throttler)

    const NUM_REQUESTS = 20

    for (let i = 0; i < NUM_REQUESTS; ++i) {
      await flowService.getEvents('test', 1, 1)
    }

    expect(ticketCount).equals(NUM_REQUESTS)
  })

  it('Check that correct events are requested', async () => {
    const requests: {eventType: string, startHeight: number, endHeight: number}[] = []
    const mockFlowClient = new MockFlowClient(latestBlock, events, (eventType, startHeight, endHeight) => {
      requests.push({
        eventType,
        startHeight,
        endHeight,
      })
    })
    const flowService = new FlowService(mockFlowClient)

    await flowService.getEvents('test', 1, 10)
    await flowService.getEvents('test2', 11, 20)

    expect(requests).length(2)
    expect(requests[0]).to.deep.equal({
      eventType: 'test',
      startHeight: 1,
      endHeight: 10,
    })
    expect(requests[1]).to.deep.equal({
      eventType: 'test2',
      startHeight: 11,
      endHeight: 20,
    })
  })
})
