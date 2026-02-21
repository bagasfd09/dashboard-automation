#!/usr/bin/env node
import { QCMonitorClient } from './core.js';
import { loadConfig } from './config.js';
import { RetryWatcher } from './retry-watcher.js';

async function main(): Promise<void> {
  const config = await loadConfig({});

  if (!config.apiUrl || !config.apiKey) {
    console.error(
      '[QC Monitor Watcher] apiUrl and apiKey are required.\n' +
        'Set QC_MONITOR_API_URL / QC_MONITOR_API_KEY or create qc-monitor.config.js.',
    );
    process.exit(1);
  }

  const client = new QCMonitorClient({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    retries: config.retries,
  });

  const watcher = new RetryWatcher(client);
  watcher.start();

  function shutdown() {
    watcher.stop();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[QC Monitor Watcher] Fatal error:', err);
  process.exit(1);
});
