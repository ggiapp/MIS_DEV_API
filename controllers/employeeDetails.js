
import {
    ggBaseQuery,
    uploadBasePath,
    PublicBasePath,
    replaceBasePath
}
from "./../db/connectdb";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
const path = require('path');
const fs = require('fs').promises;

const addEmployee = async (req, res) => {
    try {
        const {
            ename,
            contactNumber} = req.body;
        console.log(req.body);
        // Check if the username is already taken
        const [existingUser] = await ggBaseQuery('SELECT * FROM users WHERE phone = ?', [contactNumber]);
        if (existingUser) {
            res.status(401).json({
                status: false,
                message: 'Phone Number already exists'
            });
            return;
        }
        const tmpPassWord = await ggOnePassword();
        // Hash the password
        const hashedPassword = await bcrypt.hash(tmpPassWord, 10);
        const currentRole = (role || "agent");
        const thisInsitution = {};
        
        // Insert a new user
        const regParams = [name, phone, whatsapp, JSON.stringify(thisInsitution), hashedPassword, currentRole];
        console.log(regParams);
        await ggBaseQuery('INSERT INTO users (name, phone,other_institution, password,role) VALUES (?, ?, ?,?,?)', regParams);
        res.status(201).json({
            status: true,
            otp: tmpPassWord,
            message: 'User registerd successfully'
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            status: false,
            message: 'Something Went Wrong :('
        });
    }
};


const fetchEmployeeNames = async (req, res) => {
   
    try {
        // console.log(connectDB);
        const result = await ggBaseQuery(`SELECT name FROM users WHERE role="agent" AND  is_deleted = 0`);
        // const [totalRecords] = await ggBaseQuery('SELECT COUNT(*) as count FROM users WHERE is_deleted = 0');
        res.send({
            status: true,
            total_recodes: result.length,
            result,
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: false,
            error: 'Internal server error'
        });
    }
};


const fetchEmployeeDetail = async (req,res) =>{

     req = req.body;
    
    try {
        // console.log(connectDB);
        const result = await ggBaseQuery(`SELECT name FROM users WHERE  id = $1`,[req.user_id]);
        // const [totalRecords] = await ggBaseQuery('SELECT COUNT(*) as count FROM users WHERE is_deleted = 0');
        res.send({
            status: true,
            total_recodes: result.length,
            result,
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: false,
            error: 'Internal server error'
        });
    }
};

export default { fetchEmployeeNames, fetchEmployeeDetail }