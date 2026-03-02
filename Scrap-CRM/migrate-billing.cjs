const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL not found in .env");
        process.exit(1);
    }
    const conn = await mysql.createConnection(process.env.DATABASE_URL);

    const alterQueries = [
        `ALTER TABLE users ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'payg'`,
        `ALTER TABLE users ADD COLUMN credits INT NOT NULL DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN total_scrapes INT NOT NULL DEFAULT 0`,
    ];

    for (const q of alterQueries) {
        try {
            await conn.query(q);
            console.log('✅ Added:', q.split('ADD COLUMN')[1].trim().split(' ')[0]);
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('⏭️  Already exists:', q.split('ADD COLUMN')[1].trim().split(' ')[0]);
            } else {
                console.error('❌ Error:', e.message);
            }
        }
    }

    await conn.end();
    console.log('\n✅ Migration complete! Restart your dev server.');
}

runMigration().catch(console.error);
