const userModel = require("../models/user.model")
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken');

const registerUser = async (req, res) => {
     const { name, email, password } = req.body
     if (!name || !email || !password) {
          return res.status(400).json({
               message: "all fileds are required."

          })
     }
     try {
          const existsUser = await userModel.findOne({ email })
          if (existsUser) {
               return res.status(400).json({
                    message: "user already exists. please login ."
               });
          }
          const hashpassword = await bcrypt.hash(password, 10)
          const newUser = new userModel({
               name,
               email,
               password: hashpassword

          })
          await newUser.save()
          res.status(201).json({
               message: "User registered successfully !",
               user: { id: newUser._id, name: newUser.name, password: newUser.password }
          })
     } catch (error) {
          res.status(500).json(
               {
                    message: "Server error",
                    error: error.message
               }
          );
     }
}


const loginUser = async (req, res) => {

     const { email, password } = req.body
     if (!email || !password) {
          return res.status(400).json({
               message: "please register first dude "
          })
     }
     try {
          const user = await userModel.findOne({ email })
          if (!user) {
               res.status(400).json({
                    message: "invalid email "
               })
          }
          const isPassMatch = await bcrypt.compare(password, user.password)
          const key = process.env.SECRET_KEY

          if (!isPassMatch) {
               res.status(400).json({
                    message: "invalid password "
               })
          }

          const token = jwt.sign({
               id: user._id,
               email: user.email,
          }, key,
               { expiresIn: "1h" })
          res.status(200).json({
               message: "user login successfully",
               token: token
          })
     } catch (error) {
          res.status(500).json({
               message: "something went wrong",
               error: error.message
          })
     }
}

module.exports = { registerUser, loginUser }