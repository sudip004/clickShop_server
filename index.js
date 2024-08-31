const port = 4000;
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { log } = require("console");
const axios = require('axios');
const { Product, Users } = require("./model/product");
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const NodeCache = require("node-cache"); // Import NodeCache

// Initialize cache
const cache = new NodeCache({ stdTTL: 60 * 60 }); // Cache TTL is set to 1 hour

// const URL = "https://click-shop-client-lilac.vercel.app";
const URL = "http://localhost:5173";

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dkaucipxm',
    api_key: process.env.CLOUDINARY_API_KEY || '772483262288747',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'qHOO8_K31tSLgXQUplLDzlQkIc4',
});

app.use(express.json());
const corsOptions = {
    origin: [URL, "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"], // Include all the HTTP methods you use
    credentials: true, // Allows cookies to be sent in cross-origin requests
    allowedHeaders: ["Content-Type", "Authorization"], // Include any custom headers you use
};

app.use(cors(corsOptions));


// Database connection
mongoose.connect("mongodb+srv://sudipbasakk1234:Du4lBcw8ksDYmQoB@cluster0.doylg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
.then(() => {
    console.log("Database connected");
}).catch((err) => {
    console.log(err);
});

// Cloudinary storage for Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'your_folder_name',
        format: async (req, file) => 'png',
        public_id: (req, file) => `${file.fieldname}_${Date.now()}`,
    },
});
const upload = multer({ storage: storage });

// Endpoint for uploading images
app.post("/upload", upload.single('product'), (req, res) => {
    const imageUrl = req.file.path;
    res.json({
        success: 1,
        image_url: imageUrl
    });
});

// Add product endpoint
app.post("/addproduct", async (req, res) => {
    const products = await Product.find({});
    const id = products.length > 0 ? products.slice(-1)[0].id + 1 : 1;

    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });

    await product.save();
    cache.del('allProducts'); // Clear cache when new product is added
    res.json({
        success: true,
        name: req.body.name
    });
});

// Remove product endpoint
app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id });
    cache.del('allProducts'); // Clear cache when a product is removed
    res.json({
        success: true,
        name: req.body.name
    });
});

// Fetch all products endpoint with caching
app.get('/allproducts', async (req, res) => {
    const cachedProducts = cache.get('allProducts');
    if (cachedProducts) {
        console.log("Serving from cache");
        return res.json(cachedProducts);
    }

    const products = await Product.find({});
    cache.set('allProducts', products); // Cache the result
    console.log("Fetched from DB and cached");
    res.json(products);
});

// User registration
app.post("/signup", async (req, res) => {
    let check = await Users.findOne({ email: req.body.email });
    if (check) {
        return res.status(400).json({ success: false, error: "Existing user" });
    }

    const cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0;
    }

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart
    });

    await user.save();

    const data = { user: { id: user.id } };
    const token = jwt.sign(data, 'secret_ecom');
    res.json({ success: true, token });
});

// User login
app.post('/login', async (req, res) => {
    const user = await Users.findOne({ email: req.body.email });

    if (user) {
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = { user: { id: user.id } };
            const token = jwt.sign(data, 'secret_ecom');
            res.json({ success: true, token });
        } else {
            res.json({ success: false, error: "Wrong Password" });
        }
    } else {
        res.json({ success: false, errors: "Wrong Email Id" });
    }
});

// Fetch new collection data
app.get('/newcollection', async (req, res) => {
    const cachedNewCollection = cache.get('newCollection');
    if (cachedNewCollection) {
        console.log("Serving new collection from cache");
        return res.send(cachedNewCollection);
    }

    const products = await Product.find({});
    const newcollection = products.slice(1).slice(-20);
    cache.set('newCollection', newcollection); // Cache the result
    res.send(newcollection);
});

// Fetch popular in women products
app.get('/popularinwomen', async (req, res) => {
    const cachedPopularInWomen = cache.get('popularInWomen');
    if (cachedPopularInWomen) {
        console.log("Serving popular in women from cache");
        return res.send(cachedPopularInWomen);
    }

    const products = await Product.find({ category: "women" });
    const popularInWomen = products.slice(0, 4);
    cache.set('popularInWomen', popularInWomen); // Cache the result
    res.send(popularInWomen);
});

// Middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        return res.status(401).send({ error: "Please authenticate with valid token" });
    }
    try {
        const data = jwt.verify(token, 'secret_ecom');
        req.user = data.user;
        next();
    } catch (error) {
        res.status(401).send({ errors: "Please authenticate" });
    }
};

// Add to cart
app.post('/addtocart', fetchUser, async (req, res) => {
    let userData = await Users.findOne({ _id: req.user.id });
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.json({ success: true });
});

// Remove from cart
app.post('/removefromcart', fetchUser, async (req, res) => {
    let userData = await Users.findOne({ _id: req.user.id });
    if (userData.cartData[req.body.itemId] > 0) {
        userData.cartData[req.body.itemId] -= 1;
    }
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
    res.json({ success: true });
});

// Get cart data
app.post('/getcart', fetchUser, async (req, res) => {
    let userData = await Users.findOne({ _id: req.user.id });
    res.json(userData.cartData);
});

// Message handling
const messageHandlers = {
    "My payment is not going through": "I apologize for the inconvenience, due to high traffic the payment gateway is slow.",
    "Can I return a product?": "Yes, you can return the product within 30 days of purchase.",
    'How do I track my order?': "You can track your order by going to the track order page.",
    "Product delivery is late": "I apologize for the inconvenience, the product will be delivered soon within 2 days.",
};

const giveRefId = () => {
    let refId = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 6; i++) {
        refId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return refId;
};

app.post("/message", async (req, res) => {
    const response = messageHandlers[req.body.message] || "I don't understand";
    res.json({ response });
}
)
app.post("/messagesend", async (req, res) => {
    const response = "i applogize for the inconvenience, becasue of the high traffic  dont worry we are working on it give us 2-3 business days we will resolve it, your refence id is " + giveRefId() + ". thank you for your patience";
    res.json({ response });
}
)

const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: [URL, "http://localhost:3000"],
        methods: ["GET", "POST"]
    }
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});







