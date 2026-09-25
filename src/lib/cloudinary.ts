import { createHash, randomBytes } from "node:crypto";

/**
 * The image store, and the only place the Cloudinary API secret is used.
 *
 * Two rules hold the whole module together. A picture is judged by the bytes it
 * arrives with rather than the type the browser claimed, because a claimed type
 * costs nothing to forge. And nothing leaves this file until the credentials
 * exist: when they do not, the caller is told the store is not configured rather
 * than watching a request fail for a reason nobody can read.
 */

/** Eight megabytes: the Cloudinary free tier takes more, a phone camera does not need to. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type ImageKind = "jpeg" | "png" | "webp";

export type UploadRejection = "file_too_large" | "not_an_image";

export type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

/** Where branch photographs live in the store, so a later cleanup can find them. */
export const GALLERY_FOLDER = "yca-sumsilui/gallery";

/**
 * The grid's copy: display width, its own shape, and only the format this
 * reader's browser takes.
 *
 * No height and no crop on purpose. The public gallery lays its pictures out in
 * columns, and a column only reads as one while a portrait picture stays tall —
 * cut every picture into the same box and the layout is an even grid wearing a
 * description it does not match.
 */
export const THUMB_TRANSFORM = "w_600,c_limit,f_auto,q_auto";

/** The viewer's copy: large enough to read a face in, never the file as taken. */
export const FULL_SIZE_TRANSFORM = "w_1200,c_limit,f_auto,q_auto";

const SIGNATURE_ALGORITHM = "sha1";

const CLOUDINARY_HOST = "res.cloudinary.com";

function startsWith(bytes: Uint8Array, at: number, magic: readonly number[]): boolean {
  if (bytes.length < at + magic.length) return false;
  return magic.every((byte, index) => bytes[at + index] === byte);
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46];
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50];

/**
 * The file extension and the declared MIME type are both written by whoever
 * named the file; these few leading bytes are the picture itself.
 */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, 0, PNG_MAGIC)) return "png";
  if (startsWith(bytes, 0, JPEG_MAGIC)) return "jpeg";
  if (startsWith(bytes, 0, RIFF_MAGIC) && startsWith(bytes, 8, WEBP_MAGIC)) return "webp";
  return null;
}

export function uploadRejection(
  sizeInBytes: number,
  kind: ImageKind | null,
): UploadRejection | null {
  if (sizeInBytes > MAX_UPLOAD_BYTES) return "file_too_large";
  if (kind === null) return "not_an_image";
  return null;
}

/**
 * Cloudinary signs a server-side upload by hashing its own sorted parameters
 * with the API secret appended. `file`, `cloud_name`, `api_key` and the empty
 * values are left out of the string, which is why the secret never travels.
 */
export function signatureFor(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash(SIGNATURE_ALGORITHM).update(`${toSign}${apiSecret}`).digest("hex");
}

/**
 * The store's own address, with one transformation written into its path.
 *
 * Only the image store understands a transformation there, so rewriting some
 * other host's address — or an address that is not a full one — would break the
 * picture rather than resize it.
 */
function withTransform(url: string, transform: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== CLOUDINARY_HOST) return url;
  const marker = "/upload/";
  const at = parsed.pathname.indexOf(marker);
  if (at === -1) return url;
  const rest = parsed.pathname.slice(at + marker.length);
  if (rest.split("/")[0] === transform) return url;
  parsed.pathname = `${parsed.pathname.slice(0, at + marker.length)}${transform}/${rest}`;
  return parsed.toString();
}

export function thumbUrlFor(url: string): string {
  return withTransform(url, THUMB_TRANSFORM);
}

/** Where the viewer opens a picture: readable, and not the file as uploaded. */
export function fullSizeUrlFor(url: string): string {
  return withTransform(url, FULL_SIZE_TRANSFORM);
}

/**
 * Read from the environment when an upload is attempted rather than at boot, so
 * the site runs — and says which screen is missing keys — before the branch has
 * signed up for the image store.
 */
export function readCredentials(): CloudinaryCredentials | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function newPublicId(): string {
  return `photo-${Date.now()}-${randomBytes(6).toString("hex")}`;
}

export type UploadedImage = { url: string; thumbUrl: string; publicId: string };

export async function uploadToCloudinary(
  bytes: Uint8Array,
  options: { folder?: string; publicId?: string } = {},
): Promise<UploadedImage> {
  const credentials = readCredentials();
  if (!credentials) throw new Error("upload_not_configured");
  const { folder = GALLERY_FOLDER, publicId = newPublicId() } = options;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = { folder, public_id: publicId, timestamp };
  const form = new FormData();
  form.set("file", new Blob([bytes as BlobPart]), publicId);
  form.set("api_key", credentials.apiKey);
  form.set("timestamp", timestamp);
  form.set("folder", folder);
  form.set("public_id", publicId);
  form.set("signature", signatureFor(params, credentials.apiSecret));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/image/upload`,
    { method: "POST", body: form },
  );
  const body = (await response.json().catch(() => null)) as { secure_url?: string } | null;
  if (!response.ok || !body?.secure_url) {
    throw new Error(`cloudinary_rejected_${response.status}`);
  }
  return { url: body.secure_url, thumbUrl: thumbUrlFor(body.secure_url), publicId };
}
