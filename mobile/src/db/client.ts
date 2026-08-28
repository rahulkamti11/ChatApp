import * as SQLite from 'expo-sqlite';
import { initLocalDatabase } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('qwink_local.db');
    await initLocalDatabase(dbInstance);
  }
  return dbInstance;
}
