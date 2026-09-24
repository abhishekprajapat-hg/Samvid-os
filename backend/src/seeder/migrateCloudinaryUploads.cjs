require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const axios = require("axios");
const { assertSeedAllowed } = require("./seedSafetyGuard.cjs");
const Inventory = require("../models/Inventory");
const Lead = require("../models/Lead");
const ChatMessage = require("../models/ChatMessage");

const DRY_RUN = process.argv.includes("--dry-run");
const CLOUDINARY_HOST_PATTERN = /cloudinary\.com/i;
const PUBLIC_ORIGIN = String(process.env.PUBLIC_ORIGIN || "http://localhost:5000").replace(/\/+$/, "");
const UPLOAD_DIR = path.isAbsolute(process.env.UPLOAD_DIR || "")
  ? process.env.UPLOAD_DIR
  : path.join(__dirname, "..", "..", String(process.env.UPLOAD_DIR || "uploads"));

const stats = { migrated: 0, skipped: 0, failed: 0 };

const isCloudinaryUrl = (value) => typeof value === "string" && CLOUDINARY_HOST_PATTERN.test(value);

const extensionFromUrl = (url, contentType) => {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(fromUrl)) return fromUrl;

  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "video/mp4": ".mp4",
  };
  return map[String(contentType || "").toLowerCase()] || "";
};

const downloadToDisk = async (url, category) => {
  const destDir = path.join(UPLOAD_DIR, category);
  fs.mkdirSync(destDir, { recursive: true });

  const response = await axios.get(url, { responseType: "stream", timeout: 30000 });
  const ext = extensionFromUrl(url, response.headers["content-type"]);
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const destPath = path.join(destDir, filename);

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return `${PUBLIC_ORIGIN}/api/uploads/files/${category}/${filename}`;
};

const migrateUrl = async (url, category, label) => {
  if (!isCloudinaryUrl(url)) {
    stats.skipped += 1;
    return url;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] would migrate ${label}: ${url}`);
    stats.migrated += 1;
    return url;
  }

  try {
    const newUrl = await downloadToDisk(url, category);
    console.log(`migrated ${label}: ${url} -> ${newUrl}`);
    stats.migrated += 1;
    return newUrl;
  } catch (error) {
    console.error(`failed ${label}: ${url} (${error.message})`);
    stats.failed += 1;
    return url;
  }
};

const migrateStringArrayField = async (doc, field, category) => {
  const values = Array.isArray(doc[field]) ? doc[field] : [];
  let changed = false;

  const nextValues = [];
  for (const value of values) {
    const nextValue = await migrateUrl(value, category, `Inventory:${doc._id}:${field}`);
    if (nextValue !== value) changed = true;
    nextValues.push(nextValue);
  }

  if (changed) {
    doc[field] = nextValues;
  }
  return changed;
};

const migrateInventory = async () => {
  const cursor = Inventory.find({}).cursor();
  for await (const doc of cursor) {
    const changedFlags = await Promise.all([
      migrateStringArrayField(doc, "images", "inventory-images"),
      migrateStringArrayField(doc, "documents", "inventory-documents"),
      migrateStringArrayField(doc, "floorPlans", "inventory-floorplans"),
      migrateStringArrayField(doc, "videoTours", "inventory-documents"),
    ]);

    if (!DRY_RUN && changedFlags.some(Boolean)) {
      await doc.save();
    }
  }
};

const migrateLeads = async () => {
  const cursor = Lead.find({ "closureDocuments.0": { $exists: true } }).cursor();
  for await (const doc of cursor) {
    let changed = false;

    for (const closureDoc of doc.closureDocuments || []) {
      const nextUrl = await migrateUrl(closureDoc.url, "lead-documents", `Lead:${doc._id}:closureDocuments`);
      if (nextUrl !== closureDoc.url) {
        closureDoc.url = nextUrl;
        changed = true;
      }
    }

    if (!DRY_RUN && changed) {
      doc.markModified("closureDocuments");
      await doc.save();
    }
  }
};

const migrateChatMessages = async () => {
  const cursor = ChatMessage.find({ "mediaAttachments.0": { $exists: true } }).cursor();
  for await (const doc of cursor) {
    let changed = false;

    for (const media of doc.mediaAttachments || []) {
      const nextUrl = await migrateUrl(media.url, "chat", `ChatMessage:${doc._id}:mediaAttachments`);
      if (nextUrl !== media.url) {
        media.url = nextUrl;
        changed = true;
      }
    }

    if (!DRY_RUN && changed) {
      doc.markModified("mediaAttachments");
      await doc.save();
    }
  }
};

const run = async () => {
  assertSeedAllowed({ scriptName: "migrateCloudinaryUploads", destructive: true });

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. dry-run=${DRY_RUN} publicOrigin=${PUBLIC_ORIGIN} uploadDir=${UPLOAD_DIR}`);

  await migrateInventory();
  await migrateLeads();
  await migrateChatMessages();

  console.log(`Done. migrated=${stats.migrated} skipped=${stats.skipped} failed=${stats.failed}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
