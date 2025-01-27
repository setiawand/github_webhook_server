const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const util = require('util');
const Queue = require('bull');
const winston = require('winston');

const { sendDeploymentSuccessEmail, sendDeploymentFailureEmail } = require('./mailer');

require('dotenv').config();

// Bull Board imports
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

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

// Setup Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullAdapter(deployQueue),
    // Add more queues here if you have multiple
  ],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// Process deployment jobs
deployQueue.process(async (job) => {
  const { repoUrl, repoName, branch, commitMessage, committer } = job.data;
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
    await execPromise(`cd ${repoPath} && docker compose up --build -d && docker image prune -f`);
    logger.info(`Deployment of ${repoName} completed successfully.`);

    // Gather deployment information
    const deploymentInfo = {
      repoName: repoName,
      branch: branch,
      timestamp: new Date().toLocaleString(),
      deployedBy: 'Deployment Bot', // Customize as needed
      commitMessage: commitMessage,
      committer: committer,
    };

    // Send deployment success email
    await sendDeploymentSuccessEmail(deploymentInfo);

  } catch (error) {
    logger.error(`Deployment failed for ${repoName}: ${error.message}`);

    // Gather failure information
    const failureInfo = {
      repoName: repoName,
      branch: branch,
      timestamp: new Date().toLocaleString(),
      deployedBy: 'Deployment Bot', // Customize as needed
      error: error.message,
    };

    // Send deployment failure email
    await sendDeploymentFailureEmail(failureInfo);

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
    const branch = req.body.ref.split('/').pop(); // Extract branch name
    const commitMessage = req.body.head_commit ? req.body.head_commit.message : 'No commit message';
    const committer = req.body.head_commit ? req.body.head_commit.committer.username : 'Unknown';

    logger.info(`Repository URL: ${repoUrl}`);
    logger.info(`Repository Name: ${repoName}`);
    logger.info(`Branch: ${branch}`);
    logger.info(`Committer: ${committer}`);
    logger.info(`Commit Message: ${commitMessage}`);

    // Add job to queue
    deployQueue.add({
      repoUrl,
      repoName,
      branch,
      commitMessage,
      committer,
    }, {
      attempts: 3, // Retry up to 3 times on failure
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 seconds initial delay
      },
    });

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
