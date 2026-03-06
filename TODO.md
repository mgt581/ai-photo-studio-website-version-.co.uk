# TODO List - Cloud Functions Setup

## Task: Create Cloud Functions for user document backfill

### Completed:
1. [x] Created functions/ directory structure
2. [x] Created package.json with dependencies
3. [x] Created index.js with Cloud Functions:
   - `onUserCreate` - Creates Firestore document when user signs up
   - `onUserDelete` - Deletes Firestore document when user is deleted
   - `extFirestoreUserDocumentBackfillExistingUsers` - Backfills existing users
   - `backfillUserDocuments` - HTTP endpoint for manual backfill
   - `updateLastLogin` - Updates user's last login time

### Deployment Status:
- **FAILED**: Billing account issue on Google Cloud project
- Error: "Write access to project 'ai-photo-studio-24354' was denied: please check billing account associated"

### Next Steps:
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Navigate to Billing and ensure a valid billing account is linked
3. Try deploying again with: `cd functions && firebase deploy --only functions`

### Files Created:
- functions/package.json
- functions/index.js
- functions/.eslintrc.js

