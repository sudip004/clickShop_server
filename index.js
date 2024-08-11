const port = 4000
const express = require("express")
const http = require("http")
const socketio = require("socket.io")
const app = express()
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const multer = require("multer")
const path = require("path")
const cors = require("cors")
const { log } = require("console")
const axios = require('axios');
const { Product, Users } = require("./model/product")
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
//const stripe = require('stripe')("sk_test_51PkhhFP5IdnNo5MZiNTUzdVPcyHlUj7xbgWg194FthWdRyK4CTh6xdwaBbe3O4p7ulH7nojYyT0RBBuNGe0AvpMQ004LF35ZDj")
// const URL = "http://localhost:5173"
const URL = "https://click-shop-client-seven.vercel.app"
const DEPLOY_URL = 'https://clickshop-server.onrender.com'
// const DEPLOY_URL = 'http://localhost:4000'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dkaucipxm',
    api_key: process.env.CLOUDINARY_API_KEY || '772483262288747',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'qHOO8_K31tSLgXQUplLDzlQkIc4',
  });





app.use(express.json())
app.use(cors({
    origin: [URL, "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
}));


// ----------Deployment------------

// Serve static files from the React app
// app.use(express.static(path.join(__dirname, './client/build')));

// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, './client/build/index.html'));
// });


// ----------Deployment------------

// Database connection with mongodb

mongoose.connect("mongodb+srv://sudipbasakk1234:Du4lBcw8ksDYmQoB@cluster0.doylg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0").then(() => {
    console.log("Database connected")
}
).catch((err) => {
    console.log(err)
}
)


// mongoose.connect("mongodb://localhost:27017/shop").then(()=>{
//     console.log("Database connected")
// }
// ).catch((err)=>{
//     console.log(err)
// }
// )

//API creation


// Set up Cloudinary storage for Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'your_folder_name', // optional: folder where images will be stored
      format: async (req, file) => 'png', // supports promises as well
      public_id: (req, file) => `${file.fieldname}_${Date.now()}`, // unique filename
    },
  });

//Image Storage Engine
// const storage = multer.diskStorage({
//     destination: './upload/images',
//     filename: (req, file, cb) => {
//         return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
//     }
// })
const upload = multer({ storage: storage })

// Endpoint for uploading images
app.post("/upload", upload.single('product'), (req, res) => {
    const imageUrl = req.file.path; // Cloudinary URL

    res.json({
        success: 1,
        image_url: imageUrl // Return Cloudinary URL to client
    });
});

// Schema for creating Products



// Modify add product endpoint to use the Cloudinary image URL
app.post("/addproduct", async (req, res) => {
    let products = await Product.find({});
    let id = products.length > 0 ? products.slice(-1)[0].id + 1 : 1;

    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image, // Cloudinary URL is sent from the frontend
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    });

    await product.save();
    res.json({
        success: true,
        name: req.body.name
    });
});

//API for deleting products

app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id })
    console.log("removed")
    res.json({
        success: true,
        name: req.body.name
    })
})

//creating API to get all products

app.get('/allproducts', async (req, res) => {
    let products = await Product.find({})
    console.log("all products fetched")
    res.json(products)
})



//API for registering user

app.post("/signup", async (req, res) => {
    let check = await Users.findOne({ email: req.body.email })

    if (check) {
        return res.status(400).json({ success: false, error: "Existing user" })
    }

    let cart = {}

    for (let i = 0; i < 300; i++) {
        cart[i] = 0
    }

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart
    })

    await user.save()

    const data = {
        user: {
            id: user.id
        }
    }

    const token = jwt.sign(data, 'secret_ecom')
    res.json({ success: true, token })
})

//Endpoint for user login

app.post('/login', async (req, res) => {
    let user = await Users.findOne({ email: req.body.email })

    if (user) {
        const passCompare = req.body.password === user.password
        if (passCompare) {
            const data = {
                user: {
                    id: user.id
                }
            }
            const token = jwt.sign(data, 'secret_ecom')
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, error: "Wrong Password" })
        }
    } else {
        res.json({ success: false, errors: "Wrong Email Id" })
    }


})

//creating endpoint for newcollection data

app.get('/newcollection', async (req, res) => {
    let products = await Product.find({})
    console.log(products);

    let newcollection = products.slice(1).slice(-20)

    res.send(newcollection)
})

//endpoint for popular in women 

app.get('/popularinwomen', async (req, res) => {
    let products = await Product.find({ category: "women" })

    let popular_in_women = products.slice(0, 4)

    res.send(popular_in_women)
})

//creating middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token')
    if (!token) {
        res.status(401).send({ error: "Please authenticate with valid token" })
    }
    else {
        try {
            const data = jwt.verify(token, 'secret_ecom')
            req.user = data.user;
            next()

        } catch (error) {
            res.status(401).send({ errors: "Please authenticate" })
        }
    }
}

//endpoint for add to cart

app.post('/addtocart', fetchUser, async (req, res) => {
    let userData = await Users.findOne({ _id: req.user.id })

    userData.cartData[req.body.itemId] += 1
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData })

    console.log("data", userData)
})

//endpoint for remove to cart

app.post('/removefromcart', fetchUser, async (req, res) => {
    let userData = await Users.findOne({ _id: req.user.id })
    if (userData.cartData[req.body.itemId] > 0)
        userData.cartData[req.body.itemId] -= 1
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData })

    console.log("removed")
})

//creating endpoint to get cart data

app.post('/getcart', fetchUser, async (req, res) => {
    console.log("Getcart");
    let userData = await Users.findOne({ _id: req.user.id })
    res.json(userData.cartData)
})

// app.post("/payment",async(req,res)=>{

//     console.log(req.body);

//     const lineitem = req.body.products.map((e)=>{
//         return {
//             price_data: {
//                 currency: 'usd',
//                 product_data: {
//                     name: e.name,
//                     images: [e.image]
//                 },
//                 unit_amount: e.new_price*100
//             },
//             quantity: 1
//         }
//     })

//     const session = await stripe.checkout.sessions.create({
//         payment_method_types: ['card'],
//         line_items: lineitem,
//         mode: 'payment',
//         success_url: 'http://localhost:3000/success',
//         cancel_url: 'http://localhost:3000/cancel'
//     })
//     log("sess",session.id)
//     res.json({id:session.id})
// })

const messageHandlers = {
    "My payment is not going through": "i applogize for the inconvenience, becasue of the high traffic the payment gateway is slow",
    "Can I return a product?": "yes you can return the product within 30 days of purchase",
    'How do I track my order?': "You can track your order by going to the track order page",
    "Product delevery is late": "i applogize for the inconvenience, the product will be delivered soon with in 2 days",
    // Add more handlers as needed
};

const giveRefId = () => {
    let refId = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 6; i++) {
        refId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return refId;
}


const server = app.listen(port, () => console.log("Server Connectrd successfully", port))



const io = socketio(server, {
    cors: {
        origin: URL,
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("conneetettt");



    socket.on("message", (message) => {
        const response = messageHandlers[message] || "I don't understand";
        socket.emit("response", response);
    })
    socket.on("sendmessage", (message) => {

        socket.emit("response", `i applogize for the inconvenience, becasue of the high traffic  dont worry we are working on it give us 2-3 business days we will resolve it, your refence id is ${giveRefId()}. thank you for your patience`)
    })

    socket.on("disconnect", () => {
        console.log("Client disconnected")
    })
})


// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // You can add custom logic here to handle the rejection, such as logging or cleaning up resources.
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception thrown:', error);
    // Optionally, you can exit the process or perform cleanup tasks.
    // process.exit(1); // Uncomment to exit the process after handling the error.
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});



//Du4lBcw8ksDYmQoB
