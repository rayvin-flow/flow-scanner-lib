#### Jump To

[Architecture Overview](architecture-overview.md)

[Extending Flow Scanner](extending-flow-scanner.md)

[Class Reference](class-reference.md)

[Examples](examples.md)

---

## Quickstart

If you just want to get up and running and integrate Flow Scanner into your own project, this is the minimal configuration you will need:

Install flow-scanner-lib as a dependency of your project:

`npm i flow-scanner-lib`

Create and start an instance of the `FlowScanner`:

```typescript
import { FlowScanner } from 'flow-scanner-lib'
import { MemorySettingsService } from 'flow-scanner-lib/lib/settings/memory-settings-service'

// create provider for configuration (these are the minimum required values)
const configProvider: ConfigProvider = () => ({
  DEFAULT_START_BLOCK_HEIGHT: 1, // this is the block height that the scanner will start from on the very first run
  FLOW_ACCESS_NODE: 'https://access-mainnet-beta.onflow.org', // access node to use for Flow API requests
  MAX_FLOW_REQUESTS_PER_SECOND: 10, // maximum number of requests to make to the Flow API per second
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
  
// start the scanner
// this method will return as soon as the scanner has started and continue to run in the background using setTimeout calls
// the scanner is a very I/O constrained process and not very CPU intensive, so as long as you are not bottlenecking the CPU with
// your own application logic there should be plenty of room for it to process
await flowScanner.start()

// your application logic can go here

// when you are ready to stop the scanner, you can call the stop() method
await flowScanner.stop()
```

To dive deeper into the architecture of Flow Scanner and how to configure/extend it, check out the [Architecture Overview](architecture-overview.md)

