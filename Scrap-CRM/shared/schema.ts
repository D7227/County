import { mysqlTable, text, int, json, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  username: text("username").notNull(),
  password: text("password").notNull(),
});

export const uploads = mysqlTable("uploads", {
  id: int("id").primaryKey().autoincrement(),
  filename: text("filename").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scrapeItems = mysqlTable("scrape_items", {
  id: int("id").primaryKey().autoincrement(),
  uploadId: int("upload_id").references(() => uploads.id),
  // Explicitly defining the required Excel columns for reference
  // though we still use JSON for flexible storage of those specific keys
  data: json("data").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  lotStatus: text("lot_status").notNull().default("pending"),
  partyStatus: text("party_status").notNull().default("pending"),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Explicit schema for the required Excel columns
export const excelRowSchema = z.object({
  "File Number": z.any(),
  "State": z.any(),
  "County": z.any(),
  "Party Name 1": z.any(),
  "Party Name 2": z.any(),
  "Party Name 3": z.any(),
  "Party Name 4": z.any(),
  "Property Address": z.any(),
  "Lot": z.any(),
  "Block": z.any(),
  "Township": z.any(),
  "Prior Effective Date": z.any(),
}).passthrough();

export const countySettings = mysqlTable("county_settings", {
  id: int("id").primaryKey().autoincrement(),
  name: text("name").notNull(),
  searchUrl: text("search_url").notNull(),
  scrapeParty: int("scrape_party").notNull().default(1), // Using int for boolean (1=true, 0=false)
  scrapeLot: int("scrape_lot").notNull().default(1),
  vpnRequired: int("vpn_required").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const extractedDetails = mysqlTable("extracted_details", {
  id: int("id").primaryKey().autoincrement(),
  fileNumber: text("file_number").notNull(),
  sourceFile: text("source_file").notNull(),
  documentType: text("document_type"),
  grantor: text("grantor"),
  grantee: text("grantee"),
  instrumentNumber: text("instrument_number"),
  recordingDate: text("recording_date"),
  datedDate: text("dated_date"),
  considerationAmount: text("consideration_amount"),
  book: text("book"),
  pageNo: text("page_no"),
  legalDescription: text("legal_description"),
  data: json("data"), // Store the full extraction JSON just in case
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUploadSchema = createInsertSchema(uploads).omit({ id: true, createdAt: true });
export const insertScrapeItemSchema = createInsertSchema(scrapeItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertCountySettingSchema = createInsertSchema(countySettings).omit({ id: true, createdAt: true });
export const insertExtractedDetailSchema = createInsertSchema(extractedDetails).omit({ id: true, createdAt: true });

export type Upload = typeof uploads.$inferSelect;
export type ScrapeItem = typeof scrapeItems.$inferSelect;
export type User = typeof users.$inferSelect;
export type CountySetting = typeof countySettings.$inferSelect;
export type ExtractedDetail = typeof extractedDetails.$inferSelect;

export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type InsertScrapeItem = z.infer<typeof insertScrapeItemSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCountySetting = z.infer<typeof insertCountySettingSchema>;
export type InsertExtractedDetail = z.infer<typeof insertExtractedDetailSchema>;


export type ScrapeStatus = "pending" | "processing" | "completed" | "failed";
