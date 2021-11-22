import { UniqueCheckerInterface } from '../unique-checker/unique-checker'

export type UniqueCheckerProvider = () => Promise<UniqueCheckerInterface<unknown>>
