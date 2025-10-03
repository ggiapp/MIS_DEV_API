import jwt from 'jsonwebtoken'
import {
    JWT_SECRET
}
from "./../db/connectdb";
const auth = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        res.status(401).json({
            status: false,
            code: false,
            authToken: false,
            message: "Authentication failed , Token missing"
        });
    }
    try {
        const decode = jwt.verify(token, JWT_SECRET)
        req.user = decode;
        const {
            userId
        } = decode;
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