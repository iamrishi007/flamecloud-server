const jwt = require("jsonwebtoken")
const verifyToken = async (req, res, next) => {
     const token = req.headers.authorization?.split(" ")[1]
     if (!token) {
          return res.status(400).json({
               message: "token not provided"
          })
     }
     try {
          const decoded = jwt.verify(token, process.env.SECRET_KEY)
        req.userId = decoded.id; 
          next()
     } catch (error) {
          res.status(401).json(
               { message: "Invalid token." }
          );

     }
}

module.exports = verifyToken