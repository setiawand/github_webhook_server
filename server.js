const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json({ verify: verifySignature }));

const GITHUB_SECRET = process.env.GITHUB_SECRET;
const DEPLOYMENT_PATH = process.env.DEPLOYMENT_PATH;

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
    exec(`cd ${DEPLOYMENT_PATH} && git pull && docker-compose up --build -d`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error during deploy: ${stderr}`);
        return res.status(500).send('Deploy failed');
      }
      console.log(`Deploy success: ${stdout}`);
      res.status(200).send('Deploy successful');
    });
  } else {
    res.status(200).send('Event ignored');
  }
});

// Start server
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
