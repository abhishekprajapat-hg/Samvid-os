const path = require("path");
const { processUploadedImage } = require("../services/imageProcessing.service");
const { uploadsRootDir } = require("../config/uploadStorage");

exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const category = req.uploadCategory || "chat";

  // Downscale photographs before they are ever served. Best-effort: a failure
  // here leaves the original in place rather than failing the upload.
  const resized = await processUploadedImage({
    filePath: path.join(uploadsRootDir, category, req.file.filename),
    mimeType: req.file.mimetype,
    category,
  });

  /*
   * A relative path, not an absolute one.
   *
   * This used to bake `${req.protocol}://${req.get("host")}` into the value
   * stored on the record, which pinned every historical upload to whatever host
   * happened to serve it - and, because the API host differs from the app host
   * in development, made the file cross-origin so the browser withheld the
   * file-access cookie. Relative keeps stored URLs portable across
   * environments and same-origin wherever the app is served.
   */
  const publicUrl = `/api/uploads/files/${category}/${req.file.filename}`;

  return res.status(201).json({
    url: publicUrl,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: resized?.after ?? req.file.size,
  });
};
