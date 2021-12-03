import { EventBroadcasterInterface } from './event-broadcaster'
import { FlowEvent } from '../flow/models/flow-event'
import _ from 'lodash'
import { LogProvider } from '../providers/log-provider'
import { UniqueCheckerProvider } from '../providers/unique-checker-provider'

export class UniqueEventBroadcaster implements EventBroadcasterInterface {
  constructor (private readonly uniqueCheckerProvider: UniqueCheckerProvider, private readonly broadcaster: EventBroadcasterInterface, private readonly logProvider: LogProvider) {
  }

  broadcastEvents = async (blockHeight: number, events: FlowEvent[]) => {
    const groups = _.groupBy(events, ev => ev.transactionId)
    const uniqueChecker = await this.uniqueCheckerProvider()

    for (const transactionId in groups) {
      const lock = await uniqueChecker.acquireLock(transactionId)

      try {
        const consumed = await uniqueChecker.checkConsumed(lock)

        if (!consumed) {
          await this.broadcaster.broadcastEvents(blockHeight, groups[transactionId])
          await uniqueChecker.setConsumed(lock, true)
        } else {
          this.logProvider().debug(`Skipping transaction already sent: ${transactionId}`)
        }

        await uniqueChecker.releaseLock(lock)
      } catch (err) {
        await uniqueChecker.releaseLock(lock)
        throw err
      }
    }
  }

  destroy = async () => {
    const uniqueChecker = await this.uniqueCheckerProvider()
    uniqueChecker.destroy && await uniqueChecker.destroy()
  }
}

