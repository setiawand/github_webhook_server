const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json({ verify: verifySignature }));

const GITHUB_SECRET = process.env.GITHUB_SECRET;
const DEPLOYMENT_PATH = process.env.DEPLOYMENT_PATH;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function verifySignature(req, res, buf) {
  const signature = `sha256=${crypto
    .createHmac('sha256', GITHUB_SECRET)
    .update(buf)
    .digest('hex')}`;

  if (req.headers['x-hub-signature-256'] !== signature) {
    throw new Error('Invalid signature');
  }
}

// Function to handle deployment
function handleDeployment(repoUrl, repoName, res) {
  const repoPath = `${DEPLOYMENT_PATH}/${repoName}`;

  // Check if repository exists
  if (!fs.existsSync(repoPath)) {
    console.log('Repository not found. Cloning...');
    exec(`git clone ${repoUrl} ${repoPath}`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error during clone: ${stderr}`);
        // Log error but do not send response here
        return;
      }
      console.log(`Clone success: ${stdout}`);
      deployRepository(repoPath);
    });
  } else {
    deployRepository(repoPath);
  }
}

// Function to deploy repository
function deployRepository(repoPath) {
  exec(`cd ${repoPath} && git pull && docker compose up --build -d`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error during deploy: ${stderr}`);
      return;
    }
    console.log(`Deploy success: ${stdout}`);
  });
}

// Handle webhook
app.post('/webhook', (req, res) => {
  const event = req.headers['x-github-event'];
  if (event === 'push') {
    console.log('Push event received. Deploying...');

    // Extract and modify REPO_URL from payload
    const repoUrl = req.body.repository.clone_url.replace(
      'https://github.com',
      `https://${GITHUB_TOKEN}@github.com`
    );

    const repoName = req.body.repository.name;

    console.log(`Repository URL: ${repoUrl} ${repoName}`);

    // Respond immediately to GitHub
    res.status(200).send('Webhook received. Deployment in progress.');

    // Handle deployment asynchronously
    handleDeployment(repoUrl, repoName, res);
  } else {
    res.status(200).send('Event ignored');
  }
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
