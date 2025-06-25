const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');
const { CloudBuildClient } = require('@google-cloud/cloudbuild');
const axios = require('axios');
const unzipper = require('unzipper');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const rimraf = require('rimraf');

exports.triggerBuild = async (event, context) => {
  const file = event;
  const storage = new Storage();
  const firestore = new Firestore();
  const buildId = context.eventId || uuidv4();
  const bucket = storage.bucket(file.bucket);
  const zipFile = bucket.file(file.name);
  const tempDir = `/tmp/${buildId}`;

  try {
    // Download zip as Buffer and save to temp file
    const [zipContent] = await zipFile.download();
    await fs.promises.writeFile(`/tmp/${file.name}`, zipContent);

    // Extract zip
    await new Promise((resolve, reject) => {
      fs.createReadStream(`/tmp/${file.name}`)
        .pipe(unzipper.Extract({ path: tempDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    // Trigger Cloud Build
    const build = {
      steps: [
        { name: 'gcr.io/cloud-builders/gradle', args: ['build'], dir: tempDir },
      ],
      source: { storageSource: { bucket: file.bucket, object: file.name } },
    };
    const cloudbuild = new CloudBuildClient();
    const [operation] = await cloudbuild.createBuild({ projectId: process.env.GCP_PROJECT, build });
    const [buildResult] = await operation.promise();

    // Store result in Firestore
    const logUrl = `https://console.cloud.google.com/cloud-build/builds/${buildResult.metadata.build.id}?project=${process.env.GCP_PROJECT}`;
    const buildData = {
      buildId,
      success: buildResult.status === 'SUCCESS',
      logUrl,
      timestamp: new Date().toISOString(),
      error: buildResult.status !== 'SUCCESS' ? buildResult.statusDetail || 'Build failed' : '',
    };
    await firestore.collection('build_results').doc(buildId).set(buildData);

    // Post to webhook
    await axios.post(process.env.WEBHOOK_URL, buildData);

    console.log(`Build ${buildId} completed: ${buildResult.status}`);
  } catch (error) {
    console.error(`Build ${buildId} failed: ${error.message}`);
    const errorData = {
      buildId,
      success: false,
      logUrl: '',
      timestamp: new Date().toISOString(),
      error: error.message,
    };
    await firestore.collection('build_results').doc(buildId).set(errorData);
    await axios.post(process.env.WEBHOOK_URL, errorData);
  } finally {
    try {
      await fs.promises.unlink(`/tmp/${file.name}`);
      rimraf.sync(tempDir);
    } catch (cleanupError) {
      console.error(`Cleanup failed: ${cleanupError.message}`);
    }
  }
};
