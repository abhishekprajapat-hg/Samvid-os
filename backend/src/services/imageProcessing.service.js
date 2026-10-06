const fs = require("fs/promises");
const path = require("path");
const logger = require("../config/logger");

/*
 * Downscales uploaded photographs before they are stored.
 *
 * The audit found a 14.9MB profile photo being downloaded to render a 44px
 * avatar, and a 5.7MB one behind it: originals were written to disk exactly as
 * the camera produced them. Every image is now re-encoded to a sane bound for
 * the place it will be shown.
 *
 * This is best-effort. If sharp cannot read the file (an unusual codec, or a
 * format we do not process) the original is left untouched - a large image is
 * better than a broken upload.
 */

// Category -> longest edge in pixels. Avatars are only ever shown small.
const MAX_EDGE_BY_CATEGORY = {
  "profile-images": 512,
  "inventory-images": 2000,
  "inventory-floorplans": 2400,
  "lead-documents": 2400,
  // ID scans and cheques must stay legible.
  "coworking-documents": 2400,
  chat: 1600,
};
const DEFAULT_MAX_EDGE = 1800;

// Animated formats lose their animation when re-encoded, so leave them alone.
const PROCESSABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

const maxEdgeFor = (category) => MAX_EDGE_BY_CATEGORY[category] || DEFAULT_MAX_EDGE;

const processUploadedImage = async ({ filePath, mimeType, category }) => {
  if (!PROCESSABLE.has(String(mimeType || "").toLowerCase())) return null;

  let sharp;
  try {
    // Required lazily so a missing optional binary cannot stop the server booting.
    sharp = require("sharp");
  } catch {
    return null;
  }

  try {
    const before = (await fs.stat(filePath)).size;
    const maxEdge = maxEdgeFor(category);

    const image = sharp(filePath, { failOn: "none" }).rotate(); // honour EXIF orientation
    const meta = await image.metadata();

    const needsResize = (meta.width || 0) > maxEdge || (meta.height || 0) > maxEdge;
    const isJpeg = String(mimeType).toLowerCase() === "image/jpeg";

    // Nothing to gain from re-encoding a small PNG/WebP that is already within bounds.
    if (!needsResize && !isJpeg) return null;

    const pipeline = image.resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });

    if (isJpeg) pipeline.jpeg({ quality: 82, mozjpeg: true });
    else if (String(mimeType).toLowerCase() === "image/png") pipeline.png({ compressionLevel: 9 });
    else pipeline.webp({ quality: 82 });

    // Write beside the original, then swap: a failure part-way through must not
    // leave a truncated file where the upload used to be.
    const tempPath = path.join(
      path.dirname(filePath),
      `.tmp-${path.basename(filePath)}`,
    );
    await pipeline.toFile(tempPath);

    const after = (await fs.stat(tempPath)).size;
    if (after >= before) {
      // Re-encoding made it bigger; keep what we had.
      await fs.unlink(tempPath).catch(() => {});
      return null;
    }

    await fs.rename(tempPath, filePath);
    return { before, after, maxEdge };
  } catch (error) {
    logger.warn({
      message: "Image post-processing skipped",
      filePath,
      error: error.message,
    });
    return null;
  }
};

module.exports = { processUploadedImage, MAX_EDGE_BY_CATEGORY, DEFAULT_MAX_EDGE };
