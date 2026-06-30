const nodemailer = require('nodemailer');
require('dotenv').config();

// Create SMTP transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const recipientEmail = process.env.NOTIFICATION_EMAIL || 'viktorshandrov@gmail.com';

/**
 * Send contact form message email to the owner
 */
async function sendContactEmail({ name, email, subject, message }) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('--------------------------------------------------');
        console.warn('⚠️ SMTP credentials are not configured in .env!');
        console.warn('Simulating contact form email notification:');
        console.warn(`To: ${recipientEmail}`);
        console.warn(`From: ${name} <${email}>`);
        console.warn(`Subject: New Message: ${subject}`);
        console.warn(`Message:\n${message}`);
        console.warn('--------------------------------------------------');
        return true; // Return true as a fallback success indicator for testing
    }

    const mailOptions = {
        from: `"${name}" <${process.env.SMTP_USER}>`,
        replyTo: email,
        to: recipientEmail,
        subject: `New Message: ${subject}`,
        text: `You have received a new message from your website contact form.

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
                <h2 style="color: #b8977e; border-bottom: 2px solid #b8977e; padding-bottom: 10px; margin-top: 0;">New Contact Form Message</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #b8977e;">${email}</a></p>
                <p><strong>Subject:</strong> ${subject}</p>
                <div style="margin-top: 20px; padding: 15px; background-color: #fcfbfa; border-left: 4px solid #b8977e; font-style: italic; white-space: pre-wrap;">${message}</div>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Contact email sent successfully: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Error sending contact email:', error);
        return false;
    }
}

/**
 * Send order notification email to the owner
 */
async function sendOrderNotificationEmail(order) {
    const domainUrl = process.env.DOMAIN_URL || 'http://localhost:3000';
    let digitalSectionHtml = '';
    let digitalSectionText = '';

    if (order.type === 'digital' && order.paymentStatus === 'Paid') {
        const downloadUrl = `${domainUrl}/api/download?session_id=${order.stripeSessionId}`;
        digitalSectionHtml = `
            <div style="margin-top: 20px; padding: 15px; background-color: #f5fbf6; border-left: 4px solid #2e7d32; border-radius: 4px;">
                <h3 style="color: #2e7d32; margin-top: 0; margin-bottom: 10px;">Digital Download Ready!</h3>
                <p style="margin: 0 0 15px 0; font-size: 0.9rem; color: #333;">Your payment has been successfully processed. Download your high-resolution digital artwork below:</p>
                <a href="${downloadUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2e7d32; color: white; text-decoration: none; font-weight: bold; border-radius: 4px; font-size: 0.85rem;">Download Digital Painting</a>
                <p style="margin: 12px 0 0 0; font-size: 0.8rem; color: #666;">If the button doesn't work, copy and paste this link in your browser:<br/><a href="${downloadUrl}" style="color: #b8977e; word-break: break-all;">${downloadUrl}</a></p>
            </div>
        `;
        digitalSectionText = `
DIGITAL DOWNLOAD READY!
----------------------
Your payment has been successfully processed. Download your digital artwork using the link below:
${downloadUrl}
`;
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('--------------------------------------------------');
        console.warn('⚠️ SMTP credentials are not configured in .env!');
        console.warn('Simulating order email notification:');
        console.warn(`To: ${recipientEmail}, ${order.customerEmail}`);
        console.warn(`Subject: New Order Placed: #${order.id}`);
        console.warn(`Product: ${order.itemName} (${order.itemPrice})`);
        console.warn(`Customer: ${order.customerName} <${order.customerEmail}> (${order.customerPhone})`);
        console.warn(`Shipping Address: ${order.customerAddress}`);
        console.warn(`Payment Method: ${order.paymentMethod}`);
        console.warn(`Payment Status: ${order.paymentStatus}`);
        if (order.type === 'digital' && order.paymentStatus === 'Paid') {
            console.warn(`Download Link: ${domainUrl}/api/download?session_id=${order.stripeSessionId}`);
        }
        console.warn('--------------------------------------------------');
        return true; // Return true as a fallback success indicator for testing
    }

    const mailOptions = {
        from: `"Gratsiela Art Shop" <${process.env.SMTP_USER}>`,
        to: [recipientEmail, order.customerEmail].filter(Boolean).join(', '),
        subject: `New Order Placed: #${order.id}`,
        text: `A new order has been placed on your website.

Order ID: ${order.id}
Date: ${new Date(order.date).toLocaleString()}
Product: ${order.itemName}
Price: ${order.itemPrice}
Payment Method: ${order.paymentMethod}
Payment Status: ${order.paymentStatus}
${digitalSectionText}
Customer Details:
Name: ${order.customerName}
Email: ${order.customerEmail}
Phone: ${order.customerPhone}
Shipping Address: ${order.customerAddress}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
                <h2 style="color: #b8977e; border-bottom: 2px solid #b8977e; padding-bottom: 10px; margin-top: 0;">New Order Notification</h2>
                <p>A new order has been registered on the Gratsiela Art Shop website.</p>
                
                ${digitalSectionHtml}
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px;">
                    <tr style="background-color: #fcfbfa;">
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eaeaea; color: #b8977e;">Order Details</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eaeaea; color: #b8977e;"></th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Order ID:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${order.id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Date:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${new Date(order.date).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Product:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${order.itemName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Price:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${order.itemPrice}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Payment Method:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${order.paymentMethod}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Payment Status:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea; font-weight: bold; color: ${order.paymentStatus === 'Paid' ? '#2e7d32' : '#c62828'};">${order.paymentStatus}</td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr style="background-color: #fcfbfa;">
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eaeaea; color: #b8977e;">Customer Information</th>
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #eaeaea; color: #b8977e;"></th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Name:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${order.customerName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Email:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><a href="mailto:${order.customerEmail}" style="color: #b8977e;">${order.customerEmail}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Phone:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${order.customerPhone}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;"><strong>Shipping Address:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eaeaea;">${order.customerAddress}</td>
                    </tr>
                </table>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Order email sent successfully: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Error sending order notification email:', error);
        return false;
    }
}

module.exports = {
    sendContactEmail,
    sendOrderNotificationEmail
};
