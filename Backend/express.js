const express = require('express');
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = 5000;

// -------------------- Middleware --------------------
app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Body:`, req.body);
  next();
});

// -------------------- MongoDB Connection --------------------
const user = encodeURIComponent(process.env.DB_USER);
const pass = encodeURIComponent(process.env.DB_PASS);
const cluster = process.env.DB_CLUSTER;
const dbName = process.env.DB_NAME;

const uri = `mongodb+srv://${user}:${pass}@${cluster}/${dbName}?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

let lessonsCollection;
let ordersCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db('lessonShopDB');
    lessonsCollection = db.collection('lessons');
    ordersCollection = db.collection('orders');
    console.log(' MongoDB connected to lessonShopDB');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
}
connectDB();

// -------------------- Multer Setup --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'images')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// -------------------- Admin Setup --------------------
const ADMIN_USERNAME = 'zuzu';
const ADMIN_PASSWORD = '1234';
const ADMIN_KEY = 'secret123';

function checkAdmin(req, res, next) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(403).json({ message: 'Forbidden' });
  next();
}

// -------------------- Routes --------------------

// Test server
app.get('/', (req, res) => res.send('Server is running!'));

// Admin login
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD)
    return res.json({ message: 'Login successful', adminKey: ADMIN_KEY });
  res.status(401).json({ message: 'Invalid credentials' });
});

// Get all lessons
app.get('/lessons', async (req, res) => {
  try {
    const lessons = await lessonsCollection.find().toArray();
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch lessons', error: err.message });
  }
});

// Admin adds lesson
app.post('/admin/lessons', checkAdmin, upload.single('image'), async (req, res) => {
  try {
    const { topic, location, price, space } = req.body;
    const image = req.file ? req.file.filename : null;
    if (!topic || !location || !price || !space || !image)
      return res.status(400).json({ message: 'All fields required' });

    const newLesson = { topic, location, price: Number(price), space: Number(space), image };
    const result = await lessonsCollection.insertOne(newLesson);
    res.status(201).json({ message: 'Lesson added successfully', id: result.insertedId });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add lesson', error: err.message });
  }
});

// Update lesson by ID
app.put('/lessons/:id', async (req, res) => {
  try {
    const lessonId = req.params.id;
    const updateData = req.body;

    const result = await lessonsCollection.updateOne(
      { _id: new ObjectId(lessonId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) return res.status(404).json({ message: 'Lesson not found' });
    res.json({ message: 'Lesson updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update lesson', error: err.message });
  }
});
// Delete lesson by ID
app.delete('/lessons/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await Lesson.findByIdAndDelete(id);
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete lesson' });
    }
});



// Search lessons
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json([]);
    const regex = new RegExp(query, 'i');
    const results = await lessonsCollection.find({
      $or: [
        { topic: regex },
        { location: regex },
        { price: regex.toString() },
        { space: regex.toString() }
      ]
    }).toArray();
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

// Get all orders
app.get('/orders', async (req, res) => {
  try {
    const orders = await ordersCollection.find().toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch orders', error: err.message });
  }
});

// Add new order & reduce availability
app.post('/orders', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      address,
      city,
      country,   
      postcode,
      phone,
      email,
      lessonIDs,
      quantities,
      paymentMethod,
      cardLast4,
      cardBrand
    } = req.body;

    //  Validate required fields
    if (
      !firstName ||
      !lastName ||
      !address ||
      !city ||
      !country ||   //  include in validation
      !postcode ||
      !phone ||
      !email ||
      !lessonIDs ||
      !quantities
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    let paymentResult = { success: true, message: 'Payment processed successfully (mock)' };

    if (paymentMethod === 'card') {
      paymentResult = {
        success: true,
        message: `Mock card payment succeeded for ${cardBrand?.toUpperCase() || 'CARD'} ****${cardLast4 || '####'}`
      };
    } else if (paymentMethod === 'paypal') {
      paymentResult = { success: true, message: 'Mock PayPal payment completed' };
    }

    //  Validate lesson IDs and quantities
    if (
      !Array.isArray(lessonIDs) ||
      !Array.isArray(quantities) ||
      lessonIDs.length !== quantities.length
    ) {
      return res.status(400).json({ message: 'Invalid lessonIDs or quantities' });
    }

    //  Reduce availability for each lesson
    for (let i = 0; i < lessonIDs.length; i++) {
      const lessonId = lessonIDs[i];
      const qty = quantities[i];

      const lesson = await lessonsCollection.findOne({ _id: new ObjectId(lessonId) });
      if (!lesson) {
        return res.status(404).json({ message: `Lesson not found (ID: ${lessonId})` });
      }
      if (lesson.space < qty) {
        return res.status(400).json({ message: `Not enough space for ${lesson.topic}` });
      }

      await lessonsCollection.updateOne(
        { _id: new ObjectId(lessonId) },
        { $inc: { space: -qty } }
      );
    }

    //  Create order object with country included
    const newOrder = {
      firstName,
      lastName,
      address,
      city,
      country,   
      postcode,
      phone,
      email,
      lessonIDs,
      quantities,
       paymentMethod,
      paymentStatus: paymentResult.success ? 'paid' : 'failed',
      paymentMessage: paymentResult.message,
      date: new Date(),
    };

    //  Insert into MongoDB
    const result = await ordersCollection.insertOne(newOrder);

    res.status(201).json({
      message: 'Order placed successfully!',
      insertedId: result.insertedId,
      paymentStatus: newOrder.paymentStatus,
      paymentMessage: newOrder.paymentMessage,
    });

  } catch (err) {
    console.error('❌ Failed to add order:', err);
    res.status(500).json({ message: 'Failed to add order', error: err.message });
  }
});

// Start server
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
