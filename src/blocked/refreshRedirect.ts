interface BlockCheckResult {
  blocked?: boolean;
  redirectUrl?: string;
}

export function getRefreshRedirect(
  currentUrl: string,
  returnUrl: string,
  result: BlockCheckResult | null | undefined
): string | null {
  if (result?.blocked === false) {
    return returnUrl;
  }

  if (
    result?.blocked === true &&
    result.redirectUrl &&
    result.redirectUrl !== currentUrl
  ) {
    return result.redirectUrl;
  }

  return null;
}
