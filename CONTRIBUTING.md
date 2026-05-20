# 🚀 Contributing to Files on Cloud

First off, thank you for taking the time to contribute! 🎉 Projects like *Files on Cloud* thrive because of community members like you.

Whether you are fixing a bug, adding a new feature, or improving documentation, your efforts make a big difference. Please take a moment to review this guide to make your contribution process smooth and successful.

---

## 🏗️ Repository Architecture

Before making changes, it helps to understand how the project is organized:

| Directory / File | Description |
|------------------|-------------|
| 📂 `public/` | Contains all frontend assets including the core layout (`index.html`), styles (`style.css`), and client-side JavaScript |
| 📂 `backend/` | Contains the server-side logic, API routes, and database configurations built with Node.js and Express |
| 📄 `server.js` | The main entry point of the backend application |

---

## 🛠️ Getting Started in 4 Easy Steps

### 🍴 Step 1 — Fork the Project

Click the **Fork** button at the top right of the main repository page to create a copy of the codebase under your personal GitHub account.

---

### 💻 Step 2 — Clone Your Fork

Bring the code to your local machine by running this command in your terminal:

```bash
git clone https://github.com/YOUR-USERNAME/Files-on-Cloud.git
cd Files-on-Cloud
```

---

### 🌿 Step 3 — Create a Feature Branch

Never work directly on the `main` branch. Create a separate, descriptively named branch for your task:

```bash
# ✨ For features
git checkout -b feat/your-feature-name

# 📚 For documentation fixes
git checkout -b docs/your-doc-update
```

---

### ⚡ Step 4 — Setup and Run Locally

Install the required dependencies and spin up the development server:

```bash
npm install
npm start
```

> 🌐 Open `http://localhost:3000` *(or the port specified in your console)* to view the app.

---

## 📝 Contribution Standards

To maintain code quality and ensure your Pull Request gets reviewed quickly, please follow these guidelines:

- 🎯 **Issue Assignment:** Do not start working on a feature unless a maintainer has explicitly assigned the relevant issue to you. If you find a bug or have an idea, open a new issue first and ask to be assigned.

- 🏷️ **Program/Event Context:** If you are contributing as part of a specific open-source event or program, please mention it in your issue comment or PR description so maintainers can apply the appropriate tracking labels.

- 🧼 **Vanilla Tech Stack:** Write standard, clean JavaScript, semantic HTML, and plain CSS. Do not introduce external CSS frameworks unless explicitly requested in the issue description.

- 💬 **Commit Messages:** Keep your commits descriptive and structured using conventional commit prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| ✨ `feat:` | New features | `feat: add password visibility toggle option` |
| 🐛 `fix:` | Bug fixes | `fix: resolve file download crash` |
| 📚 `docs:` | Documentation changes | `docs: implement contributing guidelines` |

---

## 🚀 Submitting Your Pull Request (PR)

### 1️⃣ Push Changes
Push your local commits to your GitHub fork:

```bash
git push origin your-branch-name
```

### 2️⃣ Open PR
Go to the original repository on GitHub, click **Compare & pull request**, and write a clear title explaining what you did.

### 3️⃣ Link Your Issue
In the PR description, explicitly link your issue so it auto-closes on merge:

```
Closes #5
```

### 4️⃣ Be Patient
The project maintainers will review your PR as soon as possible and suggest changes if needed! 🙌

---

<div align="center">

✨ *Thank you for being a part of this journey! Happy coding!* ✨

</div>
