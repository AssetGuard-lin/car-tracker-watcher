const admin = require("firebase-admin");
const axios = require("axios");
const express = require("express");

/* =========================================================
   1. WEB SERVER (needed to run on Render/Railway)
========================================================= */
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🚗 Car Tracker Watcher Running 🟢");
});

app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});

/* =========================================================
   2. FIREBASE INITIALIZATION
========================================================= */
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: process.env.FIREBASE_DB_URL
});

console.log("✅ Firebase Connected");

/* =========================================================
   3. WATCH CAR LOCATION IN DATABASE
========================================================= */
const carRef = admin.database().ref("cars/car_01");

console.log("🚀 Monitoring cars/car_01 for geofence breaches...");

/* =========================================================
   4. DISTANCE FUNCTION (Haversine)
========================================================= */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* =========================================================
   5. MAIN LISTENER
========================================================= */
carRef.on("value", async (snap) => {

  const data = snap.val();
  if (!data || !data.geofence) return;

  const carLat = data.lat;
  const carLng = data.lng;

  const fenceLat = data.geofence.lat;
  const fenceLng = data.geofence.lng;
  const radius = data.geofence.radius;

  if (!carLat || !carLng) return;

  const distance = getDistanceMeters(
    carLat,
    carLng,
    fenceLat,
    fenceLng
  );

  console.log("📍 Distance:", Math.round(distance), "meters");

  /* =========================================================
     6. BREACH DETECTED → SEND PUSH
  ========================================================= */
  if (distance > radius) {

    console.log("🚨 GEOFENCE BREACH DETECTED!");

    try {
      const response = await axios.post(
        "https://onesignal.com/api/v1/notifications",
        {
          app_id: process.env.ONESIGNAL_APP_ID,

          include_player_ids: [
            process.env.PLAYER_ID
          ],

          headings: { en: "🚨 Geofence Alert" },
          contents: {
            en: `Vehicle exited safe zone (${Math.round(distance)}m away)`
          }
        },
        {
          headers: {
            Authorization: `Basic ${process.env.ONESIGNAL_REST_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log("✅ Push Sent Successfully:", response.data.id);

    } catch (err) {
      console.error("❌ Push Failed:", err.response?.data || err.message);
    }
  }
});