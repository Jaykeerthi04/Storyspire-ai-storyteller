/**
 * Test Supabase Connection
 * 
 * This script tests the connection to your Supabase database
 * Run with: node scripts/test-supabase.js
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Error: Missing Supabase credentials');
    console.log('Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env file');
    process.exit(1);
  }
  
  console.log('✅ Credentials found');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...\n`);
  
  try {
    // Test basic connection
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    
    if (response.ok) {
      console.log('✅ Successfully connected to Supabase!');
      console.log(`   Status: ${response.status} ${response.statusText}\n`);
      
      // Test tables
      console.log('🔍 Testing database tables...\n');
      
      const tables = ['profiles', 'stories'];
      
      for (const table of tables) {
        try {
          const tableResponse = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Prefer': 'count=exact',
            },
          });
          
          if (tableResponse.ok) {
            const count = tableResponse.headers.get('content-range')?.split('/')[1] || 'unknown';
            console.log(`   ✅ Table '${table}' exists (${count} records)`);
          } else if (tableResponse.status === 404) {
            console.log(`   ⚠️  Table '${table}' not found (may need to run migrations)`);
          } else {
            console.log(`   ❌ Error accessing table '${table}': ${tableResponse.status}`);
          }
        } catch (error) {
          console.log(`   ❌ Error testing table '${table}': ${error.message}`);
        }
      }
      
      console.log('\n✅ Connection test complete!');
      console.log('\n📝 Next steps:');
      console.log('   1. Make sure you have run the database migrations in supabase/migrations/');
      console.log('   2. Test the connection in your app');
      console.log('   3. Try creating a user account');
      
    } else {
      console.error(`❌ Connection failed: ${response.status} ${response.statusText}`);
      console.error('   Please check your Supabase URL and API key');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.error('\nPlease check:');
    console.error('   1. Your internet connection');
    console.error('   2. Your Supabase URL is correct');
    console.error('   3. Your API key is valid');
    process.exit(1);
  }
}

testSupabaseConnection();

