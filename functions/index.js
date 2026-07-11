/**
 * Firebase Cloud Function v2 (Node.js) for Podcast Guest Booking Manager.
 * Triggers on document creation in the 'leads' collection.
 * 
 * Flow:
 * 1. Triggers on Document Creation in the 'leads' collection.
 * 2. Checks if email_sent_status is 'Pending'.
 * 3. Authenticates via OAuth2 using process.env secrets.
 * 4. Composes an HTML outreach email.
 * 5. Base64 URL-safe encodes the MIME raw body.
 * 6. Sends the email using Google Gmail API.
 * 7. Updates Firestore status on Success or Logs errors on Failure.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { google } = require('googleapis');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

exports.onLeadCreated = onDocumentCreated('leads/{leadId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log('[Cloud Function] No snapshot data associated with event.');
    return;
  }

  const leadId = event.params.leadId;
  const leadData = snapshot.data();

  // 2. Check if leadData.email_sent_status is equal to "Pending". If not, terminate execution.
  if (leadData.email_sent_status !== 'Pending') {
    console.log(`[Cloud Function] Lead ${leadId} email_sent_status is "${leadData.email_sent_status || 'undefined'}", not "Pending". Terminating execution.`);
    return;
  }

  console.log(`[Cloud Function] Processing pending outreach email for lead ${leadId}: ${leadData.name}`);

  try {
    // 3. Use the 'googleapis' library to authenticate via OAuth2 using process.env variables
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN environment variables in Cloud Function config.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Instantiate Gmail API Client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 4. Compose an HTML email using the lead's first_name and company
    const leadName = leadData.name || 'there';
    const firstName = leadData.first_name || leadName.split(' ')[0] || 'there';
    const company = leadData.company || leadData.organization || 'your organization';
    
    // Extract recipient email (checking contactEmails list or email field fallback)
    let recipientEmail = '';
    if (Array.isArray(leadData.contactEmails) && leadData.contactEmails.length > 0) {
      recipientEmail = leadData.contactEmails[0];
    } else if (typeof leadData.contactEmails === 'string' && leadData.contactEmails) {
      recipientEmail = leadData.contactEmails;
    } else if (leadData.email) {
      recipientEmail = leadData.email;
    }

    if (!recipientEmail) {
      throw new Error(`Lead document ${leadId} has no valid contact email in 'contactEmails' or 'email' fields.`);
    }

    const subject = `Podcast collaboration & guest speaker request: ${company}`;
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #10b981; margin-top: 0; font-size: 20px;">Hello ${firstName},</h2>
        <p>I hope you are having an excellent week.</p>
        <p>I've been following your recent updates and the stellar impact of <strong>${company}</strong>. We're currently scheduling featured expert guests for our premium podcast series focusing on high-growth industries and executive insights.</p>
        <p>Given your extensive background, we think you would be an incredible fit to share your story, key milestones, and insights with our highly engaged audience.</p>
        <p>Are you available for a brief 10-minute introductory call sometime this week to discuss matching topics and outline the booking schedule?</p>
        <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #64748b;">
          <p style="margin: 0;">Warm regards,</p>
          <p style="margin: 4px 0 0 0; font-weight: 600; color: #0f172a;">Podcast Booking & Relations Team</p>
        </div>
      </div>
    `;

    // 5. Base64 URL-safe encode the MIME text body
    // Using UTF-8 safe headers and raw body preparation
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${recipientEmail}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      emailHtml
    ];
    const message = messageParts.join('\r\n');

    // Convert MIME message to Base64url encoded string
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 6. Send the email using the Gmail API endpoint
    console.log(`[Cloud Function] Sending outreach email to ${recipientEmail}...`);
    const sendResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`[Cloud Function] Email successfully sent! Message ID: ${sendResult.data.id}`);

    // 7. If successful, update the Firestore document's email_sent_status to "Sent" and lead_status to "Contacted"
    await snapshot.ref.update({
      email_sent_status: 'Sent',
      lead_status: 'Contacted',
      email_sent_at: admin.firestore.FieldValue.serverTimestamp(),
      gmail_message_id: sendResult.data.id
    });
    console.log(`[Cloud Function] Document ${leadId} successfully updated with Sent status.`);

  } catch (error) {
    console.error(`[Cloud Function] Error executing outreach email workflow for lead ${leadId}:`, error);
    
    // Catch error and update document with status "Error" and save in error_log
    try {
      await snapshot.ref.update({
        email_sent_status: 'Error',
        error_log: error.message || String(error),
        email_failed_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`[Cloud Function] Logged error status for lead ${leadId}.`);
    } catch (updateError) {
      console.error(`[Cloud Function] Fatal: Failed to update error status on lead document ${leadId}:`, updateError);
    }
  }
});
