import { TicketThrottler } from '../helpers/ticket-throttler'
import { ConfigProvider } from './config-provider'

export type FlowRateLimiterProvider = () => TicketThrottler

let _flowRateLimiter: TicketThrottler | undefined = undefined

export const flowRateLimiterProvider = (configProvider: ConfigProvider): FlowRateLimiterProvider => () => {
  if (!_flowRateLimiter) {
    _flowRateLimiter = new TicketThrottler(configProvider().maxFlowRequestsPerSecond, configProvider().maxFlowRequestsPerSecond)
  }

  return _flowRateLimiter
}
