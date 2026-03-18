# 🗂️ Files-on-Cloud

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

> A cloud file storage and sharing web application — upload, manage, and share files from any device.

**Live Demo:** https://files-on-cloud.onrender.com

---

## 🚀 What This Project Does

Files-on-Cloud is a full-stack web application that allows users to upload, store, manage, and share files securely over the cloud.

The project is structured as:
- **Frontend** → `public/` (HTML, CSS, JavaScript)
- **Backend** → `backend/` (Node.js, Express)

---

## ⭐ Why It’s Useful

- Centralized online file storage
- Access files from anywhere
- Simple UI with minimal configuration
- REST APIs for easy integration

### Features
- 📤 File upload
- 📁 File listing & management
- 🔗 File download & sharing
- 🔒 Authentication (if enabled)

---

## 🧭 Getting Started

### 🛠️ Prerequisites

- Node.js (v14+)
- npm (v6+)

---

## 📥 Installation

```bash
git clone https://github.com/priyansh13-c/Files-on-Cloud.git
cd Files-on-Cloud
```

---

## 🔧 Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:

```env
PORT=5000
DATABASE_URL=your_database_url_here
JWT_SECRET=your_secret_key_here
```

---

## 📦 Frontend Setup

```bash
cd ../public
npm install
```

---

## ▶️ Run Locally

```bash
cd backend
npm start
```

```bash
cd public
npm start
```

Visit: http://localhost:3000

---

## 🧪 Usage

```http
POST /api/files
GET /api/files
GET /api/files/:fileId
```

---

## 👩‍💻 Maintainers

- **Priyansh** — Project Author

---

## 📄 License

MIT License. See `LICENSE` file.
