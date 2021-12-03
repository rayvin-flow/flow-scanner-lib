import knex, { Knex } from 'knex'
import { UniqueCheckerInterface } from './unique-checker'
import { v4 as uuidv4 } from 'uuid'

type SqliteLockData = {
  key: string
  lockId: string
}

export class DbUniqueChecker implements UniqueCheckerInterface<SqliteLockData> {
  private db: Knex | undefined = undefined

  constructor (private readonly config: Knex.Config, private readonly tableName: string, private readonly groupId: string | undefined = undefined, private readonly lockTtlMs = 10000) {
    if (groupId && groupId.length > 16) {
      throw new Error('groupId cannot be more than 16 characters')
    }
  }

  private getDb = async (): Promise<Knex> => {
    if (!this.db) {
      this.db = knex(this.config)
    }

    return this.db
  }

  buildKey = (key: string): string => {
    return `${key}${this.groupId ? `-${this.groupId}` : ''}`
  }

  acquireLock = async (key: string): Promise<SqliteLockData | undefined> => {
    const lockId = uuidv4()

    const db = await this.getDb()

    let lockData: SqliteLockData | undefined = undefined

    const uniqueKey = this.buildKey(key)

    await db.transaction(async trx => {
      // try to create initial record
      await trx(this.tableName)
        .insert({
          'key': uniqueKey,
          'lock_id': null,
          'lock_timestamp': null,
          'consumed': '0',
        })
        .onConflict()
        .ignore()

      // try acquire lock
      await trx(this.tableName)
        .where('key', uniqueKey)
        .where(builder => {
          builder.whereNull('lock_id')
            .orWhere('lock_timestamp', '<', new Date().getTime() - this.lockTtlMs)
        })
        .update({
          lock_id: lockId,
          lock_timestamp: new Date().getTime(),
        })

      // check if lock was acquired
      const lock = await trx(this.tableName)
        .where('key', uniqueKey)
        .first()

      if (lock.lock_id === lockId) {
        lockData = {
          key: uniqueKey,
          lockId: lock.lock_id,
        }
      }
    })

    return lockData
  }

  checkConsumed = async (lockData: SqliteLockData): Promise<boolean> => {
    const db = await this.getDb()

    const record = await db(this.tableName)
      .where('key', lockData.key)
      .first()

    return record?.consumed === '1'
  }

  releaseLock = async (lockData: SqliteLockData) => {
    const db = await this.getDb()

    await db.transaction(async trx => {
      // release lock
      await trx(this.tableName)
        .where('key', lockData.key)
        .where('lock_id', lockData.lockId)
        .update({
          lock_id: null,
          lock_timestamp: null,
        })
    })
  }

  setConsumed = async (lockData: SqliteLockData, consumed: boolean) => {
    const db = await this.getDb()

    await db.transaction(async trx => {
      // release lock
      await trx(this.tableName)
        .where('key', lockData.key)
        .where('lock_id', lockData.lockId)
        .update({
          consumed: consumed ? '1' : '0',
        })
    })
  }

  destroy = async () => {
    if (this.db) {
      await this.db.destroy()
      this.db = undefined
    }
  }
}
