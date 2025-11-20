
import mysql from 'mysql2/promise';
const path = require('path');

// const DB_NAME = "ggi_dev_mis_base";

// # SEP62025 - DEV CRM MIGRATION
const DB_NAME = process.env.DB_NAME || "development_ggi_mis_base";

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Utility function to execute SQL queries with parameters
const  ggBaseQuery = async (query, params = []) => {
  const [rows] = await pool.execute(query, params);
  return rows;
};


const JWT_SECRET = process.env.JWT_SECRET || "ggindia2025@co.in";


const uploadBasePath = "./uploads/";
const PublicBasePath ="http://89.116.34.157:5555/cdn/";
const replaceBasePath = path.join(__dirname, uploadBasePath);

export  { ggBaseQuery,uploadBasePath,PublicBasePath,replaceBasePath,JWT_SECRET };


