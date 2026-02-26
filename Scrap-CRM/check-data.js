import 'dotenv/config';
import mysql from 'mysql2/promise';

async function checkData() {
    try {
        const connection = await mysql.createConnection(process.env.DATABASE_URL);

        const [rows] = await connection.query('SELECT * FROM scrape_items LIMIT 1');
        console.log('Sample row:', rows[0]);
        console.log('Data field type:', typeof rows[0].data);
        console.log('Data field value:', rows[0].data);

        await connection.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkData();
