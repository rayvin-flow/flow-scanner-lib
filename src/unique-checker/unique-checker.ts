export type LockData<T> = T

export interface UniqueCheckerInterface<T> {
  acquireLock (key: string): Promise<LockData<T> | undefined>

  checkConsumed (lockData: LockData<T>): Promise<boolean>

  setConsumed (lockData: LockData<T>, consumed: boolean): Promise<void>

  releaseLock (lockData: LockData<T>): Promise<void>

  destroy?: () => Promise<void>
}
