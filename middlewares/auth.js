import jwt from 'jsonwebtoken'
import {
    JWT_SECRET
}
from "./../db/connectdb";
const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({
            status: false,
            code: false,
            authToken: false,
            message: "Authentication failed , Token missing"
        });
    }
    
    // Extract token from "Bearer <token>" format or use raw token
    const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;
    
    try {
        const decode = jwt.verify(token, JWT_SECRET)
        req.user = decode;
        const {
            userId
        } = decode;
        req.userId = userId;
        console.log(`${req.method} | ${(userId || userId)}   =>   ${req.originalUrl} `);
        next();
    } catch (err) {
        res.status(500).json({
            status: false,
            code: false,
            authToken: false,
            message: 'Authentication failed. Invalid token.'
        })
    }
}
export default auth