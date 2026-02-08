import express from "express";
import { saveFileToCloud } from "../controllers/ciraCloudcontroller.js";

const router = express.Router();

router.put(
  "/upload/:filename",
  express.raw({ type: () => true, limit: "50mb" }),
  async (req, res) => {
    try {
      const fileBuffer = req.body;
      const contentType = req.headers["content-type"];
      const originalName = req.params.filename;

      const fileUrl = await saveFileToCloud(fileBuffer, contentType, originalName);

      return res.json({ message: "Uploaded", fileUrl });
    } catch (e) {
      return res.status(500).json({ message: "Upload failed", error: e.message });
    }
  }
);

export default router;
