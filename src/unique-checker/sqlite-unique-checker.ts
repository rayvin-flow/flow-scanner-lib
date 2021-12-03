import knex, { Knex } from 'knex'
import { UniqueCheckerInterface } from './unique-checker'
import { v4 as uuidv4 } from 'uuid'

type SqliteLockData = {
  key: string
  lockId: string
}

export class SqliteUniqueChecker implements UniqueCheckerInterface<SqliteLockData> {
  private db: Knex | undefined = undefined

  constructor (private readonly filename: string, private readonly groupId: string | undefined = undefined, private readonly lockTtlMs = 10000) {
    if (groupId && groupId.length > 16) {
      throw new Error('groupId cannot be more than 16 characters')
    }
  }

  private getDb = async (): Promise<Knex> => {
    if (!this.db) {
      this.db = knex({
        client: 'sqlite3',
        connection: this.filename === ':memory:'
          ? ':memory:'
          : {
            filename: this.filename,
          },
        pool: {
          idleTimeoutMillis: Infinity,
        },
        useNullAsDefault: true,
      })

      await this.initializeDb(this.db)
    }

    return this.db
  }

  closeDb = async () => {
    if (this.db) {
      this.db.destroy().then()
      this.db = undefined
    }
  }

  private initializeDb = async (db: Knex) => {
    const metaTableCheck = await db('sqlite_master')
      .where('type', 'table')
      .where('name', 'meta')
      .first()

    if (!metaTableCheck) {
      // we don't have a version table, initialize the database
      await this.migrateDb(db, 0)
    } else {
      // check version to see if we need to migrate the database
      const versionRecord = await db('meta')
        .where('key', 'version')
        .first()

      await this.migrateDb(db, versionRecord?.value ? Number(versionRecord.value) : 0)
    }
  }

  private migrateDb = async (db: Knex, currentVersion: number) => {
    if (currentVersion < 1) {
      // create meta table
      await db.schema.createTable('meta', table => {
        table.string('key', 32).notNullable()
        table.primary(['key'])

        table.string('value').notNullable()
      })

      // create records table
      await db.schema.createTable('records', table => {
        table.string('key', 128).notNullable()
        table.primary(['key'])
        table.string('lock_id', 64).nullable()
        table.integer('lock_timestamp').nullable()
        table.string('consumed').notNullable()
      })

      await db('meta')
        .insert({
          key: 'version',
          value: '1',
        })
    }
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
      await trx('records')
        .insert({
          'key': uniqueKey,
          'lock_id': null,
          'lock_timestamp': null,
          'consumed': '0',
        })
        .onConflict()
        .ignore()

      // try acquire lock
      await trx('records')
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
      const lock = await trx('records')
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

    const record = await db('records')
      .where('key', lockData.key)
      .first()

    return record?.consumed === '1'
  }

  releaseLock = async (lockData: SqliteLockData) => {
    const db = await this.getDb()

    await db.transaction(async trx => {
      // release lock
      await trx('records')
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
      await trx('records')
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
