import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { User, UserRole } from '@dockpilot/types';

interface StoredUser extends User {
  passwordHash: string;
  refreshToken?: string;
}

interface Database {
  users: StoredUser[];
  auditLogs: Array<{
    id: string;
    timestamp: string;
    userId: string;
    username: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ip: string;
    userAgent: string;
  }>;
  setupComplete: boolean;
}

const DB_FILE = 'db.json';

let db: Database | null = null;
let dataDir = '/data';

export function initDatabase(dataDirectory: string): void {
  dataDir = dataDirectory;
}

export async function getDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  const dbPath = path.join(dataDir, DB_FILE);

  if (!existsSync(dbPath)) {
    // Create initial database
    db = {
      users: [],
      auditLogs: [],
      setupComplete: false,
    };
    await saveDatabase();
  } else {
    const content = await readFile(dbPath, 'utf-8');
    db = JSON.parse(content);
  }

  return db;
}

export async function saveDatabase(): Promise<void> {
  if (!db) return;

  const dbPath = path.join(dataDir, DB_FILE);

  // Ensure directory exists
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }

  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

export async function isSetupComplete(): Promise<boolean> {
  const database = await getDatabase();
  return database.setupComplete && database.users.length > 0;
}

export async function completeSetup(): Promise<void> {
  const database = await getDatabase();
  database.setupComplete = true;
  await saveDatabase();
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  const database = await getDatabase();
  return database.users.find((u) => u.username === username) || null;
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  const database = await getDatabase();
  return database.users.find((u) => u.id === id) || null;
}

export async function createUser(
  user: Omit<StoredUser, 'id' | 'createdAt' | 'updatedAt'>
): Promise<StoredUser> {
  const database = await getDatabase();
  const now = new Date();

  const newUser: StoredUser = {
    ...user,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  database.users.push(newUser);
  await saveDatabase();

  return newUser;
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<StoredUser, 'id' | 'createdAt'>>
): Promise<StoredUser | null> {
  const database = await getDatabase();
  const index = database.users.findIndex((u) => u.id === id);

  if (index === -1) {
    return null;
  }

  database.users[index] = {
    ...database.users[index],
    ...updates,
    updatedAt: new Date(),
  };

  await saveDatabase();
  return database.users[index];
}

export async function deleteUser(id: string): Promise<boolean> {
  const database = await getDatabase();
  const index = database.users.findIndex((u) => u.id === id);

  if (index === -1) {
    return false;
  }

  database.users.splice(index, 1);
  await saveDatabase();
  return true;
}

export async function listUsers(): Promise<User[]> {
  const database = await getDatabase();
  return database.users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));
}

export async function addAuditLog(log: {
  userId: string;
  username: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip: string;
  userAgent: string;
}): Promise<void> {
  const database = await getDatabase();

  database.auditLogs.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...log,
  });

  // Keep only last 10000 logs
  if (database.auditLogs.length > 10000) {
    database.auditLogs = database.auditLogs.slice(-10000);
  }

  await saveDatabase();
}

export async function getAuditLogs(limit = 100): Promise<Database['auditLogs']> {
  const database = await getDatabase();
  return database.auditLogs.slice(-limit);
}
