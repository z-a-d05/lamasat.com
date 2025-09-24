const express = require('express');
const multer = require('multer');
const path = require('path');
const { Resend } = require('resend');
const cors = require('cors');
const mammoth = require('mammoth');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);

// --- Sanity check for Environment Variables ---
console.log("--- Environment Variable Check ---");
console.log("SITE_EMAIL loaded:", !!process.env.SITE_EMAIL);
console.log("RESEND_API_KEY loaded:", !!process.env.RESEND_API_KEY);
console.log("FROM_EMAIL loaded:", !!process.env.FROM_EMAIL);
console.log("SECOND_RECIPIENT_EMAIL loaded:", !!process.env.SECOND_RECIPIENT_EMAIL);
console.log("---------------------------------");

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


// --- Resend Configuration ---
const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_EMAIL = process.env.SITE_EMAIL;

// --- Multer Configuration ---
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage }).single('document');

// --- API Middleware ---
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static('public'));

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

// --- New Order Submission Route ---
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

        await sendEmailWithAttachment(
            userEmail,
            req.file.buffer,
            req.file.originalname,
            servicesList,
            deliveryTime,
            totalPrice
        );

        res.status(200).json({ success: true, message: 'Order submitted successfully!' });

    } catch (error) {
        console.error('Order Submission Error:', error);
        res.status(500).json({ success: false, message: 'Failed to send email. Please try again later.' });
    }
});


// --- Email Sending Function (Now using Resend) ---
async function sendEmailWithAttachment(userEmail, fileBuffer, fileName, services, deliveryTime, totalPrice) {
    console.log(`Attempting to send email for: ${fileName} from ${userEmail} using Resend.`);

    const servicesHtml = '<ul>' + services.map(s => `<li>${s}</li>`).join('') + '</ul>';

    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    console.log(`Sending from email: ${fromEmail}`);


    try {
        const { data, error } = await resend.emails.send({
            from: fromEmail,
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
                content: fileBuffer
            }]
        });

        if (error) {
            console.error('RESEND_ERROR:', JSON.stringify(error, null, 2));
            throw new Error(error);
        }

        console.log('Resend success! Email ID:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Failed to send email via Resend:', error);
        throw error;
    }
}

// Export the app for Vercel to use
module.exports = app;   throw error;
    }
}

// Export the app for Vercel to use
module.exports = app;