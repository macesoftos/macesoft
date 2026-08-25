import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { readFileSync } from "node:fs";
import {
  clientImageStorageProvider,
  cloudinaryPrivateDownloadUrl,
  cloudinaryReady,
  deleteCloudinaryImage,
  uploadCloudinaryImage,
} from "./cloudinaryStorage.js";

const environment = {
  CLIENT_IMAGE_STORAGE_PROVIDER: "cloudinary",
  CLOUDINARY_CLOUD_NAME: "clinic-cloud",
  CLOUDINARY_API_KEY: "123456",
  CLOUDINARY_API_SECRET: "server-secret",
  CLOUDINARY_FOLDER: "zenshotech/clinical",
};

test("Cloudinary is selected only for client profile and treatment photos", () => {
  assert.equal(clientImageStorageProvider("client-photo", environment), "cloudinary");
  assert.equal(clientImageStorageProvider("treatment-photo", environment), "cloudinary");
  assert.equal(clientImageStorageProvider("marketing-image", environment), "supabase");
  assert.equal(clientImageStorageProvider("client-photo", {}), "supabase");
  assert.equal(cloudinaryReady(environment), true);
});

test("client images upload as authenticated Cloudinary assets", async () => {
  let options;
  const client = {
    config() {},
    uploader: {
      upload_stream(nextOptions, callback) {
        options = nextOptions;
        const stream = new PassThrough();
        stream.on("data", () => {});
        stream.on("end", () => callback(null, { public_id: "zenshotech/clinical/client-photo/asset-1", bytes: 4 }));
        return stream;
      },
    },
  };
  const stored = await uploadCloudinaryImage({
    buffer: Buffer.from("test"),
    mimeType: "image/png",
    category: "client-photo",
    id: "asset-1",
    environment,
    // @ts-expect-error Minimal Cloudinary double for an isolated unit test.
    client,
  });
  assert.equal(options.type, "authenticated");
  assert.equal(options.resource_type, "image");
  assert.equal(options.overwrite, false);
  assert.equal(stored.storageProvider, "cloudinary");
  assert.equal(stored.objectPath, "zenshotech/clinical/client-photo/asset-1");
});

test("Cloudinary reads use short-lived private download URLs and deletes invalidate delivery", async () => {
  let urlOptions;
  let deleteOptions;
  const client = {
    config() {},
    utils: {
      private_download_url(publicId, format, options) {
        urlOptions = { publicId, format, ...options };
        return "https://api.cloudinary.com/private-download";
      },
    },
    uploader: {
      async destroy(_publicId, options) {
        deleteOptions = options;
        return { result: "ok" };
      },
    },
  };
  const url = cloudinaryPrivateDownloadUrl({
    objectPath: "zenshotech/clinical/treatment-photo/asset-2",
    mimeType: "image/jpeg",
    environment,
    // @ts-expect-error Minimal Cloudinary double for an isolated unit test.
    client,
    expiresAt: 12345,
  });
  assert.equal(url, "https://api.cloudinary.com/private-download");
  assert.deepEqual(urlOptions, {
    publicId: "zenshotech/clinical/treatment-photo/asset-2",
    format: "jpg",
    resource_type: "image",
    type: "authenticated",
    expires_at: 12345,
  });
  // @ts-expect-error Minimal Cloudinary double for an isolated unit test.
  assert.equal(await deleteCloudinaryImage("asset-2", { environment, client }), "ok");
  assert.deepEqual(deleteOptions, { resource_type: "image", type: "authenticated", invalidate: true });
});

test("client image provider migration is additive and delivery stays behind the authenticated proxy", () => {
  const migration = readFileSync(new URL("../prisma/migrations/20260826050000_add_upload_asset_storage_provider/migration.sql", import.meta.url), "utf8");
  const server = readFileSync(new URL("./index.js", import.meta.url), "utf8");
  const migrationScript = readFileSync(new URL("../scripts/migrate-client-images-to-cloudinary.mjs", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'supabase'/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
  assert.match(server, /app\.get\("\/api\/uploads\/:id"[\s\S]*assertReadAllowed[\s\S]*storedAssetRequest\(asset\)/);
  assert.match(server, /privateClientImage \? "private, no-store"/);
  assert.match(migrationScript, /process\.argv\.includes\("--apply"\)/);
  assert.match(migrationScript, /storageProvider: "cloudinary"/);
});
