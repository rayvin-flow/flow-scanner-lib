import { SettingsServiceInterface } from './settings-service'
import knex, { Knex } from 'knex'

export class DbSettingsService implements SettingsServiceInterface {
  private db: Knex | undefined = undefined

  constructor (private readonly config: Knex.Config, private readonly tableName: string) {
  }

  private getDb = async (): Promise<Knex> => {
    if (!this.db) {
      this.db = knex(this.config)
    }

    return this.db
  }

  getProcessedBlockHeight = async () => {
    const db = await this.getDb()

    const setting = await db(this.tableName)
      .where('key', 'processed-block-height')
      .first()

    return setting ? Number(setting.value) : undefined
  }

  setProcessedBlockHeight = async (blockHeight: number) => {
    const db = await this.getDb()
    await db.raw("REPLACE INTO `" + this.tableName + "` (`key`, `value`) VALUES (?, ?)", ['processed-block-height', String(blockHeight)])
  }
}
