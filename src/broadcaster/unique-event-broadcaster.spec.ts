import { expect } from 'chai'
import { SqliteUniqueChecker } from '../unique-checker/sqlite-unique-checker'
import { UniqueEventBroadcaster } from './unique-event-broadcaster'
import { nullLogProvider } from '../providers/log-provider'
import { FlowEvent } from '../flow/models/flow-event'

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
    eventIndex: 0,
    blockHeight: 1,
    transactionIndex: 0,
    blockTimestamp: '',
    data: {},
    transactionId: '2',
    blockId: '1',
  },
  {
    type: 'test',
    eventIndex: 0,
    blockHeight: 1,
    transactionIndex: 0,
    blockTimestamp: '',
    data: {},
    transactionId: '3',
    blockId: '1',
  },
]

describe('Test unique event broadcaster', () => {
  it('Check that transaction ids are consumed', async () => {
    let broadcasted: FlowEvent[] = []
    const checker = new SqliteUniqueChecker(':memory:')
    const broadcaster = new UniqueEventBroadcaster(async () => checker, {
      broadcastEvents: async (blockHeight: number, events: FlowEvent[]) => {
        broadcasted.push(...events)
      },
    }, nullLogProvider)

    let lock = await checker.acquireLock('1')
    let consumed = await checker.checkConsumed(lock!)
    await checker.releaseLock(lock!)

    expect(consumed).equals(false)

    lock = await checker.acquireLock('2')
    consumed = await checker.checkConsumed(lock!)
    await checker.releaseLock(lock!)

    expect(consumed).equals(false)

    lock = await checker.acquireLock('3')
    consumed = await checker.checkConsumed(lock!)
    await checker.releaseLock(lock!)

    expect(consumed).equals(false)

    await broadcaster.broadcastEvents(1, testEvents)

    expect(broadcasted).length(3)

    lock = await checker.acquireLock('1')
    consumed = await checker.checkConsumed(lock!)
    await checker.releaseLock(lock!)

    expect(consumed).equals(true)

    lock = await checker.acquireLock('2')
    consumed = await checker.checkConsumed(lock!)
    await checker.releaseLock(lock!)

    expect(consumed).equals(true)

    lock = await checker.acquireLock('3')
    consumed = await checker.checkConsumed(lock!)
    await checker.releaseLock(lock!)

    expect(consumed).equals(true)

    await checker.destroy()
  })

  it('Check that events are only broadcasted once', async () => {
    let broadcasted: FlowEvent[] = []
    const checker = new SqliteUniqueChecker(':memory:')
    const broadcaster = new UniqueEventBroadcaster(async () => checker, {
      broadcastEvents: async (blockHeight: number, events: FlowEvent[]) => {
        broadcasted.push(...events)
      },
    }, nullLogProvider)

    await broadcaster.broadcastEvents(1, testEvents)

    expect(broadcasted).length(3)

    broadcasted = []

    await broadcaster.broadcastEvents(1, testEvents)

    expect(broadcasted).length(0)

    await checker.destroy()
  })

  it('Check that new transactions are broadcasted', async () => {
    let broadcasted: FlowEvent[] = []
    const checker = new SqliteUniqueChecker(':memory:')
    const broadcaster = new UniqueEventBroadcaster(async () => checker, {
      broadcastEvents: async (blockHeight: number, events: FlowEvent[]) => {
        broadcasted.push(...events)
      },
    }, nullLogProvider)

    await broadcaster.broadcastEvents(1, [
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
    ])

    expect(broadcasted).length(1)

    broadcasted = []

    await broadcaster.broadcastEvents(2, [
      {
        type: 'test',
        eventIndex: 0,
        blockHeight: 2,
        transactionIndex: 0,
        blockTimestamp: '',
        data: {},
        transactionId: '2',
        blockId: '2',
      },
    ])

    expect(broadcasted).length(1)

    await checker.destroy()
  })
})
