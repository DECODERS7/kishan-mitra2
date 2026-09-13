// Authentication API Test Script
// This script tests the authentication endpoints
// Note: Requires valid Supabase credentials in .env file

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, data = null) {
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
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testAuthentication() {
  console.log('Testing Authentication APIs...\n');

  // Test 1: Send OTP
  console.log('Test 1: POST /api/auth/otp/send');
  try {
    const result = await makeRequest('POST', '/api/auth/otp/send', {
      phone: '+919876543210',
      role: 'farmer'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 2: Send OTP with invalid role (should fail)
  console.log('Test 2: POST /api/auth/otp/send with official role (should fail)');
  try {
    const result = await makeRequest('POST', '/api/auth/otp/send', {
      phone: '+919876543210',
      role: 'official'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 3: Send OTP with invalid phone (should fail validation)
  console.log('Test 3: POST /api/auth/otp/send with invalid phone (should fail validation)');
  try {
    const result = await makeRequest('POST', '/api/auth/otp/send', {
      phone: 'invalid-phone',
      role: 'farmer'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 4: Verify OTP (will fail without real OTP)
  console.log('Test 4: POST /api/auth/otp/verify (will fail without real OTP)');
  try {
    const result = await makeRequest('POST', '/api/auth/otp/verify', {
      phone: '+919876543210',
      token: '123456',
      role: 'farmer'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 5: Get user profile without auth (should fail)
  console.log('Test 5: GET /api/users/me without auth (should fail)');
  try {
    const result = await makeRequest('GET', '/api/users/me');
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 6: Update user profile without auth (should fail)
  console.log('Test 6: PUT /api/users/me without auth (should fail)');
  try {
    const result = await makeRequest('PUT', '/api/users/me', {
      name: 'Test User',
      location: 'Test Location'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 7: Health check
  console.log('Test 7: GET /api/health');
  try {
    const result = await makeRequest('GET', '/api/health');
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  console.log('Authentication API tests completed');
  console.log('\nNote: Full end-to-end testing requires:');
  console.log('- Valid Supabase credentials in .env');
  console.log('- Supabase SMS provider configured');
  console.log('- Real phone number for OTP testing');
  console.log('- Manual verification of OTP receipt');
}

// Start server and run tests
async function runTests() {
  console.log('Starting authentication API tests...\n');
  console.log('Make sure the server is running on port 3000\n');
  
  await testAuthentication();
}

runTests();
