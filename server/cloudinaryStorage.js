import { v2 as cloudinary } from "cloudinary";

export const cloudinaryClientImageCategories = new Set(["client-photo", "treatment-photo"]);

function clean(value) {
  return String(value ?? "").trim();
}

function formatForMimeType(mimeType) {
  const normalized = clean(mimeType).toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  throw new Error("Cloudinary client images must be JPEG, PNG, or WebP.");
}

export function clientImageStorageProvider(category, environment = process.env) {
  if (!cloudinaryClientImageCategories.has(clean(category))) return "supabase";
  return clean(environment.CLIENT_IMAGE_STORAGE_PROVIDER).toLowerCase() === "cloudinary"
    ? "cloudinary"
    : "supabase";
}

export function cloudinaryConfiguration(environment = process.env) {
  return {
    cloudName: clean(environment.CLOUDINARY_CLOUD_NAME),
    apiKey: clean(environment.CLOUDINARY_API_KEY),
    apiSecret: clean(environment.CLOUDINARY_API_SECRET),
    folder: clean(environment.CLOUDINARY_FOLDER).replace(/^\/+|\/+$/g, "") || "zenshotech/client-images",
  };
}

export function cloudinaryReady(environment = process.env) {
  const configuration = cloudinaryConfiguration(environment);
  return Boolean(configuration.cloudName && configuration.apiKey && configuration.apiSecret);
}

function configuredClient(environment, client) {
  const configuration = cloudinaryConfiguration(environment);
  if (!configuration.cloudName || !configuration.apiKey || !configuration.apiSecret) {
    throw new Error("Cloudinary client-image storage is not configured.");
  }
  client.config({
    cloud_name: configuration.cloudName,
    api_key: configuration.apiKey,
    api_secret: configuration.apiSecret,
    secure: true,
    signature_algorithm: "sha256",
  });
  return { client, configuration };
}

export async function uploadCloudinaryImage({
  buffer,
  mimeType,
  category,
  id,
  environment = process.env,
  client = cloudinary,
}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Cloudinary cannot upload an empty image.");
  if (!cloudinaryClientImageCategories.has(clean(category))) throw new Error("Cloudinary is limited to client image categories.");
  formatForMimeType(mimeType);
  const configured = configuredClient(environment, client);
  const result = await new Promise((resolve, reject) => {
    const stream = configured.client.uploader.upload_stream({
      resource_type: "image",
      type: "authenticated",
      folder: `${configured.configuration.folder}/${category}`,
      public_id: clean(id),
      overwrite: false,
      unique_filename: false,
      use_filename: false,
    }, (error, upload) => {
      if (error) reject(error);
      else resolve(upload);
    });
    stream.end(buffer);
  });
  if (!clean(result?.public_id)) throw new Error("Cloudinary did not return a public ID.");
  return {
    objectPath: clean(result.public_id),
    storageProvider: "cloudinary",
    byteSize: Number(result.bytes) || buffer.length,
  };
}

export function cloudinaryPrivateDownloadUrl({
  objectPath,
  mimeType,
  environment = process.env,
  client = cloudinary,
  expiresAt = Math.floor(Date.now() / 1000) + 60,
}) {
  const configured = configuredClient(environment, client);
  return configured.client.utils.private_download_url(clean(objectPath), formatForMimeType(mimeType), {
    resource_type: "image",
    type: "authenticated",
    expires_at: expiresAt,
  });
}

export async function fetchCloudinaryImage(asset, {
  environment = process.env,
  client = cloudinary,
  fetchImpl = fetch,
} = {}) {
  const url = cloudinaryPrivateDownloadUrl({
    objectPath: asset?.objectPath,
    mimeType: asset?.mimeType,
    environment,
    client,
  });
  return fetchImpl(url, { headers: { Accept: clean(asset?.mimeType) || "image/*" } });
}

export async function deleteCloudinaryImage(objectPath, {
  environment = process.env,
  client = cloudinary,
} = {}) {
  const configured = configuredClient(environment, client);
  const result = await configured.client.uploader.destroy(clean(objectPath), {
    resource_type: "image",
    type: "authenticated",
    invalidate: true,
  });
  return clean(result?.result).toLowerCase();
}
