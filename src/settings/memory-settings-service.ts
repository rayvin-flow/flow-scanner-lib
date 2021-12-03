import { SettingsServiceInterface } from './settings-service'

export class MemorySettingsService implements SettingsServiceInterface {
  private processedBlockHeight: number | undefined = undefined

  constructor () {
  }

  getProcessedBlockHeight = async () => {
    return this.processedBlockHeight
  }

  setProcessedBlockHeight = async (blockHeight: number) => {
    this.processedBlockHeight = blockHeight
  }

  destroy = async () => {
  }
}
