export interface FlowScannerConfig {
  maxFlowRequestsPerSecond: number

  defaultStartBlockHeight: number | undefined

  flowAccessNode: string
}
