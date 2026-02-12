
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import apiRoutes from "./routes/api.js";
import { saveFileToCloud } from "./controllers/ciraCloudcontroller.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" })); // base64 can be big
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ✅ API routes
app.use("/api", apiRoutes);
app.use("/cira-cloud", express.static(path.join(__dirname, "cira-cloud")));

// ✅ test route
app.get("/", (req, res) => {
  res.send("Cira Collection API is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
