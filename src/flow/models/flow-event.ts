export type FlowEvent = {
  blockId: string
  blockHeight: number
  blockTimestamp: string
  type: string
  transactionId: string
  transactionIndex: number
  eventIndex: number
  data: any
}
