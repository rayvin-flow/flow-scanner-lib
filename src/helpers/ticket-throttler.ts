export class WaitForTicketTimeout extends Error {
  code = 'TICKET_TIMEOUT'

  constructor () {
    super('WaitForTicketTimeout')
  }
}

export class TicketThrottler {
  private issuedTickets = 0
  private lastDecayTime: number

  constructor (private maxTickets: number, private decayPerSecond: number, private onTicketsReserved?: (count: number) => void) {
    this.lastDecayTime = new Date().getTime()
  }

  getMaxTickets = (): number => {
    return this.maxTickets
  }

  getDecayPerSecond = (): number => {
    return this.decayPerSecond
  }

  setDecayPerSecond = (decayPerSecond: number) => {
    this.decayPerSecond = decayPerSecond
    return this
  }

  setMaxTickets = (maxTickets: number) => {
    this.maxTickets = maxTickets
    return this
  }

  waitForTickets = async (count: number, maxWaitMs?: number) => {
    return new Promise<void>((resolve, reject) => {
      const startTime = new Date().getTime()

      const fn = () => {
        if (this.reserveTickets(count)) {
          resolve()
        } else if (maxWaitMs !== undefined && new Date().getTime() - startTime > maxWaitMs) {
          reject(new WaitForTicketTimeout())
        } else {
          setTimeout(fn, 10)
        }
      }

      fn()
    })
  }

  reserveTickets = (count: number, force = false): boolean => {
    const cur = new Date().getTime()
    if (this.lastDecayTime < cur) {
      this.issuedTickets = Math.max(this.issuedTickets - (cur - this.lastDecayTime) / 1000 * this.decayPerSecond, 0)
      this.lastDecayTime = cur
    }

    if (force || (this.issuedTickets > 0 && this.issuedTickets + count > this.maxTickets)) {
      return false
    }


    if (this.onTicketsReserved) {
      this.onTicketsReserved(count)
    }

    this.issuedTickets += count
    return true
  }

  freeTickets = (count: number) => {
    this.issuedTickets = Math.max(this.issuedTickets - count, 0)
  }
}
