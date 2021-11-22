import { EventBroadcasterInterface } from './event-broadcaster'
import { FlowEvent } from '../flow/models/flow-event'
import { SQS } from 'aws-sdk'
import _ from 'lodash'
import { LogProvider } from '../providers/log-provider'
import { delay } from '../helpers/delay'

export class SqsEventBroadcaster implements EventBroadcasterInterface {
  constructor (private readonly queueUrl: string, private readonly messageGroupId: string, private readonly logProvider: LogProvider, private readonly sqs: SQS) {
  }

  broadcastEvents = async (blockHeight: number, events: FlowEvent[]) => {
    const logger = this.logProvider()

    // we will send all events over an SQS FIFO Queue using deduplication

    let eventCount = 0
    let messageCount = 0

    const groups = _.groupBy(events, ev => ev.transactionId)

    for (const transactionId in groups) {
      const transactionEvents = groups[transactionId]
      const chunks = _.chunk(transactionEvents, 256)
      for (let chunkIndex = 0; chunkIndex < chunks.length; ++chunkIndex) {
        const chunk = chunks[chunkIndex]
        let errors = 0
        while (true) {
          try {
            await this.sqs.sendMessage({
              QueueUrl: this.queueUrl,
              MessageDeduplicationId: `${transactionId}-${chunkIndex}`,
              MessageGroupId: this.messageGroupId,
              MessageBody: JSON.stringify({
                chunkIndex: chunkIndex,
                chunkCount: chunks.length,
                blockHeight: blockHeight,
                transactionId: transactionId,
                events: chunk,
              }),
            }).promise()

            eventCount += chunk.length
            ++messageCount

            break
          } catch (err) {
            logger.error(err)
            ++errors
            await delay(Math.floor(Math.min(4, errors) * 500 + Math.random() * 500))
          }
        }
      }
    }

    logger.debug(`Sent ${eventCount} events in ${messageCount} SQS messages`)
  }
}
