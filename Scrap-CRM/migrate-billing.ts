import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

async function run() {
    const pool = await mysql.createPool(url!);
    const conn = await pool.getConnection();
    try {
        const queries = [
            `ALTER TABLE users ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'payg'`,
            `ALTER TABLE users ADD COLUMN credits INT NOT NULL DEFAULT 0`,
            `ALTER TABLE users ADD COLUMN total_scrapes INT NOT NULL DEFAULT 0`,
        ];
        for (const q of queries) {
            try {
                await conn.query(q);
                console.log("OK:", q);
            } catch (e: any) {
                if (e.code === "ER_DUP_FIELDNAME") {
                    console.log("Already exists, skipping:", q);
                } else {
                    throw e;
                }
            }
        }
        console.log("\n✅ Migration complete!");
    } finally {
        conn.release();
        await pool.end();
    }
}

run().catch(err => { console.error("❌ Migration failed:", err.message); process.exit(1); });
