import { Consumer } from 'kafkajs';
import {
  createKafkaConsumer,
  KAFKA_TOPICS,
  PACKAGE_SCAN_CONSUMER_GROUP,
} from '@/infrastructure/kafka/kafkaClient';
import { queryOsvBatch } from '@domain/services/osvClient';
import { publishVulnerabilityFetched } from '@/infrastructure/kafka/producers/vulnerabilityFetchedProducer';
import {
  PackageScanMessage,
  VulnerabilityFetchedMessage,
} from '@/infrastructure/kafka/types/packageScanMessages';

let consumer: Consumer | null = null;

/**
 * The Vulnerability Fetcher Worker named in root CLAUDE.md: consumes
 * package.scan events (produced either by aba-bl's plan-driven scheduler),
 * queries OSV.dev for each package, and publishes vulnerability.fetched for
 * aba-bl to persist and notify on.
 */
export async function startPackageScanConsumer(): Promise<void> {
  consumer = createKafkaConsumer(PACKAGE_SCAN_CONSUMER_GROUP);
  await consumer.connect();
  await consumer.subscribe({ topic: KAFKA_TOPICS.PACKAGE_SCAN, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => handlePackageScanMessage(message.value?.toString() ?? null),
  });
}

export async function stopPackageScanConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect().catch((error) => {
      console.error('[Worker] Failed to disconnect package.scan consumer:', error?.message);
    });
    consumer = null;
  }
}

/**
 * Exported separately from the kafkajs wiring so tests can drive it directly
 * with a constructed message body instead of a real EachMessagePayload.
 * Never throws — a bad message, or a failed publish, is logged and dropped
 * rather than crashing the consumer loop (kafkajs treats a thrown
 * eachMessage handler as fatal after retries are exhausted).
 */
export async function handlePackageScanMessage(raw: string | null): Promise<void> {
  if (!raw) {
    console.error('[Worker] Received empty package.scan message, skipping');
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(
      '[Worker] Received malformed (non-JSON) package.scan message, skipping:',
      (error as Error)?.message,
    );
    return;
  }

  if (!isValidPackageScanMessage(parsed)) {
    console.error('[Worker] Received package.scan message with unexpected shape, skipping');
    return;
  }

  const scanResults = await queryOsvBatch(parsed.packages);

  const message: VulnerabilityFetchedMessage = {
    scanId: parsed.scanId,
    companyId: parsed.companyId,
    serviceId: parsed.serviceId,
    results: scanResults.map(({ package: pkg, vulns }) => ({
      packageId: pkg.id,
      ecosystem: pkg.ecosystem,
      name: pkg.name,
      version: pkg.version,
      vulns,
    })),
  };

  try {
    await publishVulnerabilityFetched(message);
  } catch (error) {
    console.error(
      `[Worker] Failed to publish vulnerability.fetched for scanId=${parsed.scanId}:`,
      (error as Error)?.message,
    );
  }
}

function isValidPackageScanMessage(value: unknown): value is PackageScanMessage {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Record<string, unknown>;
  return (
    typeof msg.scanId === 'string' &&
    typeof msg.serviceId === 'number' &&
    typeof msg.companyId === 'number' &&
    Array.isArray(msg.packages)
  );
}
