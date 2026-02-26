import 'dotenv/config';
import { db } from './server/db.js';
import { uploads } from './shared/schema.js';

async function testInsert() {
    try {
        console.log('Testing database insert...');

        const result = await db.insert(uploads).values({
            filename: 'test.xlsx'
        }).returning();

        console.log('✅ Insert successful!');
        console.log('Result:', result);

        process.exit(0);
    } catch (error) {
        console.error('❌ Insert failed:');
        console.error('Error:', error);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testInsert();
