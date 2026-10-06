import type { ProviderId } from '@opervio/contracts';
import type { ProviderAdapter } from './types';

/** Placeholder; replaced by the scripted test provider. */
export function fakeProvider(id: ProviderId): ProviderAdapter {
  return {
    id,
    label: `Fake ${id}`,
    efforts: ['low', 'medium', 'high', 'xhigh'],
    models: [{ id: 'default', label: 'Default' }],
    detect: async () => ({ available: true, version: 'fake', error: null }),
    run: () => {
      throw new Error('fake provider not implemented');
    },
  };
}
