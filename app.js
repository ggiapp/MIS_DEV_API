import express from "express";

import dotenv from "dotenv";
const path = require('path');
dotenv.config();


import bodyParser from "body-parser";
import cors from "cors";
const fileUpload = require('express-fileupload');

//Setup Express App
const app = express();

// Set up CORS
app.use(cors());

// app.use(cors({ origin: 'http://localhost:3000' }));


//Set Midleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));


app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 }, // 100mb limit
  abortOnLimit: true,
  responseOnLimit: "File size too large"
}));
// app.use(fileUpload({
//   createParentPath: true // Ensure parent directories are created if needed
// }));

//Load Routes
app.use("/api", serverRoutes);


import serverRoutes from "./routes/serverRoutes";

// Get port from environment and store in Express.
const port = process.env.PORT || "5555";

app.use('/cdn', express.static(path.join(__dirname, 'uploads')));


app.listen(port, () => {
  console.log(`Server listining at http://localhost:${port}`);
});


//Database Connection
// const DATABASE_URL = process.env.DB_URL
// const DB_NAME = process.env.DB_NAME

// const DATABASE_URL = "mongodb://localhost:27017"
// const DB_NAME = "cgi_nodebase"

// const DB_NAME = process.env.DB_NAME


