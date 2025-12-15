const axios = require('axios');

async function testCreateTreatment() {
    try {
        console.log('🚀 Testing POST /treatments...');

        // Mock data similar to what frontend sends
        const payload = {
            HNNO: 'HN0000001', // Ensure this HN exists or use one from DB
            EMP_CODE: 'DOC001',
            SYMPTOM: 'Test symptom',
            // Create a fake queue first? Or just pass null
            // Frontend sends QUEUE_ID if it just created one.
            // Let's try without queue first, then with queue if needed.
            STATUS1: 'รอตรวจ'
        };

        const response = await axios.post('http://localhost:3001/api/treatments', payload);
        console.log('✅ Success:', response.data);
    } catch (error) {
        console.error('❌ Error full:', error);
        if (error.response) {
            console.error('❌ Status:', error.response.status);
            console.error('❌ Data:', error.response.data);
        } else {
            console.error('❌ Error Message:', error.message);
        }
    }
}

testCreateTreatment();
