// import express from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import apiRoutes from './routes/api.js';
// import cloudController from "./controllers/ciraCloudcontroller"
// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());

// // Routes
// app.use('/api', apiRoutes);
// app.use('/cira-cloud', (req, res, next) => {
//     const filePath = path.join(__dirname, 'bsi-cloud', req.path);
//     res.sendFile(filePath, (err) => {
//       if (err) {
//         console.error('Error serving file:', err);
//         res.status(err.status || 500).send('File not found');
//       }
//     });
//   });
//   app.put('/cira-cloud-upload/:filename', express.raw({
//     type: (req) => {
//       // If no content type header is provided, allow the request and let the saveFileToCloud handle it
//       const contentType = req.headers['content-type'];
//       if (!contentType) return true;
      
//       // Allow JPEG, PNG, and PDF types (using startsWith to be flexible)
//       return contentType.startsWith('image/jpeg') ||
//              contentType.startsWith('image/png') ||
//              contentType.startsWith('application/pdf');
//     },
//     limit: '50mb'
//   }), async (req, res) => {
//     try {
//       const fileBuffer = req.body; 
//       if (!fileBuffer || !fileBuffer.length) {
//         return res.status(400).send('No file uploaded.');
//       }
      
//       // Pass the content type and the filename from the URL to the controller
//       const contentType = req.headers['content-type'];
//       const originalName = req.params.filename;  // e.g., "example.jpg" or "document.pdf"
//       const fileUrl = await cloudController.saveFileToCloud(fileBuffer, contentType, originalName);
  
//       // Return the URL where the file is accessible.
//       res.status(200).json({ message: 'File successfully uploaded.', fileUrl });
//     } catch (error) {
//       console.error('Error in upload route:', error);
//       res.status(500).send(error.message || 'Error uploading file.');
//     }
//   });
// app.get('/', (req, res) => {
//     res.send('Cira Collection API is running');
// });

// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });
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
