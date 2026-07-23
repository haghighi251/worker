import axios from 'axios';
import { DependencyEcosystem } from '@aba/database';
import { queryOsvBatch, ScannablePackage } from '@domain/services/osvClient';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('queryOsvBatch', () => {
  const expressPkg: ScannablePackage = {
    id: 1,
    ecosystem: DependencyEcosystem.NPM,
    name: 'express',
    version: '4.18.2',
  };
  const djangoPkg: ScannablePackage = {
    id: 2,
    ecosystem: DependencyEcosystem.PYPI,
    name: 'django',
    version: '3.2.0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty array without calling OSV when given no packages', async () => {
    const result = await queryOsvBatch([]);

    expect(result).toEqual([]);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('maps ecosystems to OSV names and returns vulns per package', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        results: [
          { vulns: [{ id: 'GHSA-aaaa' }] },
          {},
        ],
      },
    });

    const result = await queryOsvBatch([expressPkg, djangoPkg]);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.osv.dev/v1/querybatch',
      {
        queries: [
          { package: { name: 'express', ecosystem: 'npm' }, version: '4.18.2' },
          { package: { name: 'django', ecosystem: 'PyPI' }, version: '3.2.0' },
        ],
      },
      { timeout: 15_000 },
    );
    expect(result).toEqual([
      { package: expressPkg, vulns: [{ id: 'GHSA-aaaa' }] },
      { package: djangoPkg, vulns: [] },
    ]);
  });

  it('falls back to the "other" ecosystem for an unmapped value', async () => {
    mockedAxios.post.mockResolvedValue({ data: { results: [{}] } });

    const weirdPkg: ScannablePackage = {
      id: 3,
      ecosystem: 'UNKNOWN' as DependencyEcosystem,
      name: 'mystery',
      version: '1.0.0',
    };

    await queryOsvBatch([weirdPkg]);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      { queries: [{ package: { name: 'mystery', ecosystem: 'other' }, version: '1.0.0' }] },
      expect.any(Object),
    );
  });

  it('fails open with empty vulns for every package when OSV is unreachable', async () => {
    mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await queryOsvBatch([expressPkg, djangoPkg]);

    expect(result).toEqual([
      { package: expressPkg, vulns: [] },
      { package: djangoPkg, vulns: [] },
    ]);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
