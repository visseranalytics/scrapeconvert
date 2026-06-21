import { isSafePublicUrl } from './url-safety';
import type { ScrapedImage } from './types';

// Before rendering any discovered image URL as a thumbnail in the user's own
// browser (a second egress the server SSRF guard never sees), filter it with the
// SAME shared rule set: http/https only, reject special-use IP literals in every
// encoding, localhost, credentials-in-url, non-standard ports. Do NOT fork the
// logic; this imports isSafePublicUrl from the shared module.
export function safeThumbnailUrls(images: ScrapedImage[]): ScrapedImage[] {
  return images.filter((img) => isSafePublicUrl(img.url).ok);
}
