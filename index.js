require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
  // console.log("access token here: >>>>", token);
  // console.log(req.tokenEmail);

  if (!token)
    return res.status(401).send({ message: "Unauthorized Access!  here " });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    // console.log("Decoded JWT:", decoded);
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
    const eventscollections = db.collection("events");
    const eventRegistrationscollection = db.collection("eventRegistrations");
    const paymentCollection = db.collection("payments");
    //

    const verifyADMIN = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersconllections.findOne({ email });
      if (user?.role !== "admin")
        return res
          .status(403)
          .send({ message: "Admin only Actions!", role: user?.role });

      next();
    };

    const verifyMANAGER = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersconllections.findOne({ email });
      if (user?.role !== "manager")
        return res
          .status(403)
          .send({ message: "manager only Actions!", role: user?.role });

      next();
    };

    // users api here

    app.patch("/users/:id", verifyJWT, verifyADMIN, async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const result = await usersconllections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send(result);
    });

    app.get("/userprofile", verifyJWT, async (req, res) => {
      const email = req.tokenEmail;
      const result = await usersconllections.findOne({ email: email });

      res.send(result);
    });

    app.post("/users", verifyJWT, async (req, res) => {
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

    app.get("/users/:email/role", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersconllections.findOne(query);
      res.send({ role: user?.role || "member" });
    });

    // all users here:
    app.get("/users", verifyJWT, verifyADMIN, async (req, res) => {
      const result = await usersconllections.find().toArray();
      res.send(result);
    });

    /* clube related api here */

    app.get("/clubs/approved", async (req, res) => {
      const approvedClubs = await clubcollections
        .find({ status: "aproved" })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(approvedClubs);
    });

    app.get("/approved-clubs", async (req, res) => {
      try {
        const result = await clubcollections
          .find({ status: "aproved" })
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to load clubs" });
      }
    });

    app.get("/clubs/approved-by-email", verifyJWT, async (req, res) => {
      const email = req.tokenEmail;

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const approvedClubs = await clubcollections
        .find({
          status: "aproved",
          managerEmail: email,
        })
        .toArray();

      res.send(approvedClubs);
    });

    app.get("/clubs/:id", verifyJWT, async (req, res) => {
      const id = new ObjectId(req.params.id);
      const result = await clubcollections.findOne({ _id: id });
      res.send(result);
    });

    app.get("/clubs", verifyJWT, async (req, res) => {
      const cursor = clubcollections.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/myclubs", verifyJWT, async (req, res) => {
      const email = req.tokenEmail;
      // console.log("here is test email:",email);
      const cluberwoner = clubcollections.find({ managerEmail: email });
      const result = await cluberwoner.toArray();
      res.send(result);
    });

    // Update club (manager only)

    app.post("/club", verifyJWT, verifyMANAGER, async (req, res) => {
      const clubinfo = req.body;
      const result = await clubcollections.insertOne(clubinfo);
      res.send(result);
    });

    app.patch("/clubs/:id/status", verifyJWT, async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      const result = await clubcollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      res.send(result);
    });

    /* update the club info here */

    app.patch("/clubs/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          clubName: updatedData.clubName,
          description: updatedData.description,
          category: updatedData.category,
          location: updatedData.location,
          membershipFee: updatedData.membershipFee,
          bannerImage: updatedData.bannerImage,
          updatedAt: new Date(),
        },
      };

      const result = await clubcollections.updateOne(filter, updateDoc);

      res.send(result);
    });

    /* clubs delete here */

    app.delete("/clubs/:id", verifyJWT, verifyMANAGER, async (req, res) => {
      const id = req.params.id;

      const result = await clubcollections.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    //  SEARCH & FILTER CLUBS

    // GET /club/search?search=&category=&sort=
    app.get("/club/search", async (req, res) => {
      try {
        const { search = "", category = "", sort = "newest" } = req.query;

        const query = { status: "aproved" };

        // Search by club name
        if (search.trim() !== "") {
          query.clubName = { $regex: search.trim(), $options: "i" };
        }

        // Filter by category
        if (category && category.trim() !== "") {
          query.category = { $regex: `^${category.trim()}$`, $options: "i" };
        }

        // Sort options
        let sortOption = {};
        switch (sort) {
          case "newest":
            sortOption = { createdAt: -1 };
            break;
          case "oldest":
            sortOption = { createdAt: 1 };
            break;
          case "highestFee":
            sortOption = { membershipFee: -1 };
            break;
          case "lowestFee":
            sortOption = { membershipFee: 1 };
            break;
          default:
            sortOption = { createdAt: -1 };
        }

        const clubs = await clubcollections
          .find(query)
          .sort(sortOption)
          .toArray();

        res.status(200).json(clubs);
      } catch (err) {
        console.error("Search clubs error:", err);
        res
          .status(500)
          .json({ message: "Failed to search clubs", error: err.message });
      }
    });

    /* memberships related api here */

    app.post("/memberships", verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail;
        const { clubId, status, joinedAt, manageremail, clubname, location } =
          req.body;

        if (!clubId) {
          return res.status(400).json({ message: "clubId is required" });
        }

        const alreadyMember = await membershipCollections.findOne({
          clubId: String(clubId),
          userEmail: email,
        });

        if (alreadyMember) {
          return res.status(409).json({
            message: "You already joined this club",
          });
        }

        const newMembership = {
          clubId: String(clubId),
          userEmail: email,
          status,
          createdAt: joinedAt,
          manageremail,
          clubname,
          location,
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

    /* .....................event create here.....and all api....... */

    app.post("/events", verifyJWT, async (req, res) => {
      const eventinfo = req.body;
      const result = await eventscollections.insertOne(eventinfo);
      res.send(result);
    });

    app.get("/Events", async (req, res) => {
      const events = eventscollections.find().sort({ createdAt: -1 });
      const result = await events.toArray();
      res.send(result);
    });

    app.get("/membersevent", verifyJWT, async (req, res) => {
      const useremail = req.tokenEmail;
      const selectedevent = await eventRegistrationscollection
        .find({ useremail: useremail })
        .toArray();

      if (selectedevent.length === 0) {
        return res.send([]);
      }

      res.send(selectedevent);
    });

    app.get("/event/by-wonermail", verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail;
        const userEvents = await eventscollections
          .find({ createdBy: email })
          .toArray();
        res.status(200).json(userEvents);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
      }
    });

    app.patch("/events/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      const result = await eventscollections.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            title: updatedData.title,
            location: updatedData.location,
            eventDate: updatedData.eventDate,
            description: updatedData.description,
            isPaid: updatedData.isPaid,
            eventFee: updatedData.eventFee,
            updatedAt: new Date(),
          },
        }
      );

      res.send(result);
    });

    app.post("/eventRegistrations", verifyJWT, async (req, res) => {
      const info = req.body;

      const { useremail, evnetid } = info;

      const exists = await eventRegistrationscollection.findOne({
        useremail: useremail,
        evnetid: evnetid,
      });

      if (exists) {
        return res.status(400).send({
          success: false,
          message: "You are already registered for this event.",
        });
      }

      const result = await eventRegistrationscollection.insertOne(info);

      res.send({
        success: true,
        insertedId: result.insertedId,
        message: "Event registration successful.",
      });
    });

    app.get("/eventRegistrations", verifyJWT, async (req, res) => {
      const result = await eventRegistrationscollection.find().toArray();

      res.send(result);
    });

    app.get("/eventRegistrations/evnetid", verifyJWT, async (req, res) => {
      const eventid = req.query.evnetid;
      const email = req.query.useremail;

      if (!eventid || !email) {
        return res
          .status(400)
          .send({ message: "Event ID and User Email required" });
      }

      const result = await eventRegistrationscollection.findOne({
        evnetid: eventid,
        useremail: email,
      });

      res.send(result);
    });

    ///  get one
    /* app.get("/eventRegistrations/evnetid",verifyJWT, async (req, res) => {
      const eventid = req.query.evnetid;
      const email = req.query.useremail;

      if (!eventid || !email) {
        return res
          .status(400)
          .send({ message: "Event ID and User Email required" });
      }

      const result = await eventRegistrationscollection.findOne({
        evnetid: eventid,
        useremail: email,
      });

      res.send(result);
    }); */

    //  delte one

    app.patch("/eventRegistrations/cancel", verifyJWT, async (req, res) => {
      const { evnetid, useremail } = req.query;

      if (!evnetid || !useremail) {
        return res
          .status(400)
          .send({ message: "Event ID and User Email required" });
      }

      // Update status to canceled
      const result = await eventRegistrationscollection.updateOne(
        { evnetid, useremail },
        { $set: { status: "canceled" } }
      );

      if (result.matchedCount === 0) {
        return res.status(400).send({ message: "Not registered!" });
      }

      res.send({
        success: true,
        message: "Registration canceled!",
      });
    });

    app.delete("/events/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await eventscollections.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    app.get("/events/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await eventscollections.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // GET /events/search?search=&isPaid=
    app.get("/event/search", async (req, res) => {
      try {
        const { search = "", isPaid } = req.query;

        const query = {};

        if (search.trim() !== "") {
          query.$or = [
            { title: { $regex: search.trim(), $options: "i" } },
            { location: { $regex: search.trim(), $options: "i" } },
          ];
        }

        const events = await eventscollections.find(query).toArray();
        res.status(200).json(events);
      } catch (err) {
        console.error("Search events error:", err);
        res
          .status(500)
          .json({ message: "Failed to search events", error: err.message });
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

    // mambesship get for the deshboard :

    app.get("/membership", verifyJWT, verifyMANAGER, async (req, res) => {
      const userEmail = req.tokenEmail;

      const clubs = await clubcollections
        .find({ managerEmail: userEmail })
        .toArray();

      if (clubs.length === 0) {
        return res.send([]);
      }

      const clubIds = clubs.map((club) => String(club._id));

      const members = await membershipCollections
        .find({ clubId: { $in: clubIds } })
        .toArray();

      res.send(members);
    });

    app.get("/clubmembers", verifyJWT, async (req, res) => {
      const userEmail = req.tokenEmail;
      const selectedclub = await membershipCollections
        .find({ userEmail: userEmail })
        .toArray();

      if (selectedclub.length === 0) {
        return res.send([]);
      }

      res.send(selectedclub);
    });

    app.patch(
      "/membership/:id/expire",
      verifyJWT,
      verifyMANAGER,
      async (req, res) => {
        const id = req.params.id;

        const result = await membershipCollections.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "expired" } }
        );

        res.send(result);
      }
    );

    /* stat related api here */
    app.get("/clubss/:id/stats", verifyJWT, verifyADMIN, async (req, res) => {
      try {
        const clubId = req.params.id;

        const totalMembers = await membershipCollections.countDocuments({
          clubId: String(clubId),
          status: { $ne: "expired" },
        });

        const totalEvents = await eventscollections.countDocuments({
          clubId: String(clubId),
        });

        res.send({
          clubId,
          totalMembers,
          totalEvents,
        });
      } catch (error) {
        console.error("Club stats error:", error);
        res.status(500).send({ message: "Failed to fetch club stats" });
      }
    });

    /* .................... payments related api >>>>......................................... */
    // Payment endpoints

    app.post("/create-checkout-session", verifyJWT, async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: paymentInfo?.clubName,
                description: paymentInfo?.description,
                images: [paymentInfo.bannerImage],
              },
              unit_amount: paymentInfo?.amount * 100,
            },
            quantity: paymentInfo?.quantity,
          },
        ],
        customer_email: paymentInfo?.userEmail,
        mode: "payment",
        metadata: {
          plantId: paymentInfo?.clubId,
          customer: paymentInfo?.userEmail,
        },
        success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/clubs/${paymentInfo?.clubId}`,
      });
      res.send({ url: session.url });
    });

    app.post("/payment-success", async (req, res) => {
      try {
        const { sessionId } = req.body;

        if (!sessionId) {
          return res.status(400).send({ message: "Session ID required" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const clubId = session.metadata.plantId;
        const userEmail = session.customer_email;

        const alreadyPaid = await paymentCollection.findOne({
          clubId: new ObjectId(clubId),
          userEmail: userEmail,
          status: "paid",
        });

        if (alreadyPaid) {
          return res.status(409).send({
            message: "Payment already completed for this club",
          });
        }

        // get club
        const club = await clubcollections.findOne({
          _id: new ObjectId(clubId),
        });

        if (!club) {
          return res.status(404).send({ message: "Club not found" });
        }

        // save payment info
        const paymentInfo = {
          clubId: club._id,
          transactionId: session.payment_intent,
          userEmail: userEmail,
          status: "paid",
          clubName: club.clubName,
          category: club.category,
          price: session.amount_total / 100,
          image: club.bannerImage,
          createdAt: new Date(),
        };

        const paymentResult = await paymentCollection.insertOne(paymentInfo);

        await membershipCollections.updateOne(
          {
            clubId: String(clubId),
            userEmail: userEmail,
            status: "pendingPayment",
          },
          {
            $set: {
              status: "active",
              paidAt: new Date(),
            },
          }
        );

        res.send({
          success: true,
          message: "Payment successful & membership activated",
          transactionId: session.payment_intent,
          orderId: paymentResult.insertedId,
        });
      } catch (error) {
        console.error("Payment success error:", error);
        res.status(500).send({ message: "Payment verification failed" });
      }
    });

    app.get("/payments", verifyJWT, verifyADMIN, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // Get payments for the logged-in member
    app.get("/memberpayments", verifyJWT, async (req, res) => {
      try {
        const email = req.tokenEmail;

        if (!email) return res.status(400).json({ message: "Email required" });

        const payments = await paymentCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json(payments);
      } catch (err) {
        console.error("Member payments error:", err);
        res.status(500).json({ message: "Failed to fetch member payments" });
      }
    });

    /* ********************  admin desh board overviews             ******************************************8 */

    // ================= ADMIN SUMMARY API =================
    app.get("/admin/summary", verifyJWT, verifyADMIN, async (req, res) => {
      try {
        /* ---------- USERS ---------- */
        const totalUsers = await usersconllections.countDocuments();

        /* ---------- CLUBS ---------- */
        const totalClubs = await clubcollections.countDocuments();

        const approvedClubs = await clubcollections.countDocuments({
          status: "aproved",
        });

        const pendingClubs = await clubcollections.countDocuments({
          status: "pending",
        });

        const rejectedClubs = await clubcollections.countDocuments({
          status: "rejected",
        });

        /* ---------- MEMBERSHIPS ---------- */
        const totalMemberships = await membershipCollections.countDocuments();

        /* ---------- EVENTS ---------- */
        const totalEvents = await eventscollections.countDocuments();

        /* ---------- PAYMENTS (SUM) ---------- */
        const paymentAgg = await paymentCollection
          .aggregate([
            { $match: { status: "paid" } },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: "$price" },
              },
            },
          ])
          .toArray();

        const totalPaymentAmount =
          paymentAgg.length > 0 ? paymentAgg[0].totalAmount : 0;

        /* ---------- RESPONSE ---------- */
        res.status(200).json({
          users: totalUsers,
          clubs: {
            total: totalClubs,
            approved: approvedClubs,
            pending: pendingClubs,
            rejected: rejectedClubs,
          },
          memberships: totalMemberships,
          events: totalEvents,
          revenue: totalPaymentAmount,
        });
      } catch (error) {
        console.error("Admin summary error:", error);
        res.status(500).json({
          message: "Failed to fetch admin summary",
          error: error.message,
        });
      }
    });

    // ================= MANAGER SUMMARY API =================
    app.get("/manager/summary", verifyJWT, verifyMANAGER, async (req, res) => {
      try {
        const managerEmail = req.tokenEmail;

        // ---------- Clubs managed by this manager ----------
        const managerClubs = await clubcollections
          .find({ managerEmail })
          .toArray();
        const totalClubs = managerClubs.length;

        // ---------- Memberships in these clubs ----------
        const clubIds = managerClubs.map((club) => String(club._id));
        const totalMembers = await membershipCollections.countDocuments({
          clubId: { $in: clubIds },
        });

        // ---------- Events created by this manager ----------
        const totalEvents = await eventscollections.countDocuments({
          createdBy: managerEmail,
        });

        // ---------- Payments received for these clubs ----------
        const paymentsAgg = await paymentCollection
          .aggregate([
            {
              $match: {
                clubId: { $in: clubIds.map((id) => new ObjectId(id)) },
                status: "paid",
              },
            },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: "$price" },
              },
            },
          ])
          .toArray();

        const totalPaymentAmount =
          paymentsAgg.length > 0 ? paymentsAgg[0].totalAmount : 0;

        res.status(200).json({
          clubs: totalClubs,
          members: totalMembers,
          events: totalEvents,
          revenue: totalPaymentAmount,
        });
      } catch (error) {
        console.error("Manager summary error:", error);
        res.status(500).json({
          message: "Failed to fetch manager summary",
          error: error.message,
        });
      }
    });

    // ================= MEMBER SUMMARY API =================
    app.get("/member/summary", verifyJWT, async (req, res) => {
      try {
        const userEmail = req.tokenEmail;

        // ---------- Clubs joined ----------
        const clubsJoined = await membershipCollections
          .find({ userEmail })
          .toArray();
        const totalClubsJoined = clubsJoined.length;

        // ---------- Events registered ----------
        const clubIds = clubsJoined.map((m) => String(m.clubId));
        const eventsRegistered = await eventRegistrationscollection
          .find({ useremail: userEmail })
          .toArray();
        const totalEventsRegistered = eventsRegistered.length;

        // ---------- Upcoming events from their clubs ----------
        const now = new Date();
        const upcomingEvents = await eventscollections
          .find({
            clubId: { $in: clubIds },
            eventDate: { $gte: now },
          })
          .sort({ eventDate: 1 })
          .toArray();

        res.status(200).json({
          totalClubsJoined,
          totalEventsRegistered,
          upcomingEvents,
          userEmail,
        });
      } catch (error) {
        console.error("Member summary error:", error);
        res.status(500).json({
          message: "Failed to fetch member summary",
          error: error.message,
        });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log("Connected to MongoDB successfully!");
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
