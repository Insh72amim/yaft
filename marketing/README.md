# YAFT Marketing Website (Standalone & Netlify Ready)

A 100% static, high-performance marketing website for **YAFT (Yet Another Financial Tracker)**, decoupled from the core Next.js web application and NestJS backend.

---

## 📁 Directory Structure

```text
marketing/
├── index.html       # Complete semantic HTML5 structure with responsive layouts
├── styles.css       # Standalone light/dark theme styles & responsive breakpoints
├── script.js        # Interactive tabs, privacy masking toggle, and copy tools
├── netlify.toml     # Netlify configuration & security headers
└── README.md        # Deployment instructions
```

---

## 🚀 How to Deploy to Netlify

### Option 1: Netlify Git Integration (Recommended)
1. Go to [app.netlify.com](https://app.netlify.com) and click **"Add new site"** → **"Import an existing project"**.
2. Connect your Git repository.
3. Configure the build settings:
   - **Base directory**: `marketing`
   - **Build command**: *(leave empty)*
   - **Publish directory**: `.` (or `marketing`)
4. Click **Deploy**. Netlify will automatically build and publish the marketing website.

### Option 2: Netlify Drop (Drag and Drop)
1. Open [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag and drop the `marketing/` folder directly onto the browser window.
3. Your marketing site is live immediately with a free SSL certificate and CDN URL!

### Option 3: Netlify CLI
```sh
npm install -g netlify-cli
cd marketing
netlify deploy --prod
```

---

## 🔒 Security & Privacy Isolation

- **Zero App Code**: Contains no backend secrets, database connection strings, or Next.js app routes.
- **Zero Dependencies**: Pure HTML5, CSS3, and modern vanilla JavaScript. No `node_modules` or bundlers required.
- **Independent Lifecyle**: Update marketing copy and styles without touching the self-hosted financial ledger codebase.
