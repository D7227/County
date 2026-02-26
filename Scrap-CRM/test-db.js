import 'dotenv/config';
import mysql from 'mysql2/promise';

async function testConnection() {
    try {
        console.log('Testing database connection...');
        console.log('DATABASE_URL:', process.env.DATABASE_URL);

        const connection = await mysql.createConnection(process.env.DATABASE_URL);
        console.log('✅ Connected to MySQL successfully!');

        // Check what database we're using
        const [rows] = await connection.query('SELECT DATABASE() as db');
        console.log('Current database:', rows[0].db);

        // List all tables
        const [tables] = await connection.query('SHOW TABLES');
        console.log('Tables in database:', tables);

        await connection.end();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Full error:', error);
    }
}

testConnection();
