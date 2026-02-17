# Expo Go Password Reset Setup Guide

This guide explains how to set up password reset for Expo Go using a web-based approach (no deep linking required).

## How It Works

1. **User requests password reset** → App sends email with web URL
2. **User clicks link in email** → Opens web page (works in Gmail and all email clients)
3. **Web page handles reset** → Extracts tokens, allows password entry, updates password
4. **User reopens app** → Signs in with new password

## Setup Steps

### 1. Host the Reset Page

You need to host the `public/reset-password.html` file on a web server.

**Option A: Free Hosting Services**
- **GitHub Pages**: Upload to a GitHub repo and enable Pages
- **Netlify**: Drag and drop the file or use Netlify CLI
- **Vercel**: Deploy the file
- **Firebase Hosting**: Free hosting option

**Option B: Your Own Server**
- Upload `public/reset-password.html` to your web server
- Make sure it's accessible via HTTPS

### 2. Update Environment Variable

Edit your `.env` file:

```env
EXPO_PUBLIC_SUPABASE_REDIRECT_URL=https://yourdomain.com/reset-password.html
```

Replace `https://yourdomain.com/reset-password.html` with your actual hosted URL.

### 3. Configure Supabase

1. Go to Supabase Dashboard
2. Navigate to **Authentication** > **URL Configuration**
3. Under **Redirect URLs**, add your reset page URL:
   ```
   https://yourdomain.com/reset-password.html
   ```
4. Click **Save**

### 4. Update Reset Page Configuration (if needed)

If your Supabase URL or keys are different, edit `public/reset-password.html` and update these lines:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

## Testing

1. **Request password reset** from the app
2. **Check your email** (works with Gmail!)
3. **Click the reset link**
4. **Web page opens** (no blank page!)
5. **Enter new password** and confirm
6. **See success message**
7. **Reopen the app** and sign in with new password

## Advantages of This Approach

✅ **Works with Expo Go** - No deep linking needed  
✅ **Works with Gmail** - HTTPS URLs are not blocked  
✅ **No blank pages** - Full web interface  
✅ **Simple setup** - Just host one HTML file  
✅ **Demo-safe** - Reliable for presentations  
✅ **Cross-platform** - Works on all devices  

## Troubleshooting

### Reset page shows "Invalid reset link"

**Cause:** Tokens expired or URL malformed

**Fix:**
- Request a new password reset
- Make sure the link hasn't expired (usually 1 hour)
- Check that Supabase redirect URL is configured correctly

### Reset page can't update password

**Cause:** Session not established or expired

**Fix:**
- Check browser console for errors
- Verify Supabase URL and keys in the HTML file
- Make sure the reset link is fresh (request new one if needed)

### Page doesn't load

**Cause:** Hosting issue or incorrect URL

**Fix:**
- Verify the URL is accessible in a browser
- Check that HTTPS is working
- Ensure the file is actually uploaded to the server

## File Structure

```
project/
├── public/
│   └── reset-password.html    # Web-based reset page
├── app/
│   └── auth/
│       └── forgot.tsx         # Sends reset email with web URL
└── .env                       # Contains redirect URL
```

## Next Steps

Once you have the reset page hosted:

1. Update `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` in `.env`
2. Add the URL to Supabase redirect URLs
3. Test the flow end-to-end
4. You're done! 🎉

This solution is perfect for Expo Go and college demos - simple, reliable, and works everywhere!

