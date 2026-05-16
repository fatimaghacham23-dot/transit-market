<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e8a6c609-c07e-43cd-b27c-40bb1c5eb6cf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firebase Auth setup

Firebase config is currently read from [firebase-applet-config.json](firebase-applet-config.json). If you move Firebase config into `.env.local` in this Vite app, client-side Firebase variables must use the `VITE_` prefix, such as `VITE_FIREBASE_API_KEY`.

For local Google admin login, Firebase Console must have:

- Authentication > Sign-in method > Google enabled
- Authentication > Settings > Authorized domains: `localhost` and `127.0.0.1`

Admin access is checked against the hardcoded bootstrap email in `src/App.tsx` and the Firestore document `admins/{uid}`. If sign-in succeeds but that document is missing, the app displays an `admin/missing-role` message instead of failing silently.
