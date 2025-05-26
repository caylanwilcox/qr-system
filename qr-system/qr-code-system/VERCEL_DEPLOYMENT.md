# Vercel Deployment Guide

## Email/Password Update Functionality

The system now supports updating user emails and passwords through a Vercel serverless function.

### How It Works

1. **Frontend**: Calls `/api/admin/update-user-auth` for both localhost and production
2. **Vercel API**: Handles Firebase Admin operations via serverless function
3. **No Backend Server**: No need for a separate Express server

### Environment Variables for Vercel

Set these in your Vercel dashboard under **Settings → Environment Variables**:

#### Required for Production:
```
FIREBASE_PROJECT_ID=qr-system-1cea7
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fqxwu@qr-system-1cea7.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id
FIREBASE_DATABASE_URL=https://qr-system-1cea7-default-rtdb.firebaseio.com
```

#### Frontend Variables:
```
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=qr-system-1cea7.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://qr-system-1cea7-default-rtdb.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=qr-system-1cea7
REACT_APP_FIREBASE_STORAGE_BUCKET=qr-system-1cea7.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Features

✅ **Email Updates**: Admins can change user email addresses
✅ **Password Updates**: Admins can change user passwords  
✅ **User Creation**: Creates Firebase Auth users if they don't exist
✅ **Database Sync**: Updates database with new credentials
✅ **Authentication**: Verifies admin tokens before making changes
✅ **Error Handling**: Comprehensive error logging and responses

### Usage

1. **Admin Access**: Only authenticated admins can update other users
2. **Personal Info Section**: Navigate to any user's profile
3. **Edit Mode**: Click "Edit" in Personal Information section
4. **Update Credentials**: Change email and/or password
5. **Save**: Click "Save Changes"

### Success Messages

- **"Profile updated successfully!"** - Everything worked correctly
- **Database and Firebase Auth both updated**

### Localhost Development

The system works identically on localhost and production:
- Uses the same `/api/admin/update-user-auth` endpoint
- Vercel dev server handles the API route locally
- No separate backend server needed

### Deployment

Simply deploy to Vercel with the environment variables set. The API endpoint will automatically handle all Firebase Admin operations.

```bash
vercel --prod
```

That's it! Email and password updates will work seamlessly. 🎉 