import { EventBroadcasterInterface } from './event-broadcaster'
import { FlowEvent } from '../flow/models/flow-event'
import { SNS } from 'aws-sdk'
import _ from 'lodash'
import { LogProvider } from '../providers/log-provider'
import { delay } from '../helpers/delay'

export class SnsEventBroadcaster implements EventBroadcasterInterface {
  constructor (private readonly topicArn: string, private readonly messageGroupId: string, private readonly logProvider: LogProvider, private readonly sns: SNS) {
  }

  broadcastEvents = async (blockHeight: number, events: FlowEvent[]) => {
    const logger = this.logProvider()

    // we will send all events over an SNS topic using deduplication

    let eventCount = 0
    let messageCount = 0

    for (const transactionEvents of Object.values(_.groupBy(events, ev => ev.transactionId))) {
      let errors = 0
      while (true) {
        try {
          await this.sns.publish({
            TopicArn: this.topicArn,
            MessageDeduplicationId: transactionEvents[0].transactionId,
            Message: JSON.stringify({
              blockHeight: blockHeight,
              transactionId: transactionEvents[0].transactionId,
              events: JSON.stringify(transactionEvents),
            }),
            MessageGroupId: this.messageGroupId,
          }).promise()

          eventCount += transactionEvents.length
          ++messageCount

          break
        } catch (err) {
          logger.error(err)
          ++errors
          await delay(Math.floor(Math.min(4, errors) * 500 + Math.random() * 500))
        }
      }

      logger.debug(`Sent ${messageCount} SNS event messages`)
    }
  }
}
