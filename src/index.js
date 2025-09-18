require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const userRoutes  = require("./routes/user.routes")
const transactionRoutes=require("./routes/transaction.routes")
const app = express()
const cors = require("cors")
app.use(express.json())
app.use(cors())
connectDB()

app.use("/api/users", userRoutes)
app.use("/api/transactions",transactionRoutes)

app.get("/home", (req, res) => {
  res.send("Hello From Index.js")
});

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
});
