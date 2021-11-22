import { EventBroadcasterInterface } from '../broadcaster/event-broadcaster'

export type EventBroadcasterProvider = () => Promise<EventBroadcasterInterface>
