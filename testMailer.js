// testMailer.js
const { sendDeploymentSuccessEmail } = require('./mailer');

const testDeploymentInfo = {
  repoName: 'test-repo',
  branch: 'main',
  timestamp: new Date().toLocaleString(),
  deployedBy: 'Tester',
  commitMessage: 'Initial commit',
  committer: 'tester',
};

sendDeploymentSuccessEmail(testDeploymentInfo)
  .then(() => {
    console.log('Test deployment success email sent successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error sending test deployment success email:', error);
    process.exit(1);
  });
