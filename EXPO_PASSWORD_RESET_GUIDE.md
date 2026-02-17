# Expo Password Reset Deep Link Guide

This guide explains how the password reset flow works with Expo/Expo Go and how to configure it properly.

## How It Works

1. **User requests password reset** → App calls `resetPasswordForEmail` with redirect URL
2. **Supabase sends email** → Contains HTTPS redirect URL (for Gmail) or custom scheme URL
3. **User clicks link in email** → 
   - If HTTPS: Browser opens redirect page → Redirects to `myapp://auth/reset?access_token=...&refresh_token=...`
   - If custom scheme: App opens directly
4. **App handles deep link** → `_layout.tsx` extracts tokens, sets session, navigates to reset screen
5. **User sets new password** → Success!

## Configuration

### Option 1: Custom Scheme (Development/Testing)

**Works for:** Most email clients (not Gmail)

1. Leave `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` empty or unset in `.env`
2. The app will use `myapp://auth/reset` automatically
3. Add `myapp://auth/reset` to Supabase Dashboard > Authentication > URL Configuration

**Pros:**
- Simple, no hosting required
- Works immediately

**Cons:**
- Gmail blocks custom schemes
- Some email clients may show warnings

### Option 2: HTTPS Redirect (Production/Gmail)

**Works for:** All email clients including Gmail

1. Host `public/auth/reset.html` on your web server
   - Example: `https://yourdomain.com/auth/reset.html`
2. Set `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` in `.env`:
   ```
   EXPO_PUBLIC_SUPABASE_REDIRECT_URL=https://yourdomain.com/auth/reset.html
   ```
3. Add the same URL to Supabase Dashboard > Authentication > URL Configuration

**Pros:**
- Works with Gmail
- Professional appearance
- No email client warnings

**Cons:**
- Requires web hosting
- Slightly more complex setup

## Testing

### Test Custom Scheme (Development)

1. Request password reset from app
2. Check email (not Gmail)
3. Click link
4. App should open automatically
5. Reset password screen should appear

### Test HTTPS Redirect (Production)

1. Host `public/auth/reset.html` on your server
2. Configure redirect URL in `.env` and Supabase
3. Request password reset
4. Check email (including Gmail)
5. Click link
6. Browser opens briefly → App opens → Reset screen appears

## Troubleshooting

### Link opens browser but app doesn't open

**Cause:** Redirect page not working or custom scheme not registered

**Fix:**
- Verify redirect HTML page is hosted and accessible
- Check that `scheme: 'myapp'` is set in `app.config.js`
- Test custom scheme URL manually: `myapp://auth/reset`

### Blank page after clicking link

**Cause:** Redirect page has JavaScript errors or isn't loading

**Fix:**
- Check browser console for errors
- Verify redirect page is accessible via HTTPS
- Test redirect page directly in browser
- Ensure redirect page properly extracts and passes tokens

### App opens but reset screen shows "Waiting for reset link"

**Cause:** Tokens not being extracted or session not being set

**Fix:**
- Check console logs for URL handling
- Verify tokens are in the URL (check browser address bar)
- Ensure `_layout.tsx` is properly handling the URL
- Check Supabase session is being set correctly

### Gmail still blocking links

**Cause:** Using custom scheme instead of HTTPS redirect

**Fix:**
- Must use HTTPS redirect URL for Gmail
- Host `public/auth/reset.html` and configure it properly
- Add HTTPS URL to Supabase redirect URLs

## Deep Link Handling

The app handles deep links in two places:

1. **`app/_layout.tsx`** - Handles URL on app start/background, sets session, navigates
2. **`app/auth/reset.tsx`** - Verifies session and enables password reset form

Both handle:
- Cold start (app not running)
- Background state (app already running)
- Query parameters and hash fragments
- Multiple token formats (access_token/refresh_token, code, OTP)

## Expo Go vs Production Build

### Expo Go
- Uses `exp://` scheme for development
- Custom scheme (`myapp://`) works in development builds
- HTTPS redirect works the same in both

### Production Build
- Uses custom scheme from `app.config.js` (`myapp://`)
- HTTPS redirect works the same
- May require additional configuration for Universal Links (iOS) or App Links (Android)

## Next Steps

For production, consider:
- Setting up Universal Links (iOS) or App Links (Android)
- This allows HTTPS URLs to open directly in app without redirect page
- Provides best user experience
- See Expo's [deep linking documentation](https://docs.expo.dev/guides/linking/)

