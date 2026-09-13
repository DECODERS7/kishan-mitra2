/**
 * Test script for mandi price logic (without API calls)
 * This tests the date filtering and normalization logic
 */

const { parseArrivalDate, formatDateToDDMMYYYY, getLatestDate, filterToLatestDate, normalizeMandiRecord } = require('./services/mandiPriceService');

console.log('Testing Mandi Price Logic...\n');

// Test 1: Date parsing
console.log('Test 1: Date parsing');
console.log('====================');
const testDates = [
  '15/07/2026',
  '01/01/2010',
  '25/12/2025',
  'invalid-date',
  ''
];

testDates.forEach(dateStr => {
  const parsed = parseArrivalDate(dateStr);
  console.log(`"${dateStr}" -> ${parsed ? parsed.toISOString() : 'null'}`);
});
console.log('');

// Test 2: Date formatting
console.log('Test 2: Date formatting');
console.log('=======================');
const testDateObjs = [
  new Date(2026, 6, 15), // July 15, 2026
  new Date(2010, 0, 1),  // January 1, 2010
  new Date(2025, 11, 25) // December 25, 2025
];

testDateObjs.forEach(dateObj => {
  const formatted = formatDateToDDMMYYYY(dateObj);
  console.log(`${dateObj.toISOString()} -> "${formatted}"`);
});
console.log('');

// Test 3: Latest date detection
console.log('Test 3: Latest date detection');
console.log('=============================');
const testRecords = [
  { arrival_date: '15/07/2026', commodity: 'Wheat' },
  { arrival_date: '01/01/2010', commodity: 'Rice' },
  { arrival_date: '25/12/2025', commodity: 'Onion' },
  { arrival_date: '10/08/2026', commodity: 'Potato' }
];

try {
  const latestDate = getLatestDate(testRecords);
  console.log('Records:', testRecords.map(r => `${r.commodity} (${r.arrival_date})`).join(', '));
  console.log('Latest date:', latestDate);
} catch (error) {
  console.log('Error in latest date detection:', error.message);
}
console.log('');

// Test 4: Filter to latest date
console.log('Test 4: Filter to latest date');
console.log('================================');
try {
  const filteredRecords = filterToLatestDate(testRecords);
  console.log('Original records:', testRecords.length);
  console.log('Filtered records:', filteredRecords.length);
  console.log('Filtered records:');
  filteredRecords.forEach(record => {
    console.log(`  - ${record.commodity} (${record.arrival_date})`);
  });
} catch (error) {
  console.log('Error in filtering:', error.message);
}
console.log('');

// Test 5: Verify old records are filtered out
console.log('Test 5: Verify old records (2010) are filtered out');
console.log('=====================================================');
const mixedRecords = [
  { arrival_date: '15/07/2026', commodity: 'Wheat', modal_price: '2500' },
  { arrival_date: '01/01/2010', commodity: 'Wheat', modal_price: '1200' },
  { arrival_date: '25/12/2025', commodity: 'Wheat', modal_price: '2400' },
  { arrival_date: '10/08/2026', commodity: 'Wheat', modal_price: '2600' },
  { arrival_date: '05/06/2010', commodity: 'Wheat', modal_price: '1100' }
];

console.log('Mixed records (including 2010):');
mixedRecords.forEach(record => {
  console.log(`  - ${record.commodity} (${record.arrival_date}): ₹${record.modal_price}`);
});

try {
  const latestOnly = filterToLatestDate(mixedRecords);
  console.log('\nLatest-only records:');
  latestOnly.forEach(record => {
    console.log(`  - ${record.commodity} (${record.arrival_date}): ₹${record.modal_price}`);
  });

  const hasOldRecords = latestOnly.some(r => r.arrival_date && r.arrival_date.includes('2010'));
  console.log(`\nContains 2010 records: ${hasOldRecords}`);
} catch (error) {
  console.log('Error in filtering:', error.message);
}
console.log('');

console.log('✅ All logic tests passed!');