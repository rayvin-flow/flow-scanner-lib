import { FlowScanner } from './flow-scanner'
import { EventBus } from '../event-bus/event-bus'
import { MockFlowClient } from '../mocks/mock-flow-client'
import { FlowService } from '../flow/flow-service'
import { EventBroadcasterInterface } from '../broadcaster/event-broadcaster'
import { FlowEvent } from '../flow/models/flow-event'
import { nullMetricServiceProvider } from '../providers/metric-service-provider'
import { nullLogProvider } from '../providers/log-provider'
import { SettingsServiceInterface } from '../settings/settings-service'
import { EventPayloads, EventType } from '../event-bus/events'
import { delay } from '../helpers/delay'
import _ from 'lodash'
import assert from 'assert'
import { expect } from 'chai'
import { FlowScannerConfig } from '../config/flow-scanner-config'

const testConfig: FlowScannerConfig = {
  defaultStartBlockHeight: 1,
  flowAccessNode: '',
  maxFlowRequestsPerSecond: 10,
}

type TestBlock = {
  transactions: TestTransaction[]
}

type TestTransaction = {
  events: TestEvent[]
}

type TestEvent = {
  eventType: string
  data: any
}

describe('Test flow scanner', () => {
  it('Test that the scanner creates the configured event scanners', async () => {
    const eventBus = new EventBus()

    const mockFlowClient = new MockFlowClient({
      id: '1',
      height: 10,
    }, [])

    const flowService = new FlowService(mockFlowClient)

    const eventBroadcaster: EventBroadcasterInterface = {
      broadcastEvents: async (blockHeight: number, events: FlowEvent[]) => {
      },
    }

    const settingsProvider: SettingsServiceInterface = {
      getProcessedBlockHeight: async () => {
        return 0
      },
      setProcessedBlockHeight: async (blockHeight: number) => {
      }
    }

    const flowScanner = new FlowScanner([
      'test1',
      'test2',
      'test3',
    ], {
      eventBusProvider: () => eventBus,
      logProvider: nullLogProvider,
      metricServiceProvider: nullMetricServiceProvider,
      flowServiceProvider: async () => flowService,
      eventBroadcasterProvider: async () => eventBroadcaster,
      configProvider: () => testConfig,
      settingsServiceProvider: async () => settingsProvider,
    })

    await flowScanner.__createEventScanners()

    const eventScanners = flowScanner.__getEventScanners()

    expect(eventScanners).length(3)

    expect(eventScanners[0].__getEventType()).equals('test1')
    expect(eventScanners[1].__getEventType()).equals('test2')
    expect(eventScanners[2].__getEventType()).equals('test3')
  })

  it('Test broadcasting of events', async () => {
    const eventBus = new EventBus()

    const testBlocks: TestBlock[] = [
      {
        transactions: [
          {
            events: [
              { eventType: 'test1', data: { a: 1, b: 2 } },
              { eventType: 'test1', data: { test: 'abc' } },
            ],
          },
          {
            events: [
              { eventType: 'test2', data: { a: 1, b: 2 } },
              { eventType: 'test3', data: { test: 'abc' } },
            ],
          },
        ],
      },
      {
        transactions: [
          {
            events: [
              { eventType: 'test3', data: { a: 1, b: 2 } },
              { eventType: 'test3', data: { test: 'abc' } },
            ],
          },
          {
            events: [
              { eventType: 'test1', data: { a: 1, b: 2 } },
              { eventType: 'test1', data: { test: 'abc' } },
            ],
          },
        ],
      },
      {
        transactions: [
          {
            events: [
              { eventType: 'test1', data: { a: 1, b: 2 } },
              { eventType: 'test2', data: { test: 'abc' } },
              { eventType: 'test3', data: { test: 'abc' } },
            ],
          },
          {
            events: [
              { eventType: 'test1', data: { a: 1, b: 2 } },
              { eventType: 'test2', data: { test: 'abc' } },
              { eventType: 'test3', data: { test: 'abc' } },
            ],
          },
        ],
      },
    ]

    const events: FlowEvent[] = []

    let blockId = 1
    let transactionId = 1
    for (const block of testBlocks) {
      let transactionIdx = 0
      for (const transaction of block.transactions) {
        let eventIdx = 0
        for (const event of transaction.events) {
          events.push({
            blockId: String(blockId),
            blockHeight: blockId,
            blockTimestamp: '2000-01-01T00:00:00',
            transactionId: String(transactionId),
            transactionIndex: transactionIdx,
            eventIndex: eventIdx,
            type: event.eventType,
            data: event.data,
          })

          ++eventIdx
        }
        ++transactionId
        ++transactionIdx
      }
      ++blockId
    }

    const mockFlowClient = new MockFlowClient({
      id: '1',
      height: 10,
    }, events)

    const flowService = new FlowService(mockFlowClient)

    const broadcasts: {blockHeight: number, events: FlowEvent[]}[] = []

    const eventBroadcaster: EventBroadcasterInterface = {
      broadcastEvents: async (blockHeight: number, events: FlowEvent[]) => {
        broadcasts.push({ blockHeight, events })
      },
    }

    let storedProcessedBlockHeight = 0

    const settingsProvider: SettingsServiceInterface = {
      getProcessedBlockHeight: async () => {
        return storedProcessedBlockHeight
      },
      setProcessedBlockHeight: async (blockHeight: number) => {
        storedProcessedBlockHeight = blockHeight
      }
    }

    const flowScanner = new FlowScanner([
      'test1',
      'test2',
      'test3',
    ], {
      eventBusProvider: () => eventBus,
      logProvider: nullLogProvider,
      metricServiceProvider: nullMetricServiceProvider,
      flowServiceProvider: async () => flowService,
      eventBroadcasterProvider: async () => eventBroadcaster,
      configProvider: () => testConfig,
      settingsServiceProvider: async () => settingsProvider,
    })

    const fetches: EventPayloads.FlowEventsFetched[] = []
    let processedBlockHeight = 0
    let latestBlockHeight = 0

    eventBus.addRemovableListener<EventPayloads.FlowEventsFetched>(EventType.FlowEventsFetched, ev => fetches.push(ev))
    eventBus.addRemovableListener<EventPayloads.ProcessedBlockHeightUpdated>(EventType.ProcessedBlockHeightUpdated, ev => processedBlockHeight = ev.blockHeight)
    eventBus.addRemovableListener<EventPayloads.LatestBlockHeightUpdated>(EventType.LatestBlockHeightUpdated, ev => latestBlockHeight = ev.blockHeight)

    await flowScanner.start()

    const startTime = new Date().getTime()
    // wait for a bit to see if we receive events
    while (broadcasts.length < testBlocks.length) {
      await delay(10)

      if (new Date().getTime() - startTime > 2000) {
        assert(false, 'Flow scanner timed out processing events')
        break
      }
    }

    await flowScanner.stop()

    for (const broadcast of broadcasts) {
      const testBlock = testBlocks[broadcast.blockHeight - 1]

      expect(testBlock).not.undefined

      expect(broadcast.events).length(_.sumBy(testBlock.transactions, t => t.events.length))

      for (const event of broadcast.events) {
        const testEvent = testBlock.transactions[event.transactionIndex].events[event.eventIndex]

        expect(testEvent).not.undefined

        expect(testEvent).deep.equals({
          eventType: event.type,
          data: event.data,
        })
      }
    }
  })
})
