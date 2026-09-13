// Simple API test script
const http = require('http');

function testEndpoint(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: JSON.parse(body)
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log('Running API Tests...\n');

  // Test 1: Health endpoint
  console.log('Test 1: GET /api/health');
  try {
    const result = await testEndpoint('/api/health');
    console.log('✓ Status:', result.statusCode);
    console.log('✓ Response:', result.body);
  } catch (error) {
    console.log('✗ Error:', error.message);
  }
  console.log();

  // Test 2: Crops endpoint (should return error since Supabase not configured)
  console.log('Test 2: GET /api/crops');
  try {
    const result = await testEndpoint('/api/crops');
    console.log('✓ Status:', result.statusCode);
    console.log('✓ Response:', result.body);
  } catch (error) {
    console.log('✗ Error:', error.message);
  }
  console.log();

  // Test 3: Procurement schedules (should require auth)
  console.log('Test 3: GET /api/procurement/schedules (no auth)');
  try {
    const result = await testEndpoint('/api/procurement/schedules');
    console.log('✓ Status:', result.statusCode);
    console.log('✓ Response:', result.body);
  } catch (error) {
    console.log('✗ Error:', error.message);
  }
  console.log();

  // Test 4: 404 test
  console.log('Test 4: GET /api/nonexistent');
  try {
    const result = await testEndpoint('/api/nonexistent');
    console.log('✓ Status:', result.statusCode);
    console.log('✓ Response:', result.body);
  } catch (error) {
    console.log('✗ Error:', error.message);
  }
  console.log();

  console.log('Tests completed!');
}

runTests();
