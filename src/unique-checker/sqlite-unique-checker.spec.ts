import { expect } from 'chai'
import { SqliteUniqueChecker } from './sqlite-unique-checker'
import { delay } from '../helpers/delay'

describe('Test sqlite unique checker', () => {
  it('Checking that locks are acquired', async () => {
    const checker = new SqliteUniqueChecker(':memory:')

    const check = await checker.acquireLock('test')
    const check2 = await checker.acquireLock('test2')

    expect(check).not.undefined
    expect(check).has.property('key', 'test')

    expect(check2).not.undefined
    expect(check2).has.property('key', 'test2')

    await checker.destroy()
  })

  it('Check that lock is respected', async () => {
    const checker = new SqliteUniqueChecker(':memory:')

    const check = await checker.acquireLock('test')
    const check2 = await checker.acquireLock('test')

    expect(check).not.undefined
    expect(check).has.property('key', 'test')

    expect(check2).undefined

    await checker.destroy()
  })

  it('Check that lock is can be released', async () => {
    const checker = new SqliteUniqueChecker(':memory:')

    const lock1 = await checker.acquireLock('test')

    expect(lock1).not.undefined

    const lock2 = await checker.acquireLock('test')

    expect(lock2).undefined

    await checker.releaseLock(lock1!)

    const lock3 = await checker.acquireLock('test')

    expect(lock3).not.undefined

    await checker.destroy()
  })

  it('Check consumable', async () => {
    const checker = new SqliteUniqueChecker(':memory:')

    const lock = await checker.acquireLock('test3')

    if (lock) {
      const consumed1 = await checker.checkConsumed(lock)
      await checker.setConsumed(lock, true)
      const consumed2 = await checker.checkConsumed(lock)

      expect(consumed1).equals(false)
      expect(consumed2).equals(true)
    }

    await checker.destroy()
  })

  it('Check that only lock can consume record', async () => {
    const checker = new SqliteUniqueChecker(':memory:')

    const lock = await checker.acquireLock('test')

    expect(lock).not.undefined

    if (lock) {
      const consumed1 = await checker.checkConsumed(lock)
      expect(consumed1).equals(false)

      await checker.setConsumed({ lockId: 'invalid', key: 'test' }, true)

      const consumed2 = await checker.checkConsumed(lock)
      expect(consumed2).equals(false)

      await checker.setConsumed(lock, true)

      const consumed3 = await checker.checkConsumed(lock)
      expect(consumed3).equals(true)
    }

    await checker.destroy()
  })

  it('Check that lock expires', async () => {
    const checker = new SqliteUniqueChecker(':memory:', undefined, 500)

    const lock = await checker.acquireLock('test')
    const lock2 = await checker.acquireLock('test')

    expect(lock).not.undefined
    expect(lock2).undefined

    await delay(500)

    const lock3 = await checker.acquireLock('test')

    expect(lock3).not.undefined

    await checker.destroy()
  })

  it('Check unique key builder without groupId', async () => {
    const checker = new SqliteUniqueChecker(':memory:', undefined)
    const key = checker.buildKey('test')
    expect(key).equals('test')

    await checker.destroy()
  })

  it('Check unique key builder without groupId', async () => {
    const checker = new SqliteUniqueChecker(':memory:', 'group')
    const key = checker.buildKey('test')
    expect(key).equals('test-group')

    await checker.destroy()
  })

  it('Check that lock can be acquired with groupId', async () => {
    const checker = new SqliteUniqueChecker(':memory:', 'group')

    const check = await checker.acquireLock('test')
    const check2 = await checker.acquireLock('test2')

    expect(check).not.undefined
    expect(check).has.property('key', 'test-group')

    expect(check2).not.undefined
    expect(check2).has.property('key', 'test2-group')

    await checker.destroy()
  })
})
