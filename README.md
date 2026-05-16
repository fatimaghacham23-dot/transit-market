<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy Transit Market

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e8a6c609-c07e-43cd-b27c-40bb1c5eb6cf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and fill in the `GEMINI_API_KEY` and `VITE_FIREBASE_*` values
3. Run the app:
   `npm run dev`

## Firebase Auth setup

Firebase config is read from Vite environment variables in `.env.local` and Vercel environment variables. Client-side Firebase variables must use the `VITE_` prefix, such as `VITE_FIREBASE_API_KEY`.

This app uses the Firebase project `transit-market-d1fff`, the default Firestore database, and Google Auth. Product image uploads are compressed in the browser and saved as data URL strings in Firestore; Firebase Storage is not used. Do not set a Firestore database ID unless the project is changed to a real custom database.

For local Google admin login, Firebase Console must have:

- Authentication > Sign-in method > Google enabled
- Authentication > Settings > Authorized domains: `localhost`, `127.0.0.1`, and `transit-market.vercel.app`

Admin access is checked against the bootstrap email `12134189a@gmail.com` and the Firestore document `admins/{uid}`. If sign-in succeeds but that document is missing, the app displays an `admin/missing-role` message with the signed-in UID and the exact document path to create.
