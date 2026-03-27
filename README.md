# Bazooka BJBA Tracker

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import your GitHub repo
3. Vercel auto-detects Create React App — just click Deploy
4. Done! Your app is live.

## Firebase Security Rules (switch from test mode after launch)

In Firebase Console → Firestore → Rules, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

This locks the database so only signed-in Google users can access it.
