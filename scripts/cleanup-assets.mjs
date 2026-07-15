import "dotenv/config";
import { prisma } from "../server/prisma.js";

const baseUrl = String(process.env.STORAGE_BASE_URL || "").replace(/\/$/, "");
const bucket = String(process.env.STORAGE_BUCKET || "");
const serviceKey = String(process.env.STORAGE_SERVICE_KEY || "");
if (!baseUrl || !bucket || !serviceKey) throw new Error("Object storage configuration is required.");

const [clients, staff, inventory, branches, expenses, corrections] = await Promise.all([
  prisma.client.findMany({ select: { photo: true } }),
  prisma.staffMember.findMany({ select: { photo: true } }),
  prisma.inventoryItem.findMany({ select: { image: true } }),
  prisma.branch.findMany({ select: { image: true } }),
  prisma.expense.findMany({ select: { receipt: true } }),
  prisma.faceTrackCorrectionRequest.findMany({ select: { attachmentUrl: true } }),
]);
const references = new Set(
  [...clients.map((item) => item.photo), ...staff.map((item) => item.photo), ...inventory.map((item) => item.image),
    ...branches.map((item) => item.image), ...expenses.map((item) => item.receipt), ...corrections.map((item) => item.attachmentUrl)]
    .map((value) => String(value || "").match(/^\/api\/uploads\/([^/]+)$/)?.[1])
    .filter(Boolean),
);
const cutoff = new Date(Date.now() - Math.max(1, Number(process.env.ASSET_ORPHAN_GRACE_HOURS || 24)) * 3_600_000);
const orphans = await prisma.uploadAsset.findMany({ where: { id: { notIn: [...references] }, createdAt: { lt: cutoff } } });
let removed = 0;
for (const asset of orphans) {
  const path = asset.objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Storage refused cleanup for asset ${asset.id}.`);
  await prisma.uploadAsset.delete({ where: { id: asset.id } });
  removed += 1;
}
console.log(JSON.stringify({ event: "asset_cleanup_completed", scanned: orphans.length, removed }));
await prisma.$disconnect();
