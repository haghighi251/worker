import { Consumer, Kafka, Producer } from 'kafkajs';
import { config } from '@/infrastructure/shared/config';

export const KAFKA_TOPICS = {
  PACKAGE_SCAN: 'package.scan',
  VULNERABILITY_FETCHED: 'vulnerability.fetched',
} as const;

export const PACKAGE_SCAN_CONSUMER_GROUP = 'worker-package-scan';

const kafka = new Kafka({
  clientId: 'worker',
  brokers: config.KAFKA_BROKERS.split(',').map((broker) => broker.trim()),
});

let producer: Producer | null = null;

/** Lazily connects and memoizes a single shared producer instance. */
export async function getKafkaProducer(): Promise<Producer> {
  if (!producer) {
    const created = kafka.producer();
    await created.connect();
    producer = created;
  }
  return producer;
}

export function createKafkaConsumer(groupId: string): Consumer {
  return kafka.consumer({ groupId });
}

export async function disconnectKafkaProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect().catch((error) => {
      console.error('[Worker] Failed to disconnect Kafka producer:', error?.message);
    });
    producer = null;
  }
}
