interface RuntimeFailure {
  success: false;
  error?: string;
}

export function assertRuntimeMutationSucceeded(
  response: unknown,
  fallbackMessage: string
): void {
  if (response === undefined || response === null) {
    throw new Error(fallbackMessage);
  }

  if (
    typeof response === 'object' &&
    'success' in response &&
    (response as RuntimeFailure).success === false
  ) {
    throw new Error((response as RuntimeFailure).error || fallbackMessage);
  }
}
