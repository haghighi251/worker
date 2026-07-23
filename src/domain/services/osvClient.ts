import axios from 'axios';
import { DependencyEcosystem } from '@aba/database';

const OSV_ECOSYSTEM: Record<DependencyEcosystem, string> = {
  NPM: 'npm',
  PYPI: 'PyPI',
  MAVEN: 'Maven',
  RUBYGEMS: 'RubyGems',
  NUGET: 'NuGet',
  GO: 'Go',
  OTHER: 'other',
};

const OSV_URL = 'https://api.osv.dev/v1/querybatch';

export interface OsvVuln {
  id: string;
  summary?: string;
  published?: string;
  severity?: { type: string; score: string }[];
  affected?: {
    ranges?: {
      type: string;
      events: { introduced?: string; fixed?: string }[];
    }[];
  }[];
}

/**
 * The subset of a Package row this client needs. Deliberately not the full
 * Prisma `Package` type — the packages arrive over Kafka in a
 * PackageScanMessage, not from a local DB read.
 */
export interface ScannablePackage {
  id: number;
  ecosystem: DependencyEcosystem;
  name: string;
  version: string;
}

export interface PackageScanResult {
  package: ScannablePackage;
  vulns: OsvVuln[];
}

/**
 * Worker-side port of aba-bl's OsvService.queryBatch — this is the
 * Vulnerability Fetcher Worker half of the package.scan -> vulnerability.fetched
 * pipeline, so it needs its own copy rather than importing aba-bl's NestJS
 * service across services. Keeps the same fail-open behavior: an OSV outage
 * returns empty-vulns results instead of throwing, so one bad batch never
 * takes down the consumer loop (see packageScanConsumer.ts).
 */
export async function queryOsvBatch(packages: ScannablePackage[]): Promise<PackageScanResult[]> {
  if (!packages.length) return [];

  const queries = packages.map((pkg) => ({
    package: { name: pkg.name, ecosystem: OSV_ECOSYSTEM[pkg.ecosystem] ?? 'other' },
    version: pkg.version,
  }));

  try {
    const { data } = await axios.post<{ results: { vulns?: OsvVuln[] }[] }>(
      OSV_URL,
      { queries },
      { timeout: 15_000 },
    );

    return packages.map((pkg, i) => ({
      package: pkg,
      vulns: data.results[i]?.vulns ?? [],
    }));
  } catch (error) {
    console.error('[Worker] OSV batch query failed:', (error as Error)?.message);
    return packages.map((pkg) => ({ package: pkg, vulns: [] }));
  }
}
