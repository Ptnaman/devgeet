# Push Notification Migration Runbook

Date: May 3, 2026

## Scope
- Move remote push send from client app to Firebase Cloud Functions.
- Move client token registration to native device tokens.
- Switch server delivery from Expo Push API to Firebase Cloud Messaging (FCM).
- Keep server-side delivery logging and receipt cleanup.

## What Was Implemented
- Callable function: `dispatchPushNotifications`
  - Actions:
    - `custom-single`
    - `custom-all`
    - `post-published`
    - `post-published-to-all`
    - `post-published-to-user`
    - `test-token`
- Function send path now uses `admin.messaging().sendEach()` (FCM) instead of Expo `/push/send`.
- `pushTokens` docs now store token `provider` metadata (`fcm` / `apns`).
- Scheduled function: `processPendingPushReceipts` (every 15 minutes)
  - Marks legacy Expo `pending` receipts as `expired`.
- Scheduled function: `cleanupPushReceiptLogs` (daily)
- Client app now calls callable function by default for push sends.
- Client token registration now uses `getDevicePushTokenAsync()` (native token), not Expo token.
- Legacy client-side Expo dispatch is disabled (`useLegacyClientPushDispatch = false`).
- Current platform behavior:
  - Android: eligible for FCM push.
  - iOS: token provider is `apns`; those tokens are intentionally skipped by FCM sender.

## Files Added
- `functions/index.js`
- `functions/package.json`
- `firebase.json`
- `docs/push-notifications-migration.md`

## Files Updated
- `src/lib/firebase.ts`
- `src/lib/notifications.ts`

## Manual Steps Required (Production)
1. Rotate/revoke leaked service-account key immediately in Google Cloud IAM.
2. Install Firebase CLI if missing and login.
3. Install function dependencies:
   - `cd functions`
   - `npm install`
4. Deploy functions:
   - `firebase deploy --only functions`
5. Verify EAS push credentials:
   - Android app is linked to same Firebase project (`google-services.json`).
   - FCM API is enabled in Firebase/GCP project.
   - If iOS push is required, add either:
     - iOS FCM token flow in app, or
     - direct APNs sender path on backend.
6. Create and test a new dev build (Expo Go is not valid for push testing).
7. Production rollout:
   - 5% -> 20% -> 50% -> 100% with monitoring.

## Current Blockers (Observed on May 3, 2026)
- Deploy identity in use (`firebase-adminsdk-fbsvc@dev-geet.iam.gserviceaccount.com`) does not currently have enough project permissions.
- `serviceusage.googleapis.com` rejected API enable requests with `PERMISSION_DENIED`.
- `cloudresourcemanager.googleapis.com` IAM policy update call returned `PERMISSION_DENIED`.
- `iam.googleapis.com` was not enabled for the project during key-revocation attempts.

## Owner-Only Recovery Commands
Run these from Cloud Shell or any machine where `gcloud` is authenticated as a Project Owner:

1. Enable required APIs:
   - `gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com --project dev-geet`
2. Grant deploy roles to the deployment service account:
   - `gcloud projects add-iam-policy-binding dev-geet --member=\"serviceAccount:firebase-adminsdk-fbsvc@dev-geet.iam.gserviceaccount.com\" --role=\"roles/cloudfunctions.admin\"`
   - `gcloud projects add-iam-policy-binding dev-geet --member=\"serviceAccount:firebase-adminsdk-fbsvc@dev-geet.iam.gserviceaccount.com\" --role=\"roles/iam.serviceAccountUser\"`
   - `gcloud projects add-iam-policy-binding dev-geet --member=\"serviceAccount:firebase-adminsdk-fbsvc@dev-geet.iam.gserviceaccount.com\" --role=\"roles/serviceusage.serviceUsageAdmin\"`
3. Revoke leaked key:
   - `gcloud iam service-accounts keys delete a2756f70269ee2471bac5c23dbf606cbdf74c90c --iam-account firebase-adminsdk-fbsvc@dev-geet.iam.gserviceaccount.com --project dev-geet --quiet`
4. Deploy functions:
   - `npx firebase-tools deploy --only functions --project dev-geet --non-interactive`

## Validation Checklist
- Admin custom notification with push ON returns non-zero `pushRecipientCount` when eligible tokens exist.
- Publish flow sends:
  - broadcast push to active users
  - separate creator approval push when author differs from actor
- `pushReceipts` documents are created with `ok/error` immediately from FCM response.
- `messaging/registration-token-not-registered` and `messaging/invalid-registration-token`
  trigger token cleanup in `pushTokens`.
- Any old Expo `pending` receipts are marked `expired` by scheduler.

## Rollback
- Revert `functions/index.js` and `src/lib/notifications.ts` to pre-FCM commit.
- Deploy functions and release a rebuilt client.
