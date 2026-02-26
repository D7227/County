import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is missing");
        process.exit(1);
    }

    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    try {
        console.log("Creating table county_settings...");
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`county_settings\` (
        \`id\` int PRIMARY KEY AUTO_INCREMENT,
        \`name\` text NOT NULL,
        \`search_url\` text NOT NULL,
        \`scrape_party\` int NOT NULL DEFAULT 1,
        \`scrape_lot\` int NOT NULL DEFAULT 1,
        \`vpn_required\` int NOT NULL DEFAULT 0,
        \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
        console.log("Table created successfully!");
    } catch (err) {
        console.error("Error creating table:", err);
    } finally {
        await connection.end();
    }
}

main();
