import { nullLogProvider } from '../providers/log-provider'
import { FlowEvent } from '../flow/models/flow-event'
import { HttpEventBroadcaster } from './http-event-broadcaster'
import { expect } from 'chai'
import sha256 from 'crypto-js/sha256'
import Base64 from 'crypto-js/enc-base64'
import hmacSHA512 from 'crypto-js/hmac-sha512'

const testEvents: FlowEvent[] = [
  {
    type: 'test',
    eventIndex: 0,
    blockHeight: 1,
    transactionIndex: 0,
    blockTimestamp: '',
    data: {},
    transactionId: '1',
    blockId: '1',
  },
  {
    type: 'test',
    eventIndex: 1,
    blockHeight: 1,
    transactionIndex: 0,
    blockTimestamp: '',
    data: {},
    transactionId: '1',
    blockId: '1',
  },
]

describe('Test http event broadcaster', () => {
  it('Test unsigned message payload', async () => {
    const broadcaster = new HttpEventBroadcaster({
      endpoint: 'test',
    }, nullLogProvider)

    const payload = broadcaster.buildPayload(1, '1', testEvents)

    expect(payload.payload.data).deep.equals({
      transactionId: '1',
      blockHeight: 1,
      events: testEvents,
    })

    expect(payload.hmac).to.be.undefined
  })

  it('Test signed message payload', async () => {
    const sharedSecret = 'shared-secret'

    const broadcaster = new HttpEventBroadcaster({
      hmacSharedSecret: sharedSecret,
      endpoint: 'test',
    }, nullLogProvider)

    const payload = broadcaster.buildPayload(1, '1', testEvents)

    expect(payload.payload.data).deep.equals({
      transactionId: '1',
      blockHeight: 1,
      events: testEvents,
    })

    const message = JSON.stringify(payload.payload)
    const hashDigest = sha256(payload.hmac?.nonce + message)
    const hmacDigest = Base64.stringify(hmacSHA512(message + hashDigest, sharedSecret))

    expect(payload.hmac?.hash).equals(hmacDigest)
  })
})
