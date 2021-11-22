[Index](index.md)

## Architecture Overview

Flow Scanner is a service that monitors the Flow blockchain for Cadence events and broadcasts them to consumers. Since this is a very I/O constrained process (network calls, database access, etc) it is perfectly suited for NodeJS. `async`/`await` is leveraged heavily to allow for concurrent processing wherever possible. This also allows your application to run concurrently with Flow Scanner even if you embed it into your own codebase (as long as you are allowing Node to switch contexts with `async`/`await` or Promises).

The core of the Flow Scanner system is the `FlowScanner` class, which coordinates the interactions between all of the other components. When you first start a `FlowScanner` instance (using the `start()` method), it will start an instance of `EventScanner` for each event type you are monitoring, and one `BlockHeightScanner` to monitor the height of the latest sealed block. Each of these components executes and then schedules a subsequent execution using `setTimeout`, so they are essentially all in an infinite loop until you call `stop()` on the `FlowScanner` instance. Many of the operations performed are asynchronous I/O operations, giving Node the chance to context switch back to your application for the majority of the CPU time.

---

### Data/Event Flow

Every time the block height increases, the `BlockHeightScanner` emits an event that all of the `FlowScanner` instances are listening for so they know that new blocks are available to query. Each `EventScanner` instance will query as many blocks as it should (this is configurable and you can find out more details in the [EventScanner Class Reference](class-references/event-scanner.md)). Multiple blocks are queried at a time using the Flow SDK `getEventsAtBlockHeightRange` API call. For each block that is queried, the `EventScanner` will emit an event containing information about the block, as well as all events that were contained in it.

The parent `FlowScanner` instance is listening for these events emitted by the `EventScanner` instance(s). Once it has received a block for all monitored Cadence event types, all events for that block are combined and sent to any registered `EventBroadcaster` instances.

Each `EventBroadcaster` will broadcast the event (to HTTP/SNS/SQS/etc), and once it has been successfully broadcast the `FlowScanner` will mark that block as processed and move on to the next one.

An `EventScanner` instance is always trying to stay slightly ahead of the processed block height so that the next block is hopefully immediately available for processing. This allows most of the I/O operations to overlap and keeps the system running quickly and efficiently.

---

You can dive deeper into each component to learn more:

[FlowScanner Reference](class-references/flow-scanner.md)

[BlockHeightScanner Class Reference](class-references/block-height-scanner.md)

[EventScanner Class Reference](class-references/event-scanner.md)

[EventBroadcaster Class Reference](class-references/event-broadcaster.md)

[View All Class References](class-reference.md)
