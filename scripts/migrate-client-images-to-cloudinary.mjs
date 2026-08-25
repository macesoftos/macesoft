import "dotenv/config";
import { prisma } from "../server/prisma.js";
import {
  cloudinaryReady,
  deleteCloudinaryImage,
  uploadCloudinaryImage,
} from "../server/cloudinaryStorage.js";

const apply = process.argv.includes("--apply");
const categories = ["client-photo", "treatment-photo"];

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

function supabaseConfiguration() {
  return {
    baseUrl: required(process.env.STORAGE_BASE_URL, "STORAGE_BASE_URL").replace(/\/$/, ""),
    bucket: required(process.env.STORAGE_BUCKET, "STORAGE_BUCKET"),
    serviceKey: required(process.env.STORAGE_SERVICE_KEY, "STORAGE_SERVICE_KEY"),
  };
}

async function supabaseAssetRequest(objectPath, options = {}) {
  const configuration = supabaseConfiguration();
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return fetch(`${configuration.baseUrl}/storage/v1/object/${encodeURIComponent(configuration.bucket)}/${encodedPath}`, {
    ...options,
    headers: {
      apikey: configuration.serviceKey,
      Authorization: `Bearer ${configuration.serviceKey}`,
      ...(options.headers || {}),
    },
  });
}

async function migrateAsset(asset) {
  const source = await supabaseAssetRequest(asset.objectPath);
  if (!source.ok) throw new Error(`Source download returned ${source.status}.`);
  const buffer = Buffer.from(await source.arrayBuffer());
  const uploaded = await uploadCloudinaryImage({
    buffer,
    mimeType: asset.mimeType,
    category: asset.category,
    id: asset.id,
  });
  try {
    const changed = await prisma.uploadAsset.updateMany({
      where: { id: asset.id, storageProvider: "supabase", objectPath: asset.objectPath },
      data: { storageProvider: "cloudinary", objectPath: uploaded.objectPath, byteSize: uploaded.byteSize },
    });
    if (changed.count !== 1) throw new Error("Asset changed while it was being migrated.");
  } catch (error) {
    await deleteCloudinaryImage(uploaded.objectPath).catch(() => {});
    throw error;
  }
  const removed = await supabaseAssetRequest(asset.objectPath, { method: "DELETE" });
  if (!removed.ok && removed.status !== 404) {
    console.warn(`Migrated ${asset.id}, but the old Supabase copy returned ${removed.status} during cleanup.`);
  }
}

async function main() {
  if (String(process.env.CLIENT_IMAGE_STORAGE_PROVIDER || "").trim().toLowerCase() !== "cloudinary") {
    throw new Error("Set CLIENT_IMAGE_STORAGE_PROVIDER=cloudinary before migrating client images.");
  }
  if (!cloudinaryReady()) throw new Error("Cloudinary credentials are incomplete.");
  supabaseConfiguration();
  const assets = await prisma.uploadAsset.findMany({
    where: { category: { in: categories }, storageProvider: "supabase" },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${assets.length} existing client image${assets.length === 1 ? "" : "s"} eligible for Cloudinary migration.`);
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to copy, verify, switch, and remove each old object.");
    return;
  }
  let migrated = 0;
  for (const asset of assets) {
    try {
      await migrateAsset(asset);
      migrated += 1;
      console.log(`Migrated ${asset.id} (${migrated}/${assets.length}).`);
    } catch (error) {
      console.error(`Stopped at ${asset.id}: ${error.message}`);
      throw error;
    }
  }
  console.log(`Migration complete: ${migrated} client image${migrated === 1 ? "" : "s"} moved to Cloudinary.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
