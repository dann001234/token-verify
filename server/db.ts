import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, InsertTokenProcessing, TokenProcessing, tokenProcessing } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createTokenProcessing(data: InsertTokenProcessing): Promise<TokenProcessing | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create token processing: database not available");
    return null;
  }

  try {
    const result = await db.insert(tokenProcessing).values(data);
    const rows = await db.select().from(tokenProcessing).where(eq(tokenProcessing.id, result[0].insertId)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error("[Database] Failed to create token processing:", error);
    throw error;
  }
}

export async function updateTokenProcessing(id: number, data: Partial<InsertTokenProcessing>): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update token processing: database not available");
    return;
  }

  try {
    await db.update(tokenProcessing).set(data).where(eq(tokenProcessing.id, id));
  } catch (error) {
    console.error("[Database] Failed to update token processing:", error);
    throw error;
  }
}

export async function getTokenProcessingHistory(limit: number = 100): Promise<TokenProcessing[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get token processing history: database not available");
    return [];
  }

  try {
    return await db.select().from(tokenProcessing).orderBy(desc(tokenProcessing.createdAt)).limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get token processing history:", error);
    throw error;
  }
}
