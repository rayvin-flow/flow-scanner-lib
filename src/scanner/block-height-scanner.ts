import { EventPayloads, EventType } from '../event-bus/events'
import { FlowServiceProvider } from '../providers/flow-service-provider'
import { LogProvider } from '../providers/log-provider'
import { EventBusProvider } from '../providers/event-bus-provider'
import { MetricServiceProvider } from '../providers/metric-service-provider'
import { METRIC_SERVICE_NAME } from './flow-scanner'

const PROCESS_INTERVAL_MS = 1000 // how often to fetch the latest block height (in ms)

type Providers = {
  flowServiceProvider: FlowServiceProvider
  logProvider: LogProvider
  eventBusProvider: EventBusProvider
  metricServiceProvider: MetricServiceProvider
}

export class BlockHeightScanner {
  private fetchTimeout: NodeJS.Timeout | undefined = undefined
  private running = false
  private currentBlockHeight: number | undefined = undefined

  constructor (private readonly providers: Providers) {
  }

  start = async () => {
    const logger = this.providers.logProvider()

    logger.info('Starting BlockHeightScanner')

    this.running = true
    this.process().then()
  }

  private process = async () => {
    const logger = this.providers.logProvider()

    if (this.fetchTimeout) {
      clearTimeout(this.fetchTimeout)
      this.fetchTimeout = undefined
    }

    const startTime = new Date().getTime()

    try {
      await (async () => {
        const flowService = await this.providers.flowServiceProvider()
        try {
          const startRequestTime = new Date().getTime()
          const latestBlock = await flowService.getLatestBlock()
          const endRequestTime = new Date().getTime()

          if ((this.currentBlockHeight ?? 0) < latestBlock.height) {
            this.currentBlockHeight = latestBlock.height
            const eventBus = this.providers.eventBusProvider()
            eventBus.emit<EventPayloads.LatestBlockHeightUpdated>(EventType.LatestBlockHeightUpdated, { blockHeight: latestBlock.height })
          }

          try {
            const metricService = await this.providers.metricServiceProvider()
            metricService.putMetric(METRIC_SERVICE_NAME, 'FlowApiRequests', 1, false, false, false)
            metricService.putMetric(METRIC_SERVICE_NAME, 'FlowBlockHeightRequests', 1, false, false, false)
            metricService.putMetric(METRIC_SERVICE_NAME, 'FlowBlockHeightRequestDuration', endRequestTime - startRequestTime, true, false, false)
          } catch (err) {
            logger.error(err)
          }
        } catch (err) {
          logger.error(err)

          try {
            const metricService = await this.providers.metricServiceProvider()
            metricService.putMetric(METRIC_SERVICE_NAME, 'FlowBlockHeightRequestErrors', 1, false, false, false)
          } catch (err) {
            logger.error(err)
          }

          // TODO: exponential backoff
        }
      })()
    } catch (err) {
      logger.error(err)
    }

    if (this.running) {
      this.fetchTimeout = setTimeout(() => this.process(), Math.max(0, PROCESS_INTERVAL_MS - (new Date().getTime() - startTime)))
    }
  }

  stop = async () => {
    const logger = this.providers.logProvider()

    logger.info('Stopping BlockHeightScanner')

    this.running = false

    if (this.fetchTimeout) {
      clearTimeout(this.fetchTimeout)
      this.fetchTimeout = undefined
    }
  }

  __process = async () => {
    await this.process()
  }
}
