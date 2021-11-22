import { CloudWatch } from 'aws-sdk'
import { MetricDatum } from 'aws-sdk/clients/cloudwatch'
import { delay } from '../helpers/delay'
import { LogProvider } from '../providers/log-provider'
import { Metric, MetricServiceInterface } from './metric-service'

type MetricQueue = {
  metric?: Metric
}

const FLUSH_INTERVAL = 60000

export class CloudwatchMetricService implements MetricServiceInterface {
  private queue: {[key: string]: MetricQueue} = {}
  private flushInterval?: NodeJS.Timeout
  private defaultValues: {service: string, metricName: string, value: number}[] = []

  constructor (private readonly metricNamespace: string, private readonly metricEnv: string, private readonly logProvider: LogProvider, private readonly cloudWatch: CloudWatch) {
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

    const mergedMetrics: {[key: string]: MetricDatum[]} = {}

    for (const defaultValue of this.defaultValues) {
      this.putMetric(defaultValue.service, defaultValue.metricName, defaultValue.value, false, false, false)
    }

    for (const queueKey of queueKeys) {
      if (queues.hasOwnProperty(queueKey)) {
        const queue = queues[queueKey]

        // send all metrics for this service

        if (queue.metric) {
          const metric = queue.metric
          const namespace = `${this.metricNamespace}/${metric.service}`

          if (metric.persist && metric.value) {
            this.putMetric(metric.service, metric.metricName, metric.value, !!metric.statisticValues, true, true)
          }

          let tries = 0
          while (true) {
            try {
              logger.debug(`Sending metric for ${namespace}/${metric.metricName} (${metric.value !== undefined ? metric.value : metric.statisticValues ? JSON.stringify(metric.statisticValues) : '-'})`)

              const metricDatum: MetricDatum = {
                Dimensions: [
                  {
                    Name: 'Environment',
                    Value: this.metricEnv,
                  },
                ],
                MetricName: metric.metricName,
                Timestamp: metric.timestamp,
              }

              if (metric.value !== undefined) {
                metricDatum.Value = metric.value
              }

              if (metric.statisticValues) {
                metricDatum.StatisticValues = {
                  Minimum: metric.statisticValues.min,
                  Maximum: metric.statisticValues.max,
                  SampleCount: Math.max(metric.statisticValues.sampleCount, 1),
                  Sum: metric.statisticValues.sum,
                }
              }

              if (!mergedMetrics[namespace]) {
                mergedMetrics[namespace] = []
              }
              mergedMetrics[namespace].push(metricDatum)

              break
            } catch (err) {
              if (++tries > 3) {
                logger.error(err)
                break
              }

              await delay(500)
            }
          }
        }
      }
    }

    for (const namespace in mergedMetrics) {
      let tries = 0
      if (mergedMetrics.hasOwnProperty(namespace)) {
        while (true) {
          try {
            await this.cloudWatch.putMetricData({
              Namespace: namespace,
              MetricData: mergedMetrics[namespace],
            }).promise()
            break
          } catch (err) {
            if (++tries > 3) {
              logger.error(err)
              break
            }

            await delay(500)
          }
        }
      }
    }
  }
}
