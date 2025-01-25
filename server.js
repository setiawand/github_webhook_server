const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const util = require('util');
const Queue = require('bull');
const winston = require('winston');
require('dotenv').config();

const app = express();

// Promisify exec for better async/await handling
const execPromise = util.promisify(exec);

// Setup Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

app.use(express.json({ verify: verifySignature }));

const GITHUB_SECRET = process.env.GITHUB_SECRET;
const DEPLOYMENT_PATH = process.env.DEPLOYMENT_PATH;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Initialize Bull queue
const deployQueue = new Queue('deployments', {
  redis: { port: 6379, host: '127.0.0.1' }, // Adjust if needed
});

// Process deployment jobs
deployQueue.process(async (job) => {
  const { repoUrl, repoName } = job.data;
  const repoPath = `${DEPLOYMENT_PATH}/${repoName}`;

  try {
    if (!fs.existsSync(repoPath)) {
      logger.info(`Repository ${repoName} not found. Cloning...`);
      await execPromise(`git clone ${repoUrl} ${repoPath}`);
      logger.info(`Cloned repository ${repoName} successfully.`);
    } else {
      logger.info(`Repository ${repoName} exists. Pulling latest changes...`);
      await execPromise(`cd ${repoPath} && git pull`);
      logger.info(`Pulled latest changes for ${repoName}.`);
    }

    logger.info(`Deploying repository ${repoName} with Docker Compose...`);
    await execPromise(`cd ${repoPath} && docker compose up --build -d`);
    logger.info(`Deployment of ${repoName} completed successfully.`);
  } catch (error) {
    logger.error(`Deployment failed for ${repoName}: ${error.message}`);
    throw error; // Let Bull handle retries if configured
  }
});

// Function to verify GitHub signature
function verifySignature(req, res, buf) {
  const signature = `sha256=${crypto
    .createHmac('sha256', GITHUB_SECRET)
    .update(buf)
    .digest('hex')}`;

  if (req.headers['x-hub-signature-256'] !== signature) {
    logger.warn('Invalid signature detected.');
    throw new Error('Invalid signature');
  }
}

// Handle webhook
app.post('/webhook', (req, res) => {
  const event = req.headers['x-github-event'];
  if (event === 'push') {
    logger.info('Push event received. Enqueuing deployment.');

    const repoUrl = req.body.repository.clone_url.replace(
      'https://github.com',
      `https://${GITHUB_TOKEN}@github.com`
    );

    const repoName = req.body.repository.name;

    logger.info(`Repository URL: ${repoUrl}`);
    logger.info(`Repository Name: ${repoName}`);

    // Add job to queue
    deployQueue.add({ repoUrl, repoName });

    // Respond immediately
    res.status(200).send('Webhook received. Deployment enqueued.');
  } else {
    res.status(200).send('Event ignored');
  }
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Error processing webhook: ${err.message}`);
  res.status(400).send('Invalid signature.');
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
