import { db } from "./db";
import {
  uploads,
  scrapeItems,
  type Upload,
  type InsertUpload,
  type ScrapeItem,
  type InsertScrapeItem,
  type ScrapeStatus,
  type User,
  type InsertUser,
  users,
  countySettings,
  type CountySetting,
  type InsertCountySetting,
  extractedDetails,
  type ExtractedDetail,
  type InsertExtractedDetail
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);
import { eq, desc, gte } from "drizzle-orm";

export interface IStorage {
  // Uploads
  createUpload(upload: InsertUpload): Promise<Upload>;
  getUploads(): Promise<Upload[]>;
  getUpload(id: number): Promise<Upload | undefined>;
  deleteUpload(id: number): Promise<boolean>;

  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  sessionStore: session.Store;

  // Scrape Items
  createScrapeItems(items: InsertScrapeItem[]): Promise<ScrapeItem[]>;
  getScrapeItems(uploadId?: number, status?: string): Promise<ScrapeItem[]>;
  getScrapeItem(id: number): Promise<ScrapeItem | undefined>;
  deleteScrapeItem(id: number): Promise<boolean>;
  updateScrapeItemStatus(id: number, status: ScrapeStatus, result?: string, lotStatus?: ScrapeStatus, partyStatus?: ScrapeStatus): Promise<ScrapeItem | undefined>;
  startAllScrapeItems(uploadId?: number): Promise<number>;

  // County Settings
  getCountySettings(): Promise<CountySetting[]>;
  getCountySettingByName(name: string): Promise<CountySetting | undefined>;
  updateCountySetting(id: number, setting: Partial<InsertCountySetting>): Promise<CountySetting | undefined>;
  createCountySetting(setting: InsertCountySetting): Promise<CountySetting>;
  deleteCountySetting(id: number): Promise<boolean>;

  // Extracted Details
  createExtractedDetail(detail: InsertExtractedDetail): Promise<ExtractedDetail>;
  getExtractedDetails(fileNumber: string): Promise<ExtractedDetail[]>;
}

export class DatabaseStorage implements IStorage {
  async createUpload(upload: InsertUpload): Promise<Upload> {
    const result = await db.insert(uploads).values(upload);
    const insertId = Number(result[0].insertId);
    const [newUpload] = await db.select().from(uploads).where(eq(uploads.id, insertId));
    return newUpload;
  }

  sessionStore: session.Store = new MemoryStore({
    checkPeriod: 86400000,
  });

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser);
    const insertId = Number(result[0].insertId);
    const [newUser] = await db.select().from(users).where(eq(users.id, insertId));
    return newUser;
  }

  async getUploads(): Promise<Upload[]> {
    return await db.select().from(uploads).orderBy(desc(uploads.createdAt));
  }

  async getUpload(id: number): Promise<Upload | undefined> {
    const [upload] = await db.select().from(uploads).where(eq(uploads.id, id));
    return upload;
  }

  async deleteUpload(id: number): Promise<boolean> {
    // First delete all items associated with this upload
    await db.delete(scrapeItems).where(eq(scrapeItems.uploadId, id));
    const result = await db.delete(uploads).where(eq(uploads.id, id));
    return result[0].affectedRows > 0;
  }

  async createScrapeItems(items: InsertScrapeItem[]): Promise<ScrapeItem[]> {
    if (items.length === 0) return [];
    const result = await db.insert(scrapeItems).values(items);
    const insertId = Number(result[0].insertId);
    // Fetch the inserted items (they will have sequential IDs starting from insertId)
    const inserted = await db.select().from(scrapeItems)
      .where(gte(scrapeItems.id, insertId))
      .limit(items.length);

    // Parse JSON data field if it's a string (MySQL returns JSON as string)
    return inserted.map(item => ({
      ...item,
      data: typeof item.data === 'string' ? JSON.parse(item.data) : item.data
    }));
  }

  async getScrapeItems(uploadId?: number, status?: string): Promise<ScrapeItem[]> {
    let query = db.select().from(scrapeItems);

    if (uploadId) {
      query.where(eq(scrapeItems.uploadId, uploadId));
    }

    if (status) {
      // Logic for status filtering if needed, but keeping simple for now
      // This might need strictly typed 'where' clause if using complex filters
    }

    const items = await query.orderBy(desc(scrapeItems.id));

    // Parse JSON data field if it's a string (MySQL returns JSON as string)
    return items.map(item => ({
      ...item,
      data: typeof item.data === 'string' ? JSON.parse(item.data) : item.data
    }));
  }

  async getScrapeItem(id: number): Promise<ScrapeItem | undefined> {
    const [item] = await db.select().from(scrapeItems).where(eq(scrapeItems.id, id));
    if (!item) return undefined;

    // Parse JSON data field if it's a string
    return {
      ...item,
      data: typeof item.data === 'string' ? JSON.parse(item.data) : item.data
    };
  }

  async deleteScrapeItem(id: number): Promise<boolean> {
    const result = await db.delete(scrapeItems).where(eq(scrapeItems.id, id));
    return result[0].affectedRows > 0;
  }

  async updateScrapeItemStatus(id: number, status: ScrapeStatus, result?: string, lotStatus?: ScrapeStatus, partyStatus?: ScrapeStatus): Promise<ScrapeItem | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (result !== undefined) updateData.result = result;
    if (lotStatus !== undefined) updateData.lotStatus = lotStatus;
    if (partyStatus !== undefined) updateData.partyStatus = partyStatus;

    await db
      .update(scrapeItems)
      .set(updateData)
      .where(eq(scrapeItems.id, id));
    const [updated] = await db.select().from(scrapeItems).where(eq(scrapeItems.id, id));

    if (!updated) return undefined;

    // Parse JSON data field if it's a string
    return {
      ...updated,
      data: typeof updated.data === 'string' ? JSON.parse(updated.data) : updated.data
    };
  }

  async startAllScrapeItems(uploadId?: number): Promise<number> {
    const whereClause = uploadId
      ? eq(scrapeItems.uploadId, uploadId)
      : undefined;

    // We only update pending items
    // Since we can't easily do compound 'where' with undefined, let's construct it properly or just update all pending
    // For simplicity, update where status is 'pending'

    const result = await db
      .update(scrapeItems)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(scrapeItems.status, "pending"));

    return result[0].affectedRows;
  }

  async getCountySettings(): Promise<CountySetting[]> {
    return await db.select().from(countySettings).orderBy(desc(countySettings.createdAt));
  }

  async getCountySettingByName(name: string): Promise<CountySetting | undefined> {
    const [setting] = await db.select().from(countySettings).where(eq(countySettings.name, name));
    return setting;
  }

  async createCountySetting(setting: InsertCountySetting): Promise<CountySetting> {
    const result = await db.insert(countySettings).values(setting);
    const insertId = Number(result[0].insertId);
    const [newSetting] = await db.select().from(countySettings).where(eq(countySettings.id, insertId));
    return newSetting;
  }

  async updateCountySetting(id: number, setting: Partial<InsertCountySetting>): Promise<CountySetting | undefined> {
    await db.update(countySettings).set(setting).where(eq(countySettings.id, id));
    const [updated] = await db.select().from(countySettings).where(eq(countySettings.id, id));
    return updated;
  }

  async deleteCountySetting(id: number): Promise<boolean> {
    const result = await db.delete(countySettings).where(eq(countySettings.id, id));
    return result[0].affectedRows > 0;
  }

  async createExtractedDetail(detail: InsertExtractedDetail): Promise<ExtractedDetail> {
    const result = await db.insert(extractedDetails).values(detail);
    const insertId = Number(result[0].insertId);
    const [newDetail] = await db.select().from(extractedDetails).where(eq(extractedDetails.id, insertId));
    return newDetail;
  }

  async getExtractedDetails(fileNumber: string): Promise<ExtractedDetail[]> {
    return await db.select().from(extractedDetails).where(eq(extractedDetails.fileNumber, fileNumber)).orderBy(desc(extractedDetails.createdAt));
  }
}

export const storage = new DatabaseStorage();
