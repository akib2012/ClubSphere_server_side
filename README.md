# **ClubSphere – Backend (Server Side)**

Backend API for **ClubSphere**, a full-stack MERN application for managing local clubs, memberships, events, and payments. This server handles authentication, role-based authorization, database operations, and Stripe payment processing.

---

## 📌 **Project Overview**

The backend of **ClubSphere** is built using **Node.js**, **Express.js**, and **MongoDB**, with secure authentication via **Firebase Admin SDK** and payment processing through **Stripe API**. It provides RESTful APIs to support role-based dashboards for **Admins**, **Club Managers**, and **Members**.

---

## 🚀 **Key Features**

* RESTful API architecture
* Firebase JWT-based authentication & authorization
* Role-based access control (Admin, Club Manager, Member)
* Secure Stripe payment integration (test mode)
* CRUD operations for clubs, events, and memberships
* Event registration & membership lifecycle handling
* Admin moderation system (approve/reject clubs)
* Centralized payment tracking
* Production-ready CORS configuration

---

## 🛠 **Technology Stack**

* Node.js
* Express.js
* MongoDB
* Firebase Admin SDK (JWT verification)
* Stripe API
* CORS
* dotenv

---

## 📂 **Project Structure**

```
server/
├── index.js
├── routes/
│   ├── users.routes.js
│   ├── clubs.routes.js
│   ├── events.routes.js
│   ├── memberships.routes.js
│   ├── payments.routes.js
│   └── admin.routes.js
├── middleware/
│   ├── verifyJWT.js
│   ├── verifyAdmin.js
│   └── verifyClubManager.js
├── config/
│   ├── firebase.config.js
│   └── stripe.config.js
├── utils/
│   └── generateToken.js
└── .env
```

---

## 🗄 **Database Collections**

### **users**

* name
* email
* photoURL
* role (admin | clubManager | member)
* createdAt

### **clubs**

* clubName
* description
* category
* location
* bannerImage
* membershipFee
* status (pending | approved | rejected)
* managerEmail (FK → users)
* createdAt, updatedAt

### **memberships**

* userEmail
* clubId
* status (active | expired | pendingPayment)
* paymentId
* joinedAt
* expiresAt (optional)

### **events**

* clubId
* title
* description
* eventDate
* location
* isPaid
* eventFee
* maxAttendees (optional)
* createdAt

### **eventRegistrations**

* eventId
* userEmail
* clubId
* status (registered | cancelled)
* paymentId (optional)
* registeredAt

### **payments**

* userEmail
* amount
* type (membership | event)
* clubId
* eventId (optional)
* stripePaymentIntentId / transactionId
* status
* createdAt

---

## 🔐 **Authentication & Authorization**

* Firebase Authentication (handled on client)
* Firebase Admin SDK verifies JWT on server
* Protected routes using middleware:

  * `verifyJWT`
  * `verifyAdmin`
  * `verifyClubManager`

---

## 💳 **Stripe Payment Flow**

1. Client requests payment intent
2. Server creates Stripe PaymentIntent
3. Stripe returns `clientSecret`
4. Client confirms payment
5. Server stores payment & updates membership/event status

---

## ⚙️ **Environment Variables**

Create a `.env` file in the `server` directory:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
STRIPE_SECRET_KEY=your_stripe_secret_key
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
```

---

## 📦 **Installation & Setup**

```bash
cd server
npm install
```

---

## ▶ **Run the Server**

```bash
npm run dev
```

The server will run on:

```
http://localhost:3000
```

---

## 🧪 **Testing Accounts (Client Side)**

### Admin

* Email: [admin100@gmail.com]
* Password: Admin@1234

### Club Manager

* Email: [manager100@gmail.com]
* Password: Manager@11234

---

## 📚 **Important NPM Packages**

* express
* cors
* mongodb
* firebase-admin
* stripe
* dotenv


**Developed by:** MD Perbej Bhuiyan Akib
