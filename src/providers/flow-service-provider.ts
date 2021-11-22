import { FlowRateLimiterProvider } from './flow-rate-limiter-provider'
import { FlowClientProvider } from './flow-client-provider'
import { FlowService } from '../flow/flow-service'

export type FlowServiceProvider = () => Promise<FlowService>

let _flowService: FlowService | undefined = undefined

export const flowServiceProvider = (flowClientProvider: FlowClientProvider, rateLimiterProvider: FlowRateLimiterProvider): FlowServiceProvider => async () => {
  if (!_flowService) {
    _flowService = new FlowService(await flowClientProvider(), rateLimiterProvider)
  }

  return _flowService
}
