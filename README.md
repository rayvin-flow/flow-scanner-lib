`flow-scanner-lib` is a library that makes it easy to monitor the Flow blockchain for any Cadence events that you are interested in and broadcast them to one or more consumers. It is highly configurable, and is meant to be extended or modified to fit into any pipeline.

Some included features are:

* Listen for one or more Cadence event types
* Broadcast events to one or more consumers (support is included for AWS SQS, AWS SNS, and HTTP endpoints)
* Support for metrics (AWS CloudWatch implementation included)
* Configurable Flow API rate limiting
* Configurable storage for persistent data (SQLite, MySQL, Postgres)
* Built-in optional message deduplication
* Can be run as a stand-alone deployment (please reference the [flow-scanner](https://github.com/rayvin-flow/flow-scanner/) repository) or as a dependency of a larger codebase as an NPM package

#### High-level overview

Cadence events are emitted as the result of scripts being executed on Flow. They are grouped into transactions, which are further grouped into blocks. Flow scanner will always broadcast all events for a transaction as a single group, and it will always broadcast all transactions in the order they were presented on on the blockchain.

Flow Scanner polls the Flow blockchain to get the latest block height and spawns an EventScanner instance for each configured event type. Each of these uses the `getEventsAtBlockHeightRange` API call to query the blockchain for events. Events of each type are sent to the main FlowScanner instance, and once all events for a particular block are available it groups them by transaction ID and sends them to the EventBroadcaster instance(s) to be broadcast.

Each EventScanner instance is running in parallel, and there are configuration options for both how many blocks to check at a time, as well as how far ahead a single EventScanner is allowed to be (since they may all run at different speeds).

#### Fault tolerance

Since all events for a transaction are broadcast together, a transaction cannot be broadcast until all EventScanners have queried the blockchain for a particular block height. If there are errors, the scanner will retry until it can successfully query the necessary block(s). Errors are logged, and if you have configured metrics (ie: AWS CloudWatch) you can enable alarms for errors reported to the metric service. In the case that the scanner service is killed or restarted, it will resume from where it left off (if you have configured a settings provider to persist state) and optional message deduplication can be configured to ensure that the same transactions are not delivered to your consumers more than once.

---

To learn more about the internals of Flow Scanner, check out the [Documentation](docs/index.md)
