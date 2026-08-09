interface BlockCheckResult {
  blocked?: boolean;
  redirectUrl?: string;
}

export interface BlockedPageParams {
  type: string | null;
  siteId: string | null;
  limitId: string | null;
  returnUrl: string | null;
}

export function parseBlockedPageParams(search: string, hash: string): BlockedPageParams {
  const query = new URLSearchParams(search);
  if (query.has('site') || query.has('limitId') || query.has('returnUrl')) {
    return {
      type: query.get('type'),
      siteId: query.get('site'),
      limitId: query.get('limitId'),
      returnUrl: query.get('returnUrl'),
    };
  }

  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const returnMarker = '&returnUrl=';
  const markerIndex = rawHash.indexOf(returnMarker);
  const metadata = new URLSearchParams(markerIndex >= 0 ? rawHash.slice(0, markerIndex) : rawHash);
  return {
    type: metadata.get('type'),
    siteId: metadata.get('site'),
    limitId: metadata.get('limitId'),
    returnUrl: markerIndex >= 0 ? rawHash.slice(markerIndex + returnMarker.length) : null,
  };
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
