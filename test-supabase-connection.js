require('dotenv').config();
const { supabase, supabaseAdmin } = require('./config/supabase');

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...\n');

  // Test basic connection
  console.log('1. Testing Supabase client configuration...');
  if (!supabase) {
    console.log('❌ Supabase client not initialized');
    console.log('   Check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env');
    return false;
  }
  console.log('✅ Supabase client initialized');

  if (!supabaseAdmin) {
    console.log('❌ Supabase admin client not initialized');
    console.log('   Check SUPABASE_SECRET_KEY in .env');
    return false;
  }
  console.log('✅ Supabase admin client initialized');

  // Test database connection with a simple query
  console.log('\n2. Testing database connection...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      // This might fail if table doesn't exist yet, which is expected
      console.log('⚠️  Database query returned error (expected if tables not created):');
      console.log(`   ${error.message}`);
      console.log('   This is normal before running the database schema');
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (err) {
    console.log('❌ Database connection failed:');
    console.log(`   ${err.message}`);
    return false;
  }

  // Test if we can list tables (using admin client)
  console.log('\n3. Testing admin client access...');
  try {
    const { data, error } = await supabaseAdmin
      .from('crops')
      .select('count')
      .limit(1);

    if (error) {
      console.log('⚠️  Admin client query returned error (expected if tables not created):');
      console.log(`   ${error.message}`);
    } else {
      console.log('✅ Admin client access successful');
    }
  } catch (err) {
    console.log('❌ Admin client access failed:');
    console.log(`   ${err.message}`);
    return false;
  }

  console.log('\n✅ Supabase connection test completed');
  console.log('Ready to proceed with database schema setup');
  return true;
}

testSupabaseConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Connection test failed:', err);
    process.exit(1);
  });
