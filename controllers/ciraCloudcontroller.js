import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ helper: base64 -> { buffer, contentType, originalName }
const base64ToFile = (base64String, fallbackName = "upload.png") => {
  const s = String(base64String || "").trim();

  // supports: data:image/png;base64,AAAA
  const match = s.match(/^data:(.+);base64,(.*)$/);

  const contentType = match ? match[1] : "application/octet-stream";
  const b64 = match ? match[2] : s;

  const buffer = Buffer.from(b64, "base64");
  if (!buffer.length) throw new Error("Invalid base64 file.");

  let ext = "bin";
  if (contentType.includes("jpeg")) ext = "jpg";
  else if (contentType.includes("png")) ext = "png";
  else if (contentType.includes("pdf")) ext = "pdf";

  const originalName = `upload.${ext === "bin" ? "png" : ext}`;

  return { buffer, contentType, originalName };
};

export const saveFileToCloud = async (fileBuffer, contentType, originalName) => {
  try {
    console.log(
      "fileBuffer type:",
      typeof fileBuffer,
      "is Buffer:",
      fileBuffer instanceof Buffer,
      "length:",
      fileBuffer?.length
    );

    // ✅ FIX: store in /cira-cloud (project root or sibling directory)
    const localDirectory = path.join(__dirname, "../cira-cloud");
    if (!fs.existsSync(localDirectory)) {
      fs.mkdirSync(localDirectory, { recursive: true });
    }

    // ✅ extension detection
    let extension;
    if (contentType) {
      if (contentType.startsWith("image/jpeg")) extension = "jpg";
      else if (contentType.startsWith("image/png")) extension = "png";
      else if (contentType.startsWith("application/pdf")) extension = "pdf";
    }

    if (!extension && originalName) {
      const extFromName = originalName.split(".").pop().toLowerCase();
      if (["jpg", "jpeg", "png", "pdf"].includes(extFromName)) {
        extension = extFromName === "jpeg" ? "jpg" : extFromName;
      }
    }

    if (!extension) {
      throw new Error("Unsupported file type. Only JPG/PNG/PDF allowed.");
    }

    // ✅ unique filename
    const unique = crypto.randomBytes(10).toString("hex");
    const fileName = `file_${Date.now()}_${unique}.${extension}`;
    const filePath = path.join(localDirectory, fileName);

    await fs.promises.writeFile(filePath, fileBuffer);

    // ✅ FIX: return correct URL path => /cira-cloud/
    const backendUrl =
      process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

    const fileUrl = `${backendUrl}/cira-cloud/${fileName}`;
    return fileUrl;
  } catch (error) {
    console.error("Error storing file:", error);
    throw error;
  }
};

// ✅ NEW: save base64 using same controller
export const saveBase64ToCloud = async (base64String) => {
  const { buffer, contentType, originalName } = base64ToFile(base64String);
  return saveFileToCloud(buffer, contentType, originalName);
};
