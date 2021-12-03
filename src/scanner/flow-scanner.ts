import { BlockHeightScanner } from './block-height-scanner'
import { EventScanner } from './event-scanner'
import { LogProvider, nullLogProvider } from '../providers/log-provider'
import { flowServiceProvider, FlowServiceProvider } from '../providers/flow-service-provider'
import { eventBusProvider, EventBusProvider } from '../providers/event-bus-provider'
import { RemovableListener } from '../event-bus/event-bus'
import { EventPayloads, EventType } from '../event-bus/events'
import { FlowEvent } from '../flow/models/flow-event'
import _ from 'lodash'
import { EventBroadcasterProvider } from '../providers/event-broadcaster-provider'
import { SettingsServiceProvider } from '../providers/settings-service-provider'
import { MetricServiceProvider, nullMetricServiceProvider } from '../providers/metric-service-provider'
import { ConfigProvider } from '../providers/config-provider'
import { flowClientProvider } from '../providers/flow-client-provider'
import { flowRateLimiterProvider } from '../providers/flow-rate-limiter-provider'
import { onlyDefined } from '../helpers/js-helpers'

export const METRIC_SERVICE_NAME = 'FlowScanner'

const PROCESS_INTERVAL_MS = 100 // how often to try to process fetched blocks

type ProviderOptions = {
  settingsServiceProvider: SettingsServiceProvider
  eventBroadcasterProvider: EventBroadcasterProvider
  metricServiceProvider?: MetricServiceProvider
  logProvider?: LogProvider
  flowServiceProvider?: FlowServiceProvider
  eventBusProvider?: EventBusProvider
  configProvider: ConfigProvider
}

type Providers = {
  settingsServiceProvider: SettingsServiceProvider
  eventBroadcasterProvider: EventBroadcasterProvider
  metricServiceProvider: MetricServiceProvider
  logProvider: LogProvider
  flowServiceProvider: FlowServiceProvider
  eventBusProvider: EventBusProvider
  configProvider: ConfigProvider
}


export class FlowScanner {
  private processTimeout: NodeJS.Timeout | undefined = undefined
  private blockHeightScanner: BlockHeightScanner | undefined = undefined
  private eventScanners: EventScanner[] = []
  private listeners: RemovableListener[] = []
  private running = false
  private processedBlockHeight: number = 0
  private fetchedEvents: {[key: string]: {[key: string]: FlowEvent[]}} = {}
  private readonly providers: Providers

  constructor (private readonly eventTypes: string[], providers: ProviderOptions) {
    this.providers = {
      logProvider: nullLogProvider,
      flowServiceProvider: flowServiceProvider(flowClientProvider(providers.configProvider), flowRateLimiterProvider(providers.configProvider)),
      eventBusProvider: eventBusProvider,
      metricServiceProvider: nullMetricServiceProvider,
      ...onlyDefined(providers),
    }
  }

  private createEventScanners = async () => {
    for (const eventType of this.eventTypes) {
      this.fetchedEvents[eventType] = {}

      const eventScanner = new EventScanner({
        processedBlockHeight: this.processedBlockHeight,
        latestBlockHeight: undefined,
        eventType: eventType,
      }, {
        eventBusProvider: this.providers.eventBusProvider,
        flowServiceProvider: this.providers.flowServiceProvider,
        logProvider: this.providers.logProvider,
        metricServiceProvider: this.providers.metricServiceProvider,
      })

      this.eventScanners.push(eventScanner)
    }
  }

  private startEventScanners = async () => {
    for (const scanner of this.eventScanners) {
      await scanner.start()
    }
  }

  start = async () => {
    if (this.running) {
      return
    }

    this.running = true

    const logger = this.providers.logProvider()
    const eventBus = this.providers.eventBusProvider()
    const settings = await this.providers.settingsServiceProvider()
    const config = this.providers.configProvider()

    logger.info('Starting FlowScanner')

    this.listeners.push(
      eventBus.addRemovableListener<EventPayloads.FlowEventsFetched>(EventType.FlowEventsFetched, this.onEventsFetched)
    )

    this.blockHeightScanner = new BlockHeightScanner(this.providers)

    this.processedBlockHeight = await settings.getProcessedBlockHeight() ?? 0

    if (this.processedBlockHeight === 0) {
      if (config.defaultStartBlockHeight) {
        this.processedBlockHeight = config.defaultStartBlockHeight - 1
      } else {
        // try to get latest block and start there
        const latestBlock = await (await this.providers.flowServiceProvider()).getLatestBlock()
        this.processedBlockHeight = latestBlock.height - 1

      }
    }

    await this.createEventScanners()
    await this.startEventScanners()

    await this.blockHeightScanner.start()

    this.process().then()
  }

  private onEventsFetched = (ev: EventPayloads.FlowEventsFetched) => {
    // store the fetched events for processing
    this.fetchedEvents[ev.eventType][String(ev.blockHeight)] = ev.events
  }

  stop = async () => {
    const logger = this.providers.logProvider()

    logger.info('Stopping FlowScanner')

    for (const listener of this.listeners) {
      listener.remove()
    }
    this.listeners = []

    if (this.blockHeightScanner) {
      await this.blockHeightScanner.stop()
      this.blockHeightScanner = undefined
    }

    for (const eventScanner of this.eventScanners) {
      await eventScanner.stop()
    }

    this.eventScanners = []

    const settings = await this.providers.settingsServiceProvider()
    settings.destroy && await settings.destroy()

    const eventBroadcaster = await this.providers.eventBroadcasterProvider()
    eventBroadcaster.destroy && await eventBroadcaster.destroy()

    this.running = false

    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
      this.processTimeout = undefined
    }
  }

  private process = async () => {
    const logger = this.providers.logProvider()

    if (this.processTimeout) {
      clearTimeout(this.processTimeout)
      this.processTimeout = undefined
    }

    const startTime = new Date().getTime()

    try {
      const eventBus = this.providers.eventBusProvider()
      const settingsService = await this.providers.settingsServiceProvider()

      const checkBlockHeight = this.processedBlockHeight + 1

      let missing = false

      while (!missing) {
        const startProcessingTime = new Date().getTime()

        // check if we have all event types for the block we are currently processing
        for (const eventType of this.eventTypes) {
          if (!this.fetchedEvents[eventType][String(checkBlockHeight)]) {
            missing = true
            break
          }
        }

        if (!missing) {
          let allEvents: FlowEvent[] = []
          // we have all events for the current block, group them and broadcast them
          for (const eventType of this.eventTypes) {
            allEvents.push(...this.fetchedEvents[eventType][String(checkBlockHeight)])
          }

          // order events by transaction/event index
          allEvents = _.orderBy(allEvents, [e => e.transactionIndex, e => e.eventIndex])

          if (allEvents.length) {
            const eventBroadcaster = await this.providers.eventBroadcasterProvider()
            await eventBroadcaster.broadcastEvents(checkBlockHeight, allEvents)
          }

          for (const eventType of this.eventTypes) {
            delete this.fetchedEvents[eventType][String(checkBlockHeight)]
          }

          try {
            const metricService = await this.providers.metricServiceProvider()
            metricService.putMetric(METRIC_SERVICE_NAME, 'ProcessBlockDuration', new Date().getTime() - startProcessingTime, true, false, false)
            metricService.putMetric(METRIC_SERVICE_NAME, 'BlocksProcessed', 1, false, false, false)
            metricService.putMetric(METRIC_SERVICE_NAME, 'EventsBroadcasted', allEvents.length, false, false, false)
            metricService.putMetric(METRIC_SERVICE_NAME, 'ProcessedBlockHeight', checkBlockHeight, false, true, true)
          } catch (err) {
            logger.error(err)
          }

          this.processedBlockHeight = checkBlockHeight
          await settingsService.setProcessedBlockHeight(this.processedBlockHeight)
          eventBus.emit<EventPayloads.ProcessedBlockHeightUpdated>(EventType.ProcessedBlockHeightUpdated, { blockHeight: this.processedBlockHeight })
        }
      }
    } catch (err) {
      logger.error(err)
    }

    if (this.running) {
      this.processTimeout = setTimeout(() => this.process(), Math.max(0, PROCESS_INTERVAL_MS - (new Date().getTime() - startTime)))
    }
  }

  __createEventScanners = async () => await this.createEventScanners()

  __getEventScanners = () => this.eventScanners
}
