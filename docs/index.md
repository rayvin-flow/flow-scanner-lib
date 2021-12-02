#### Jump To

[Architecture Overview](architecture-overview.md)

[Extending Flow Scanner](extending-flow-scanner.md)

[Class Reference](class-reference.md)

[Examples](examples.md)

---

## Quickstart

If you just want to get up and running and integrate Flow Scanner into your own project, this is the minimal configuration you will need:

Install flow-scanner-lib as a dependency of your project:

`npm i @rayvin-flow/flow-scanner-lib`

Create and start an instance of the `FlowScanner`:

```typescript
import {FlowScanner} from '@rayvin-flow/flow-scanner-lib'
import {MemorySettingsService} from '@rayvin-flow/flow-scanner-lib/lib/settings/memory-settings-service'
import {ConfigProvider} from '@rayvin-flow/flow-scanner-lib/lib/providers/config-provider'
import {ConsoleEventBroadcaster} from '@rayvin-flow/flow-scanner-lib/lib/broadcaster/console-event-broadcaster'

// create provider for configuration (these are the minimum required values)
const configProvider: ConfigProvider = () => ({
    defaultStartBlockHeight: undefined, // this is the block height that the scanner will start from on the very first run (undefined to start at the latest block)
    flowAccessNode: 'https://access-mainnet-beta.onflow.org', // access node to use for Flow API requests
    maxFlowRequestsPerSecond: 10, // maximum number of requests to make to the Flow API per second
})

// create the service that will persist settings (in this case, it is just in-memory)
const settingsService = new MemorySettingsService()
// the broadcaster that will send all monitored events (this one just outputs information the the console)
const eventBroadcaster = new ConsoleEventBroadcaster()

// create the scanner instance
const flowScanner = new FlowScanner(
    // event types to monitor
    [
        'A.c1e4f4f4c4257510.TopShotMarketV3.MomentListed',
    ],
    // pass in the configured providers
    {
        configProvider: configProvider,
        eventBroadcasterProvider: async () => eventBroadcaster,
        settingsServiceProvider: async () => settingsService,
    }
)

const main = async () => {
    // start the scanner
    // this method will return as soon as the scanner has started and continue to run in the background using setTimeout calls
    // the scanner is a very I/O constrained process and not very CPU intensive, so as long as you are not bottlenecking the CPU with
    // your own application logic there should be plenty of room for it to process
    console.log('Starting scanner')
    await flowScanner.start()

    // wait for interrupt signal
    await new Promise<void>(resolve => {
        // listen for SIGTERM to stop the scanner
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM')
            resolve()
        })

        process.on('SIGINT', () => {
            console.log('Received SIGINT')
            resolve()
        })
    })

    // when you are ready to stop the scanner, you can call the stop() method
    console.log('Stopping scanner')
    await flowScanner.stop()
}

main()
```

---

### Full Project Setup

If you are starting a project from scratch, first create an empty folder (for this example, we will call it `flow-scanner-example`). Navigate to that folder, and set up the configuration:

```shell
# create the package.json file
npm init
# you can fill in whatever values you want for your project

# add the flow-scanner-lib dependency
npm install @rayvin-flow/flow-scanner-lib

# add typescript
npm install -D typescript ts-node node
```

Create an `src` folder in your project, and add an `index.ts` file with the following code:

```typescript
import {FlowScanner} from '@rayvin-flow/flow-scanner-lib'
import {MemorySettingsService} from '@rayvin-flow/flow-scanner-lib/lib/settings/memory-settings-service'
import {ConfigProvider} from '@rayvin-flow/flow-scanner-lib/lib/providers/config-provider'
import {EventBroadcasterInterface} from '@rayvin-flow/flow-scanner-lib/lib/broadcaster/event-broadcaster'
import {FlowEvent} from '@rayvin-flow/flow-scanner-lib/lib/flow/models/flow-event'

// create provider for configuration (these are the minimum required values)
const configProvider: ConfigProvider = () => ({
    defaultStartBlockHeight: undefined, // this is the block height that the scanner will start from on the very first run (undefined to start at the latest block)
    flowAccessNode: 'https://access-mainnet-beta.onflow.org', // access node to use for Flow API requests
    maxFlowRequestsPerSecond: 10, // maximum number of requests to make to the Flow API per second
})

// create the service that will persist settings (in this case, it is just in-memory)
const settingsService = new MemorySettingsService()

// the broadcaster that will handle all monitored events
class CustomEventBroadcaster implements EventBroadcasterInterface {
    async broadcastEvents(blockHeight: number, events: FlowEvent[]): Promise<void> {
        // this method will be called for any monitored events
        // you can perform your own application logic here (ie: persist to database, etc)
        console.log(JSON.stringify({
            blockHeight,
            events,
        }))
    }
}

// create the scanner instance
const flowScanner = new FlowScanner(
    // event types to monitor
    [
        'A.c1e4f4f4c4257510.TopShotMarketV3.MomentListed',
    ],
    // pass in the configured providers
    {
        configProvider: configProvider,
        eventBroadcasterProvider: async () => new CustomEventBroadcaster(),
        settingsServiceProvider: async () => settingsService,
    }
)

const main = async () => {
    // start the scanner
    // this method will return as soon as the scanner has started and continue to run in the background using setTimeout calls
    // the scanner is a very I/O constrained process and not very CPU intensive, so as long as you are not bottlenecking the CPU with
    // your own application logic there should be plenty of room for it to process
    console.log('Starting scanner')
    await flowScanner.start()

    // wait for interrupt signal
    await new Promise<void>(resolve => {
        // listen for SIGTERM to stop the scanner
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM')
            resolve()
        })

        process.on('SIGINT', () => {
            console.log('Received SIGINT')
            resolve()
        })
    })

    // when you are ready to stop the scanner, you can call the stop() method
    console.log('Stopping scanner')
    await flowScanner.stop()
}

main()
```

Now run the `index.ts` file:

```shell
npx ts-node src/index.ts
```

You should see some output indicating that the scanner has started, and see some console output whenever a monitored event is detected.

---

To dive deeper into the architecture of Flow Scanner and how to configure/extend it, check out the [Architecture Overview](architecture-overview.md)

