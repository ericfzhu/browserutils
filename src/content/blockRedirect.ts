interface BlockRedirectResponse {
  blocked?: boolean;
  redirectUrl?: string;
}

export async function getBlockRedirect(
  url: string,
  sendMessage: (message: {
    type: 'CHECK_SITE_WITH_REDIRECT';
    payload: { url: string };
  }) => Promise<BlockRedirectResponse>
): Promise<string | null> {
  try {
    const response = await sendMessage({
      type: 'CHECK_SITE_WITH_REDIRECT',
      payload: { url },
    });
    return response?.blocked && response.redirectUrl ? response.redirectUrl : null;
  } catch {
    return null;
  }
}
