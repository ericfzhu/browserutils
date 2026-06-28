declare global {
  interface Window {
    __browserUtilsBlobVideoHook?: boolean;
  }
}

const MESSAGE_SOURCE = 'browserutils:blob-video';

if (!window.__browserUtilsBlobVideoHook) {
  window.__browserUtilsBlobVideoHook = true;

  const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
  const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);

  URL.createObjectURL = (object: Blob | MediaSource) => {
    const url = originalCreateObjectUrl(object);

    try {
      const isBlob = object instanceof Blob;
      const type = isBlob ? object.type : '';
      const shouldIncludeBlob = isBlob && (
        type.startsWith('video/') ||
        type === 'application/octet-stream' ||
        type === ''
      );

      window.postMessage({
        source: MESSAGE_SOURCE,
        type: 'object-url-created',
        url,
        objectKind: object.constructor.name,
        mimeType: type,
        size: isBlob ? object.size : undefined,
        blob: shouldIncludeBlob ? object : undefined,
      }, window.location.origin);
    } catch {
      // Keep page behavior unchanged if metadata capture fails.
    }

    return url;
  };

  URL.revokeObjectURL = (url: string) => {
    try {
      window.postMessage({
        source: MESSAGE_SOURCE,
        type: 'object-url-revoked',
        url,
      }, window.location.origin);
    } catch {
      // Ignore messaging errors and still revoke the page's object URL.
    }

    originalRevokeObjectUrl(url);
  };
}

export {};
