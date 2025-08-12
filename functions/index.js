const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

initializeApp();

const transporter = nodemailer.createTransport({
  host: 'vps-1711372-x.dattaweb.com',
  port: 587,
  secure: false,
  auth: {
    user: 'contacto@notificas.com',
    pass: '3JF9x*a2xS'
  }
});

exports.sendEmail = onDocumentCreated('mail/{docId}', async (event) => {
  const emailData = event.data.data();
  const docRef = event.data.ref;
  
  try {
    const mailOptions = {
      from: emailData.from || 'contacto@notificas.com',
      to: emailData.to,
      subject: emailData.message?.subject || 'Sin asunto',
      text: emailData.message?.text,
      html: emailData.message?.html
    };

    const result = await transporter.sendMail(mailOptions);
    
    await docRef.update({
      'delivery.state': 'SUCCESS',
      'delivery.time': FieldValue.serverTimestamp(),
      'delivery.info': result.messageId
    });

    console.log('Email enviado:', result.messageId);
    
  } catch (error) {
    console.error('Error:', error);
    
    await docRef.update({
      'delivery.state': 'ERROR',
      'delivery.time': FieldValue.serverTimestamp(),
      'delivery.error': error.message
    });
  }
});
