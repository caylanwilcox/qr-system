# Security Guide

## 🔒 Environment Variables Setup

This project uses environment variables to securely store sensitive credentials like Firebase service account keys. **Never commit these credentials to version control.**

### Setting Up Your Environment

1. **Create a `.env` file** in the project root directory:
   ```bash
   touch .env
   ```

2. **Add your Firebase credentials** to the `.env` file:
   ```env
   # Firebase Service Account Configuration
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY_ID=your-private-key-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----"
   FIREBASE_CLIENT_EMAIL=your-service-account-email@your-project.iam.gserviceaccount.com
   FIREBASE_CLIENT_ID=your-client-id
   FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
   ```

3. **Verify the `.env` file is in `.gitignore`** (it should already be there):
   ```bash
   grep -n "\.env" .gitignore
   ```

### Getting Your Firebase Credentials

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Extract the values and add them to your `.env` file

### Security Best Practices

#### ✅ DO:
- Use environment variables for all sensitive data
- Keep the `.env` file in `.gitignore`
- Use different service accounts for different environments
- Regularly rotate your service account keys
- Limit service account permissions to only what's needed
- Use Firebase security rules to protect your database

#### ❌ DON'T:
- Commit credentials to version control
- Share your `.env` file via email or messaging
- Use production credentials in development
- Store credentials in code comments
- Push credentials to public repositories

### If Credentials Are Accidentally Exposed

If you accidentally commit credentials to version control:

1. **Immediately revoke the exposed credentials** in the Firebase Console
2. **Generate new credentials** and update your `.env` file
3. **Remove the credentials from git history**:
   ```bash
   # Remove the file from git history
   git filter-branch --force --index-filter \
   'git rm --cached --ignore-unmatch path/to/file/with/credentials' \
   --prune-empty --tag-name-filter cat -- --all
   
   # Force push to update remote repository
   git push origin --force --all
   ```
4. **Notify your team** about the credential rotation

### Environment-Specific Setup

#### Development
- Use a separate Firebase project for development
- Limit database access to development data only

#### Production
- Use production Firebase project credentials
- Implement proper backup and monitoring
- Use Firebase security rules to restrict access

### Troubleshooting

#### Missing Environment Variables Error
If you see an error about missing environment variables:

1. Ensure your `.env` file exists in the project root
2. Check that all required variables are defined
3. Restart your development server after adding variables
4. Verify the variable names match exactly (case-sensitive)

#### Firebase Authentication Errors
If you get Firebase authentication errors:

1. Verify your service account has the correct permissions
2. Check that the private key is properly formatted (with `\n` for line breaks)
3. Ensure the project ID matches your Firebase project
4. Confirm the database URL is correct

### File Structure
```
project-root/
├── .env                    # Your environment variables (NEVER commit)
├── .env.example           # Template file (safe to commit)
├── .gitignore             # Must include .env
├── attendance-backend/    # Backend scripts
│   ├── *.js              # All scripts now use environment variables
│   └── README.md         # Backend-specific documentation
└── src/                  # Frontend application
```

### Contact

If you have questions about security or need help with credential setup, please contact the development team.

---

**Remember: Security is everyone's responsibility. When in doubt, ask for help rather than risk exposing credentials.** 