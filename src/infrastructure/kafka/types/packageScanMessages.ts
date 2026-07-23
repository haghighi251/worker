import { DependencyEcosystem } from '@aba/database';
import { OsvVuln } from '@domain/services/osvClient';

/**
 * Wire contract for the `package.scan` topic.
 *
 * Produced by aba-bl's PackageRescanScheduler, consumed here. Must stay in
 * sync with aba-bl's copy at
 * `aba-bl/src/modules/kafka/types/packageScanMessages.ts` — there's no
 * shared npm package for Kafka contracts in this monorepo.
 */
export interface PackageScanMessage {
  scanId: string;
  companyId: number;
  serviceId: number;
  packages: {
    id: number;
    ecosystem: DependencyEcosystem;
    name: string;
    version: string;
  }[];
}

/**
 * Wire contract for the `vulnerability.fetched` topic, produced here after
 * querying OSV.dev and consumed by aba-bl.
 */
export interface VulnerabilityFetchedMessage {
  scanId: string;
  companyId: number;
  serviceId: number;
  results: {
    packageId: number;
    ecosystem: DependencyEcosystem;
    name: string;
    version: string;
    vulns: OsvVuln[];
  }[];
}
