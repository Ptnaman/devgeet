# DevGeet

DevGeet is a cross-platform reading and publishing app built with Expo, React Native, Expo Router, and Firebase. It provides categorized content feeds, search, favorites, creator tools, notifications, and role-based administration on Android, iOS, and the web.

## Features

- Email/password authentication with persistent sessions
- Native Google Sign-In in development and release builds
- Home and category feeds backed by Cloud Firestore
- Post search, recent searches, favorites, and creator following
- Rich post reader with images and supported video content
- User, author, and admin roles with author applications
- Admin tools for posts, categories, users, and notifications
- Offline-aware content caching and network status feedback
- Light, dark, and system themes
- EAS Update support
- Google Sans loaded through `@expo-google-fonts/google-sans`
- WordPress-to-Firebase content synchronization

## Tech stack

- Expo and React Native with TypeScript
- Expo Router for file-based navigation
- Firebase Authentication, Cloud Firestore, Cloud Functions, and FCM
- Expo SQLite and AsyncStorage for local persistence
- EAS Build and EAS Update for native distribution

## Local setup

### Requirements

- Node.js 20 or newer
- npm
- Android Studio for local Android builds
- Xcode on macOS for local iOS builds
- Java and Firebase CLI when running Firestore emulator tests or deploying backend resources

### Install and run

```bash
npm install
npm run start
```

The Expo CLI will show the available Android, iOS, web, and development-build options.

Expo Go can be used for compatible UI and email-auth flows. Native Google Sign-In, remote push notifications, and other custom native functionality require a development or release build.

## Environment variables

Configure these values in the local Expo environment:

```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_ADMIN_EMAILS=
```

Values prefixed with `EXPO_PUBLIC_` are bundled into the client application. Never store private keys, service-account credentials, or backend secrets in them.

WordPress sync secrets belong in `functions/.env`; see the dedicated setup guide below.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run start` | Start the Expo development server |
| `npm run android` | Build and run the native Android project |
| `npm run ios` | Build and run the native iOS project on macOS |
| `npm run web` | Start the web app |
| `npm run lint` | Run Expo ESLint checks |
| `npx tsc --noEmit` | Run TypeScript validation |
| `npm run test:rules` | Test Firestore rules with the local emulator |

## Firebase backend

Firestore rules, indexes, and Cloud Functions live in this repository. Install the function dependencies separately before local backend work or deployment:

```bash
cd functions
npm install
cd ..
```

Common deployment commands:

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

Review and test the selected Firebase resources before deploying them to production.

## Project structure

```text
src/app/          Expo Router routes
src/components/   Shared UI and icons
src/lib/          Firebase, content, caching, search, and notification logic
src/providers/    App-wide auth, theme, network, update, and data state
functions/        Firebase Cloud Functions and WordPress sync logic
docs/             Backend migration and integration guides
firestore.rules   Firestore access rules
```

## Additional documentation

- [Push notification migration](docs/push-notifications-migration.md)
- [WordPress to Firebase sync](docs/wordpress-firebase-sync.md)

## Before committing

```bash
npm run lint
npx tsc --noEmit
npm run test:rules
```

Do not commit `.env` secrets, Firebase service-account files, signing keys, or generated native credentials.
