require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const port = process.env.PORT || 3000;

// Initialize Firebase Admin
if (process.env.FB_SERVICE_KEY) {
  const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
    "utf-8"
  );
  const serviceAccount = JSON.parse(decoded);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin initialized.");
} else {
  console.log("FB_SERVICE_KEY not found in .env");
}

const app = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(express.json());

// JWT middleware
const verifyJWT = async (req, res, next) => {
  const token = req.headers?.authorization?.split(" ")[1];
  console.log("access token here: >>>>", token);
  console.log(req.tokenEmail);

  if (!token)
    return res.status(401).send({ message: "Unauthorized Access!  here " });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log("Decoded JWT:", decoded);
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
async function run() {
  try {
    const db = client.db("ClubSphere");
    const usersconllections = db.collection("users");
    const clubcollections = db.collection("clubs");
    const membershipCollections = db.collection("memberships");

    //

    // users api here

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const result = await usersconllections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const usersinfo = req.body;
      usersinfo.createdAt = new Date();
      usersinfo.role = "member";
      const userExists = await usersconllections.findOne({
        email: usersinfo.email,
      });

      if (userExists) {
        return res.send({ message: "user exists" });
      }
      const result = await usersconllections.insertOne(usersinfo);
      res.send(result);
    });

    // get user for the role based

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersconllections.findOne(query);
      res.send({ role: user?.role || "member" });
    });

    // all users here:
    app.get("/users", async (req, res) => {
      const result = await usersconllections.find().toArray();
      res.send(result);
    });

    /* clube related api here */

    app.get("/clubs/approved", async (req, res) => {
      const approvedClubs = await clubcollections
        .find({ status: "aproved" })
        .toArray();
      res.send(approvedClubs);
    });

    app.get("/clubs/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const result = await clubcollections.findOne({ _id: id });
      res.send(result);
    });

    app.get("/clubs", async (req, res) => {
      const cursor = clubcollections.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/myclubs',verifyJWT, async(req,res) => {
      const email = req.tokenEmail;
      // console.log("here is test email:",email);
      const cluberwoner = clubcollections.find({managerEmail: email});
      const result  = await cluberwoner.toArray();
      res.send(result);

      
    })

    app.post("/club", async (req, res) => {
      const clubinfo = req.body;
      const result = await clubcollections.insertOne(clubinfo);
      res.send(result);
    });

    app.patch("/clubs/:id/status", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      const result = await clubcollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      res.send(result);
    });

    /* memberships related api here */

    app.post("/memberships", verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail; // token theke email
        const { clubId, status, joinedAt } = req.body;

        if (!clubId) {
          return res.status(400).json({ message: "clubId is required" });
        }

        if (!email) {
          return res.status(401).json({ message: "Unauthorized" });
        }

       
        const alreadyMember = await membershipCollections.findOne({
          clubId: String(clubId),
          userEmail: email,
        });

        if (alreadyMember) {
          return res.status(409).json({
            message: "User already joined this club",
          });
        }

        
        const newMembership = {
          clubId: String(clubId),
          userEmail: email,
          status: status,
          createdAt: joinedAt,
        };

        const result = await membershipCollections.insertOne(newMembership);

        res.status(201).json({
          message: "Membership created successfully",
          membershipId: result.insertedId,
        });
      } catch (err) {
        console.error("Membership create error:", err);
        res.status(500).json({ message: "Internal server error" });
      }
    });


    /* members ship api get here */

    app.get("/memberships/my", verifyJWT, async (req, res) => {
      try {
        const { clubId } = req.query;
        console.log(clubId);
        const email = req.tokenEmail;
        console.log({ email });

        if (!clubId) {
          return res.status(400).json({ message: "clubId is required" });
        }

        if (!email) {
          return res.status(401).json({ message: "Unauthorized verify" });
        }

        const membership = await membershipCollections.findOne({
          clubId: String(clubId),
          userEmail: email,
        });

        res.status(200).json(membership ?? null);
      } catch (err) {
        console.error("Error fetching membership:", err);
        res
          .status(500)
          .json({ message: "Internal server error", error: err.message });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
}
run().catch(console.error);

app.get("/", (req, res) => {
  res.send("Hello from Server..");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
