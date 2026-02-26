import 'dotenv/config';
import { db } from './server/db';
import { uploads } from './shared/schema';

async function testInsert() {
    try {
        console.log('Testing database insert...');

        const result: any = await db.insert(uploads).values({
            filename: 'test.xlsx'
        });

        console.log('✅ Insert successful!');
        console.log('Result:', result);
        console.log('Insert ID:', result[0].insertId);

        process.exit(0);
    } catch (error: any) {
        console.error('❌ Insert failed:');
        console.error('Error:', error);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testInsert();
