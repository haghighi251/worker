import { DependencyEcosystem } from '@aba/database';
import { handlePackageScanMessage } from '@/infrastructure/kafka/consumers/packageScanConsumer';
import { queryOsvBatch } from '@domain/services/osvClient';
import { publishVulnerabilityFetched } from '@/infrastructure/kafka/producers/vulnerabilityFetchedProducer';

jest.mock('@domain/services/osvClient');
jest.mock('@/infrastructure/kafka/producers/vulnerabilityFetchedProducer');

const mockedQueryOsvBatch = queryOsvBatch as jest.Mock;
const mockedPublish = publishVulnerabilityFetched as jest.Mock;

describe('handlePackageScanMessage', () => {
  const validMessage = {
    scanId: 'scan-1',
    companyId: 10,
    serviceId: 20,
    packages: [{ id: 1, ecosystem: DependencyEcosystem.NPM, name: 'express', version: '4.18.2' }],
  };

  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('queries OSV and publishes a well-formed vulnerability.fetched message', async () => {
    mockedQueryOsvBatch.mockResolvedValue([
      {
        package: { id: 1, ecosystem: DependencyEcosystem.NPM, name: 'express', version: '4.18.2' },
        vulns: [{ id: 'GHSA-aaaa' }],
      },
    ]);

    await handlePackageScanMessage(JSON.stringify(validMessage));

    expect(mockedQueryOsvBatch).toHaveBeenCalledWith(validMessage.packages);
    expect(mockedPublish).toHaveBeenCalledWith({
      scanId: 'scan-1',
      companyId: 10,
      serviceId: 20,
      results: [
        {
          packageId: 1,
          ecosystem: DependencyEcosystem.NPM,
          name: 'express',
          version: '4.18.2',
          vulns: [{ id: 'GHSA-aaaa' }],
        },
      ],
    });
  });

  it('publishes an empty-vulns result when OSV found nothing', async () => {
    mockedQueryOsvBatch.mockResolvedValue([
      { package: validMessage.packages[0], vulns: [] },
    ]);

    await handlePackageScanMessage(JSON.stringify(validMessage));

    expect(mockedPublish).toHaveBeenCalledWith(
      expect.objectContaining({ results: [expect.objectContaining({ vulns: [] })] }),
    );
  });

  it('skips without calling OSV when the message is null', async () => {
    await handlePackageScanMessage(null);

    expect(mockedQueryOsvBatch).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('skips without calling OSV when the message is not valid JSON', async () => {
    await handlePackageScanMessage('{not json');

    expect(mockedQueryOsvBatch).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('skips without calling OSV when the message is missing required fields', async () => {
    await handlePackageScanMessage(JSON.stringify({ scanId: 'scan-1' }));

    expect(mockedQueryOsvBatch).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('logs and swallows the error instead of throwing when publishing fails', async () => {
    mockedQueryOsvBatch.mockResolvedValue([{ package: validMessage.packages[0], vulns: [] }]);
    mockedPublish.mockRejectedValue(new Error('broker unreachable'));

    await expect(handlePackageScanMessage(JSON.stringify(validMessage))).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to publish vulnerability.fetched'),
      'broker unreachable',
    );
  });
});
