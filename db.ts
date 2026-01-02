
import sql from 'mssql';

// Environment variables are now loaded centrally in the main index.ts file.

const connectionString = process.env.MSSQL_CONNECTION_STRING;

let pool: sql.ConnectionPool | null = null;

export const connectDB = async () => {
  if (!connectionString) {
    console.log("No MSSQL_CONNECTION_STRING found. Running in Offline Mode (In-Memory Database).");
    return;
  }

  try {
    pool = await sql.connect(connectionString);
    console.log("Database connection successful.");
  } catch (err) {
    console.error("Database connection failed:", err);
    console.log("Running in Offline Mode (In-Memory Database).");
    // Do not exit process, allow fallback to in-memory store
    pool = null;
  }
};

export const getPool = () => {
    if (!pool) {
        throw new Error("Database is not connected.");
    }
    return pool;
}

export const isDbConnected = () => {
    return pool !== null;
}
