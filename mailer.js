// mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using Gmail's SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address
    pass: process.env.GMAIL_APP_PASSWORD, // Your App Password
  },
});

// Verify the transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('Error configuring email transporter:', error);
  } else {
    console.log('Email transporter is configured correctly.');
  }
});

// Function to send a deployment success email
const sendDeploymentSuccessEmail = async (deploymentInfo) => {
  const { repoName, branch, timestamp, deployedBy, commitMessage, committer } = deploymentInfo;

  const mailOptions = {
    from: `"Deployment Bot" <${process.env.GMAIL_USER}>`, // Sender address
    to: process.env.EMAIL_RECIPIENTS, // List of receivers (comma-separated if multiple)
    subject: `✅ Deployment Successful: ${repoName} on ${branch}`,
    text: `Hello,

Your deployment for the repository "${repoName}" on branch "${branch}" was successful!

Details:
- **Repository:** ${repoName}
- **Branch:** ${branch}
- **Committer:** ${committer}
- **Commit Message:** ${commitMessage}
- **Time:** ${timestamp}
- **Deployed By:** ${deployedBy}

Best Regards,
Deployment Bot`,
    html: `<p>Hello,</p>
<p>Your deployment for the repository "<strong>${repoName}</strong>" on branch "<strong>${branch}</strong>" was successful!</p>
<p><strong>Details:</strong></p>
<ul>
  <li><strong>Repository:</strong> ${repoName}</li>
  <li><strong>Branch:</strong> ${branch}</li>
  <li><strong>Committer:</strong> ${committer}</li>
  <li><strong>Commit Message:</strong> ${commitMessage}</li>
  <li><strong>Time:</strong> ${timestamp}</li>
  <li><strong>Deployed By:</strong> ${deployedBy}</li>
</ul>
<p>Best Regards,<br/>Deployment Bot</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Deployment success email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending deployment success email:', error);
  }
};

// Function to send a deployment failure email (optional but recommended)
const sendDeploymentFailureEmail = async (failureInfo) => {
  const { repoName, branch, timestamp, deployedBy, error } = failureInfo;

  const mailOptions = {
    from: `"Deployment Bot" <${process.env.GMAIL_USER}>`, // Sender address
    to: process.env.EMAIL_RECIPIENTS, // List of receivers
    subject: `❌ Deployment Failed: ${repoName} on ${branch}`,
    text: `Hello,

Your deployment for the repository "${repoName}" on branch "${branch}" has failed.

Details:
- **Repository:** ${repoName}
- **Branch:** ${branch}
- **Time:** ${timestamp}
- **Deployed By:** ${deployedBy}
- **Error:** ${error}

Please investigate the issue.

Best Regards,
Deployment Bot`,
    html: `<p>Hello,</p>
<p>Your deployment for the repository "<strong>${repoName}</strong>" on branch "<strong>${branch}</strong>" has failed.</p>
<p><strong>Details:</strong></p>
<ul>
  <li><strong>Repository:</strong> ${repoName}</li>
  <li><strong>Branch:</strong> ${branch}</li>
  <li><strong>Time:</strong> ${timestamp}</li>
  <li><strong>Deployed By:</strong> ${deployedBy}</li>
  <li><strong>Error:</strong> ${error}</li>
</ul>
<p>Please investigate the issue.</p>
<p>Best Regards,<br/>Deployment Bot</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Deployment failure email sent:', info.messageId);
  } catch (error) {
    console.error('Error sending deployment failure email:', error);
  }
};

module.exports = { sendDeploymentSuccessEmail, sendDeploymentFailureEmail };
