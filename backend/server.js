require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const cors = require('cors');
const mammoth = require('mammoth');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// --- Security Middleware ---
app.use(helmet());

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per window
	standardHeaders: true, 
	legacyHeaders: false, 
});

// Apply the rate limiting middleware to API calls only
app.use('/analyze-document', apiLimiter);
app.use('/submit-order', apiLimiter);


// --- Nodemailer Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
const SITE_EMAIL = process.env.SITE_EMAIL;

// --- Multer Configuration ---
// Vercel is stateless, so we must process files in memory
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage }).single('document');

// --- Middleware ---
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the root directory
const staticPath = path.join(__dirname, '../');
app.use(express.static(staticPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});


// --- Document Analysis Route ---
app.post('/analyze-document', upload, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Error: No File Selected!' });
    }

    try {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        const text = result.value;
        
        const cleanedText = text
            .replace(/[\u2010-\u2015]/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, '');
    
        const words = cleanedText.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        const pageCount = Math.ceil(wordCount / 450);

        res.status(200).json({ wordCount, pageCount });

    } catch (error) {
        console.error('Document Analysis Error:', error);
        res.status(500).json({ message: 'Failed to analyze document.' });
    }
});

// --- New Order Submission Route (Refactored for Vercel) ---
app.post('/submit-order', upload, async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Error: No File Selected!' });
    }

    const { userEmail, services, deliveryTime, totalPrice } = req.body;

    if (!userEmail || !services || !deliveryTime) {
        return res.status(400).json({ success: false, message: 'Missing order details.' });
    }

    try {
        const servicesList = JSON.parse(services);

        // Send file buffer instead of file path
        sendEmailWithAttachment(
            userEmail,
            req.file.buffer, // Pass the buffer
            req.file.originalname,
            servicesList,
            deliveryTime,
            totalPrice
        );

        res.status(200).json({ success: true, message: 'Order submitted successfully!' });

    } catch (error) {
        console.error('Order Submission Error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit order.' });
    }
});


// --- Email Sending Function (Refactored for Vercel) ---
function sendEmailWithAttachment(userEmail, fileBuffer, fileName, services, deliveryTime, totalPrice) {
    console.log(`Attempting to send email for: ${fileName} from ${userEmail}`);

    const servicesHtml = '<ul>' + services.map(s => `<li>${s}</li>`).join('') + '</ul>';

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: SITE_EMAIL,
        subject: `طلب جديد: ${fileName}`,
        html: `
            <h3>طلب جديد</h3>
            <p><strong>البريد الإلكتروني للعميل:</strong> ${userEmail}</p>
            <h4>الخدمات المطلوبة:</h4>
            ${servicesHtml}
            <p><strong>مدة التسليم المختارة:</strong> ${deliveryTime}</p>
            <hr>
            <p><strong>التكلفة الإجمالية:</strong> ${totalPrice}</p>
            <p>الملف المرفوع موجود في المرفقات.</p>
        `,
        attachments: [{
            filename: fileName,
            content: fileBuffer // Use content (buffer) instead of path
        }]
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.error('Nodemailer Error:', error);
        }
        console.log('Email sent successfully: ' + info.response);
    });
}

// Export the app for Vercel to use
module.exports = app;
