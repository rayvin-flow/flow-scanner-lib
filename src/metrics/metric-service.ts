export type Metric = {
  service: string
  metricName: string
  timestamp: Date
  statisticValues?: {
    min: number
    max: number
    sum: number
    sampleCount: number
    latest: number
  }
  value?: number
  persist: boolean
}

export interface MetricServiceInterface {
  putMetric (service: string, metricName: string, value: number, statistic: boolean, overwrite: boolean, persist: boolean): void
}
