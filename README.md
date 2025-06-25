Android Build DevOps Pipeline
This repository implements a DevOps solution for building Android applications on Google Cloud Platform (GCP). The system triggers builds when zip files are uploaded to a Cloud Storage bucket, compiles the Android application, stores results in Firestore, and posts build status to a webhook.
Architecture

Cloud Storage: Stores uploaded Android app zip files.
Cloud Functions: Triggers build on new zip file uploads.
Cloud Build: Compiles the Android application using Gradle.
Firestore: Stores build results and logs.
Webhook: Publishes build results (e.g., to https://webhook.site).

Prerequisites

GCP account with billing enabled (see Billing Setup).
gcloud CLI installed (gcloud init to configure).
Node.js 20 for Cloud Function development.
Android SDK for local testing (optional).
Webhook URL from https://webhook.site.

Setup Instructions
1. Clone Repository
git clone https://github.com/your-username/android-build-pipeline.git
cd android-build-pipeline

2. Configure GCP Project
gcloud config set project YOUR_PROJECT_ID

Replace YOUR_PROJECT_ID with your GCP project ID (e.g., 602763997614).
3. Enable Required APIs
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com storage.googleapis.com

4. Billing Setup
If you encounter billing errors (e.g., FAILED_PRECONDITION: Billing account not found):

Go to GCP Billing.
Create or link a billing account to your project.
Verify with:gcloud billing projects describe YOUR_PROJECT_ID


Link billing if needed:gcloud billing projects link YOUR_PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID



5. Create Cloud Storage Bucket
gsutil mb -l us-central1 gs://android-builds-YOUR_PROJECT_ID

Choose a region (e.g., us-central1) matching your Firestore location.
6. Set Up Firestore

In GCP Console, navigate to Firestore (under "Databases").
Click Create Database:
Select Native Mode.
Choose a location (e.g., us-central1).
Click Create.


Create a collection:
Click Start Collection.
Enter build_results as the Collection ID.
Add a sample document (optional):
Document ID: build-test-001
Fields:
buildId: build-test-001 (String)
success: true (Boolean)
logUrl: https://console.cloud.google.com/cloud-build/builds/build-test-001 (String)
timestamp: 2025-06-24T14:30:00Z (String)
error: `` (String, empty if success)


Save.




Set Firestore permissions:gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/datastore.user"


Deploy security rules (see firestore.rules):gcloud firestore rules deploy firestore.rules



7. Deploy Cloud Function
cd cloud-function
gcloud functions deploy trigger-android-build \
  --runtime nodejs20 \
  --trigger-bucket gs://android-builds-YOUR_PROJECT_ID \
  --entry-point triggerBuild \
  --set-env-vars WEBHOOK_URL=https://webhook.site/your-unique-id


Replace WEBHOOK_URL with your unique URL from https://webhook.site.
Monitor logs:gcloud functions logs read trigger-android-build



8. Configure Cloud Build

Ensure cloudbuild.yaml is in the repository root.
Grant Cloud Build permissions:gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_ID@cloudbuild.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"


Test build by uploading a zip (e.g., YetCalc):gsutil cp yetCalc.zip gs://android-builds-YOUR_PROJECT_ID



Repository Structure
├── cloud-function/
│   ├── index.js           # Cloud Function code
│   ├── package.json       # Node.js dependencies
├── scripts/
│   ├── setup-android-sdk.sh  # Android SDK setup for Cloud Build
├── cloudbuild.yaml        # Cloud Build configuration
├── firestore.rules        # Firestore security rules
├── README.md

Testing

Upload a zip file:gsutil cp yetCalc.zip gs://android-builds-YOUR_PROJECT_ID


Monitor Cloud Build in GCP Console.
Check Firestore build_results collection.
Verify webhook at https://webhook.site.

Build Result Format
Posted to webhook:
{
  "buildId": "unique-build-id",
  "success": true,
  "logUrl": "https://console.cloud.google.com/cloud-build/builds/unique-build-id",
  "timestamp": "2025-06-24T14:30:00Z",
  "error": ""
}

Demo Environment

GCP Project: android-build-demo
Access granted to: nashpaz@gmail.com
Bucket: gs://android-builds-android-build-demo
Firestore: build_results collection

Scalability

Cloud Functions auto-scale with uploads.
Cloud Build parallelizes builds.
Firestore handles high read/write throughput.

Error Handling

Retries builds 3 times.
Stores logs in Cloud Build.
Posts errors to webhook.

Security

Least privilege IAM roles.
Encrypted storage and transfers.
Firestore rules restrict access.

Future Improvements

Store build artifacts in Cloud Storage.
Add build queue for high volume.
Support multiple Android SDK versions.

