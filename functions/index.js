const   functions                   = require('firebase-functions'),
        app                         = require('express')(),
        db                          = require('./util/admin'),
        { 
            getAllScreams, 
            postOneScream,
            getScream,
            commentOnScream,
            likeScream,
            unlikeScream,
            deleteScream 
        }                           = require('./handlers/screams'),
        { 
            signup, 
            login, 
            uploadImage, 
            addUserDetails, 
            getAuthenticatedUser,
            getUserDetails,
            markNotificationsRead 
        }                           = require('./handlers/users'),
        FBAuth                      = require('./util/fbAuth')
;

// ==============
// SREAMS ROUTES
// ==============

// INDEX ROUTE - get all screams
app.get('/screams', getAllScreams);

// SHOW ROUTE - get one scream
app.get('/scream/:screamId', getScream);

// CREATE ROUTE - post one scream 
app.post('/scream', FBAuth, postOneScream);

// CREATE ROUTE - comment on a scream
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);

// CREATE ROUTE - like and unlike a scream
app.get('/scream/:screamId/like', FBAuth, likeScream);
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream);

// DELETE ROUTE - delete a scream 
app.delete('/scream/:screamId', FBAuth, deleteScream);

// ==============
// USERS ROUTES
// ==============

// SIGNUP ROUTE
app.post('/signup', signup); 

// LOGIN ROUTE
app.post('/login', login);

// UPLOAD IMAGE ROUTE
app.post('/user/image', FBAuth, uploadImage);

// ADD USER DETAILS ROUTE
app.post('/user', FBAuth, addUserDetails);

// GET USER DETAILS
app.get('/user', FBAuth, getAuthenticatedUser);

// GET ANOTHER USER'S DETAILS
app.get('/user/:handle', getUserDetails)

app.post('/notifications', FBAuth, markNotificationsRead)

exports.api = functions.region('us-central1').https.onRequest(app);

exports.createNotificationOnLike = functions
  .region('us-central1')
  .firestore.document('likes/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            screamId: doc.id
          });
        }
      })
      .catch((err) => console.error(err));
  });

exports.deleteNotificationOnUnLike = functions
  .region('us-central1')
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  
  });

exports.createNotificationOnComment = functions
  .region('us-central1')
  .firestore.document('comments/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            screamId: doc.id
          });
        }
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.onUserImageChange = functions
  .region('us-central1')
  .firestore.document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('image has changed');
      const batch = db.batch();
      return db
        .collection('screams')
        .where('userHandle', '==', change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onScreamDelete = functions
  .region('us-central1')
  .firestore.document('/screams/{screamId}')
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('screamId', '==', screamId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('screamId', '==', screamId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('screamId', '==', screamId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });