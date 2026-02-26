const mysql = require('mysql2/promise');
require('dotenv').config();

async function runSQL() {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);

    const tables = [
        `CREATE TABLE IF NOT EXISTS county_settings (
      id int AUTO_INCREMENT NOT NULL,
      name text NOT NULL,
      search_url text NOT NULL,
      scrape_party int NOT NULL DEFAULT 1,
      scrape_lot int NOT NULL DEFAULT 1,
      vpn_required int NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT (now()),
      CONSTRAINT county_settings_id PRIMARY KEY(id)
    );`,
        `CREATE TABLE IF NOT EXISTS extracted_details (
      id int AUTO_INCREMENT NOT NULL,
      file_number text NOT NULL,
      source_file text NOT NULL,
      document_type text,
      grantor text,
      grantee text,
      instrument_number text,
      recording_date text,
      dated_date text,
      consideration_amount text,
      book text,
      page_no text,
      legal_description text,
      data json,
      created_at timestamp DEFAULT (now()),
      CONSTRAINT extracted_details_id PRIMARY KEY(id)
    );`,
        `CREATE TABLE IF NOT EXISTS scrape_items (
      id int AUTO_INCREMENT NOT NULL,
      upload_id int,
      data json NOT NULL,
      status text NOT NULL DEFAULT ('pending'),
      lot_status text NOT NULL DEFAULT ('pending'),
      party_status text NOT NULL DEFAULT ('pending'),
      result text,
      created_at timestamp DEFAULT (now()),
      updated_at timestamp DEFAULT (now()),
      CONSTRAINT scrape_items_id PRIMARY KEY(id)
    );`
    ];

    for (const sql of tables) {
        try {
            await conn.query(sql);
            console.log('Success for one table');
        } catch (e) {
            console.error('Error:', e.message);
        }
    }

    await conn.end();
}
runSQL().catch(console.error);
