import { ConfigProvider } from '../providers/config-provider'
import { LogProvider } from '../providers/log-provider'
import { Metric, MetricServiceInterface } from './metric-service'

type MetricQueue = {
  metric?: Metric
}

const FLUSH_INTERVAL = 10000

export class ConsoleMetricService implements MetricServiceInterface {
  private queue: {[key: string]: MetricQueue} = {}
  private flushInterval?: NodeJS.Timeout
  private defaultValues: {service: string, metricName: string, value: number}[] = []

  constructor (private readonly configProvider: ConfigProvider, private readonly logProvider: LogProvider) {
  }

  start = async () => {
    this.logProvider().info('Starting metric service')

    this.flushInterval = setInterval(async () => {
      this.flush().then()
    }, FLUSH_INTERVAL)
  }

  stop = async () => {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = undefined
    }

    this.flush().then()
  }

  addDefaultValue = (service: string, metricName: string, value: number) => {
    this.defaultValues.push({
      service,
      metricName,
      value,
    })

    return this
  }

  private getMetricQueueKey = (service: string, metricName: string) => {
    return `${service}-${metricName}`
  }

  putMetric = (service: string, metricName: string, value: number, statistic: boolean = false, overwrite: boolean = false, persist = false) => {
    const key = this.getMetricQueueKey(service, metricName)
    if (!this.queue[key]) {
      this.queue[key] = {}
    }

    if (statistic) {
      let min = Math.min(this.queue[key].metric?.statisticValues?.min ?? value, value)
      let max = Math.max(this.queue[key].metric?.statisticValues?.max ?? value, value)
      let sum = ((this.queue[key].metric?.statisticValues?.sum ?? 0) + value)
      let sampleCount = (this.queue[key].metric?.statisticValues?.sampleCount ?? 0) + 1

      this.queue[key].metric = {
        service: service,
        metricName: metricName,
        timestamp: new Date(),
        statisticValues: {
          min,
          max,
          sum,
          sampleCount,
          latest: value,
        },
        persist,
      }
    } else {
      const newValue = overwrite ? value : ((this.queue[key].metric?.value ?? 0) + value)

      this.queue[key].metric = {
        service: service,
        metricName: metricName,
        timestamp: new Date(),
        value: newValue,
        persist,
      }
    }
  }

  flush = async () => {
    const logger = await this.logProvider()

    const queues = this.queue
    const queueKeys = Object.keys(queues)

    this.queue = {}

    for (const defaultValue of this.defaultValues) {
      this.putMetric(defaultValue.service, defaultValue.metricName, defaultValue.value, false, false, false)
    }

    for (const queueKey of queueKeys) {
      if (queues.hasOwnProperty(queueKey)) {
        const queue = queues[queueKey]

        // send all metrics for this service

        if (queue.metric) {
          const metric = queue.metric

          if (metric.persist && metric.value) {
            this.putMetric(metric.service, metric.metricName, metric.value, !!metric.statisticValues, true, true)
          }

          logger.info(`Metric: ${metric.metricName} (${metric.value !== undefined ? metric.value : metric.statisticValues ? JSON.stringify(metric.statisticValues) : '-'})`)
        }
      }
    }
  }
}
