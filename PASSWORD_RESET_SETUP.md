# Password Reset Setup Guide

This guide explains how to configure the password reset flow to work with Gmail and other email clients.

## Problem

Gmail and many email clients block custom scheme URLs (like `myapp://`). To make password reset links work, we need to use HTTPS redirect URLs.

## Solution

The app now uses HTTPS redirect URLs that redirect to your app's custom scheme. This allows the links to work in Gmail while still opening your app.

## Setup Steps

### 1. Configure Redirect URL in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **URL Configuration**
3. Under **Redirect URLs**, add your HTTPS redirect URL:
   ```
   https://yourdomain.com/auth/reset
   ```
   Or use a service like:
   - `https://yourdomain.com/auth/reset.html`
   - Any publicly accessible HTTPS URL

### 2. Host the Redirect Page

You need to host the redirect HTML page (`public/auth/reset.html`) on your domain.

**Option A: Host on your own domain**
- Upload `public/auth/reset.html` to your web server
- Make it accessible at: `https://yourdomain.com/auth/reset.html`
- Update `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` in `.env` to this URL

**Option B: Use a redirect service**
- Use a service like [redirect.app](https://redirect.app) or similar
- Configure it to redirect to `myapp://auth/reset` with query parameters
- Update `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` in `.env` to the service URL

**Option C: Use Supabase's callback (for testing)**
- For development/testing, you can use Supabase's callback URL
- The app will handle the HTTPS URL directly if opened
- Note: This may not work perfectly with Gmail, but works for testing

### 3. Update Environment Variable

Update your `.env` file:

```env
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=https://yourdomain.com/auth/reset.html
```

### 4. How It Works

1. User requests password reset
2. Supabase sends email with HTTPS redirect URL
3. User clicks link in Gmail
4. Browser opens the HTTPS URL
5. Redirect page extracts tokens and redirects to `myapp://auth/reset?access_token=...&refresh_token=...`
6. App opens and handles the custom scheme URL
7. User can set new password

## Testing

1. Request a password reset from the app
2. Check your email
3. Click the reset link
4. The app should open automatically
5. You should be able to set a new password

## Troubleshooting

**Link opens in browser but app doesn't open:**
- Make sure the redirect page is properly configured
- Check that the custom scheme (`myapp://`) is registered in your app
- Verify the redirect URL in the HTML matches your app scheme

**Tokens not being passed:**
- Check the redirect HTML page is correctly extracting and passing tokens
- Verify the URL format matches what Supabase sends

**Gmail still blocking:**
- For full Gmail compatibility, consider setting up Universal Links (iOS) or App Links (Android)
- This requires additional configuration but provides the best user experience

## Advanced: Universal Links / App Links

For the best experience (especially with Gmail), consider setting up Universal Links (iOS) or App Links (Android). This allows HTTPS URLs to open directly in your app without a redirect page.

This requires:
- A domain you control
- Properly configured `apple-app-site-association` file (iOS)
- Properly configured `assetlinks.json` file (Android)
- App configuration in `app.config.js`

See Expo's documentation on [deep linking](https://docs.expo.dev/guides/linking/) for more details.

