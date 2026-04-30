import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import "dotenv/config";
import { google } from "googleapis";
import admin from "firebase-admin";
import cookieParser from "cookie-parser";

import { Readable } from "stream";

// Lazy initialize Firebase Admin
let db: admin.firestore.Firestore | null = null;
function getDb() {
  if (!db) {
    if (!admin.apps.length) {
      // In AI Studio, the environment usually has what it needs if we just init
      // But we need the project ID. We can get it from the config or env.
      admin.initializeApp();
    }
    db = admin.firestore();
  }
  return db;
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/auth/callback`
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- GOOGLE OAUTH ROUTES ---
  app.get("/api/auth/google/url", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "UID required" });

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/drive.file"],
      state: uid as string,
    });
    res.json({ url });
  });

  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    const { code, state: uid } = req.query;
    if (!code || !uid) return res.send("Error: Missing code or state");

    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Store tokens in Firestore
      const firestore = getDb();
      await firestore.collection("users").doc(uid as string).collection("private").doc("googleTokens").set({
        tokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send success message to popup opener
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_DRIVE_CONNECTED' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Conexão com Google Drive realizada com sucesso! Você pode fechar esta janela.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/google/status", async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.json({ connected: false });

    try {
      const firestore = getDb();
      const doc = await firestore.collection("users").doc(uid as string).collection("private").doc("googleTokens").get();
      res.json({ connected: doc.exists });
    } catch (err) {
      res.json({ connected: false });
    }
  });

  // --- DRIVE UPLOAD ROUTE ---
  app.post("/api/drive/upload", async (req, res) => {
    const { uid, fileName, fileBase64, year, month } = req.body;
    if (!uid || !fileName || !fileBase64) return res.status(400).json({ error: "Missing data" });

    try {
      const firestore = getDb();
      const doc = await firestore.collection("users").doc(uid as string).collection("private").doc("googleTokens").get();
      if (!doc.exists) return res.status(401).json({ error: "Google Drive not connected" });

      const { tokens } = doc.data()!;
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      auth.setCredentials(tokens);

      const drive = google.drive({ version: "v3", auth });

      // 1. Find or Create "Energisa" folder
      let energisaFolderId = "";
      const energisaSearch = await drive.files.list({
        q: "name = 'Energisa' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: "files(id)",
      });
      if (energisaSearch.data.files?.length) {
        energisaFolderId = energisaSearch.data.files[0].id!;
      } else {
        const createEnergisa = await drive.files.create({
          requestBody: { name: "Energisa", mimeType: "application/vnd.google-apps.folder" },
          fields: "id",
        });
        energisaFolderId = createEnergisa.data.id!;
      }

      // 2. Find or Create Year folder inside Energisa
      let yearFolderId = "";
      const yearSearch = await drive.files.list({
        q: `name = '${year}' and '${energisaFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id)",
      });
      if (yearSearch.data.files?.length) {
        yearFolderId = yearSearch.data.files[0].id!;
      } else {
        const createYear = await drive.files.create({
          requestBody: { 
            name: String(year), 
            mimeType: "application/vnd.google-apps.folder",
            parents: [energisaFolderId],
          },
          fields: "id",
        });
        yearFolderId = createYear.data.id!;
      }

      // 3. Upload File
      const buffer = Buffer.from(fileBase64, "base64");
      const fileMetadata = {
        name: `${String(month).padStart(2, "0")}-${year}.pdf`,
        parents: [yearFolderId],
      };
      const media = {
        mimeType: "application/pdf",
        body: Readable.from(buffer),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, webViewLink, webContentLink",
      });

      res.json({ 
        fileId: response.data.id, 
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink
      });
    } catch (error) {
      console.error("Drive upload error:", error);
      res.status(500).json({ error: "Failed to upload to Drive" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
