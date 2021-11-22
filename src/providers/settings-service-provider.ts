import { SettingsServiceInterface } from '../settings/settings-service'

export type SettingsServiceProvider = () => Promise<SettingsServiceInterface>
