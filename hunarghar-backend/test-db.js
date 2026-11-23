require("dotenv").config();
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false
});

async function testConnection() {
  try {
    await client.connect();

    console.log("SUCCESS: Connected to Supabase PostgreSQL!");

    const result = await client.query(
      "SELECT current_database() AS database, current_user AS username"
    );

    console.log("Database information:", result.rows[0]);

    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
    );

    console.log("Tables found:");
    tables.rows.forEach(row => console.log("- " + row.table_name));

  } catch (error) {
    console.log("CONNECTION FAILED:", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

testConnection();
