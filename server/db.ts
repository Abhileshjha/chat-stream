import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Idle clients can be dropped by the network or the DB provider at any time;
// without this handler that throws as an uncaught exception and kills the
// whole server instead of just recycling the one connection.
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client:", err.message);
});

export const db = drizzle(pool);
