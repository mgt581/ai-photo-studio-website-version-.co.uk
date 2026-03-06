const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Firestore reference
const db = admin.firestore();

/**
 * Cloud Function: ext-firestore-user-document-backfillExistingUsers
 * 
 * This function ensures all existing authenticated users have corresponding
 * Firestore documents in the users collection.
 * 
 * It triggers on:
 * 1. New user creation (onCreate auth trigger)
 * 2. Can be called manually to backfill existing users
 */

// Triggered when a new user is created in Firebase Auth
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  console.log('New user created:', user.uid);
  
  const userData = {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    phoneNumber: user.phoneNumber || null,
    emailVerified: user.emailVerified || false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    tier: 'free',
    subscription: null
  };

  try {
    await db.collection('users').doc(user.uid).set(userData, { merge: true });
    console.log('User document created for:', user.uid);
    return { success: true };
  } catch (error) {
    console.error('Error creating user document:', error);
    return { success: false, error: error.message };
  }
});

// Triggered when a user is deleted from Firebase Auth
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
  console.log('User deleted:', user.uid);
  
  try {
    // Delete the user's Firestore document
    await db.collection('users').doc(user.uid).delete();
    console.log('User document deleted for:', user.uid);
    
    // Optionally: Delete user's gallery images
    const gallerySnapshot = await db.collection('users').doc(user.uid)
      .collection('gallery').get();
    
    if (!gallerySnapshot.empty) {
      const batch = db.batch();
      gallerySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log('User gallery deleted for:', user.uid);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting user document:', error);
    return { success: false, error: error.message };
  }
});

/**
 * HTTP endpoint to backfill existing users
 * This can be called manually or by the Firebase Extension
 * URL: https://europe-west2-ai-photo-studio-24354.cloudfunctions.net/extFirestoreUserDocumentBackfillExistingUsers
 */
exports.extFirestoreUserDocumentBackfillExistingUsers = functions.https.onCall(async (data, context) => {
  // Check if the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'This function requires authentication'
    );
  }

  console.log('Starting user document backfill...');
  
  try {
    // Get all users from Firebase Auth
    const listAllUsers = async (nextPageToken) => {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      return result;
    };

    let pageToken;
    let totalCreated = 0;
    let totalErrors = 0;
    const errors = [];

    // Paginate through all users
    do {
      const result = await listAllUsers(pageToken);
      
      for (const user of result.users) {
        try {
          // Check if user document already exists
          const userDoc = await db.collection('users').doc(user.uid).get();
          
          if (!userDoc.exists) {
            const userData = {
              uid: user.uid,
              email: user.email || null,
              displayName: user.displayName || null,
              photoURL: user.photoURL || null,
              phoneNumber: user.phoneNumber || null,
              emailVerified: user.emailVerified || false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              lastLogin: admin.firestore.FieldValue.serverTimestamp(),
              tier: 'free',
              subscription: null,
              // Mark as backfilled
              backfilledAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(user.uid).set(userData);
            totalCreated++;
            console.log('Backfilled user:', user.uid);
          }
        } catch (error) {
          totalErrors++;
          errors.push({ uid: user.uid, error: error.message });
          console.error('Error backfilling user:', user.uid, error);
        }
      }
      
      pageToken = result.pageToken;
    } while (pageToken);

    console.log('Backfill complete. Created:', totalCreated, 'Errors:', totalErrors);
    
    return {
      success: true,
      message: 'Backfill complete',
      created: totalCreated,
      errors: totalErrors,
      errorDetails: errors
    };
  } catch (error) {
    console.error('Backfill failed:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Backfill failed: ' + error.message
    );
  }
});

/**
 * HTTP endpoint (GET) for backfilling - can be triggered via URL
 */
exports.backfillUserDocuments = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.status(204).send('');
    return;
  }

  console.log('Manual backfill triggered via HTTP');

  try {
    // Get all users from Firebase Auth
    const listAllUsers = async (nextPageToken) => {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      return result;
    };

    let pageToken;
    let totalCreated = 0;
    let totalErrors = 0;

    // Paginate through all users
    do {
      const result = await listAllUsers(pageToken);
      
      for (const user of result.users) {
        try {
          // Check if user document already exists
          const userDoc = await db.collection('users').doc(user.uid).get();
          
          if (!userDoc.exists) {
            const userData = {
              uid: user.uid,
              email: user.email || null,
              displayName: user.displayName || null,
              photoURL: user.photoURL || null,
              phoneNumber: user.phoneNumber || null,
              emailVerified: user.emailVerified || false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              lastLogin: admin.firestore.FieldValue.serverTimestamp(),
              tier: 'free',
              subscription: null,
              // Mark as backfilled
              backfilledAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(user.uid).set(userData);
            totalCreated++;
            console.log('Backfilled user:', user.uid);
          }
        } catch (error) {
          totalErrors++;
          console.error('Error backfilling user:', user.uid, error);
        }
      }
      
      pageToken = result.pageToken;
    } while (pageToken);

    const message = `Backfill complete. Created: ${totalCreated}, Errors: ${totalErrors}`;
    console.log(message);
    
    res.status(200).json({
      success: true,
      message: message,
      created: totalCreated,
      errors: totalErrors
    });
  } catch (error) {
    console.error('Backfill failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Function to update user's last login time
 */
exports.updateLastLogin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'This function requires authentication'
    );
  }

  try {
    await db.collection('users').doc(context.auth.uid).update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating last login:', error);
    return { success: false, error: error.message };
  }
});

