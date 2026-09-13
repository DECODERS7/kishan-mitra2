// Email/Password Authentication API Test Script
// This script tests the email/password authentication endpoints
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
  console.log('Testing Email/Password Authentication APIs...\n');

  // Test 1: Register with valid data
  console.log('Test 1: POST /api/auth/register with valid data');
  try {
    const result = await makeRequest('POST', '/api/auth/register', {
      email: 'farmer.kisan@example.com',
      password: 'password123',
      role: 'farmer'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 2: Register with official role (should fail)
  console.log('Test 2: POST /api/auth/register with official role (should fail)');
  try {
    const result = await makeRequest('POST', '/api/auth/register', {
      email: 'testofficial@example.com',
      password: 'password123',
      role: 'official'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 3: Register with invalid email (should fail validation)
  console.log('Test 3: POST /api/auth/register with invalid email (should fail validation)');
  try {
    const result = await makeRequest('POST', '/api/auth/register', {
      email: 'invalid-email',
      password: 'password123',
      role: 'farmer'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 4: Register with short password (should fail validation)
  console.log('Test 4: POST /api/auth/register with short password (should fail validation)');
  try {
    const result = await makeRequest('POST', '/api/auth/register', {
      email: 'test@example.com',
      password: '123',
      role: 'farmer'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 5: Login with valid credentials
  console.log('Test 5: POST /api/auth/login with valid credentials');
  try {
    const result = await makeRequest('POST', '/api/auth/login', {
      email: 'testfarmer@example.com',
      password: 'password123'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 6: Login with invalid credentials (should fail)
  console.log('Test 6: POST /api/auth/login with invalid credentials (should fail)');
  try {
    const result = await makeRequest('POST', '/api/auth/login', {
      email: 'testfarmer@example.com',
      password: 'wrongpassword'
    });
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 7: Get user profile without auth (should fail)
  console.log('Test 7: GET /api/users/me without auth (should fail)');
  try {
    const result = await makeRequest('GET', '/api/users/me');
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  // Test 8: Update user profile without auth (should fail)
  console.log('Test 8: PUT /api/users/me without auth (should fail)');
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

  // Test 9: Health check
  console.log('Test 9: GET /api/health');
  try {
    const result = await makeRequest('GET', '/api/health');
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', JSON.stringify(result.body, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log();

  console.log('Email/Password Authentication API tests completed');
  console.log('\nNote: Full end-to-end testing requires:');
  console.log('- Valid Supabase credentials in .env');
  console.log('- Supabase Auth enabled (email/password provider)');
  console.log('- Database migration completed (email column added)');
  console.log('- Manual verification of user creation in Supabase Auth');
}

// Start server and run tests
async function runTests() {
  console.log('Starting email/password authentication API tests...\n');
  console.log('Make sure the server is running on port 3000\n');
  
  await testAuthentication();
}

runTests();
