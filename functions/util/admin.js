const admin             = require('firebase-admin');
const serviceAccount    = require('../socialchimp-5c8f3-firebase-adminsdk-h3w1e-02d1f7b00c.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://socialchimp-5c8f3.firebaseio.com"
});

const db = admin.firestore();

module.exports = { admin, db };