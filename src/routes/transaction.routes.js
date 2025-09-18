const express = require("express")
const router = express.Router()
const upload = require("../middlewares/upload.middleware")
const auth = require("../middlewares/auth.middleware")
const fs = require("fs")
const Transaction = require("../models/transaction.model")
const { GoogleGenAI } = require("@google/genai")
require("dotenv").config();

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// --------------------
// UPLOAD + AI PARSING
// --------------------
router.post("/upload-statement", auth, upload.single("statement"), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: "Please upload a valid bank statement" });

        const filePath = req.file.path;
        const ext = req.file.originalname.split(".").pop().toLowerCase()
        let content = "";

        // Read file conten
        if (ext === "pdf") {
            const pdfParse = require("pdf-parse")
            const dataBuffer = fs.readFileSync(filePath)
            const pdfData = await pdfParse(dataBuffer)
            content = pdfData.text;
        } else {
            content = fs.readFileSync(filePath, "utf-8")
        }

        // --------------------
        // AI PARSING WITH RETRY
        // --------------------
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        let aiResponse;

        for (let i = 0; i < 3; i++) { // retry 3 times
            try {
                aiResponse = await genai.models.generateContent({
                    model: "models/gemini-2.5-flash",
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: `Extract transactions as JSON array with date, description, merchant, amount, type, category from:\n${content}`,
                                },
                            ],
                        },
                    ],
                });
                break; // success
            } catch (err) {
                console.error(`AI attempt ${i + 1} failed:`, err.message)
                if (i === 2) {
                    return res.status(503).json({
                        message: "AI service is overloaded. Please try again later.",
                        error: err.message,
                    });
                }
                await delay(2000); // wait 2s before retry
            }
        }

        // --------------------
        // PARSE AI RESPONSE
        // --------------------
        let transactions = []
        try {
            const aiText = aiResponse.candidates[0]?.content?.parts[0]?.text || "";
            const match = aiText.match(/```json\s*([\s\S]*?)```/);
            if (!match) throw new Error("No JSON block found in AI response");
            transactions = JSON.parse(match[1].trim());
        } catch (err) {
            return res.status(400).json({
                message: "AI parsing failed",
                error: err.message,
                aiResponse: aiResponse,
            });
        }

        // --------------------
        // MAP TRANSACTION TYPES TO ENUM
        // --------------------
        transactions = transactions.map((t) => {
            let mappedType = "expense";
            const typeLower = (t.type || "").toLowerCase();
            if (typeLower === "income" || typeLower === "credit") mappedType = "income";
            if (typeLower === "expense" || typeLower === "debit") mappedType = "expense";

            return {
                userId: req.userId,
                date: new Date(t.date),
                amount: t.amount,
                description: t.description || "",
                merchant: t.merchant || t.description || "",
                type: mappedType,
                category: t.category || "other",
            };
        });

        
        const savedTransactions = await Transaction.insertMany(transactions)
        fs.unlinkSync(filePath)

        // Compute summary
        const totalIncome = savedTransactions
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0)
        const totalExpense = savedTransactions
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0)
        const netBalance = totalIncome - totalExpense;

        res.status(200).json({
            message: "Transactions uploaded successfully",
            summary: { totalIncome, totalExpense, netBalance },
            transactions: savedTransactions,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// --------------------
// GET ALL TRANSACTIONS
// --------------------
router.get("/", auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.userId }).sort({ date: -1 });
        res.status(200).json({ transactions });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// --------------------
// GET SINGLE TRANSACTION
// --------------------
router.get("/:id", auth, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
        if (!transaction) return res.status(404).json({ message: "Transaction not found" });
        res.status(200).json({ transaction });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// --------------------
// UPDATE TRANSACTION
// --------------------
router.put("/:id", auth, async (req, res) => {
    try {
        const { date, amount, description, merchant, type, category } = req.body;

        // Map type to enum
        let mappedType = "expense";
        const typeLower = (type || "").toLowerCase();
        if (typeLower === "income" || typeLower === "credit") mappedType = "income";
        if (typeLower === "expense" || typeLower === "debit") mappedType = "expense";

        const updatedTransaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { date, amount, description, merchant, type: mappedType, category },
            { new: true, runValidators: true }
        );

        if (!updatedTransaction) return res.status(404).json({ message: "Transaction not found" });

        res.status(200).json({ message: "Transaction updated", transaction: updatedTransaction });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// --------------------
// DELETE TRANSACTION
// --------------------
router.delete("/:id", auth, async (req, res) => {
    try {
        const deletedTransaction = await Transaction.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId,
        });
        if (!deletedTransaction) return res.status(404).json({ message: "Transaction not found" });
        res.status(200).json({ message: "Transaction deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
