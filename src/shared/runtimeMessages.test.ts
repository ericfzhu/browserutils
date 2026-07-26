import { describe, expect, it } from 'vitest';
import { assertRuntimeMutationSucceeded } from './runtimeMessages';

describe('assertRuntimeMutationSucceeded', () => {
  it('accepts successful acknowledgements and returned entities', () => {
    expect(() => assertRuntimeMutationSucceeded({ success: true }, 'Failed')).not.toThrow();
    expect(() => assertRuntimeMutationSucceeded({ id: 'created-1' }, 'Failed')).not.toThrow();
  });

  it('throws the background error for an explicit failure', () => {
    expect(() =>
      assertRuntimeMutationSucceeded({ success: false, error: 'Authentication required' }, 'Failed')
    ).toThrow('Authentication required');
  });

  it('rejects a missing response', () => {
    expect(() => assertRuntimeMutationSucceeded(undefined, 'No response')).toThrow('No response');
  });
});
