const db = require('./config/db');

async function checkDrug() {
    try {
        const [drugs] = await db.execute("SELECT * FROM TABLE_DRUG WHERE DRUG_CODE = 'D0060'");
        console.log('Drug D0060 info:', drugs);

        if (drugs.length > 0) {
            const [stockCards] = await db.execute("SELECT * FROM STOCK_CARD WHERE DRUG_CODE = 'D0060'");
            console.log('Stock Card records for D0060:', stockCards.length);

            const [receiptDetails] = await db.execute("SELECT * FROM RECEIPT1_DT WHERE DRUG_CODE = 'D0060'");
            console.log('Receipt Details for D0060:', receiptDetails.length);
            if (receiptDetails.length > 0) {
                console.log('Sample Receipt Detail:', receiptDetails.slice(0, 3));
            }

            const [balDrugs] = await db.execute("SELECT * FROM BAL_DRUG WHERE DRUG_CODE = 'D0060'");
            console.log('Balance Drug (BAL_DRUG) for D0060:', balDrugs);
            if (stockCards.length > 0) {
                console.log('Sample Stock Card:', stockCards.slice(0, 3));
                const uniqueLots = [...new Set(stockCards.map(s => s.LOTNO))];
                console.log('Unique Lots:', uniqueLots);
            }
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDrug();
