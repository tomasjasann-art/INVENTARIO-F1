import { createClient } from "@supabase/supabase-js";

const BUCKET = "kardex-evidencias";
const PREFIX = "supabase://";

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    || process.env.SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function decodeImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if (!match) throw new Error("La evidencia debe ser una foto JPG, PNG o WEBP.");
  return {
    contentType: match[1].toLowerCase(),
    bytes: Buffer.from(match[2], "base64"),
  };
}

export async function storeEvidenceImage(value: string, folder: string) {
  if (!value || value.startsWith(PREFIX) || /^https?:\/\//i.test(value)) return value;
  const client = configuredClient();
  if (!client) return value;

  const { data: bucket } = await client.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error } = await client.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 8_000_000,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  }

  const image = decodeImage(value);
  const extension = image.contentType === "image/png" ? "png" : image.contentType === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from(BUCKET).upload(path, image.bytes, {
    contentType: image.contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return `${PREFIX}${BUCKET}/${path}`;
}

export async function resolveEvidenceImage(value: string) {
  if (!value.startsWith(PREFIX)) return value;
  const client = configuredClient();
  if (!client) return "";
  const marker = value.slice(PREFIX.length);
  const slash = marker.indexOf("/");
  if (slash < 1) return "";
  const bucket = marker.slice(0, slash);
  const path = marker.slice(slash + 1);
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return error ? "" : data.signedUrl;
}

export function isSupabaseStorageConfigured() {
  return Boolean(configuredClient());
}
