# Supabase Setup Guide

This guide will help you set up Supabase for your Storyspire app.

## 1. Create Your .env File

Create a `.env` file in the root of your project with the following content:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://satsqxekgppoifdetgju.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhdHNxeGVrZ3Bwb2lmZGV0Z2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5ODAyNTgsImV4cCI6MjA3NzU1NjI1OH0.JIWmPkNeZ9aLbL_tjaCo9J3u9NJJgkjk3ZkxmmR7kMI

# Gemini API (Add your Gemini API key here when you have it)
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Unsplash API for better image generation
# EXPO_PUBLIC_UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here

# Optional: Pexels API
# EXPO_PUBLIC_PEXELS_API_KEY=your_pexels_api_key_here
```

**Important:** The `.env` file is already in `.gitignore`, so your secrets won't be committed to git.

## 2. Install Dependencies

The Supabase dependencies are already installed in your `package.json`. If you need to reinstall:

```bash
npm install
```

Required packages (already included):
- `@supabase/supabase-js` - Supabase JavaScript client
- `@react-native-async-storage/async-storage` - For session storage
- `react-native-url-polyfill` - URL polyfill for React Native

## 3. Supabase Client Initialization

The Supabase client is already initialized in `lib/supabase.ts`. It:
- Loads credentials from environment variables
- Configures authentication with AsyncStorage
- Enables automatic token refresh
- Persists sessions

## 4. Set Up Database Tables

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://satsqxekgppoifdetgju.supabase.co
2. Navigate to **SQL Editor**
3. Open the migration file: `supabase/migrations/20251030190130_create_user_profiles_and_stories.sql`
4. Copy and paste the entire SQL content into the SQL Editor
5. Click **Run** to execute the migration

### Option B: Using Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
supabase db push
```

## 5. Test the Connection

### Option A: Using Node Script (Recommended for initial testing)

1. Install dotenv if not already installed:
```bash
npm install --save-dev dotenv
```

2. Run the test script:
```bash
npm run test:supabase
```

This will:
- Test the connection to your Supabase instance
- Check if your credentials are valid
- Verify that tables exist (if migrations have been run)

### Option B: Test in Your App

You can test the connection in your app by importing and calling the test function:

```typescript
import { testSupabaseConnection, testDatabaseTables } from '@/lib/test-supabase';

// Test connection
const result = await testSupabaseConnection();
console.log(result);

// Test tables
const tables = await testDatabaseTables();
console.log(tables);
```

## 6. Verify Tables Created

After running the migration, verify in Supabase Dashboard:

1. Go to **Table Editor** in your Supabase dashboard
2. You should see two tables:
   - `profiles` - User profile information
   - `stories` - Generated stories

## 7. Security Policies

The migration automatically sets up:
- **Row Level Security (RLS)** enabled on both tables
- **Policies** that ensure users can only access their own data
- **Authentication required** for all operations

## Troubleshooting

### Error: "Missing Supabase environment variables"

- Ensure your `.env` file exists in the root directory
- Check that variable names start with `EXPO_PUBLIC_`
- Restart your Expo development server after creating/modifying `.env`

### Error: "Connection failed"

- Verify your Supabase URL is correct
- Check that your API key is valid
- Ensure your internet connection is working
- Check Supabase dashboard for service status

### Tables not found

- Make sure you've run the SQL migration in Supabase dashboard
- Verify the migration executed successfully
- Check the Table Editor in Supabase dashboard

### Authentication errors

- Ensure RLS policies are set up correctly
- Verify users are authenticated before accessing tables
- Check that your anon key has the correct permissions

## Next Steps

1. ✅ Create `.env` file with your credentials
2. ✅ Run database migrations in Supabase dashboard
3. ✅ Test connection using `npm run test:supabase`
4. ✅ Start your app and try creating an account
5. ✅ Generate your first story!

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

