import { SettingsServiceInterface } from './settings-service'
import knex, { Knex } from 'knex'

export class SqliteSettingsService implements SettingsServiceInterface {
  private db: Knex | undefined = undefined

  constructor (private readonly filename: string) {
  }

  private getDb = async (): Promise<Knex> => {
    if (!this.db) {
      this.db = knex({
        client: 'sqlite3',
        connection: {
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

      // create settings table
      await db.schema.createTable('settings', table => {
        table.string('key', 32).notNullable()
        table.primary(['key'])

        table.string('value').notNullable()
      })

      await db('meta')
        .insert({
          key: 'version',
          value: '1',
        })
    }
  }

  getProcessedBlockHeight = async () => {
    const db = await this.getDb()

    const setting = await db('settings')
      .where('key', 'processed-block-height')
      .first()

    return setting ? Number(setting.value) : undefined
  }

  setProcessedBlockHeight = async (blockHeight: number) => {
    const db = await this.getDb()
    await db.raw("REPLACE INTO settings (`key`, `value`) VALUES (?, ?)", ['processed-block-height', String(blockHeight)])
  }

  destroy = async () => {
    if (this.db) {
      await this.db.destroy()
      this.db = undefined
    }
  }
}
