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

// Handle webhook
app.post('/webhook', (req, res) => {
  const event = req.headers['x-github-event'];
  if (event === 'push') {
    console.log('Push event received. Deploying...');
    
    // Ambil REPO_URL dari payload
    const repoUrl = req.body.repository.clone_url.replace(
      'https://github.com',
      `https://${GITHUB_TOKEN}@github.com`
    );

    const repoName = req.body.repository.name;

    console.log(`Repository URL: ${repoUrl} ${repoName}`);

    // Cek apakah folder repository ada
    if (!fs.existsSync(DEPLOYMENT_PATH + '/' + repoName)) {
      console.log('Repository not found. Cloning...');
      exec(`git clone ${repoUrl} ${DEPLOYMENT_PATH + '/' + repoName}`, (err, stdout, stderr) => {
        if (err) {
          console.error(`Error during clone: ${stderr}`);
          return res.status(500).send('Clone failed');
        }
        console.log(`Clone success: ${stdout}`);
        deployRepository(res);
      });
    } else {
      deployRepository(res);
    }
  } else {
    res.status(200).send('Event ignored');
  }
});

// Deploy repository (git pull and docker-compose)
function deployRepository(res) {
  exec(`cd ${DEPLOYMENT_PATH + '/' + repoName} && git pull && docker-compose up --build -d`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error during deploy: ${stderr}`);
      return res.status(500).send('Deploy failed');
    }
    console.log(`Deploy success: ${stdout}`);
    res.status(200).send('Deploy successful');
  });
}

// Start server
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
