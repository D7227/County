import { generateVariations } from "./utils/variations";
import * as fs from "fs";
import * as path from "path";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import { insertCountySettingSchema } from "@shared/schema";
import fetch from "node-fetch";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Protected route middleware for API
  app.use("/api", (req, res, next) => {
    const publicPaths = ["/login", "/register", "/user"];
    if (publicPaths.some(p => req.path.startsWith(p)) || req.isAuthenticated()) {
      return next();
    }
    res.sendStatus(401);
  });

  // Upload Endpoint
  app.post(api.uploads.create.path, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Create upload record
      const newUpload = await storage.createUpload({
        filename: req.file.originalname,
      });

      // Parse Excel
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });

      // Helper to format date as DD/MM/YYYY
      // input is likely M/D/YYYY from Excel e.g. "7/8/2025" or "12/30/2025"
      const formatDate = (val: any): string | null => {
        if (!val) return null;
        const str = String(val).trim();

        // Try parsing M/D/Y
        const parts = str.split('/');
        if (parts.length === 3) {
          const m = parseInt(parts[0]);
          const d = parseInt(parts[1]);
          const y = parseInt(parts[2]);

          if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
            const day = d.toString().padStart(2, '0');
            const month = m.toString().padStart(2, '0');
            let year = y;
            if (year < 100) year += 2000;
            return `${day}/${month}/${year}`;
          }
        }

        // Fallback: Date parse
        const date = new Date(val);
        if (isNaN(date.getTime())) return str;

        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      // Create scrape items
      const itemsToInsert = jsonData.map((row: any) => {
        // Format Prior Effective Date if present
        if (row["Prior Effective Date"]) {
          row["Prior Effective Date"] = formatDate(row["Prior Effective Date"]);
        }

        const partyFields = [
          "Party Name 1",
          "Party Name 2",
          "Party Name 3",
          "Party Name 4"
        ];

        const partyVariations: Record<string, string[]> = {};
        const partyCounts: Record<string, number> = {};

        partyFields.forEach(field => {
          const rawName = row[field];
          // Ensure it's a string if it exists
          const nameStr = rawName ? String(rawName) : null;
          const vars = generateVariations(nameStr);

          partyVariations[field] = vars;
          partyCounts[field] = vars.length;
        });

        // Add to the row data
        row.party_variations = partyVariations;
        row.party_variation_count = partyCounts;

        return {
          uploadId: newUpload.id,
          data: row,
          status: "pending",
        };
      });

      await storage.createScrapeItems(itemsToInsert);

      res.status(201).json({
        message: "Upload successful",
        uploadId: newUpload.id,
        count: itemsToInsert.length
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      res.status(500).json({ message: "Internal server error during upload", error: err.message });
    }
  });

  // List Uploads
  app.get(api.uploads.list.path, async (req, res) => {
    const uploads = await storage.getUploads();
    res.json(uploads);
  });

  // List Items
  app.get(api.scrapeItems.list.path, async (req, res) => {
    const uploadId = req.query.uploadId ? parseInt(req.query.uploadId as string) : undefined;
    const status = req.query.status as string;
    const items = await storage.getScrapeItems(uploadId, status);
    res.json(items);
  });

  // Delete Item
  app.delete(api.scrapeItems.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteScrapeItem(id);
    if (!deleted) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Item deleted" });
  });

  // Delete Upload
  app.delete(api.uploads.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const deleted = await storage.deleteUpload(id);
    if (!deleted) return res.status(404).json({ message: "Upload not found" });
    res.json({ message: "Upload deleted" });
  });

  // Update Item Status
  app.patch(api.scrapeItems.updateStatus.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.scrapeItems.updateStatus.input.parse(req.body);

      const updated = await storage.updateScrapeItemStatus(id, input.status, input.result, input.lotStatus, input.partyStatus);

      if (!updated) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Start All
  app.post(api.scrapeItems.startAll.path, async (req, res) => {
    try {
      const input = api.scrapeItems.startAll.input.parse(req.body);
      const count = await storage.startAllScrapeItems(input.uploadId);
      res.json({ message: "Started processing", count });
    } catch (err) {
      console.error("Start all error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Webhook Start (New Endpoint)
  app.post("/api/scrape-items/start-webhook", async (req, res) => {
    try {
      const { id, selectedVariations } = req.body;
      const item = await storage.getScrapeItem(id);

      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Construct Payload
      const payload: any[] = [];
      const data = item.data as any; // The original row data (e.g. "File Number", "State", etc.)

      // Helper to push a variation to the payload
      const pushVariation = (partyType: string, ownerName: string) => {
        // Clone the original data
        const entry = { ...data };

        // Add required fields for the webhook
        entry["row_number"] = item.id;
        entry["Party Type"] = partyType;
        entry["Owner/Borrower Name"] = ownerName;

        // Add defaults if missing (as per user example)
        if (!entry["Town/Lot/Block User Status"]) entry["Town/Lot/Block User Status"] = "Out_Couty";
        if (!entry["Party User Status"]) entry["Party User Status"] = "Done";
        if (!entry["Town/Lot/Block status"]) entry["Town/Lot/Block status"] = "Out_Couty";
        if (!entry["party status"]) entry["party status"] = "Out_Couty";
        if (!entry["party"]) entry["party"] = "Out_Couty";
        if (!entry["Town/Lot/Block"]) entry["Town/Lot/Block"] = "Out_Couty";

        // Remove our internal fields if we don't want to send them
        delete entry.party_variations;
        delete entry.party_variation_count;

        payload.push(entry);
      };

      const partyFields = ["Party Name 1", "Party Name 2", "Party Name 3", "Party Name 4"];

      partyFields.forEach(field => {
        const key = `${item.id}-${field}`;
        // If user selected variations in UI, use those
        const userSelected = selectedVariations?.[key];

        if (userSelected && Array.isArray(userSelected) && userSelected.length > 0) {
          // Send selected variations
          userSelected.forEach(v => pushVariation(field, v));
        } else {
          // If no selection, maybe send the original name if it exists?
          // Or send all variations? 
          // Defaulting to: If logic exists, send ALL generated variations.
          const generated = (data.party_variations as any)?.[field];
          if (generated && Array.isArray(generated) && generated.length > 0) {
            generated.forEach(v => pushVariation(field, v));
          } else if (data[field]) {
            // Just the raw name
            pushVariation(field, data[field]);
          }
        }
      });

      console.log(`Sending webhook payload for item #${id}:`, JSON.stringify(payload, null, 2));

      // Send to n8n Webhook
      const response = await fetch("https://n8n.srv1232587.hstgr.cloud/webhook/fddd5375-8d87-48e7-878e-f324c2fd6650", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`n8n webhook failed with status ${response.status}`);
      }

      const responseData = await response.json();
      console.log("n8n response:", JSON.stringify(responseData, null, 2));

      // Determine final status
      // We expect an array or object. We look for "Party User Status" == "completed"
      let newStatus: "pending" | "processing" | "completed" | "failed" = "processing";
      let resultStr = "";

      // Helper to check a single item
      const checkItem = (item: any) => {
        if (item && item["Party User Status"] === "completed") {
          return true;
        }
        return false;
      };

      if (Array.isArray(responseData)) {
        if (responseData.length > 0 && checkItem(responseData[0])) {
          newStatus = "completed";
        }
        resultStr = JSON.stringify(responseData);
      } else if (typeof responseData === 'object' && responseData !== null) {
        if (checkItem(responseData)) {
          newStatus = "completed";
        }
        resultStr = JSON.stringify(responseData);
      }

      // Update local status with the result
      await storage.updateScrapeItemStatus(id, newStatus, resultStr);

      res.json({ message: "Webhook triggered", count: payload.length, status: newStatus });
    } catch (err: any) {
      console.error("Webhook error:", err);
      res.status(500).json({ message: "Internal server error", error: err.message });
    }
  });

  // Direct Lot Scrape (Hits Python port 5001 /scrape)
  app.post("/api/scrape-items/lot-scrape", async (req, res) => {
    const { id } = req.body;
    try {
      if (!id) return res.status(400).json({ message: "ID is required" });
      const item = await storage.getScrapeItem(id);
      if (!item) return res.status(404).json({ message: "Item not found" });

      const data = item.data as any;
      const township = (data["Township"] || data["Townsnhip"] || data["township"] || "").toUpperCase();
      const county = (data["County"] || "").toUpperCase();

      // Fetch dynamic settings for this county
      const countySetting = await storage.getCountySettingByName(county);
      const site_url = data["site_url"] || countySetting?.searchUrl || "https://clerk.mercercounty.org/records/search/advanced";

      const payload = {
        township,
        lot: data["Lot"] || "",
        block: data["Block"] || "",
        party_name: "", // Do not pass party name for Lot/Block search
        file_number: data["File Number"] || "",
        date: data["Prior Effective Date"] || "",
        site_url,
        county: county,
        vpn_required: countySetting?.vpnRequired === 1
      };

      console.log(`Triggering direct Lot Scrape for item #${id}:`, payload);

      // Mark as processing in DB immediately
      await storage.updateScrapeItemStatus(id, "processing", undefined, "processing");

      const response = await fetch("http://localhost:5001/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}) as any) as any;
        throw new Error(`Python scrape failed: ${errorData.message || response.statusText}`);
      }
      const result = await response.json() as any;

      // Mapping: Both successful finds and "Data Not Found" should count as 'completed'
      // Only real scraper errors should stay as 'failed'
      const finalStatus = (result.status === "PDF_FOUND_SUCCESSFULLY" || result.status === "DATA_NOT_FOUND")
        ? "completed"
        : "failed";

      // Global remains processing since Party is next, but Lot is done
      await storage.updateScrapeItemStatus(id, "processing", JSON.stringify(result), finalStatus);
      res.json(result);
    } catch (err: any) {
      console.error("Lot scrape error:", err);
      // Ensure we mark it as failed in DB so it doesn't stay 'processing' forever
      if (id) {
        await storage.updateScrapeItemStatus(id, "failed", JSON.stringify({ error: err.message, status: "ERROR" }), "failed");
      }
      res.status(500).json({ message: err.message });
    }
  });

  // Direct Party Scrape (Hits Python port 5001 /search-document)
  app.post("/api/scrape-items/party-scrape", async (req, res) => {
    const { id, selectedVariations } = req.body;
    try {
      if (!id) return res.status(400).json({ message: "ID is required" });
      const item = await storage.getScrapeItem(id);
      if (!item) return res.status(404).json({ message: "Item not found" });

      const data = item.data as any;
      const county = (data["County"] || "").toUpperCase();

      // Fetch dynamic settings for this county
      const countySetting = await storage.getCountySettingByName(county);
      const site_url = data["site_url"] || countySetting?.searchUrl || "https://clerk.mercercounty.org/records/search/advanced";

      // Use any variation passed in selectedVariations, otherwise fallback to any detected Party Name column
      let ownerName = "";
      if (selectedVariations) {
        // Find the first (and likely only) variation sent for this specific request
        const firstKey = Object.keys(selectedVariations)[0];
        if (firstKey && selectedVariations[firstKey].length > 0) {
          ownerName = selectedVariations[firstKey][0];
        }
      }

      if (!ownerName) {
        // Dynamic Fallback: Scan all keys for "Party Name" (case-insensitive)
        const partyFieldRegex = /party.*name/i;
        const partyKeys = Object.keys(data).filter(k => partyFieldRegex.test(k)).sort();
        if (partyKeys.length > 0) {
          ownerName = data[partyKeys[0]] || "";
        }
      }

      const payload = {
        party_name: ownerName,
        township: data["Township"] || data["Townsnhip"] || data["township"] || "",
        from_date: data["Prior Effective Date"] || "",
        file_number: data["File Number"] || "",
        site_url,
        folder_name: data["folder_name"] || ownerName,
        county: county,
        vpn_required: countySetting?.vpnRequired === 1
      };

      console.log(`Triggering direct Party Scrape for item #${id}:`, payload);

      // Mark as processing in DB immediately
      await storage.updateScrapeItemStatus(id, "processing", undefined, undefined, "processing");

      const response = await fetch("http://localhost:5001/search-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}) as any) as any;
        throw new Error(`Python search-document failed: ${errorData.message || response.statusText}`);
      }
      const result = await response.json() as any;

      // Mapping: Both successful finds and "Data Not Found" should count as 'completed'
      const finalStatus = (result.status === "PDF_FOUND_SUCCESSFULLY" || result.status === "DATA_NOT_FOUND")
        ? "completed"
        : "failed";

      // Global status is MANAGED BY FRONTEND during batch scrapes to avoid race conditions.
      // We only update the party-specific status and the result data here.
      await storage.updateScrapeItemStatus(id, "processing", JSON.stringify(result), undefined, finalStatus);
      res.json(result);
    } catch (err: any) {
      console.error("Party scrape error:", err);
      // Ensure we mark it as failed in DB so it doesn't stay 'processing' forever
      if (id) {
        await storage.updateScrapeItemStatus(id, "failed", JSON.stringify({ error: err.message, status: "ERROR" }), undefined, "failed");
      }
      res.status(500).json({ message: err.message });
    }
  });

  // File System Routes
  app.get("/api/fs/list", async (req, res) => {
    try {
      const relPath = (req.query.path as string) || "";
      // Security check
      if (relPath.includes("..")) {
        return res.status(400).json({ message: "Invalid path" });
      }

      const baseDir = path.join(process.cwd(), "../auto/auto");
      const targetPath = path.join(baseDir, relPath);

      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ message: "Path not found" });
      }

      const stats = await fs.promises.stat(targetPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ message: "Not a directory" });
      }

      const files = await fs.promises.readdir(targetPath, { withFileTypes: true });

      const contents = files
        .filter(dirent => {
          // If we are at the root, filter out non-county directories and files
          if (!relPath) {
            if (!dirent.isDirectory()) return false;
            const blocked = ['__pycache__', 'blueprints', 'services', 'utils', 'node_modules', '.git'];
            if (blocked.includes(dirent.name)) return false;
            return true;
          }
          return true;
        })
        .map(dirent => ({
          name: dirent.name,
          isDirectory: dirent.isDirectory(),
          path: path.join(relPath, dirent.name).replace(/\\/g, "/")
        }));

      res.json(contents);
    } catch (err: any) {
      console.error("FS List error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/fs/download", async (req, res) => {
    try {
      const relPath = (req.query.path as string);
      if (!relPath || relPath.includes("..")) {
        return res.status(400).json({ message: "Invalid path" });
      }

      const baseDir = path.join(process.cwd(), "../auto/auto");
      const targetPath = path.join(baseDir, relPath);

      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ message: "File not found" });
      }

      const isPreview = req.query.preview === 'true';
      if (isPreview) {
        res.sendFile(targetPath);
      } else {
        res.download(targetPath);
      }
    } catch (err: any) {
      console.error("FS Download error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // County Settings Routes
  app.get("/api/county-settings", async (_req, res) => {
    const settings = await storage.getCountySettings();
    res.json(settings);
  });

  app.post("/api/county-settings", async (req, res) => {
    try {
      const data = insertCountySettingSchema.parse(req.body);
      const newSetting = await storage.createCountySetting(data);
      res.json(newSetting);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/county-settings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateCountySetting(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/county-settings/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteCountySetting(id);
    res.json({ success: true });
  });

  // PDF Extraction Route
  app.post("/api/extract-details", async (req, res) => {
    const { fileNumber } = req.body;
    try {
      if (!fileNumber) return res.status(400).json({ message: "fileNumber is required" });

      console.log(`Triggering PDF extraction for file number: ${fileNumber}`);

      // Check if we already have it in the database
      const existingDetails = await storage.getExtractedDetails(fileNumber);
      if (existingDetails && existingDetails.length > 0) {
        return res.json({
          message: "Extraction loaded from database",
          total_files: existingDetails.length,
          results: existingDetails
        });
      }

      const response = await fetch("http://localhost:5001/extract_by_file_number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_number: fileNumber })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}) as any) as any;
        throw new Error(`Flask extraction failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json() as any;
      const extractedData = result.data || [];

      // Store results in DB
      const storedResults = [];
      for (const item of extractedData) {
        const detail = await storage.createExtractedDetail({
          fileNumber: fileNumber,
          sourceFile: item.SOURCE_FILE,
          documentType: item.DOCUMENT_TYPE,
          grantor: item.GRANTOR,
          grantee: item.GRANTEE,
          instrumentNumber: item.INSTRUMENT_NUMBER,
          recordingDate: item.RECORDING_DATE,
          datedDate: item.DATED_DATE,
          considerationAmount: item.CONSIDERATION_AMOUNT ? String(item.CONSIDERATION_AMOUNT) : null,
          book: item.BOOK,
          pageNo: item.PAGENO,
          legalDescription: item.LEGAL_DESCRIPTION,
          data: item
        });
        storedResults.push(detail);
      }

      res.json({
        message: "Extraction completed and stored",
        total_files: result.total_files_processed,
        results: storedResults
      });
    } catch (err: any) {
      console.error("Extraction error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}

