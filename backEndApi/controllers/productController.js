const SummerSetProduct = require('../models/SummerSetProduct');
const WinterSetProduct = require('../models/WinterSetProduct');
const JeansProduct = require('../models/JeansProduct');
const TShirtProduct = require('../models/TShirtProduct');
const Upload = require('../helpers/upload');
const Product = require('../models/Product')
const { generateCustomId } = require("../helpers/uuid");

// Create a new product
const createProduct = async (req, res) => {
    try {
        const {customId, name, color, variety, price, age, size, material } = req.body;
        let imageUrls = [];

        // Check if files are present in the request
        if (req.files && req.files.length > 0) {
            // Iterate through each file and upload to Cloudinary
            for (const file of req.files) {
                const upload = await Upload.uploadFile(file.path);
                if (!upload || !upload.secure_url) {
                    return res.status(400).json({ success: false, msg: 'Upload process failed or no secure_url returned' });
                }
                // Push the secure URL to the array of image URLs
                imageUrls.push(upload.secure_url);
            }
        }

        let newProduct;
        if (name === 'summer-set') {
            newProduct = new SummerSetProduct({ customId, name, color, variety, price, age, size, material, images: imageUrls });
        } else if (name === 'winter-set') {
            newProduct = new WinterSetProduct({ customId, name, color, variety, price, age, size, material, images: imageUrls });
        } else if (name === 'jeans') {
            newProduct = new JeansProduct({ customId, name, color, variety, price, age, size, material, images: imageUrls });
        } else if (name === 't-shirt') {
            newProduct = new TShirtProduct({ customId, name, color, variety, price, age, size, material, images: imageUrls });
        } else {
            return res.status(400).json({ success: false, msg: 'Invalid product name' });
        }

        // Save the new product to the appropriate collection
        const savedProduct = await newProduct.save();

        // Send success response with saved product data
        res.status(201).json({ success: true, data: savedProduct });
    } catch (error) {
        // Handle errors
        res.status(400).json({ success: false, msg: error.message });
    }
};

// Get all products from the specified collection
const getProducts = async (req, res) => {
    try {
        const products = await Product.find({});
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(400).json({ success: false, msg: error.message });
    }
};
//Get a product by CustomId from the specified collection
const getProductByCustomId = async (req, res) => {
    try {
        const { collection, customId } = req.params;
        let product;
        if (collection === 'summer-set') {
            product = await SummerSetProduct.findOne({ customId });
        } else if (collection === 'winter-set') {
            product = await WinterSetProduct.findOne({ customId });
        } else if (collection === 'jeans') {
            product = await JeansProduct.findOne({ customId });
        } else if (collection === 't-shirt') {
            product = await TShirtProduct.findOne({ customId });
        } else {
            return res.status(400).json({ success: false, msg: 'Invalid collection' });
        }
        if (!product) {
            return res.status(404).json({ success: false, msg: 'Product not found' });
        }
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(400).json({ success: false, msg: error.message });
    }
};

// Update a product by CustomId in the specified collection
const updateProductByCustomId = async (req, res) => {
    try {
        const { collection, customId } = req.params;
        const { name, color, variety, price, age, size, material } = req.body;
        const updatedData = { name, color, variety, price, age, size, material };

        if (req.files && req.files.length > 0) {
            let imageUrls = [];
            for (const file of req.files) {
                const upload = await Upload.uploadFile(file.path);
                if (!upload || !upload.secure_url) {
                    return res.status(400).json({ success: false, msg: 'Upload process failed or no secure_url returned' });
                }
                imageUrls.push(upload.secure_url);
            }
            updatedData.images = imageUrls;
        }

        let updatedProduct;
        if (collection === 'summer-set') {
            updatedProduct = await SummerSetProduct.findOneAndUpdate({ customId }, updatedData, { new: true });
        } else if (collection === 'winter-set') {
            updatedProduct = await WinterSetProduct.findOneAndUpdate({ customId }, updatedData, { new: true });
        } else if (collection === 'jeans') {
            updatedProduct = await JeansProduct.findOneAndUpdate({ customId }, updatedData, { new: true });
        } else if (collection === 't-shirt') {
            updatedProduct = await TShirtProduct.findOneAndUpdate({ customId }, updatedData, { new: true });
        } else {
            return res.status(400).json({ success: false, msg: 'Invalid collection' });
        }
        if (!updatedProduct) {
            return res.status(404).json({ success: false, msg: 'Product not found' });
        }
        res.status(200).json({ success: true, data: updatedProduct });
    } catch (error) {
        res.status(400).json({ success: false, msg: error.message });
    }
};

// Delete a product by CustomId from the specified collection
const deleteProductByCustomId = async (req, res) => {
    try {
        const { collection, customId } = req.params;
        let deletedProduct;
        if (collection === 'summer-set') {
            deletedProduct = await SummerSetProduct.findOneAndDelete({ customId });
        } else if (collection === 'winter-set') {
            deletedProduct = await WinterSetProduct.findOneAndDelete({ customId });
        } else if (collection === 'jeans') {
            deletedProduct = await JeansProduct.findOneAndDelete({ customId });
        } else if (collection === 't-shirt') {
            deletedProduct = await TShirtProduct.findOneAndDelete({ customId });
        } else {
            return res.status(400).json({ success: false, msg: 'Invalid collection' });
        }
        if (!deletedProduct) {
            return res.status(404).json({ success: false, msg: 'Product not found' });
        }
        res.status(200).json({ success: true, msg: 'Product deleted successfully' });
    } catch (error) {
        res.status(400).json({ success: false, msg: error.message });
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductByCustomId,
    updateProductByCustomId,
    deleteProductByCustomId
};

