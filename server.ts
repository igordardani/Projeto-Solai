import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import "dotenv/config";
import { google } from "googleapis";
import admin from "firebase-admin";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import { PDFDocument } from "pdf-lib";

import { Readable } from "stream";

import fs from "fs/promises";

import { initializeApp, getApps, getApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Lazy initialize Firestore
let db: admin.firestore.Firestore | null = null;

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  projectId?: string;
  databaseId?: string;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const err = error as any;
  const errInfo: FirestoreErrorInfo = {
    error: err.message || String(err),
    operationType,
    path
  };
  
  if (db) {
    const dbAny = db as any;
    errInfo.projectId = dbAny._projectId || dbAny.projectId;
    errInfo.databaseId = dbAny._databaseId?.database || dbAny.databaseId;
  }

  console.error("Firestore Error Object: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function getDb(): Promise<admin.firestore.Firestore> {
  if (db && getApps().length > 0) return db;

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const configContent = await fs.readFile(configPath, "utf8");
    const configData = JSON.parse(configContent);
    
    const projectId = configData.projectId;
    // The specific database ID from the console screenshot
    const databaseId = configData.firestoreDatabaseId || "ai-studio-90d09ce8-ee65-4e58-81b1-661c683f07ac";

    if (!projectId) throw new Error("PROJECT_ID_MISSING_IN_CONFIG");

    console.log(`[Firestore] Attempting Initialization: Project=${projectId}, DB=${databaseId}`);

    // Initialize without a name to use it as the [DEFAULT] app, or with clear config
    const app = initializeApp({ projectId });

    console.log(`[Firestore] Initializing. Project=${projectId}, DB=${databaseId}`);
    
    // Explicitly target the database
    if (databaseId && databaseId !== "(default)") {
      db = getFirestore(app, databaseId);
    } else {
      db = getFirestore(app);
    }

    try {
      // Test basic list capability
      const testSnap = await db.collection("_health").limit(1).get();
      console.log(`[Firestore] SUCCESS: Access verified. Docs: ${testSnap.size}`);
    } catch (dbErr: any) {
      console.error(`[Firestore] ACCESS ERROR: ${dbErr.message}`);
      // Fallback attempt: Try to list collections as a test
      try {
        const collections = await db.listCollections();
        console.log(`[Firestore] FALLBACK SUCCESS: Can list collections (${collections.length})`);
      } catch (e2: any) {
        console.error(`[Firestore] TOTAL FAILURE: ${e2.message}`);
        if (e2.message.includes("is not fully provisioned")) {
          console.error("-> The database might still be initializing.");
        }
      }
      throw dbErr;
    }

    return db;
  } catch (err: any) {
    console.error(`[Firestore] Initialization failed: ${err.message}`);
    // If we already have an app and it failed above, we might be in a bad state
    if (getApps().length === 0) {
      try {
        initializeApp();
        db = getFirestore();
        console.log("[Firestore] Fallback to default initialization (ADC)");
      } catch (e2) {
        console.error("[Firestore] ADC Fallback also failed");
      }
    }
    return db || getFirestore();
  }
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/auth/callback`
);

// Global cron job for the 20th of each month at 7:00 AM
cron.schedule("0 7 20 * *", async () => {
  console.log("Running monthly Energisa automation...");
  // This would iterate over users who have Energisa credentials set up
  // and trigger the sync process.
});

async function compressPDF(buffer: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(buffer);
    // Basic optimization: re-saving often reduces size if there's redundant metadata
    const compressedPdfBytes = await pdfDoc.save({ useObjectStreams: true });
    return Buffer.from(compressedPdfBytes);
  } catch (err) {
    console.error("Compression error:", err);
    return buffer; // Return original if failed
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Health check
  app.get("/api/health", async (req, res) => {
    try {
      const firestore = await getDb();
      const firestoreAny = firestore as any;
      const apps = getApps();
      
      const info: any = {
        status: "ok",
        projectId: firestoreAny._projectId || firestoreAny.projectId,
        databaseId: firestoreAny._databaseId?.database || firestoreAny.databaseId,
        time: new Date().toISOString()
      };

      try {
        const snap = await firestore.collection("_health").limit(1).get();
        info.firestoreQuery = "success";
      } catch (e: any) {
        info.firestoreQuery = `failed: ${e.message}`;
      }
      
      res.json(info);
    } catch (err: any) {
      console.error("Health check FATAL:", err);
      res.status(500).json({ status: "error", message: err.message, stack: err.stack });
    }
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
      const firestore = await getDb();
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
      const firestore = await getDb();
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
      const firestore = await getDb();
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

      // 3. Compress and Upload File
      let buffer = Buffer.from(fileBase64, "base64");
      buffer = await compressPDF(buffer);
      
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

  // --- ENERGISA AUTOMATION ROUTES ---
  app.post("/api/energisa/start", async (req, res) => {
    const { uid, cpf } = req.body;
    if (!uid || !cpf) return res.status(400).json({ error: "UID and CPF required" });
    
    console.log(`Starting sync for CPF: ${cpf}`);
    
    // Simulating Puppeteer: Browser would navigate to login, enter CPF, 
    // and extract contact methods.
    const mockMethods = [
      { id: "method_1", type: "sms", label: "17*****3033" },
      { id: "method_2", type: "sms", label: "17*****6310" },
      { id: "method_3", type: "email", label: "mmd*@hotmail.com" },
      { id: "method_4", type: "email", label: "mmd*@hotmail.com.br" }
    ];
    
    // In real implementation: 
    // const page = await browser.newPage();
    // await page.goto("https://servicos.energisa.com.br/login");
    // await page.type("#cpf", cpf);
    // await page.click("#login-btn");
    // const methods = await page.evaluate(...)
    
    res.json({ methods: mockMethods });
  });

  app.post("/api/energisa/select-method", async (req, res) => {
    const { uid, methodId } = req.body;
    if (!uid || !methodId) return res.status(400).json({ error: "Missing data" });

    console.log(`User selected method: ${methodId}`);
    
    // In real implementation: 
    // await page.click(`#${methodId}`);
    // Energisa sends SMS/Email
    
    res.json({ status: "sent" });
  });

  app.post("/api/energisa/verify-mfa", async (req, res) => {
    const { uid, code } = req.body;
    if (!uid || !code) return res.status(400).json({ error: "Missing data" });

    console.log(`Verifying code: ${code} for UID: ${uid}`);
    try {
      const firestore = await getDb();
      const currentApp = getApps().length > 0 ? getApp() : null;
      const currentProjectId = currentApp ? currentApp.options.projectId : "unknown";
      const currentDbId = (firestore as any)._databaseId?.database || "default";

      console.log(`Using Firestore project: ${currentProjectId} database: ${currentDbId}`);
      
      // Ensure user document exists (skeleton)
      try {
        const userDocRef = firestore.collection("users").doc(uid);
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
          console.log(`Creating user doc for ${uid}`);
          await userDocRef.set({
            userId: uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            syncedFromEnergisa: true
          });
        }
      } catch (e: any) {
        handleFirestoreError(e, OperationType.WRITE, `users/${uid}`);
      }

      // Simulating checking Energisa for the most recent bill (e.g., May 2026)
      const mockBillMonth = 5;
      const mockBillYear = 2026;

      const entriesRef = firestore.collection("users").doc(uid).collection("entries");
      let existing: admin.firestore.QuerySnapshot;
      try {
        existing = await entriesRef
          .where("month", "==", mockBillMonth)
          .where("year", "==", mockBillYear)
          .get();
      } catch (e: any) {
        handleFirestoreError(e, OperationType.GET, `users/${uid}/entries`);
        return; // Unreachable
      }

      if (!existing.empty) {
        return res.json({ 
          status: "success", 
          message: `Fatura de 05/2026 já está no sistema. Nada novo para baixar.` 
        });
      }

      // In a real crawl, the robot would download the PDF and update Firestore here.
      // For now, let's at least save a mock record so the user can see it in the database.
      const mockBillData = {
        userId: uid,
        month: mockBillMonth,
        year: mockBillYear,
        amount: 245.80, // Mock value
        discountValue: 12.50, // Mock value
        status: "paid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        syncedFromEnergisa: true,
        dueDate: "2026-05-15"
      };

      try {
        await entriesRef.add(mockBillData);
        console.log(`[Firestore] Successfully saved entry for 05/2026`);
      } catch (e: any) {
        handleFirestoreError(e, OperationType.CREATE, `users/${uid}/entries`);
      }

      res.json({ status: "success", message: "Fatura de 05/2026 importada com sucesso!" });
    } catch (err: any) {
      console.error("Firestore sync error:", err);
      // Log more details about the error code and project
      res.status(500).json({ 
        error: `Erro ao acessar Firestore: ${err.code} ${err.message}`,
        details: "Isso pode ocorrer se as permissões IAM do Firebase ainda estiverem propagando ou se o projeto configurado estiver incorreto."
      });
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

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    try {
      await getDb();
      console.log("Firestore initialized successfully on startup");
    } catch (e) {
      console.error("Delayed Firestore initialization failed:", e);
    }
  });
}

startServer();
