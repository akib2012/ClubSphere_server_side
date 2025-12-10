// Firebase Admin initialization using base64 from .env
const admin = require("firebase-admin");

if (process.env.FB_SERVICE_KEY) {
  try {
    // Decode the base64 string from .env
    const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString("utf-8");

    // Parse JSON
    const serviceAccount = JSON.parse(decoded);

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("Firebase Admin initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
  }
} else {
  console.log("FB_SERVICE_KEY not found in .env");
}
