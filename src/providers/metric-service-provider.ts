import { MetricServiceInterface } from '../metrics/metric-service'

export type MetricServiceProvider = () => Promise<MetricServiceInterface>

export const nullMetricServiceProvider: MetricServiceProvider = async () => ({
  putMetric (service: string, metricName: string, value: number, statistic: boolean, overwrite: boolean, persist: boolean) {
  }
})
