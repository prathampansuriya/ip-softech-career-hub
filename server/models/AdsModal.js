import mongoose from "mongoose";

const adsSchema = new mongoose.Schema({
    title: {
        type: String,
    },
    description: {
        type: String,
    },
    images: [{  // Changed from image to images array
        type: String,
    }],
    details: {  // New field for rich content
        type: String,
    },
    targetCity: {
        type: String,
    },
}, { timestamps: true }); // This adds createdAt and updatedAt fields automatically

const Ads = mongoose.model("Ads", adsSchema);

export { Ads };
