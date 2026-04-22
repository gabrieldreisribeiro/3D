import { resolveAssetUrl } from './api';

const DEFAULT_FAVICON = '/favicon.ico';

export function applySiteFavicon(url) {
  if (typeof document === 'undefined') return;
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;

  const href = resolveAssetUrl(url) || DEFAULT_FAVICON;
  let link = head.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'icon');
    head.appendChild(link);
  }
  link.setAttribute('href', href);
}

