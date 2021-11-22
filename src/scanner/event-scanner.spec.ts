import { expect } from 'chai'
import { FlowEvent } from '../flow/models/flow-event'
import { EventBus } from '../event-bus/event-bus'
import { nullLogProvider } from '../providers/log-provider'
import { EventPayloads, EventType } from '../event-bus/events'
import { MockFlowClient } from '../mocks/mock-flow-client'
import { FlowService } from '../flow/flow-service'
import { nullMetricServiceProvider } from '../providers/metric-service-provider'
import { EventScanner } from './event-scanner'

describe('Test event scanner', () => {
  it('Test max block fetch size', async () => {
    const eventBus = new EventBus()
    const mockFlowClient = new MockFlowClient({
      id: '1',
      height: 1000,
    }, [])
    const flowService = new FlowService(mockFlowClient)

    const MAX_BLOCKS_AHEAD = 25
    const MAX_FETCH_SIZE = 5

    const eventScanner = new EventScanner({
      eventType: 'test',
      latestBlockHeight: 100,
      processedBlockHeight: 0,
    }, {
      eventBusProvider: () => eventBus,
      logProvider: nullLogProvider,
      flowServiceProvider: async () => flowService,
      metricServiceProvider: nullMetricServiceProvider,
    })

    eventScanner.setMaxBlocksAhead(MAX_BLOCKS_AHEAD)
    eventScanner.setMaxFetchSize(MAX_FETCH_SIZE)

    let numberOfBlocksFetched = 0
    eventBus.addRemovableListener<EventPayloads.FlowEventsFetched>(EventType.FlowEventsFetched, () => ++numberOfBlocksFetched)

    await eventScanner.__process()

    expect(numberOfBlocksFetched).equals(MAX_FETCH_SIZE)
  })

  it('Test max blocks ahead', async () => {
    const MAX_BLOCKS_AHEAD = 25
    const MAX_FETCH_SIZE = 5

    const eventBus = new EventBus()
    const mockFlowClient = new MockFlowClient({
      id: '1',
      height: MAX_BLOCKS_AHEAD * 2,
    }, [])
    const flowService = new FlowService(mockFlowClient)

    const eventScanner = new EventScanner({
      eventType: 'test',
      latestBlockHeight: 100,
      processedBlockHeight: 0,
    }, {
      eventBusProvider: () => eventBus,
      logProvider: nullLogProvider,
      flowServiceProvider: async () => flowService,
      metricServiceProvider: nullMetricServiceProvider,
    })

    eventScanner.setMaxBlocksAhead(MAX_BLOCKS_AHEAD)
    eventScanner.setMaxFetchSize(MAX_FETCH_SIZE)

    let numberOfBlocksFetched = 0
    eventBus.addRemovableListener<EventPayloads.FlowEventsFetched>(EventType.FlowEventsFetched, () => ++numberOfBlocksFetched)

    while (numberOfBlocksFetched < MAX_BLOCKS_AHEAD) {
      await eventScanner.__process()
    }

    numberOfBlocksFetched = 0

    await eventScanner.__process()

    expect(numberOfBlocksFetched).equals(0)

    numberOfBlocksFetched = 0

    eventScanner.__setProcessedBlockHeight(1)

    await eventScanner.__process()

    expect(numberOfBlocksFetched).equals(1)
  })

  it('Test event fetch', async () => {
    const events: FlowEvent[] = [
      {
        type: 'test',
        data: {},
        transactionIndex: 0,
        eventIndex: 0,
        transactionId: '1',
        blockTimestamp: '2000-01-01T00:00:00',
        blockHeight: 1,
        blockId: '1',
      },
      {
        type: 'test',
        data: {},
        transactionIndex: 0,
        eventIndex: 1,
        transactionId: '1',
        blockTimestamp: '2000-01-01T00:00:00',
        blockHeight: 1,
        blockId: '1',
      },
      {
        type: 'test',
        data: {},
        transactionIndex: 1,
        eventIndex: 0,
        transactionId: '2',
        blockTimestamp: '2000-01-01T00:00:00',
        blockHeight: 1,
        blockId: '1',
      },
      {
        type: 'test',
        data: {},
        transactionIndex: 0,
        eventIndex: 0,
        transactionId: '3',
        blockTimestamp: '2000-01-01T00:00:00',
        blockHeight: 2,
        blockId: '2',
      },
      {
        type: 'test',
        data: {},
        transactionIndex: 0,
        eventIndex: 0,
        transactionId: '4',
        blockTimestamp: '2000-01-01T00:00:00',
        blockHeight: 4,
        blockId: '4',
      },
    ]

    const eventBus = new EventBus()
    const mockFlowClient = new MockFlowClient({
      id: '1',
      height: 100,
    }, events)
    const flowService = new FlowService(mockFlowClient)

    const eventScanner = new EventScanner({
      eventType: 'test',
      latestBlockHeight: 100,
      processedBlockHeight: 0,
    }, {
      eventBusProvider: () => eventBus,
      logProvider: nullLogProvider,
      flowServiceProvider: async () => flowService,
      metricServiceProvider: nullMetricServiceProvider,
    })

    eventScanner.setMaxFetchSize(4)
    eventScanner.setMaxBlocksAhead(4)

    const fetches: EventPayloads.FlowEventsFetched[] = []

    eventBus.addRemovableListener<EventPayloads.FlowEventsFetched>(EventType.FlowEventsFetched, ev => fetches.push(ev))

    await eventScanner.__process()

    expect(fetches).length(4)

    expect(fetches[0].eventType).equals('test')
    expect(fetches[0].blockHeight).equals(1)
    expect(fetches[0].events).length(3)
    expect(fetches[0].events[0]).deep.equals(events[0])
    expect(fetches[0].events[1]).deep.equals(events[1])
    expect(fetches[0].events[2]).deep.equals(events[2])

    expect(fetches[1].eventType).equals('test')
    expect(fetches[1].blockHeight).equals(2)
    expect(fetches[1].events).length(1)
    expect(fetches[1].events[0]).deep.equals(events[3])

    expect(fetches[2].eventType).equals('test')
    expect(fetches[2].blockHeight).equals(3)
    expect(fetches[2].events).length(0)

    expect(fetches[3].eventType).equals('test')
    expect(fetches[3].blockHeight).equals(4)
    expect(fetches[3].events).length(1)
    expect(fetches[3].events[0]).deep.equals(events[4])
  })
})
