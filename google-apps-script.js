// ═══════════════════════════════════════════════
// ShipTrack — Gmail Draft Creator
// ═══════════════════════════════════════════════
// 
// HOW TO SET UP:
// 1. Go to https://script.google.com → New Project
// 2. Delete any existing code and paste this entire file
// 3. Click "Deploy" → "New Deployment"
// 4. Type: "Web app"
// 5. Execute as: "Me (krvvy700@gmail.com)"
// 6. Who has access: "Anyone"
// 7. Click "Deploy" → Authorize when prompted
// 8. Copy the Web App URL → paste in Vercel as GMAIL_SCRIPT_URL
// ═══════════════════════════════════════════════

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var emails = data.emails; // Array of { to, subject, html }
    
    if (!emails || !emails.length) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'No emails provided', drafts: 0 })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    var created = 0;
    var failed = 0;
    var errors = [];
    
    for (var i = 0; i < emails.length; i++) {
      try {
        var email = emails[i];
        
        // Create a draft in Gmail
        GmailApp.createDraft(
          email.to,       // recipient
          email.subject,  // subject
          '',             // plain text body (empty, we use HTML)
          { htmlBody: email.html }  // HTML body
        );
        
        created++;
      } catch (err) {
        failed++;
        if (errors.length < 3) {
          errors.push(err.toString());
        }
      }
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        drafts: created,
        failed: failed,
        errors: errors,
        message: created + ' drafts created' + (failed > 0 ? ', ' + failed + ' failed' : '')
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString(), drafts: 0 })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function — run this to trigger the permission prompt
function testDraft() {
  GmailApp.createDraft('test@example.com', 'Test Draft', 'This is a test draft from ShipTrack');
  Logger.log('Test draft created! Check your Gmail Drafts folder.');
}
