import { EventBroadcasterInterface } from './event-broadcaster'
import { FlowEvent } from '../flow/models/flow-event'
import _ from 'lodash'
import { LogProvider } from '../providers/log-provider'
import { delay } from '../helpers/delay'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import sha256 from 'crypto-js/sha256'
import Base64 from 'crypto-js/enc-base64'
import hmacSHA512 from 'crypto-js/hmac-sha512'

type Options = {
  endpoint: string
  hmacSharedSecret?: string
}

type Payload = {
  payload: {
    timestamp: number
    data: {
      transactionId: string
      blockHeight: number
      events: FlowEvent[]
    }
  }
  hmac?: {
    nonce: string
    hash: string
  }
}

export class HttpEventBroadcaster implements EventBroadcasterInterface {
  constructor (private readonly options: Options, private readonly logProvider: LogProvider) {
  }

  buildPayload = (blockHeight: number, transactionId: string, transactionEvents: FlowEvent[]): Payload => {
    const payload: Payload = {
      payload: {
        timestamp: Math.floor(new Date().getTime() / 1000),
        data: {
          transactionId,
          blockHeight,
          events: transactionEvents,
        },
      }
    }

    if (this.options.hmacSharedSecret) {
      const nonce = uuidv4()
      const message = JSON.stringify(payload.payload)
      const hashDigest = sha256(nonce + message)
      const hmacDigest = Base64.stringify(hmacSHA512(message + hashDigest, this.options.hmacSharedSecret))
      payload.hmac = {
        nonce,
        hash: hmacDigest,
      }
    }

    return payload
  }

  broadcastEvents = async (blockHeight: number, events: FlowEvent[]) => {
    const logger = this.logProvider()

    // we will send all events to an HTTP endpoint

    let eventCount = 0
    let messageCount = 0

    const groups = _.groupBy(events, ev => ev.transactionId)

    for (const transactionId in groups) {
      const transactionEvents = groups[transactionId]

      const client = axios.create({
        maxContentLength: 50000000,
        timeout: 600000,
      })

      let errors = 0

      while (true) {
        const payload = this.buildPayload(blockHeight, transactionId, transactionEvents)

        try {
          try {
            await client.post(this.options.endpoint, payload)
          } catch (err) {
            if (axios.isAxiosError(err)) {
              throw Error(`Unable to post to HTTP endpoint: ${err.message}`)
            } else {
              throw Error(`Unable to post to HTTP endpoint: ${err}`)
            }

          }

          eventCount += transactionEvents.length
          ++messageCount
          break
        } catch (err) {
          logger.error(err)
          ++errors
          await delay(Math.floor(Math.min(4, errors) * 500 + Math.random() * 500))
        }
      }
    }

    logger.debug(`Sent ${eventCount} events in ${messageCount} HTTP messages`)
  }
}
