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
import { eq, desc, gte, inArray } from "drizzle-orm";

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
  updateUser(id: number, data: Partial<InsertUser & { isAdmin: number; plan: string; credits: number }>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsersWithStats(): Promise<any[]>;
  // Billing
  deductCredit(userId: number): Promise<{ success: boolean; remaining: number }>;
  deductCredits(userId: number, amount: number): Promise<{ success: boolean; remaining: number }>;
  addCredits(userId: number, amount: number): Promise<User | undefined>;
  incrementScrapeCount(userId: number): Promise<void>;
  setPlan(userId: number, plan: string): Promise<User | undefined>;

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

  // User Scope
  getAllowedFileNumbers(userId: number): Promise<string[]>;
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

  async updateUser(id: number, updateData: Partial<InsertUser & { isAdmin: number; plan: string; credits: number }>): Promise<User | undefined> {
    await db.update(users).set(updateData as any).where(eq(users.id, id));
    const [updatedUser] = await db.select().from(users).where(eq(users.id, id));
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    await db.update(uploads).set({ userId: null }).where(eq(uploads.userId, id));
    const result = await db.delete(users).where(eq(users.id, id));
    return result[0].affectedRows > 0;
  }

  async deductCredit(userId: number): Promise<{ success: boolean; remaining: number }> {
    return this.deductCredits(userId, 1);
  }

  async deductCredits(userId: number, amount: number): Promise<{ success: boolean; remaining: number }> {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return { success: false, remaining: 0 };
    if (u.credits < amount) return { success: false, remaining: 0 };
    const newCredits = u.credits - amount;
    await db.update(users).set({ credits: newCredits, totalScrapes: u.totalScrapes + amount }).where(eq(users.id, userId));
    return { success: true, remaining: newCredits };
  }

  async addCredits(userId: number, amount: number): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return undefined;
    await db.update(users).set({ credits: u.credits + amount }).where(eq(users.id, userId));
    const [updated] = await db.select().from(users).where(eq(users.id, userId));
    return updated;
  }

  async incrementScrapeCount(userId: number): Promise<void> {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return;
    await db.update(users).set({ totalScrapes: u.totalScrapes + 1 }).where(eq(users.id, userId));
  }

  async setPlan(userId: number, plan: string): Promise<User | undefined> {
    await db.update(users).set({ plan }).where(eq(users.id, userId));
    const [updated] = await db.select().from(users).where(eq(users.id, userId));
    return updated;
  }

  async getUsersWithStats(): Promise<any[]> {
    // We can use a raw SQL query or drizzle query builder to get all users and their counts
    // For simplicity, let's fetch users, then uploads and scrape items, and map them in memory since there won't be millions of users right now.
    // Or just a simple nested map. Wait, let's just use raw drizzle queries or memory mapping.

    // Fetch all users
    const allUsers = await db.select().from(users);

    // Fetch all uploads
    const allUploads = await db.select().from(uploads);

    // Fetch all scrape items
    const allScrapeItems = await db.select().from(scrapeItems);

    const result = allUsers.map(u => {
      // Find uploads by this user
      const userUploads = allUploads.filter(up => up.userId === u.id);
      const userUploadIds = userUploads.map(up => up.id);

      // Find scrape items belonging to these uploads
      const userScrapeItems = allScrapeItems.filter(si => si.uploadId && userUploadIds.includes(si.uploadId));

      return {
        id: u.id,
        username: u.username,
        isAdmin: u.isAdmin,
        plan: u.plan,
        credits: u.credits,
        totalScrapes: u.totalScrapes,
        totalUploads: userUploads.length,
        totalScrapeRecords: userScrapeItems.length,
        // Billing: estimated spend
        estimatedBill: u.plan === "payg" ? u.totalScrapes * 1 : 0, // $1 per scrape for payg
        creditsValueUsd: u.plan === "credits" ? (u.credits / 1000) * 1000 : 0, // $1000 per 1000 credits
      };
    });

    return result;
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

  async getAllowedFileNumbers(userId: number): Promise<string[]> {
    const userUploads = await db.select().from(uploads).where(eq(uploads.userId, userId));
    const uploadIds = userUploads.map(u => u.id);
    if (uploadIds.length === 0) return [];

    const userItems = await db.select().from(scrapeItems).where(inArray(scrapeItems.uploadId, uploadIds));
    const fileNumbers = new Set<string>();
    for (const item of userItems) {
      const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
      if (data && data["File Number"]) {
        fileNumbers.add(String(data["File Number"]).trim());
      }
    }
    return Array.from(fileNumbers);
  }
}

export const storage = new DatabaseStorage();
