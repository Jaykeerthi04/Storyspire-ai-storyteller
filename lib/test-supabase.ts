/**
 * Test Supabase Connection (for React Native/Expo)
 * 
 * You can import and use this function to test the Supabase connection
 * in your app, or call it during app initialization
 */

import { supabase } from './supabase';

export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('🔍 Testing Supabase Connection...');
    
    // Test 1: Check if we can connect to Supabase
    const { data: healthData, error: healthError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    if (healthError && healthError.code !== 'PGRST116') {
      // PGRST116 means table doesn't exist, which is okay if migrations haven't run
      return {
        success: false,
        message: `Connection failed: ${healthError.message}`,
        details: healthError,
      };
    }
    
    // Test 2: Check if we can read from the database
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return {
        success: false,
        message: `Auth check failed: ${sessionError.message}`,
        details: sessionError,
      };
    }
    
    return {
      success: true,
      message: 'Successfully connected to Supabase!',
      details: {
        hasSession: !!sessionData.session,
        tablesAccessible: healthError?.code !== 'PGRST116',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection error: ${error.message}`,
      details: error,
    };
  }
}

// Test database tables exist
export async function testDatabaseTables(): Promise<{
  success: boolean;
  tables: {
    profiles: boolean;
    stories: boolean;
  };
}> {
  const results = {
    profiles: false,
    stories: false,
  };
  
  try {
    // Test profiles table
    const { error: profilesError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    
    results.profiles = profilesError?.code !== 'PGRST116';
    
    // Test stories table
    const { error: storiesError } = await supabase
      .from('stories')
      .select('id', { count: 'exact', head: true });
    
    results.stories = storiesError?.code !== 'PGRST116';
    
    return {
      success: results.profiles && results.stories,
      tables: results,
    };
  } catch (error) {
    return {
      success: false,
      tables: results,
    };
  }
}

