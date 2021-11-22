import { FlowClient } from '../flow/flow-client'
import { ConfigProvider } from './config-provider'

export type FlowClientProvider = () => Promise<FlowClient>

let _flowClient: FlowClient | undefined = undefined

export const flowClientProvider = (configProvider: ConfigProvider): FlowClientProvider => async () => {
  if (!_flowClient) {
    _flowClient = new FlowClient(configProvider().flowAccessNode)
  }

  return _flowClient
}
