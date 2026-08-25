# 🚀 ROS Campaign Tracking Dashboard & Lead Management System

A dedicated, sleek client-facing Campaign Tracking Dashboard & Lead Management System built for **Ruhit Outreach Solutions (ROS)**.

Adheres strictly to the official **ROS Brand Identity Guidelines**:
- **Typography**: Space Grotesk
- **Palette**: Brand Black (`#0A0A0A`), Deep Navy (`#111827`), Midnight Blue (`#1E3A5F`), Electric Cyan (`#00C2FF`), Signal Green (`#00E5A0`), Brand Orange (`#F97316`), Pure White (`#FFFFFF`), Muted Gray (`#7B7B7B`).
- **Design Philosophy**: High-tech, minimalistic B2B agency telemetry with Signal Green KPI counters and Electric Cyan section headers.

---

## 🌟 Key Features

### 1. 📋 Google Mail Merge Fast Batch Dispatcher (1-Click Workflow)
- **Select Sequence Step**: Choose between `Email 1 — Initial Outreach`, `Email 2 — Follow-up 1`, and `Email 3 — Follow-up 2`.
- **Select Batch Size**: Instant presets (`10`, `25`, `50`, `100`, `All Eligible`) or enter any custom quantity.
- **1-Click Copy**: Copies 4 formatted columns (`Email Address`, `First Name`, `City`, `Company Name`) to clipboard as tab-separated values ready for immediate paste into row 2 of your Google Mail Merge Sheet.
- **Auto-Apply Sent Status**: 1-click updates all selected leads with `Email Sent - DD/MM/YY` and logs the sending account (`hello@crewlixglobal.com`), dynamically updating *Sent Today*, *Total Sent*, and sequence conversion counters in real-time.

### 2. 🎯 Interested Leads Pipeline & Stage Tracker
- Interactive **Kanban Board** & **Table View** for leads that replied positively:
  1. `🎯 Interested / Positive Reply`
  2. `📅 Discovery Call Booked`
  3. `📑 Proposal / Audit Sent`
  4. `🤝 Negotiation / Contract`
  5. `🏆 Closed Won`
  6. `❌ Not a Fit / Disqualified`
- 1-click stage advancement, notes management, and qualified deal value tracking (£).

### 3. 🏢 Multi-Client Workspaces & Role-Based Authentication
- **Agency Admin Mode**: Full access across all client workspaces, lead creation/editing, CSV imports, batch clipboard dispatcher, and credentials manager.
- **Client Portal Mode**: Dedicated, read-only executive view where clients log in to see their real-time outreach volume, sequence funnel, interested leads pipeline, and live campaign activity.
- Clients can log in directly with their unique workspace credentials from anywhere on the web (Vercel).

---

## 🔐 Default Login Credentials

### ⚡ Agency Administrator (Full Control)
- **Username**: `admin` (or `ruhitahmed111@gmail.com`)
- **Password**: `ros2026` (or `admin123`)


*(You can also create new client workspaces and set custom client login credentials anytime inside the Workspace Settings modal).*

---

## 🚢 How to Push to GitHub Desktop & Deploy on Vercel

### Step 1: Open in GitHub Desktop
1. Open **GitHub Desktop** on your PC.
2. Click **File** → **Add Local Repository...**
3. Choose path: `C:\Users\Staff Asia - PC\.gemini\antigravity\scratch\ros-campaign-dashboard`
4. If prompted to initialize a repository, click **Create a Repository**.
5. Click **Publish repository** to push it to your GitHub account (public or private).

### Step 2: 1-Click Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New...** → **Project**.
3. Select your `ros-campaign-dashboard` repository from the list.
4. Framework Preset will automatically detect **Vite**.
5. Click **Deploy**.
6. In ~30 seconds, Vercel will give you a live production URL (e.g. `https://ros-campaign-dashboard.vercel.app`)!

---

## 💻 Local Development

To run locally on your PC:
```bash
cd ros-campaign-dashboard
npm install
npm run dev
```

To build for production:
```bash
npm run build
```
