// ✅ server.js - DanceCount Auth API (Production Ready)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ✅ MongoDB Connection
const dbUsername = 'deepikasidral';
const dbPassword = encodeURIComponent('deep@1711');
const dbName = 'dance_katta_db';

const uri = `mongodb+srv://${dbUsername}:${dbPassword}@cluster0.ysj38ta.mongodb.net/${dbName}?retryWrites=true&w=majority`;

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ OTP Schema
const otpUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otp: String,
  otpExpires: Date,
  createdFrom: String,
  registeredApps: [String]
});

const OTPUser = mongoose.model('OTPUser', otpUserSchema, 'otp_users');

// ✅ Health check
app.get('/', (req, res) => {
  res.send('✅ DanceCount Auth API is Live');
});

// ---------------------- Send OTP ----------------------
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    // Lookup the studio by email, but allow owner email as well
    const StudioCollection = mongoose.connection.collection('studios');

    const existingStudio = await StudioCollection.findOne({
      $and: [
        { status: "Approved" },
        {
          $or: [
            { contactEmail: email.toLowerCase() },
          ]
        }
      ]
    });

    if (!existingStudio) {
      return res.status(403).json({ message: 'Email is not approved or not registered' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    let user = await OTPUser.findOne({ email });

    if (!user) {
      user = new OTPUser({
        email,
        createdFrom: 'DanceCount',
        registeredApps: ['DanceCount'],
        otp,
        otpExpires: expires
      });
    } else {
      user.otp = otp;
      user.otpExpires = expires;
      if (!user.registeredApps.includes('DanceCount')) {
        user.registeredApps.push('DanceCount');
      }
    }

    await user.save();

    // Send email via Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"DanceCount" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your OTP for DanceCount',
      text: `Your OTP is: ${otp}`
    });

    console.log(`✅ OTP sent to ${email}: ${otp}`);

    return res.status(200).json({
      message: 'OTP sent!',
      studioId: existingStudio._id.toString(),
      contactNumber: existingStudio.contactNumber || ''
    });

  } catch (err) {
    console.error('❌ OTP error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ---------------------- Verify OTP ----------------------
app.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP required' });
  }

  try {
    const user = await OTPUser.findOne({ email });

    if (!user || user.otp !== otp || new Date() > new Date(user.otpExpires)) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    // Clear OTP after verification
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    const StudioCollection = mongoose.connection.collection('studios');

    const existingStudio = await StudioCollection.findOne({
      $and: [
        { status: "Approved" },
        {
          $or: [
            { contactEmail: email.toLowerCase() }
          ]
        }
      ]
    });

    if (!existingStudio) {
      return res.status(403).json({ message: 'Studio not found after verification' });
    }

    return res.status(200).json({
      message: 'OTP verified successfully',
      studioId: existingStudio._id.toString(),
      contactNumber: existingStudio.contactNumber || ''
    });

  } catch (err) {
    console.error('❌ Verify OTP error:', err);
    return res.status(500).json({ message: 'Server error during OTP verification' });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 DanceCount Auth API running on port ${PORT}`);
});
