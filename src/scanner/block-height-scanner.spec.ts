import { expect } from 'chai'
import { FlowBlock } from '../flow/models/flow-block'
import { FlowEvent } from '../flow/models/flow-event'
import { BlockHeightScanner } from './block-height-scanner'
import { EventBus } from '../event-bus/event-bus'
import { nullLogProvider } from '../providers/log-provider'
import { EventPayloads, EventType } from '../event-bus/events'
import { MockFlowClient } from '../mocks/mock-flow-client'
import { FlowService } from '../flow/flow-service'
import { nullMetricServiceProvider } from '../providers/metric-service-provider'

const latestBlock: FlowBlock = {
  id: '1',
  height: 10,
}

const events: FlowEvent[] = []

describe('Test block height scanner', () => {
  it('Checking that event is emitted on new block height', async () => {
    const eventBus = new EventBus()
    const mockFlowClient = new MockFlowClient(latestBlock, events)
    const flowService = new FlowService(mockFlowClient)

    const blockHeightScanner = new BlockHeightScanner({
      eventBusProvider: () => eventBus,
      logProvider: nullLogProvider,
      flowServiceProvider: async () => flowService,
      metricServiceProvider: nullMetricServiceProvider,
    })

    let currentBlockHeight: number | undefined = undefined

    eventBus.addRemovableListener<EventPayloads.LatestBlockHeightUpdated>(EventType.LatestBlockHeightUpdated, ev => currentBlockHeight = ev.blockHeight)

    expect(currentBlockHeight).undefined
    await blockHeightScanner.__process()
    expect(currentBlockHeight).equals(10)
  })

  it('Checking that event is not emitted on same block height', async () => {
    const eventBus = new EventBus()
    const mockFlowClient = new MockFlowClient(latestBlock, events)
    const flowService = new FlowService(mockFlowClient)

    const blockHeightScanner = new BlockHeightScanner({
      eventBusProvider: () => eventBus,
      logProvider: nullLogProvider,
      flowServiceProvider: async () => flowService,
      metricServiceProvider: nullMetricServiceProvider,
    })

    let eventEmitted = false

    eventBus.addRemovableListener<EventPayloads.LatestBlockHeightUpdated>(EventType.LatestBlockHeightUpdated, () => eventEmitted = true)

    await blockHeightScanner.__process()
    expect(eventEmitted).equals(true)
    eventEmitted = false
    await blockHeightScanner.__process()
    expect(eventEmitted).equals(false)
  })
})
