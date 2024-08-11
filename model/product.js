const mongoose = require("mongoose");

const Product = mongoose.model("Product",{
    id:{
        type: Number,
        required: true
    },
    name:{
        type: String,
        required: true
    },
    image:{
        type:String,
        required:true
    },
    category:{
        type:String,
        required: true
    },
    new_price:{
        type: Number,
        required: true
    },
    old_price:{
        type: Number,
        required: true
    },
    date:{
        type:Date,
        default:Date.now
    },
    available:{
        type:Boolean,
        default: true
    },
})

const Users = mongoose.model('Users',{
    name:{
        type: String,
    },
    email:{
        type: String,
        unique: true
    },
    password:{
        type:String
    },
    cartData:{
        type: Object,

    },
    date:{
        type:Date,
        default:Date.now
    }
})

module.exports = {Product,Users}