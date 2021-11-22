import { RemovableListener } from '../event-bus/event-bus'
import { EventBusProvider } from '../providers/event-bus-provider'
import { EventPayloads, EventType } from '../event-bus/events'
import { LogProvider } from '../providers/log-provider'
import { FlowServiceProvider } from '../providers/flow-service-provider'
import _ from 'lodash'
import { FlowEvent } from '../flow/models/flow-event'
import { delay } from '../helpers/delay'
import { MetricServiceProvider } from '../providers/metric-service-provider'
import { METRIC_SERVICE_NAME } from './flow-scanner'

const PROCESS_INTERVAL_MS = 50 // how often to run processing loop
const MAX_BLOCKS_AHEAD = 100 // max number of blocks to look ahead of current
const MAX_FETCH_SIZE = 50 // maximum number of blocks to fetch at once

type Providers = {
  eventBusProvider: EventBusProvider
  logProvider: LogProvider
  flowServiceProvider: FlowServiceProvider
  metricServiceProvider: MetricServiceProvider
}

type Options = {
  eventType: string
  latestBlockHeight: number | undefined
  processedBlockHeight: number
}

export class EventScanner {
  private processTimeout: NodeJS.Timeout | undefined = undefined
  private running = false
  private readonly eventType: string
  private latestBlockHeight: number | undefined
  private processedBlockHeight: number
  private fetchedBlockHeight: number | undefined
  private listeners: RemovableListener[] = []
  private maxFetchSize = MAX_FETCH_SIZE
  private maxBlocksAhead = MAX_BLOCKS_AHEAD

  constructor (options: Options, private readonly providers: Providers) {
    this.latestBlockHeight = options.latestBlockHeight
    this.processedBlockHeight = options.processedBlockHeight
    this.fetchedBlockHeight = options.processedBlockHeight
    this.eventType = options.eventType
  }

  start = async () => {
    const eventBus = this.providers.eventBusProvider()

    this.listeners = [
      eventBus.addRemovableListener<EventPayloads.LatestBlockHeightUpdated>(EventType.LatestBlockHeightUpdated, this.onLatestBlockHeightUpdated),
      eventBus.addRemovableListener<EventPayloads.ProcessedBlockHeightUpdated>(EventType.ProcessedBlockHeightUpdated, this.onProcessedBlockHeightUpdated),
    ]
    this.running = true
    this.process().then()
  }

  stop = async () => {
    for (const listener of this.listeners) {
      listener.remove()
    }
    this.listeners = []

    this.running = false

    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
      this.processTimeout = undefined
    }
  }

  private onLatestBlockHeightUpdated = (ev: EventPayloads.LatestBlockHeightUpdated) => {
    this.latestBlockHeight = ev.blockHeight
  }

  private onProcessedBlockHeightUpdated = (ev: EventPayloads.ProcessedBlockHeightUpdated) => {
    this.processedBlockHeight = ev.blockHeight
  }

  setMaxFetchSize = (maxFetchSize: number) => {
    this.maxFetchSize = maxFetchSize
  }

  setMaxBlocksAhead = (maxBlocksAhead: number) => {
    this.maxBlocksAhead = maxBlocksAhead
  }

  private process = async () => {
    const logger = this.providers.logProvider()

    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
      this.processTimeout = undefined
    }

    const startTime = new Date().getTime()

    try {
      if (this.latestBlockHeight) {
        let startHeight = (this.fetchedBlockHeight ?? this.processedBlockHeight) + 1 // find out where we should start this fetch
        let endHeight = Math.min(this.latestBlockHeight, startHeight + this.maxFetchSize - 1) // try to fetch max blocks
        endHeight = Math.min(endHeight, this.processedBlockHeight + this.maxBlocksAhead) // respect max lookahead

        if (startHeight <= endHeight) {
          const flowService = await this.providers.flowServiceProvider()
          const eventBus = await this.providers.eventBusProvider()

          // we have new blocks to fetch
          let fetchSize = endHeight - startHeight + 1
          while (true) {
            let errors = 0
            let minErrors = 0
            let endHeight = startHeight + fetchSize - 1
            try {
              logger.debug(`Fetching events: ${this.eventType} ${startHeight}-${endHeight}`)
              const startRequestTime = new Date().getTime()
              const events = await flowService.getEvents(this.eventType, startHeight, endHeight)
              const endRequestTime = new Date().getTime()

              // group events by block height
              const groupedEvents: {[key: string]: FlowEvent[]} = _.groupBy(events, e => String(e.blockHeight))

              // FIXME: there is a potential issue here where we might request blocks past the current block height, or the access node we hit might
              //        be behind the blockchain. We don't know for sure if there were no events in a block or if the block did not exist yet. The Go
              //        SDK returns a result for every block with an empty events array, but JS does not.

              for (let i = startHeight; i <= endHeight; ++i) {
                // emit event for each block with the events in that block
                eventBus.emit<EventPayloads.FlowEventsFetched>(EventType.FlowEventsFetched, {
                  eventType: this.eventType,
                  blockHeight: i,
                  events: groupedEvents[String(i)] ?? [],
                })
                this.fetchedBlockHeight = i
              }

              try {
                const metricService = await this.providers.metricServiceProvider()
                metricService.putMetric(METRIC_SERVICE_NAME, 'FlowApiRequests', 1, false, false, false)
                metricService.putMetric(METRIC_SERVICE_NAME, 'FlowEventRequests', 1, false, false, false)
                metricService.putMetric(METRIC_SERVICE_NAME, 'FlowEventRequestDuration', endRequestTime - startRequestTime, true, false, false)
              } catch (err) {
                logger.error(err)
              }

              break
            } catch (err: any) {
              try {
                const metricService = await this.providers.metricServiceProvider()
                metricService.putMetric(METRIC_SERVICE_NAME, 'FlowEventRequestErrors', 1, false, false, false)
              } catch (err) {
                logger.error(err)
              }

              logger.error(`Error fetching events ${this.eventType} (${startHeight} - ${endHeight}): ${err}`)
              ++errors
              if (fetchSize > 1) {
                // sometimes there are too many events in the response for the access nodes to handle, try to back off on our fetch size
                fetchSize = Math.max(Math.floor(fetchSize / 4), 1) // try to fetch less blocks at a time
                endHeight = startHeight + fetchSize - 1
              } else if (++minErrors > 3) {
                try {
                  const metricService = await this.providers.metricServiceProvider()
                  metricService.putMetric(METRIC_SERVICE_NAME, 'FlowEventRequestFailures', 1, false, false, false)
                } catch (err) {
                  logger.error(err)
                }

                // we've had repeated errors fetching a single block, error out
                throw err
              } else {
                // delay on errors fetching single blocks
                await delay(250 * errors + Math.floor(Math.random() * 1000))
              }
            }
          }
        }
      }
    } catch (err) {
      logger.error(err)
    }

    if (this.running) {
      setTimeout(() => this.process().then(), Math.max(PROCESS_INTERVAL_MS - (new Date().getTime() - startTime), 0))
    }
  }

  __process = async () => {
    await this.process()
  }

  __setProcessedBlockHeight = (blockHeight: number) => this.processedBlockHeight = blockHeight

  __getEventType = () => this.eventType
}
