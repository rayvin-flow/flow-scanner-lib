export interface SettingsServiceInterface {
  getProcessedBlockHeight (): Promise<number | undefined>

  setProcessedBlockHeight (blockHeight: number): Promise<void>

  destroy?: () => Promise<void>
}
