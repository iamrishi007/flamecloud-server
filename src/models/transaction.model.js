const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    merchant: { type: String },
    type: { type: String, enum: ["income", "expense"], default: "expense" },
    category: { type: String, default: "other" }
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);
