require("dotenv").config();
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    await client.connect();

    const result = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    let current = "";

    for (const row of result.rows) {
      if (row.table_name !== current) {
        current = row.table_name;
        console.log("\nTABLE: " + current);
      }
      console.log("  " + row.column_name + " (" + row.data_type + ")");
    }

  } catch (error) {
    console.log("ERROR:", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

inspect();
