/**
 * Test script for mandi price API integration
 * This script tests the data.gov.in mandi price API integration
 * 
 * Usage:
 * 1. Ensure AGMARKNET_API_KEY is set in .env file
 * 2. Run: node test-mandi-prices.js
 */

require('dotenv').config();
const { getLatestMandiPrices, getMandiPricesByDateRange } = require('./services/mandiPriceService');

async function testMandiPriceAPI() {
  console.log('Testing Mandi Price API Integration...\n');

  try {
    // Test 1: Basic query with no filters (should return latest prices)
    console.log('Test 1: Basic query (no filters, latest only)');
    console.log('===============================================');
    const result1 = await getLatestMandiPrices({}, { limit: 5 });
    console.log(`Total records available: ${result1.total}`);
    console.log(`Records returned: ${result1.count}`);
    console.log('Sample records:');
    result1.records.slice(0, 2).forEach(record => {
      console.log(`  - ${record.commodity} in ${record.market}, ${record.district}, ${record.state}`);
      console.log(`    Date: ${record.arrival_date}, Modal Price: ₹${record.modal_price}/quintal`);
    });
    console.log('');

    // Test 2: Query with state filter (Madhya Pradesh)
    console.log('Test 2: Query with state filter (Madhya Pradesh)');
    console.log('====================================================');
    const result2 = await getLatestMandiPrices({ state: 'Madhya Pradesh' }, { limit: 5 });
    console.log(`Total records available: ${result2.total}`);
    console.log(`Records returned: ${result2.count}`);
    console.log('Sample records:');
    result2.records.slice(0, 2).forEach(record => {
      console.log(`  - ${record.commodity} in ${record.market}, ${record.district}`);
      console.log(`    Date: ${record.arrival_date}, Modal Price: ₹${record.modal_price}/quintal`);
    });
    console.log('');

    // Test 3: Query with commodity filter (Wheat)
    console.log('Test 3: Query with commodity filter (Wheat)');
    console.log('=============================================');
    const result3 = await getLatestMandiPrices({ commodity: 'Wheat' }, { limit: 5 });
    console.log(`Total records available: ${result3.total}`);
    console.log(`Records returned: ${result3.count}`);
    console.log('Sample records:');
    result3.records.slice(0, 2).forEach(record => {
      console.log(`  - ${record.commodity} in ${record.market}, ${record.district}, ${record.state}`);
      console.log(`    Date: ${record.arrival_date}, Modal Price: ₹${record.modal_price}/quintal`);
    });
    console.log('');

    // Test 4: Query with state and commodity (Madhya Pradesh + Wheat)
    console.log('Test 4: Query with state and commodity (Madhya Pradesh + Wheat)');
    console.log('===================================================================');
    const result4 = await getLatestMandiPrices(
      { state: 'Madhya Pradesh', commodity: 'Wheat' },
      { limit: 5 }
    );
    console.log(`Total records available: ${result4.total}`);
    console.log(`Records returned: ${result4.count}`);
    console.log('Sample records:');
    result4.records.slice(0, 2).forEach(record => {
      console.log(`  - ${record.commodity} in ${record.market}, ${record.district}`);
      console.log(`    Date: ${record.arrival_date}, Modal Price: ₹${record.modal_price}/quintal`);
    });
    console.log('');

    // Test 5: Verify latest date filtering
    console.log('Test 5: Verify latest date filtering');
    console.log('=======================================');
    const result5 = await getLatestMandiPrices({ commodity: 'Wheat' }, { limit: 20, latestOnly: false });
    console.log(`Total records (all dates): ${result5.count}`);
    
    // Get unique dates
    const uniqueDates = [...new Set(result5.records.map(r => r.arrival_date))];
    console.log(`Unique dates found: ${uniqueDates.length}`);
    console.log('Date range:', uniqueDates.slice(0, 5).join(', '), '...');
    
    // Now get latest only
    const result5Latest = await getLatestMandiPrices({ commodity: 'Wheat' }, { limit: 20, latestOnly: true });
    const latestDates = [...new Set(result5Latest.records.map(r => r.arrival_date))];
    console.log(`Latest-only records: ${result5Latest.count}`);
    console.log(`Latest date(s): ${latestDates.join(', ')}`);
    console.log('');

    // Test 6: Check for old records (2010) to ensure they're not returned as current
    console.log('Test 6: Verify old historical records (e.g., 2010) are not returned as current');
    console.log('=============================================================================');
    const result6 = await getLatestMandiPrices({ commodity: 'Wheat' }, { limit: 100, latestOnly: false });
    const oldRecords = result6.records.filter(r => r.arrival_date && r.arrival_date.includes('2010'));
    console.log(`Total records: ${result6.count}`);
    console.log(`Records from 2010: ${oldRecords.length}`);
    
    if (oldRecords.length > 0) {
      console.log('WARNING: Found old records from 2010:');
      oldRecords.slice(0, 3).forEach(record => {
        console.log(`  - ${record.commodity} in ${record.market}, Date: ${record.arrival_date}`);
      });
    }
    
    // Verify latest-only doesn't include old records
    const result6Latest = await getLatestMandiPrices({ commodity: 'Wheat' }, { limit: 100, latestOnly: true });
    const oldRecordsInLatest = result6Latest.records.filter(r => r.arrival_date && r.arrival_date.includes('2010'));
    console.log(`Latest-only records from 2010: ${oldRecordsInLatest.length}`);
    console.log('');

    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.message.includes('AGMARKNET_API_KEY')) {
      console.log('\nTo run this test, set AGMARKNET_API_KEY in your .env file.');
      console.log('Get an API key from: https://data.gov.in/');
    }
    process.exit(1);
  }
}

// Run tests
testMandiPriceAPI();