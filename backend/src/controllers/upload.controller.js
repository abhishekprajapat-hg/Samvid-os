exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const category = req.uploadCategory || "chat";
  const publicUrl = `${req.protocol}://${req.get("host")}/api/uploads/files/${category}/${req.file.filename}`;

  return res.status(201).json({
    url: publicUrl,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
};
