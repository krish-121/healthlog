# HealthLog - Arrhythmia Trigger Tracking Application

HealthLog is a full-stack health-monitoring web application built specifically for cardiac patients (such as those with Atrial Fibrillation, PVCs, or SVT). It empowers users to log their daily lifestyle triggers (caffeine, alcohol, sleep, stress, and exercise) and correlates them against heart rate and acute symptom episodes. 

Rather than relying on raw spreadsheets, HealthLog features a **custom multi-variable insight engine** that analyzes trigger combinations and outputs plain-English, actionable health patterns to help patients and their cardiologists make informed lifestyle interventions.

## 🚀 Key Features

- **JWT Authentication & Security:** Secure login/registration with bcrypt password hashing and strict per-user data isolation.
- **Custom Insight Engine:** A backend math engine that analyzes time-series data to calculate the "Strongest Single Trigger", "Worst Combination", and "Symptom Patterns".
- **Dynamic Dashboard:** Features interactive, dual-axis **Chart.js** visualizations mapping caffeine intake directly against baseline heart rates over 14-day rolling windows.
- **Real-Time Alerts:** Personalized warning banners trigger when daily limits (e.g., caffeine > 400mg) are exceeded.
- **Historical Editing:** A robust Global Date Picker and Logged Events Manager allows patients to retroactively submit and delete specific logged events to ensure data integrity.
- **Clinical PDF Export:** A dedicated export module that filters 7, 14, 30-day, or All-Time data, generating a Gold Standard chronological report suitable for a 15-minute cardiologist consultation.

## 🛠️ Technology Stack

- **Frontend:** HTML5, Tailwind CSS v3, Vanilla JavaScript (ES6+), Chart.js
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas, Mongoose
- **Auth:** JSON Web Tokens (JWT), bcryptjs

## ⚙️ Local Installation & Setup

To run this project locally, you will need [Node.js](https://nodejs.org/) and a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (or local MongoDB).

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/healthlog.git
   cd healthlog
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file inside the `backend` directory and add the following variables:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/healthlog
   JWT_SECRET=your_super_secret_jwt_string
   ```

4. **Start the backend server:**
   ```bash
   npm start
   # Server will run on http://localhost:5000
   ```

5. **Run the frontend:**
   Because the frontend uses Vanilla HTML/JS, you can simply open `frontend/index.html` in your browser, or use a tool like VS Code Live Server to serve the `frontend` folder.

## 📁 Folder Structure

* `/backend` - Express API routes, Mongoose models, JWT middleware, and the insight engine logic.
* `/frontend` - HTML views, Tailwind CSS styles, and Vanilla JS fetch logic.

## 🚀 Deployment

This application is configured to be easily deployed on **Render** (Backend as a Web Service, Frontend as a Static Site). Ensure that the `API` constant in your frontend JavaScript files points to your live Render backend URL before deploying the frontend.
