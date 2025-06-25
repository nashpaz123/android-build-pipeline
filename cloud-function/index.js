const { Storage } = require('@google-cloud/storage');
const { CloudBuildClient } = require('@google-cloud/cloudbuild');
const axios = require('axios');
const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');

exports.triggerBuild = async (event, context) => {
  const file = event;
  const storage = new Storage();
  const firestore = new Firestore();
  const buildId = context.eventId || uuidv4();
  const bucket = storage.bucket(file.bucket);
  const zipFile = bucket.file(file.name);

  try {
    console.log(`ZIP uploaded: ${file.name}, triggering build ${buildId}`);

    const cloudbuild = new CloudBuildClient();
    const projectId = process.env.GCP_PROJECT;
    const build = {
      steps: [
        { name: 'gcr.io/android-build/android-sdk', entrypoint: '/bin/bash', args: ['/workspace/scripts/setup-android-sdk.sh'] },
        { name: 'gcr.io/cloud-builders/gradle', args: ['build'], dir: 'source' },
      ],
      source: {
        repoSource: {
          repoName: 'nashpaz123/android-build-pipeline',
          branchName: 'main',
        },
      },
    };
    const [operation] = await cloudbuild.createBuild({ projectId, build });
    const [buildResult] = await operation.promise();

    const logUrl = `https://console.cloud.google.com/cloud-build/builds/${buildResult.metadata.build.id}?project=${projectId}`;
    const buildData = {
      buildId,
      success: buildResult.status === 'SUCCESS',
      logUrl,
      timestamp: new Date().toISOString(),
      error: buildResult.status !== 'SUCCESS' ? buildResult.statusDetail || 'Build failed' : '',
    };
    await firestore.collection('build_results').doc(buildId).set(buildData);
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
  }
};
