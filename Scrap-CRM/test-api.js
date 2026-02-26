import 'dotenv/config';
import fetch from 'node-fetch';

async function testAPI() {
    try {
        const response = await fetch('http://localhost:5000/api/scrape-items');
        const data = await response.json();

        console.log('API Response:');
        console.log('Total items:', data.length);

        if (data.length > 0) {
            console.log('\nFirst item:');
            console.log('ID:', data[0].id);
            console.log('Data type:', typeof data[0].data);
            console.log('Data value:', data[0].data);
            console.log('Data keys:', Object.keys(data[0].data));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testAPI();
