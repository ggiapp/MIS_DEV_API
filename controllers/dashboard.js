import {
    ggBaseQuery,
    uploadBasePath,
    PublicBasePath,
    replaceBasePath
} from "./../db/connectdb";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
const xlsx = require('xlsx');
const path = require('path');
const moment = require('moment');
const fs = require('fs').promises;
async function ensureDirectoryExists(directory) {
    try {
        await fs.access(directory);
    } catch (error) {
        await fs.mkdir(directory, {
            recursive: true
        });
    }
}
// COMMON FUNCTIONS
function parseExcelDate(value) {
    if (!value) return null;
    // Case 1: Already a JS Date object
    if (value instanceof Date && !isNaN(value)) {
        return value;
    }
    // Case 2: Excel serial number (e.g. 44561)
    if (typeof value === 'number') {
        const excelEpoch = new Date(1899, 11, 30); // Excel epoch
        return new Date(excelEpoch.getTime() + value * 86400000);
    }
    // Case 3: String formats
    if (typeof value === 'string') {
        let parts;
        // dd-mm-yyyy
        if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
            parts = value.split('-');
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        // dd/mm/yyyy
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
            parts = value.split('/');
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        // yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return new Date(value);
        }
        // dd-MMM-yyyy (e.g. 23-Aug-2021)
        if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(value)) {
            const [day, monStr, year] = value.split('-');
            const months = {
                Jan: 0,
                Feb: 1,
                Mar: 2,
                Apr: 3,
                May: 4,
                Jun: 5,
                Jul: 6,
                Aug: 7,
                Sep: 8,
                Oct: 9,
                Nov: 10,
                Dec: 11
            };
            const month = months[monStr];
            if (month !== undefined) {
                return new Date(year, month, parseInt(day, 10));
            }
        }
    }
    return null; // fallback
}
const ggOnePassword = async () => {
    const length = 10;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset.charAt(randomIndex);
    }
    return password;
}
const remarksEntry = async (remarkRecord) => {
    try {
        const insertQuery = 'INSERT INTO remarks (message, type, ref_id,user_type, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
        await ggBaseQuery(insertQuery, remarkRecord);
    } catch (err) {
        console.log(err);
    }
}
const getSiteSettings = async () => {
    const thisOptionsQuery = `Select institution,form_types,form_doc_types,form_kyc_types  from settings where id =1`;
    let optionsRows = await ggBaseQuery(thisOptionsQuery);
    return (optionsRows ? optionsRows[0] : {});
}
// Index method to fetch all users from the MySQL database
const userRecords = async (req, res) => {
    const {
        startDate,
        endDate
    } = req.query;
    const queryParams = [];
    try {
        let query = `
      SELECT u.*,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) AS incentive_amount,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM'AND t.status ='1' THEN t.amount ELSE 0 END), 0) AS claim_amount,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0) AS commission_amount,
    (COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) 
    + COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0)) AS wallet_blance,
    r.message AS remark,
    r.user_type AS remark_user,
    r.created_at AS remark_timestamp
FROM
    users u
LEFT JOIN 
    transactions t ON u.id = t.agent_id
LEFT JOIN (
    SELECT ref_id, message, user_type, created_at
    FROM remarks r1
    WHERE created_at = (
        SELECT MAX(created_at)
        FROM remarks r2
        WHERE r2.ref_id = r1.ref_id
    )
) r ON u.id = r.ref_id
     `;
        if (startDate && endDate) {
            if (startDate !== endDate) {
                query += ` WHERE u.created_at BETWEEN ? AND ?`;
                queryParams.push(startDate, endDate);
            } else {
                query += ` WHERE Date(u.created_at)= ?`;
                queryParams.push(startDate);
            }
        }
        // if (startDate == endDate) {
        //     query += ` WHERE u.created_at=?`;
        //     queryParams.push(startDate);
        // }
        query += ` GROUP BY
    u.id, r.message, r.user_type, r.created_at ORDER BY u.created_at DESC;`;
        console.log(query);
        const rows = await ggBaseQuery(query, queryParams);
        if (rows.length === 0) {
            return res.json({
                status: false,
                results: [],
                message: "No data found.",
                options: await getSiteSettings()
            });
        }
        res.send({
            status: true,
            results: rows,
            total_recodes: rows.length,
            options: await getSiteSettings()
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal Server Error."
        });
    }
}
const leadRecords = async (req, res) => {
    const {
        startDate,
        endDate
    } = req.query;
    const queryParams = [];
    try {
        let query = `
         SELECT
           u.name,
            u.id as user_id,
    l.*,
    CASE
        WHEN l.documentimg IS NOT NULL THEN CONCAT('${PublicBasePath}', l.documentimg)
        ELSE l.documentimg
    END AS documentimg_url,
    CASE
        WHEN l.vehiclephoto IS NOT NULL THEN CONCAT('${PublicBasePath}', l.vehiclephoto)
        ELSE l.vehiclephoto
    END AS vehiclephoto_url, 
    r.message AS remark,
    r.user_type AS remark_user,
    r.created_at AS remark_timestamp
FROM
    leads l
LEFT JOIN users u ON l.user_id = u.id
LEFT JOIN (
    SELECT ref_id, message,user_type,created_at
    FROM remarks r1
    WHERE created_at = (
        SELECT MAX(created_at)
        FROM remarks r2
        WHERE r2.type='lead' and r2.ref_id = r1.ref_id
    )
) r ON l.id = r.ref_id

      `;
        if (startDate && endDate) {
            const startDateFull = startDate;
            const endDateFull = endDate;
            query += ` WHERE l.created_at BETWEEN ? AND ?`;
            queryParams.push(startDateFull, endDateFull);
        }
        query += ` ORDER BY l.created_at DESC;`;
        const rows = await ggBaseQuery(query, queryParams);
        if (rows.length === 0) {
            return res.json({
                status: false,
                results: [],
                message: "No data found.",
                options: await getSiteSettings()
            });
        }
        res.send({
            status: true,
            results: rows,
            total_recodes: rows.length,
            options: await getSiteSettings()
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal Server Error."
        });
    }
};
const quoteRecords = async (req, res) => {
    const {
        startDate,
        endDate
    } = req.query;
    const queryParams = [];
    try {
        let query = `

          SELECT   u.id as user_id,u.name,q.*,CASE
    WHEN q.document IS NOT NULL THEN CONCAT('${PublicBasePath}', q.document)
    ELSE q.document
  END AS document_url,r.message AS remark,
    r.user_type AS remark_user,
    r.created_at AS remark_timestamp FROM quotes q
  LEFT JOIN users u ON q.user_id = u.id
  LEFT JOIN (
    SELECT ref_id, message,user_type,created_at
    FROM remarks r1
    WHERE created_at = (
        SELECT MAX(created_at)
        FROM remarks r2
        WHERE r2.type='quote' and r2.ref_id = r1.ref_id
    )
) r ON q.id = r.ref_id
       
      `;
        if (startDate && endDate) {
            const startDateFull = startDate;
            const endDateFull = endDate;
            query += ` WHERE q.created_at BETWEEN ? AND ?`;
            queryParams.push(startDateFull, endDateFull);
        }
        query += ` ORDER BY q.created_at DESC;`;
        const rows = await ggBaseQuery(query, queryParams);
        if (rows.length === 0) {
            return res.json({
                status: false,
                results: [],
                message: "No data found.",
                options: await getSiteSettings()
            });
        }
        res.send({
            status: true,
            results: rows,
            total_recodes: rows.length,
            options: await getSiteSettings()
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal Server Error."
        });
    }
};
const index = async (req, res) => {
    try {
        // console.log(connectDB);
        const result = await ggBaseQuery(`SELECT *, CASE
    WHEN avatar IS NOT NULL THEN CONCAT('${PublicBasePath}', avatar)
    ELSE avatar
  END AS avatar_url,
  CASE
    WHEN kyc_document IS NOT NULL THEN CONCAT('${PublicBasePath}', kyc_document)
    ELSE kyc_document
  END AS kyc_documents_url
   FROM users WHERE deleted = 0`);
        const [totalRecords] = await ggBaseQuery('SELECT COUNT(*) as count FROM users WHERE deleted = 0');
        res.send({
            status: true,
            result,
            total_recodes: totalRecords.count
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: false,
            error: 'Internal server error'
        });
    }
};
// View method to fetch a single user by ID from the MySQL database
const view = async (req, res) => {
    console.log(req.user);
    const {
        userId
    } = req.user;
    if (!userId) {
        res.status(401).json({
            status: false,
            error: 'Invalid Authorization'
        });
    }
    try {
        const [user] = await ggBaseQuery(`SELECT *, CASE
    WHEN avatar IS NOT NULL THEN CONCAT('${PublicBasePath}', avatar)
    ELSE avatar
  END AS avatar_url,
  CASE
    WHEN kyc_document IS NOT NULL THEN CONCAT('${PublicBasePath}', kyc_document)
    ELSE kyc_document
  END AS kyc_documents_url FROM users WHERE id = ?`, [userId]);
        if (!user) return res.status(404).json({
            status: false,
            message: 'No Data Found.'
        });
        delete user.password;
        user.avatar = user.avatar_url;
        user.kyc_document = user.kyc_documents_url;
        // user.status = true;
        res.status(200).json({
            status: true,
            data: user
        });
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({
            status: false,
            error: 'Internal server error'
        });
    }
};
const register = async (req, res) => {
    try {
        const {
            name,
            phone,
            whatsapp,
            institution,
            role
        } = req.body;
        console.log(req.body);
        // Check if the username is already taken
        const [existingUser] = await ggBaseQuery('SELECT * FROM users WHERE phone = ?', [phone]);
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
        // Insert a new user
        await ggBaseQuery('INSERT INTO users (name, phone, whatsapp, institution, password,role) VALUES (?, ?, ?, ?,?,?)', [name, phone, whatsapp, institution, hashedPassword, currentRole]);
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
const login = async (req, res) => {
    try {
        const {
            username,
            password
        } = req.body;
        console.log(req.body);
        // Find the user by phone
        const [user] = await ggBaseQuery(`SELECT id,name,CASE
    WHEN avatar IS NOT NULL THEN CONCAT('${PublicBasePath}', avatar)
    ELSE avatar
  END AS avatar_url,phone,email_address,password,whatsapp,institution,role,created_at FROM users WHERE email_address = ?`, [username]);
        if (!user) {
            res.status(401).json({
                status: false,
                message: 'Invalid Phone Number'
            });
            return;
        }
        // BLock Agent Login
        if (user && user.id !== 1) {
            res.status(401).json({
                status: false,
                message: 'Agent Login Not Allowed.'
            });
            return;
        }
        // Compare the provided password with the hashed password stored in the database
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({
                status: false,
                message: 'Invalid Login'
            });
            return;
        }
        // Create a JWT token
        const token = jwt.sign({
            userId: user.id
        }, 'secret_key', {
            expiresIn: '1d'
        });
        delete user.password;
        res.setHeader('Authorization', token);
        res.status(200).json({
            status: true,
            token,
            user,
            message: 'Login successfully'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const statusUpdate = async (req, res) => {
    try {
        const {
            module
        } = req.params;
        const {
            status,
            index_id,
            remarks
        } = req.body;
        const {
            userId
        } = req.user;
        if (module && module != "" && index_id) {
            if (status === '0') {
                let thisStatusUpdate = await ggBaseQuery(`UPDATE ${module} SET status = 2 , is_deleted = 1 WHERE id = ?`, [index_id]);
                console.log(thisStatusUpdate);
            } else {
                let thisStatusUpdate = await ggBaseQuery(`UPDATE ${module} SET status = ? WHERE id = ?`, [status, index_id]);
                console.log(thisStatusUpdate);
            }
            if (remarks && remarks != "") {
                await remarksEntry([remarks, module.slice(0, -1), index_id, "admin", userId]);
            }
            res.status(200).json({
                status: true,
                message: "Successfully Status Updated"
            });
        } else {
            res.status(500).json({
                status: false,
                message: 'Invalid API'
            });
        }
    } catch (err) {
        console.error('error:', err);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
}
const edit = async (req, res) => {
    try {
        const {
            name,
            phone,
            whatsapp,
            institution,
            email,
            password,
            dob,
            kyc_type,
            upi
        } = req.body;
        console.log(req.body);
        const avatar = req.files && req.files.avatar ? req.files.avatar : null;
        const kycDocument = req.files && req.files.kyc_document ? req.files.kyc_document : null;
        // Hash the password
        if (password && password !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            await ggBaseQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);
        }
        const ggReqParmas = [name, phone, whatsapp, institution, email, dob, kyc_type, upi, req.params.id];
        console.log(ggReqParmas);
        // Handle file uploads
        if (avatar) {
            await handleFileUpload(avatar, uploadBasePath + 'users/avatar', 'avatar', req.params.id);
        }
        if (kycDocument) {
            await handleFileUpload(kycDocument, uploadBasePath + 'users/kyc', 'kyc_document', req.params.id);
        }
        // Update the user in the database
        const result = await ggBaseQuery('UPDATE users SET name = ?, phone = ?, whatsapp = ?, institution = ?, email_address = ?, dob = ?, kyc_type = ?, upi = ? WHERE id = ?', ggReqParmas);
        const resultData = await ggBaseQuery(`select *, CASE
    WHEN avatar IS NOT NULL THEN CONCAT('${PublicBasePath}', avatar)
    ELSE avatar
  END AS avatar_url FROM users WHERE id=?`, [req.params.id]);
        res.status(200).json({
            status: true,
            data: resultData[0],
            message: 'User updated successfully'
        });
    } catch (err) {
        console.error('Failed to update user:', err);
        res.status(400).json({
            status: false,
            error: 'Failed to update user'
        });
    }
};
// Function to handle file uploads
const handleFileUpload = async (file, uploadPath, databaseField, userId) => {
    try {
        const timestamp = new Date().getTime();
        const ext = path.extname(file.name);
        const fileName = `${timestamp}${ext}`;
        let replacePath = replaceBasePath;
        console.log(replacePath);
        let filePath = path.join(replacePath, uploadPath, fileName);
        // Check if the file already exists and delete it
        const existingFilePath = await ggBaseQuery(`SELECT ${databaseField} FROM users WHERE id = ?`, [userId]);
        if (existingFilePath && existingFilePath[0] && existingFilePath[0][databaseField]) {
            const oldfilePath = path.join(replacePath, existingFilePath[0][databaseField]);
            console.log(oldfilePath);
            try {
                await fs.access(oldfilePath);
                // File exists, proceed with unlinking
                await fs.unlink(oldfilePath);
                console.log(`File ${oldfilePath} deleted successfully`);
            } catch (error) {
                console.warn(`File ${oldfilePath} not found`);
            }
        }
        // Move the new file to the upload directory
        await ensureDirectoryExists(path.join(replacePath, uploadPath));
        file.mv(filePath);
        filePath = filePath.replace(replacePath, "");
        // Update the database field with the new filename
        await ggBaseQuery(`UPDATE users SET ${databaseField} = ? WHERE id = ?`, [filePath, userId]);
    } catch (error) {
        console.error(`Failed to handle file upload for ${databaseField}:`, error);
        throw error;
    }
};
// const edit = async (req, res) => {
//     try {
//         console.log(req.body);
//         const {
//             name,
//             phone,
//             whatsapp,
//             institution,
//             email,
//             password,
//             dob, 
//             kyc_type, 
//             kyc_documents, 
//             upi
//         } = req.body;
//         const payment = upi;
//         // Hash the password
//         if(password && password !==""){
//             const hashedPassword = await bcrypt.hash(password, 10);  
//             await ggBaseQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);  
//         }
//         // Update the user in the database
//         const result = await ggBaseQuery('UPDATE users SET name = ?, phone = ?, whatsapp = ?, institution = ?, email_address = ?, dob = ?, kyc_type = ?, kyc_documents = ?, upi = ?, payment = ? WHERE id = ?', [name, phone, whatsapp, institution, email, dob, kyc_type, kyc_documents, upi, payment, req.params.id]);
//         res.status(200).json({
//             status:true,
//             message: 'User updated successfully'
//         });
//     } catch (err) {
//         console.error('Failed to Update User:', err);
//         res.status(400).json({
//             status:false,
//             error: 'Failed to Update User'
//         });
//     }
// };
const deleteData = async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(userId);
        // Retrieve user details from the database
        const user = await ggBaseQuery('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user || user.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }
        if (user && user[0].role !== 'admin') {
            // Update the user's 'deleted' field to true
            await ggBaseQuery('UPDATE users SET is_deleted = ? WHERE id = ?', [true, userId]);
            res.send({
                status: true,
                message: 'User deleted successfully'
            });
        } else {
            res.send({
                status: true,
                message: 'Admin cannot be deleted'
            });
        }
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
// ... Other methods (edit, deleteData, register, login) can be similarly converted ...
// Export the converted methods
const dashBoard = async (req, res) => {
    try {
        const mainCountQuery = `SELECT 
  'users' AS widget_name,  COUNT(*) AS user_records,
  SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_records,
  SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS rejected_records,
  SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS pending_records
FROM users
UNION ALL
SELECT 
  'leads' AS widget_name, COUNT(*) AS record_count,
    SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_records,
  SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS rejected_records,
  SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS pending_records
   FROM leads
UNION ALL
SELECT 
  'quotes' AS widget_name, COUNT(*) AS record_count,
    SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active_records,
  SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS rejected_records,
  SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS pending_records
   FROM quotes
;`;
        const mainData = await ggBaseQuery(mainCountQuery);
        const overallQuery = `
            SELECT 
  'remarks' AS widget_name, COUNT(*) AS record_count FROM remarks
UNION ALL
       SELECT 
  'claims' AS widget_name, COUNT(*) AS record_count FROM claims
UNION ALL
SELECT 
  'documents' AS widget_name, COUNT(*) AS record_count FROM documents
UNION ALL
SELECT 
  'policies' AS widget_name, COUNT(*) AS record_count FROM policies
UNION ALL
SELECT 
  'settings' AS widget_name, COUNT(*) AS record_count FROM settings
  UNION ALL
SELECT 
  'transactions' AS widget_name, COUNT(*) AS record_count FROM transactions;
      `;
        const overallData = await ggBaseQuery(overallQuery);
        // if (rows.length === 0) {
        //     return res.json({
        //         status: false,
        //         results: {
        //             overall: {},
        //             records: {}
        //         },
        //         message: "No data found."
        //     });
        // }
        res.send({
            status: true,
            results: {
                overall: overallData,
                records: mainData
            },
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal Server Error."
        });
    }
};
const viewUser = async (req, res) => {
    console.log(req.params);
    const {
        user_id
    } = req.params;
    if (!user_id) {
        res.status(401).json({
            status: false,
            error: 'Invalid Authorization'
        });
    }
    try {
        const [user] = await ggBaseQuery(`SELECT
  u.*,

   COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) AS incentive_amount,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0) AS claim_amount,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0) AS commission_amount,
    (COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) 
    + COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0)) AS wallet_balance,
  CASE
    WHEN u.avatar IS NOT NULL THEN CONCAT('${PublicBasePath}', u.avatar)
    ELSE u.avatar
  END AS avatar_url,
 
  MAX(r.message) AS remark,
  MAX(r.user_type) AS remark_user,
  MAX(r.created_at) AS remark_timestamp
FROM
  users u
LEFT JOIN 
    transactions t ON u.id = t.agent_id

LEFT JOIN (
  SELECT ref_id, message, user_type, created_at
  FROM remarks r1
  WHERE created_at = (
    SELECT MAX(created_at)
    FROM remarks r2
    WHERE r2.ref_id = r1.ref_id
  )
) r ON u.id = r.ref_id
WHERE
  u.id = ?
GROUP BY
  u.id;
`, [user_id]);
        const documents = await ggBaseQuery(`SELECT id,document_type,type,CONCAT('${PublicBasePath}', document_path)as document_path  FROM documents  WHERE type="user" and ref_id=?
    `, [user_id]);
        console.log(user);
        if (!user) return res.status(404).json({
            status: false,
            message: 'No Profile data Found.'
        });
        delete user.password;
        user.avatar = user.avatar_url;
        user.kyc_document = user.kyc_documents_url;
        user.public_path = "";
        user.documents = documents;
        // user.status = true;
        res.status(200).json({
            status: true,
            data: user
        });
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({
            status: false,
            error: 'Internal server error'
        });
    }
};
const webSettings = async (req, res) => {
    try {
        const userId = 1;
        // Retrieve user details from the database
        const settings = await ggBaseQuery('SELECT * FROM settings WHERE id = ?', [userId]);
        res.send({
            status: true,
            data: settings[0]
        });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const updateSettings = async (req, res) => {
    const settings = req.body;
    console.log(settings);
    try {
        const {
            site_name,
            site_description,
            logo,
            meta_data,
            token_time,
            colors,
            institution,
            form_types,
            form_doc_types,
            form_kyc_types,
            terms,
            auto_credit,
            credit_amount
        } = settings;
        // Construct the update query
        const query = `
      UPDATE settings
      SET
        site_name = ?,
        site_description = ?,
        logo = ?,
        meta_data = ?,
        token_time = ?,
        colors = ?,
        institution = ?,
        form_types = ?,
        form_doc_types = ?,
        form_kyc_types = ?,
        terms = ?,
        auto_credit= ?,
        credit_amount=?
      WHERE id = 1;`;
        // Execute the update query
        const rows = await ggBaseQuery(query, [
            site_name,
            site_description,
            logo,
            meta_data,
            token_time,
            colors,
            institution,
            form_types,
            form_doc_types,
            form_kyc_types,
            terms,
            auto_credit,
            credit_amount
        ]);
        res.send({
            status: true,
            data: (rows.affectedRows ? true : false)
        });
    } catch (err) {
        console.error('Error ', err);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
// Institutions API's
const getInstitutions = async (req, res) => {
    try {
        const rows = await ggBaseQuery('SELECT * FROM institutions');
        console.log(rows);
        res.json({
            status: true,
            data: rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const createInstitution = async (req, res) => {
    try {
        const {
            name,
            institute_type,
            state,
            city
        } = req.body;
        const rows = await ggBaseQuery('INSERT INTO institutions (name, institute_type, state, city) VALUES (?, ?, ?, ?)', [name, institute_type, state, city]);
        console.log(rows);
        res.json({
            status: true,
            rows: rows,
            message: 'Institution created successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const viewInstitution = async (req, res) => {
    const institutionId = req.params.id;
    try {
        const [rows] = await ggBaseQuery('SELECT * FROM institutions WHERE id=?', [institutionId]);
        console.log(rows);
        if (!rows) {
            res.json({
                status: false,
                data: "Institution Not Found"
            });
        }
        res.json({
            status: true,
            data: rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const updateInstitution = async (req, res) => {
    const institutionId = req.params.id;
    const {
        name,
        institute_type,
        state,
        city
    } = req.body;
    try {
        const result = await ggBaseQuery('UPDATE institutions SET name = ?, institute_type = ?, state = ?, city = ? WHERE id = ?', [name, institute_type, state, city, institutionId]);
        // Check if the institution with the given ID exists
        console.log(result);
        if (result.affectedRows === 0) {
            res.status(404).json({
                status: false,
                error: 'Institution not found'
            });
        } else {
            res.json({
                status: true,
                message: 'Institution updated successfully'
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const deleteInstitution = async (req, res) => {
    const institutionId = req.params.id;
    try {
        await ggBaseQuery('DELETE FROM institutions WHERE id = ?', [institutionId]);
        res.json({
            status: true,
            message: 'Institution deleted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const getGlobalOptions = async () => {
    try {
        const rows = await ggBaseQuery(`SELECT id as value,description as label FROM roles WHERE name NOT IN ('admin', 'super')`);
        const categoryQuery = 'SELECT DISTINCT category FROM form_options';
        const categories = await ggBaseQuery(categoryQuery);
        console.log(categories);
        // Step 2: Build the dynamic JSON_OBJECT query parts
        const jsonParts = categories.map(row => {
            const category = row.category;
            // Convert category to valid key (e.g., "place_of_posting" to "place_of_posting_data")
            const keyName = `${category}_data`;
            return `'${keyName}', (SELECT JSON_ARRAYAGG(JSON_OBJECT('value', label, 'label', label)) FROM form_options WHERE category = '${category}')`;
        });
        // Step 3: Construct the final query
        const dynamicQuery = `SELECT JSON_OBJECT(${jsonParts.join(', ')}) AS categories_data`;
        console.log(dynamicQuery);
        // Step 4: Execute the dynamic query
        const results = await ggBaseQuery(dynamicQuery);
        console.log(results);
        // Step 5: Parse and return the results
        const formOptions = results[0]['categories_data'];
        const finalData = {
            rows,
            form_data: formOptions
        };
        return finalData;
    } catch (error) {
        console.error(error);
        const finalData = {
            rows: [],
            form_data: []
        };
        return finalData;
    }
}
const getFormOptions = async (req, res) => {
    try {
        const getGlobalOptionsData = await getGlobalOptions();
        res.json({
            status: true,
            ...getGlobalOptionsData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};

function formatDate(d) {
    if (!d) return "";
    const date = new Date(d);
    return date.toISOString().split("T")[0];
}
const leadsImport = async (req, res) => {
    const reqBody = req.body;
    if (!req.files || !req.files.file) {
        return res.status(400).json({
            error: "No file uploaded"
        });
    }
    const leadesExcel = req.files.file;
    let workbook;
    try {
        if (leadesExcel.data) {
            workbook = xlsx.read(leadesExcel.data, {
                type: "buffer"
            });
        } else if (leadesExcel.tempFilePath) {
            workbook = xlsx.readFile(leadesExcel.tempFilePath);
        } else {
            return res.status(400).json({
                error: "Uploaded file data not available"
            });
        }
    } catch (err) {
        console.error("Error reading workbook:", err);
        return res.status(400).json({
            error: "Invalid Excel file"
        });
    }
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, {
        header: 1
    });
    if (!rawData || rawData.length < 2) {
        return res.status(400).json({
            error: "Excel contains no data"
        });
    }
    // --- helper to normalize header text and map to canonical field names
    const normalize = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "");
    const mapHeaderToField = (hdr) => {
        const h = normalize(hdr);
        // common patterns => canonical DB field names
        if (/reg.*no|regno|registration.*no|registration_no/.test(h)) return "reg_no";
        if (/prev.*policy.*end.*date|prev.*end.*date|previous.*policy.*end/.test(h)) return "prev_policy_end_date";
        if (/prev.*policy.*start.*date|prev.*start.*date/.test(h)) return "prev_policy_start_date";
        if (/prev.*pol.*no|prevpol.*no|prev_policy_no/.test(h)) return "prev_pol_no";
        if (/prev.*pol.*premium|prev.*premium|prev_pol_premium/.test(h)) return "prev_pol_premium";
        if (/prev.*insur|previns|previous.*insur/.test(h)) return "prev_insurer";
        if (/vehicle.*make/.test(h)) return "vehicle_make";
        if (/vehicle.*model|variant/.test(h)) return "vehicle_model_variant";
        if (/sale.*amount|sale_amount/.test(h)) return "sale_amount";
        if (/engine.*no|engine_no/.test(h)) return "engine_no";
        if (/chasis|chassis|chasis_no|chasisno/.test(h)) return "chasis_no";
        if (/address/.test(h)) return "address";
        if (/mobile|phone|contact/.test(h)) return "mobile";
        if (/name/.test(h)) return "name";
        if (/state/.test(h)) return "state";
        if (/product/.test(h) && !/sub/.test(h)) return "product";
        if (/sub.*product|company/.test(h)) return "sub_product"; // excel 'company' -> sub_product mapping
        if (/vehicle.*type|bike|bikescooter|vehicle_type/.test(h)) return "vehicle_type";
        if (/tc\b|tc /.test(h)) return "tc";
        if (/fuel/.test(h)) return "fuel";
        if (/rto|red\b|red /.test(h)) return "rto"; // RED / RTO mapping
        // fallback mapping for date-like fields
        if (/reg.*date|regdate/.test(h)) return "reg_date";
        // catch generic prev_policy_type
        if (/prev.*policy.*type|policy.*type/.test(h)) return "prev_policy_type";
        // finally return normalized raw header as fallback (replace spaces with underscores)
        return h.replace(/\s+/g, "_");
    };
    // build header -> field map using first row
    const excelHeaders = rawData[0];
    const headerFieldMap = excelHeaders.map((h) => ({
        raw: h,
        field: mapHeaderToField(h),
    }));
    // rows to process
    const rows = rawData.slice(1);
    // target DB columns (must match table schema)
    const columns = ["state", "prev_policy_type", "product", "sub_product", "vehicle_type", "reg_no", "prev_insurer", "prev_policy_start_date", "prev_policy_end_date", "prev_pol_no", "prev_pol_premium", "rto", "reg_date", "name", "mobile", "vehicle_make", "vehicle_model_variant", "sale_amount", "engine_no", "chasis_no", "address", "tc", "fuel", "is_lead_type", "status", ];
    const values = [];
    let invalidCount = 0;
    let validCount = 0;
    for (const row of rows) {
        if (!row || row.every((c) => c === undefined || c === null || String(c).trim() === "")) continue;
        // build a canonical rowData object with keys = canonical fields
        const rowData = {};
        for (let i = 0; i < headerFieldMap.length; i++) {
            const hf = headerFieldMap[i];
            const val = row[i] === undefined ? null : row[i];
            // if field is already mapped to a canonical name, set it
            const field = hf.field;
            if (!field) continue;
            rowData[field] = val;
        }
        // Validate required
        const hasRequired = rowData["name"] && rowData["reg_no"] && rowData["mobile"] && rowData["state"] && rowData["prev_policy_type"] && rowData["prev_policy_end_date"]; // allow Excel serial 0? mainly check presence
        if (!hasRequired) {
            invalidCount++;
            continue;
        }
        // Parse date fields to MySQL date string (YYYY-MM-DD)
        const prevPolicyStartDate = rowData["prev_policy_start_date"] ? parseExcelDate(rowData["prev_policy_start_date"]) : null;
        const prevPolicyEndDate = rowData["prev_policy_end_date"] ? parseExcelDate(rowData["prev_policy_end_date"]) : null;
        const regDate = rowData["reg_date"] ? parseExcelDate(rowData["reg_date"]) : null;
        // For safety: convert numeric-looking RTO/RED to string
        const rtoVal = rowData["rto"] !== undefined ? String(rowData["rto"]).trim() : null;
        // build values aligned to columns array
        const insertRow = [
            rowData["state"] || null,
            rowData["prev_policy_type"] || null,
            rowData["product"] || null,
            rowData["sub_product"] || rowData["company"] || null, // fallback
            rowData["vehicle_type"] || null,
            rowData["reg_no"] || null,
            rowData["prev_insurer"] || null,
            prevPolicyStartDate ? formatDateToMySQL(prevPolicyStartDate) : null,
            prevPolicyEndDate ? formatDateToMySQL(prevPolicyEndDate) : null,
            rowData["prev_pol_no"] || null,
            rowData["prev_pol_premium"] || null,
            rtoVal || null, // RED / RTO
            regDate ? formatDateToMySQL(regDate) : null,
            rowData["name"] || null,
            rowData["mobile"] || null,
            rowData["vehicle_make"] || null,
            rowData["vehicle_model_variant"] || null,
            rowData["sale_amount"] || null,
            rowData["engine_no"] || null,
            rowData["chasis_no"] || null,
            rowData["address"] || null,
            rowData["tc"] || null,
            rowData["fuel"] || null,
            reqBody.lead_type || null,
            0, // status default
        ];
        values.push(insertRow);
        validCount++;
    }
    const totalRows = rows.length;
    if (!values.length) {
        return res.json({
            status: true,
            message: "No valid rows to import",
            summary: {
                total_rows: totalRows,
                valid_rows: 0,
                inserted_rows: 0,
                duplicate_rows: 0,
                invalid_rows: invalidCount,
            },
        });
    }
    // --- Insert batches using INSERT IGNORE and UNIQUE constraint on (reg_no, prev_policy_type, prev_policy_end_date)
    const BATCH_SIZE = 500;
    let insertedCount = 0;
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
        const batch = values.slice(i, i + BATCH_SIZE);
        const placeholdersPerRow = "(" + new Array(columns.length).fill("?").join(",") + ")";
        const allPlaceholders = new Array(batch.length).fill(placeholdersPerRow).join(",");
        const flatParams = batch.flat();
        const sql = `INSERT IGNORE INTO temp_leads_management (${columns.join(",")}) VALUES ${allPlaceholders}`;
        try {
            const result = await ggBaseQuery(sql, flatParams);
            // result.affectedRows is number of rows actually inserted (MySQL)
            insertedCount += result.affectedRows || 0;
        } catch (err) {
            console.error("Batch insert error:", err);
            return res.status(500).json({
                error: "DB insert error",
                detail: err.message
            });
        }
    }
    const duplicateCount = validCount - insertedCount;
    return res.json({
        status: true,
        message: "File processed successfully",
        summary: {
            total_rows: totalRows,
            valid_rows: validCount,
            inserted_rows: insertedCount,
            duplicate_rows: duplicateCount,
            invalid_rows: invalidCount,
        },
    });
};
// helper to produce MySQL date string
function formatDateToMySQL(date) {
    if (!(date instanceof Date) || isNaN(date)) return null;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
const fetchLeadsData = async (req, res) => {
    try {
        const {
            start,
            end,
            year,
            prev_policy_type,
            states,
            rf,
            years,
        } = req.query;
        console.log(req.query);
        let conditions = [];
        // Date range filter
        if (start && end) {
            conditions.push(`prev_policy_end_date BETWEEN '${start}' AND '${end}'`);
        }
        // Single year
        if (year) {
            conditions.push(`YEAR(prev_policy_end_date) = '${year}'`);
        }
        // Multiple years
        if (years && years.length) {
            const yearList = Array.isArray(years) ? years : years.split(",");
            conditions.push(`YEAR(prev_policy_end_date) IN (${yearList.map((y) => `'${y}'`).join(",")})`);
        }
        // States
        if (states && states.length) {
            const stateList = Array.isArray(states) ? states : states.split(",");
            conditions.push(`state IN (${stateList.map((s) => `'${s}'`).join(",")})`);
        }
        // Prev policy type
        if (prev_policy_type && prev_policy_type.length) {
            const typeList = Array.isArray(prev_policy_type) ? prev_policy_type : prev_policy_type.split(",");
            conditions.push(`prev_policy_type IN (${typeList.map((t) => `'${t}'`).join(",")})`);
        }
        // R/F filter (status 0=Fresh, 1=Renewal)
        if (rf) {
            conditions.push(`is_lead_type = '${rf.toString()}'`);
        }
        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")} AND is_assigned =0` : "WHERE is_assigned =0";
        // 1. Distinct values
        const [leadDistinctValues] = await ggBaseQuery(`
      SELECT 
        GROUP_CONCAT(DISTINCT state) AS states,
        GROUP_CONCAT(DISTINCT prev_policy_type) AS prev_policy_types,
        GROUP_CONCAT(DISTINCT product) AS products,
        GROUP_CONCAT(DISTINCT sub_product) AS sub_products,
        GROUP_CONCAT(DISTINCT vehicle_type) AS vehicle_types,
        GROUP_CONCAT(DISTINCT YEAR(prev_policy_end_date)) AS policy_years
        
      FROM temp_leads_management
     
    `);
        // 2. Lead Type Counts (Fresh vs Renewal)
        const leadTypeCounts = await ggBaseQuery(`
      SELECT is_assigned, COUNT(*) as total
      FROM temp_leads_management
      ${whereClause}
      GROUP BY is_assigned
    `);
        const is_lead_type = {};
        (leadTypeCounts || []).forEach((r) => {
            const key = r.is_assigned === 0 ? "Fresh" : "Renewal";
            is_lead_type[key] = r.total;
        });
        // 3. Policy End Year Counts
        const policyYearCounts = await ggBaseQuery(`
      SELECT YEAR(prev_policy_end_date) as year, COUNT(*) as total
      FROM temp_leads_management
      ${whereClause}
      GROUP BY YEAR(prev_policy_end_date)
      ORDER BY year
    `);
        const prev_policy_end_date = {};
        (policyYearCounts || []).forEach((r) => {
            prev_policy_end_date[r.year] = r.total;
        });
        // 4. Assigned vs Unassigned Counts
        const assignedCounts = await ggBaseQuery(`
      SELECT is_assigned, COUNT(*) as total
      FROM temp_leads_management
      WHERE is_assigned IN (0,1)
      ${conditions.length ? `AND ${conditions.join(" AND ")}` : ""}
      GROUP BY is_assigned
    `);
        const assigned_status = {
            Unassigned: 0,
            Assigned: 0
        };
        (assignedCounts || []).forEach((r) => {
            if (r.is_assigned === 0) assigned_status.Unassigned = r.total;
            if (r.is_assigned === 1) assigned_status.Assigned = r.total;
        });
        // Work locations
        const work_locations = await ggBaseQuery(`
      SELECT id,name 
      FROM teams 
      WHERE status = 'active'
    `);
        // ✅ Filtered count (for frontend)
        const [filteredRow] = await ggBaseQuery(`
      SELECT COUNT(*) as filtered
      FROM temp_leads_management
      ${whereClause}
    `);
        console.log(whereClause);
        // ✅ Final Response
        res.json({
            work_locations,
            states: leadDistinctValues.states.split(",") || [],
            prev_policy_type: leadDistinctValues.prev_policy_types.split(",") || [],
            product: leadDistinctValues.products.split(",") || [],
            policy_years: leadDistinctValues.policy_years.split(",") || [],
            // sub_product: leadDistinctValues.sub_products.split(",") || [],
            // vehicle_type: leadDistinctValues.vehicle_types.split(",") || [],
            sub_product: [],
            vehicle_type: [],
            is_lead_type,
            prev_policy_end_date,
            assigned_status,
            filtered: filteredRow.filtered || 0,
            filter_range: {
                start,
                end,
                year,
                years,
                states,
                prev_policy_type,
                rf
            },
        });
    } catch (error) {
        console.error("Error fetching filters:", error);
        res.json({
            status: false,
            message: "No Leads Data Found.",
            detail: error.message,
        });
    }
};
const getLocationByUsers = async (req, res) => {
    try {
        const {
            location
        } = req.query;
        // #FETCH LOCATOIN WISE USERS LITS
        const work_location_users = await ggBaseQuery(`SELECT id,name FROM users WHERE status = 1 AND place_of_posting = '${location}' `);
        res.json({
            status: true,
            data: work_location_users
        })
    } catch (err) {
        console.error("Error fetching filters:", err);
        res.json({
            status: false,
            error: "Failed to fetch users",
            detail: err.message,
        });
    }
};
const getTeamLeadByUsers = async (req, res) => {
    try {
        const {
            location
        } = req.query;
        // #FETCH LOCATOIN WISE USERS LITS
        // const team_leads = await ggBaseQuery(`SELECT id,name FROM users WHERE status = 1  AND designation ='Asst Mgr / Team Leader' AND place_of_posting = '${location}' `);
        const team_leads = await ggBaseQuery(`SELECT id,name FROM crm_users WHERE status = 1  AND role= 'team_lead'`);
        res.json({
            status: true,
            data: team_leads
        })
    } catch (err) {
        console.error("Error fetching filters:", err);
        res.json({
            status: false,
            error: "Failed to fetch users",
            detail: err.message,
        });
    }
};
const previewModuleReports = async (leads, selected_users, max_leads_per_employee, res) => {
    try {
        const MAX_LEADS_PER_EXEC = max_leads_per_employee || 150;
        if (!leads.length) {
            return res.status(400).json({
                error: "No leads provided"
            });
        }
        if (!selected_users || Object.keys(selected_users).length === 0) {
            return res.status(400).json({
                error: "selected_users object required"
            });
        }
        // 1️⃣ Extract team names & build safe IN clause
        const teamNames = Object.keys(selected_users).map((name) => name.trim());
        const placeholders = teamNames.map(() => "?").join(", ");
        // 2️⃣ Fetch team leads by name
        const teamLeadsSql = `
      SELECT id, name 
      FROM teams
      WHERE name IN (${placeholders}) AND status = 'active'
    `;
        const teamLeads = await ggBaseQuery(teamLeadsSql, teamNames);
        if (!teamLeads.length) {
            return res.status(404).json({
                error: "No valid teams found"
            });
        }
        // 3️⃣ Build mapping: team_name -> team_id
        const teamIdByName = {};
        for (const t of teamLeads) {
            teamIdByName[t.name.trim()] = t.id;
        }
        // 4️⃣ Build executive list (each team’s members from selected_users)
        const execByTeam = {};
        for (const [teamName, userIds] of Object.entries(selected_users)) {
            if (userIds && userIds.length) {
                const teamId = teamIdByName[teamName.trim()];
                if (!teamId) continue;
                const userPlaceholders = userIds.map(() => "?").join(", ");
                const execSql = `
        SELECT u.id, u.name, ${teamId} AS leader_id
        FROM users u
        WHERE u.id IN (${userPlaceholders})
        ORDER BY u.id ASC
      `;
                console.log(execSql, userIds);
                const execRows = await ggBaseQuery(execSql, userIds);
                execByTeam[teamId] = execRows.map((u) => ({ ...u,
                    current_assigned: 0,
                }));
            }
        }
        if (!Object.keys(execByTeam).length) {
            return res.status(404).json({
                error: "No executives found under these team leads"
            });
        }
        // 5️⃣ Create a global ordered flat list: TL1-E1, TL1-E2, TL2-E1, TL2-E2, ...
        let flatExecList = [];
        const maxTeamExecutives = Math.max(...Object.values(execByTeam).map((arr) => arr.length));
        const teamIds = Object.keys(execByTeam);
        for (let i = 0; i < maxTeamExecutives; i++) {
            for (const tid of teamIds) {
                const exec = execByTeam[tid][i];
                if (exec) flatExecList.push(exec);
            }
        }
        if (!flatExecList.length) {
            return res.status(404).json({
                error: "No executives available for assignment"
            });
        }
        // 6️⃣ Round-robin assign leads
        let execIndex = 0;
        const totalLeads = leads.length;
        const teamPreview = {};
        const unassigned = [];
        for (const leadId of leads) {
            let assigned = false;
            let attempts = 0;
            while (attempts < flatExecList.length) {
                const exec = flatExecList[execIndex];
                const team_lead_id = exec.leader_id;
                if (exec.current_assigned < MAX_LEADS_PER_EXEC) {
                    if (!teamPreview[team_lead_id]) {
                        teamPreview[team_lead_id] = {
                            team_lead_id,
                            executives: {},
                            team_total: 0,
                        };
                    }
                    if (!teamPreview[team_lead_id].executives[exec.id]) {
                        teamPreview[team_lead_id].executives[exec.id] = {
                            executive_id: exec.id,
                            executive_name: exec.name,
                            predicted_assign_count: 0,
                        };
                    }
                    exec.current_assigned++;
                    teamPreview[team_lead_id].executives[exec.id].predicted_assign_count++;
                    teamPreview[team_lead_id].team_total++;
                    assigned = true;
                    break;
                }
                execIndex = (execIndex + 1) % flatExecList.length;
                attempts++;
            }
            if (!assigned) unassigned.push(leadId);
            execIndex = (execIndex + 1) % flatExecList.length;
        }
        // 7️⃣ Build preview summary
        const preview_summary = teamLeads.map((lead) => {
            const data = teamPreview[lead.id] || {
                executives: {},
                team_total: 0
            };
            return {
                team_lead_id: lead.id,
                team_lead_name: lead.name.trim(),
                team_total: data.team_total,
                executives: Object.values(data.executives),
            };
        });
        // 8️⃣ Final output
        const finalOut = {
            status: true,
            data: {
                total: totalLeads,
                assigned_total: totalLeads - unassigned.length,
                unassigned_total: unassigned.length,
                preview_summary,
                unassigned_leads: unassigned,
            },
        };
        return finalOut;
    } catch (err) {
        console.error("previewModuleReports error:", err);
        return res.status(500).json({
            error: "Server error",
            detail: err.message
        });
    }
};
const LeadPreviewModule = async (req, res) => {
    try {
        const {
            filters,
            year_filters,
            user_ids,
            max_leads_per_employee,
            is_preview,
            selected_users
        } = req.body;
        const userId = req.userId;
        if (!filters || !year_filters) {
            return res.status(400).json({
                error: "Missing filters or year_filters",
            });
        }
        // 1️⃣ Base WHERE clauses
        const baseClauses = [];
        if (filters.prev_policy_type.length) {
            baseClauses.push(`prev_policy_type IN (${filters.prev_policy_type
          .map((v) => `'${v.replace(/'/g, "''")}'`)
          .join(",")})`);
        }
        if (filters.states.length) {
            baseClauses.push(`state IN (${filters.states
          .map((v) => `'${v.replace(/'/g, "''")}'`)
          .join(",")})`);
        }
        if (filters.rf !== undefined && filters.rf !== null && filters.rf !== "") {
            baseClauses.push(`is_lead_type = ${
          typeof filters.rf === "number" ? filters.rf : `'${filters.rf}'`
        }`);
        }
        const baseWhere = baseClauses.length ? baseClauses.join(" AND ") : "1=1";
        // ✅ Use an array, concat results in batches
        let finalRows = [];
        // 2️⃣ Iterate over year_filters
        for (const [yearStr, yrFilter] of Object.entries(year_filters)) {
            const year = parseInt(yearStr, 10);
            if (Number.isNaN(year)) continue;
            const yearClauses = [baseWhere, `YEAR(prev_policy_end_date) = ${year}`];
            if (yrFilter.start && yrFilter.end) {
                yearClauses.push(`prev_policy_end_date BETWEEN '${yrFilter.start}' AND '${yrFilter.end}'`);
            }
            const whereForYear = `WHERE ${yearClauses.join(" AND ")}`;
            // 3️⃣ Count query
            const countSql = `SELECT COUNT(*) AS cnt FROM temp_leads_management ${whereForYear};`;
            const countRes = await ggBaseQuery(countSql);
            const cnt = countRes && countRes[0] && countRes[0].cnt ? Number(countRes[0].cnt) : 0;
            // 4️⃣ Percent calc
            const percent = Number(yrFilter.percent) || 100;
            const take = Math.floor(cnt * (percent / 100));
            if (take <= 0) continue;
            // 5️⃣ Select query
            // const selectSql = `
            //   SELECT id, reg_no, name, mobile, is_lead_type, prev_policy_end_date
            //   FROM temp_leads_management
            //   ${whereForYear}
            //   ORDER BY prev_policy_end_date
            //   LIMIT ${take};
            // `;
            const selectSql = `
        SELECT id
        FROM temp_leads_management
        ${whereForYear} AND is_assigned =0
        ORDER BY prev_policy_end_date ASC
        LIMIT ${take};
      `;
            console.log(selectSql);
            const rows = await ggBaseQuery(selectSql);
            // ✅ Avoid spread (...rows) which can blow stack on large arrays
            if (rows && rows.length) {
                for (const r of rows) {
                    // shallow copy → strips DB driver prototypes/circular refs
                    finalRows.push({ ...r
                    });
                }
            }
        }
        const thisLeads = finalRows.map(lead => lead.id);
        if (!thisLeads || !thisLeads.length) {
            return res.status(400).json({
                error: "No leads provided"
            });
        }
        const team_lead_ids = selected_users;
        if (!team_lead_ids || !team_lead_ids.length) {
            return res.status(400).json({
                error: "team_lead_ids required"
            });
        }
        let thisResponse = {};
        if (is_preview) {
            thisResponse = await previewModuleReports(thisLeads, team_lead_ids, max_leads_per_employee, res);
        } else {
            thisResponse = await assignLeadsModule(thisLeads, team_lead_ids, max_leads_per_employee, userId, res);
        }
        // 6️⃣ Return safe JSON
        return res.json(thisResponse);
    } catch (err) {
        console.error("fetchFilteredLeadsAndSample error:", err);
        return res.status(500).json({
            error: "Server error",
            detail: err.message,
        });
    }
};
const LeadTeamsPreviewModule = async (req, res) => {
    try {
        const {
            filters,
            year_filters,
            user_ids,
            max_leads_per_employee,
            is_preview,
            selected_users
        } = req.body;
        const userId = req.userId;
        if (!filters || !year_filters) {
            return res.status(400).json({
                error: "Missing filters or year_filters",
            });
        }
        // 1️⃣ Base WHERE clauses
        const baseClauses = [];
        if (filters.prev_policy_type.length) {
            baseClauses.push(`prev_policy_type IN (${filters.prev_policy_type
          .map((v) => `'${v.replace(/'/g, "''")}'`)
          .join(",")})`);
        }
        if (filters.states.length) {
            baseClauses.push(`state IN (${filters.states
          .map((v) => `'${v.replace(/'/g, "''")}'`)
          .join(",")})`);
        }
        if (filters.rf !== undefined && filters.rf !== null && filters.rf !== "") {
            baseClauses.push(`is_lead_type = ${
          typeof filters.rf === "number" ? filters.rf : `'${filters.rf}'`
        }`);
        }
        const baseWhere = baseClauses.length ? baseClauses.join(" AND ") : "1=1";
        // ✅ Use an array, concat results in batches
        let finalRows = [];
        // 2️⃣ Iterate over year_filters
        for (const [yearStr, yrFilter] of Object.entries(year_filters)) {
            const year = parseInt(yearStr, 10);
            if (Number.isNaN(year)) continue;
            const yearClauses = [baseWhere, `YEAR(prev_policy_end_date) = ${year}`];
            if (yrFilter.start && yrFilter.end) {
                yearClauses.push(`prev_policy_end_date BETWEEN '${yrFilter.start}' AND '${yrFilter.end}'`);
            }
            const whereForYear = `WHERE ${yearClauses.join(" AND ")}`;
            // 3️⃣ Count query
            const countSql = `SELECT COUNT(*) AS cnt FROM temp_leads_management ${whereForYear};`;
            const countRes = await ggBaseQuery(countSql);
            const cnt = countRes && countRes[0] && countRes[0].cnt ? Number(countRes[0].cnt) : 0;
            // 4️⃣ Percent calc
            const percent = Number(yrFilter.percent) || 100;
            const take = Math.floor(cnt * (percent / 100));
            if (take <= 0) continue;
            // 5️⃣ Select query
            // const selectSql = `
            //   SELECT id, reg_no, name, mobile, is_lead_type, prev_policy_end_date
            //   FROM temp_leads_management
            //   ${whereForYear}
            //   ORDER BY prev_policy_end_date
            //   LIMIT ${take};
            // `;
            const selectSql = `
        SELECT id
        FROM temp_leads_management
        ${whereForYear} AND is_assigned =0
        ORDER BY prev_policy_end_date ASC
        LIMIT ${take};
      `;
            console.log(selectSql);
            const rows = await ggBaseQuery(selectSql);
            // ✅ Avoid spread (...rows) which can blow stack on large arrays
            if (rows && rows.length) {
                for (const r of rows) {
                    // shallow copy → strips DB driver prototypes/circular refs
                    finalRows.push({ ...r
                    });
                }
            }
        }
        const thisLeads = finalRows.map(lead => lead.id);
        if (!thisLeads || !thisLeads.length) {
            return res.status(400).json({
                error: "No leads provided"
            });
        }
        const team_lead_ids = selected_users;
        if (!team_lead_ids || !Object.keys(team_lead_ids).length) {
            return res.status(400).json({
                error: "team_lead_ids required"
            });
        }
        let thisResponse = {};
        if (is_preview) {
            thisResponse = await previewModuleReports(thisLeads, team_lead_ids, max_leads_per_employee, res);
        } else {
            thisResponse = await assignLeadsModule(thisLeads, team_lead_ids, max_leads_per_employee, userId, res);
        }
        // 6️⃣ Return safe JSON
        return res.json(thisResponse);
    } catch (err) {
        console.error("fetchFilteredLeadsAndSample error:", err);
        return res.status(500).json({
            error: "Server error",
            detail: err.message,
        });
    }
};
const assignLeadsModule = async (leads, team_lead_ids, max_leads_per_employee, user_id, res) => {
    try {
        const MAX_LEADS_PER_EXEC = max_leads_per_employee || 150;
        if (!leads.length) {
            return res.status(400).json({
                error: "No leads provided"
            });
        }
        if (!team_lead_ids.length) {
            return res.status(400).json({
                error: "team_lead_ids required"
            });
        }
        // 🔹 Build team placeholders
        const placeholders = team_lead_ids.map((id) => `${id}`).join(",");
        // 1️⃣ Fetch team leads
        const teamLeads = await ggBaseQuery(`
     SELECT id, name 
      FROM teams  
      WHERE id IN (${placeholders}) AND status = 'active'
    `);
        // 2️⃣ Fetch executives
        const executives = await ggBaseQuery(`
      SELECT u.id,u.name,tm.team_id as leader_id
      FROM team_members tm
LEFT JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id IN (${placeholders}) 
      ORDER BY tm.team_id, u.id ASC
    `);
        // 3️⃣ Prepare executive mapping
        const execByTeam = {};
        for (const exec of executives) {
            if (!execByTeam[exec.leader_id]) execByTeam[exec.leader_id] = [];
            execByTeam[exec.leader_id].push({ ...exec,
                current_assigned: 0
            });
        }
        // Flatten in round-robin order (TL1-E1, TL2-E1, TL1-E2, TL2-E2...)
        let flatExecList = [];
        const maxTeamExecutives = Math.max(...Object.values(execByTeam).map((arr) => arr.length));
        for (let i = 0; i < maxTeamExecutives; i++) {
            for (const tid of team_lead_ids) {
                const exec = execByTeam[tid][i];
                if (exec) flatExecList.push(exec);
            }
        }
        if (!flatExecList.length) {
            return res.status(404).json({
                error: "No executives available"
            });
        }
        // 4️⃣ Round-robin assignment
        let execIndex = 0;
        const totalLeads = leads.length;
        const unassigned = [];
        for (const leadId of leads) {
            let assigned = false;
            let attempts = 0;
            while (attempts < flatExecList.length) {
                const exec = flatExecList[execIndex];
                const team_lead_id = exec.leader_id;
                if (exec.current_assigned < MAX_LEADS_PER_EXEC) {
                    // ✅ Full insert with TEAMLEADER, EXECUTIVE, status, sub_status
                    await ggBaseQuery(`
            INSERT INTO insurdata (
              BIKESCOOTER, COMPANY, REGNO, REGDATE, TC, fuel, RED, PREVINS, PREVPOL_NO,
              NAME, ADDRESS, ENGINE_NO, CHASIS_NO, VEHICLEMAKE, VEHICLEMODEL, VARIANT,
              SALE_AMOUNT, MOBILE, TEAMLEADER, EXECUTIVE, CURSTATUS, RESPONSE, LATTERDATE,
              REMARKS, status, sub_status, state, prev_policy_type, product, sub_product,
              created_at, updated_at, status_history
            )
            SELECT
              vehicle_type, prev_insurer, reg_no, reg_date, tc, fuel, rto, prev_insurer, prev_pol_no,
              name, address, engine_no, chasis_no, vehicle_make, vehicle_model_variant, vehicle_model_variant,
              sale_amount, mobile,
              ? AS TEAMLEADER,
              ? AS EXECUTIVE,
              'New' AS CURSTATUS,
              NULL AS RESPONSE,
              NULL AS LATTERDATE,
              NULL AS REMARKS,
              1 AS status,
              0 AS sub_status,
              state,
              prev_policy_type,
              product,
              sub_product,
              NOW() AS created_at,
              NOW() AS updated_at,
              JSON_OBJECT('status', 'New', 'date', NOW()) AS status_history
            FROM temp_leads_management
            WHERE id = ?
          `, [team_lead_id, exec.id, leadId]);
                    // ✅ Update temp_leads_management tracking
                    await ggBaseQuery(`
            UPDATE temp_leads_management
            SET is_assigned = 1,
                executive_id = ?,
                assigned_by = ?,
                assigned_at = NOW()
            WHERE id = ?
          `, [exec.id, team_lead_id, user_id, leadId]);
                    // ✅ Insert into logs
                    await ggBaseQuery(`
            INSERT INTO lead_assignment_logs (
              lead_id, team_lead_id, executive_id, assigned_by, assigned_at, remarks
            )
            VALUES (?, ?, ?, ?, NOW(), ?)
          `, [leadId, team_lead_id, exec.id, user_id, 'Initial lead assignment']);
                    exec.current_assigned++;
                    assigned = true;
                    break;
                }
                execIndex = (execIndex + 1) % flatExecList.length;
                attempts++;
            }
            if (!assigned) unassigned.push(leadId);
            execIndex = (execIndex + 1) % flatExecList.length;
        }
        // ✅ Done
        return res.json({
            status: true,
            message: "Leads assigned successfully",
            data: {
                total: totalLeads,
                unassigned_total: unassigned.length,
                unassigned_leads: unassigned,
            },
        });
    } catch (err) {
        console.error("assignLeadsModule error:", err);
        return res.status(500).json({
            error: "Server error",
            detail: err.message,
        });
    }
};
const getExecutiveCcount = async (req, res) => {
    try {
        const {
            team_leads
        } = req.body;
        if (!team_leads.length) {
            return res.json({
                status: true,
                data: [],
            });
        }
        const placeholders = team_leads.map((id) => `${id}`).join(",");
        const execSql = `
      SELECT COUNT(id) as count
      FROM crm_users 
      WHERE leader_id IN (${placeholders}) AND role = 'executive'
      ORDER BY leader_id, id ASC
    `;
        const executives = await ggBaseQuery(execSql);
        return res.json({
            status: true,
            data: executives[0]['count'],
        });
    } catch (err) {
        console.error("Error fetching filters:", err);
        res.json({
            status: false,
            error: "Failed to fetch users",
            detail: err.message,
        });
    }
};
const getTeamExecutives = async (req, res) => {
    try {
        const {
            team_leads
        } = req.body;
        if (!team_leads.length) {
            return res.json({
                status: true,
                data: [],
            });
        }
        const placeholders = team_leads.map((id) => `${id}`).join(",");
        const execSql = `
      


            SELECT COUNT(id) as count
      FROM team_members 
      WHERE team_id IN (${placeholders})

    `;
        const executives = await ggBaseQuery(execSql);
        return res.json({
            status: true,
            data: executives[0]['count'],
        });
    } catch (err) {
        console.error("Error fetching filters:", err);
        res.json({
            status: false,
            error: "Failed to fetch users",
            detail: err.message,
        });
    }
};
async function listTeams(req, res) {
    try {
        const {
            page = 1,
                pageSize = 20,
                q,
                location,
                vertical,
                status
        } = req.body || req.query;
        const offset = (page - 1) * pageSize;
        let where = "WHERE t.deleted_at IS NULL";
        const params = [];
        // 🔍 Search filter
        if (q) {
            where += " AND t.name LIKE ?";
            params.push(`%${q}%`);
        }
        // 📍 Location filter (multi or single)
        if (Array.isArray(location) && location.length > 0) {
            where += ` AND t.location IN (${location.map(() => "?").join(",")})`;
            params.push(...location);
        } else if (typeof location === "string" && location.trim() !== "") {
            where += " AND t.location = ?";
            params.push(location);
        }
        // 🏢 Vertical filter (multi or single)
        if (Array.isArray(vertical) && vertical.length > 0) {
            where += ` AND t.vertical IN (${vertical.map(() => "?").join(",")})`;
            params.push(...vertical);
        } else if (typeof vertical === "string" && vertical.trim() !== "") {
            where += " AND t.vertical = ?";
            params.push(vertical);
        }
        // ✅ Status filter
        if (status) {
            where += " AND t.status = ?";
            params.push(status);
        }
        // 🧮 Total count
        const [countRows] = await ggBaseQuery(`SELECT COUNT(DISTINCT t.id) AS cnt 
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id
       ${where}`, params);
        const total = countRows[0] && countRows[0].cnt || 0;
        // 📊 Team list with member count
        const teamQuery = `
      SELECT 
        t.*,
        COUNT(tm.id) AS member_count,
    JSON_ARRAYAGG(
       
        JSON_OBJECT(
            'name', u.name,
            'id', u.id
        )
    ) AS member_data,
        GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ', ') AS member_names
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN users u ON u.id = tm.user_id
      ${where}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}
    `;
        // ✅ Here we embed limit/offset as literals (safe since they’re sanitized)
        const teams = await ggBaseQuery(teamQuery, params);
        res.json({
            total,
            page: Number(page),
            pageSize: Number(pageSize),
            teams,
        });
    } catch (err) {
        console.error("listTeams error:", err);
        res.status(500).json({
            error: "Server error",
            detail: err.message,
        });
    }
}
// =====================
// GET /api/teams/:id
// =====================
async function getTeam(req, res) {
    try {
        const {
            id
        } = req.params;
        const [teamRows] = await ggBaseQuery(`SELECT * FROM teams WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [id]);
        const team = teamRows[0];
        if (!team) return res.status(404).json({
            error: "Team not found"
        });
        const [members] = await ggBaseQuery(`SELECT u.id, u.name, u.email 
         FROM team_members tm
         INNER JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?`, [id]);
        team.members = members;
        res.json(team);
    } catch (err) {
        console.error("getTeam error:", err);
        res.status(500).json({
            error: "Server error",
            detail: err.message
        });
    }
}
// =====================
// POST /api/teams
// =====================
async function createTeam(req, res) {
    try {
        // 🧩 Auth user check
        const userId = req.user ? req.user.id : 0;
        // 🧠 Extract from request
        const body = req.body ? req.body : {};
        const name = body.name;
        const location = body.location;
        const vertical = body.vertical;
        const status = body.status ? body.status : "active";
        const members = Array.isArray(body.members) ? body.members : [];
        // ✅ Validation
        if (!name) {
            return res.status(400).json({
                error: "Team name required"
            });
        }
        // 📍 Convert arrays (multi-select) to string
        const locationStr = Array.isArray(location) ? location.join(",") : location;
        const verticalStr = Array.isArray(vertical) ? vertical.join(",") : vertical;
        // ✅ 1️⃣ Insert into teams table
        const insertSQL = `
      INSERT INTO teams (name, location, vertical, status)
      VALUES (?, ?, ?, ?)
    `;
        const insertParams = [name, locationStr, verticalStr, status];
        const resultArr = await ggBaseQuery(insertSQL, insertParams);
        // ⚙️ Extract team ID
        var insertResult = resultArr && resultArr[0] ? resultArr[0] : resultArr;
        const teamId = insertResult && insertResult.insertId ? insertResult.insertId : 0;
        if (!teamId) {
            throw new Error("Failed to retrieve inserted team ID");
        }
        // ✅ 2️⃣ Insert team members one by one (safe)
        if (members.length > 0) {
            for (var i = 0; i < members.length; i++) {
                var uid = members[i];
                await ggBaseQuery("INSERT IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)", [teamId, uid]);
            }
        }
        // ✅ 3️⃣ Fetch created team details
        const teamRowsArr = await ggBaseQuery("SELECT * FROM teams WHERE id = ?", [
            teamId,
        ]);
        const teamRows = teamRowsArr && teamRowsArr[0] ? teamRowsArr[0] : teamRowsArr;
        const team = teamRows && teamRows[0] ? teamRows[0] : (Array.isArray(teamRows) ? {} : teamRows);
        // ✅ 4️⃣ Fetch member names
        const memberListArr = await ggBaseQuery("SELECT u.id, u.name FROM team_members tm INNER JOIN users u ON u.id = tm.user_id WHERE tm.team_id = ?", [teamId]);
        const memberList = memberListArr;
        team.members = memberList ? memberList : [];
        // ✅ Final Response
        res.status(201).json({
            success: true,
            message: "Team created successfully",
            team: team,
        });
    } catch (err) {
        console.error("createTeam error:", err);
        res.status(500).json({
            error: "Failed to create team",
            detail: err.message,
        });
    }
}
// =====================
// PUT /api/teams/:id
// =====================
async function updateTeam(req, res) {
    try {
        // const {
        //     id
        // } = req.params;
        const userId = req.user.id;
        const {
            id,
            name,
            location,
            vertical,
            status,
            members
        } = req.body;
        // 1️⃣ Update team basic info
        await ggBaseQuery(`UPDATE teams
       SET name = ?, location = ?, vertical = ?, status = ?,updated_at = ?
       WHERE id = ?`, [name, location.join(","), vertical.join(","), status, moment().format("YYYY-MM-DD HH:mm:ss"), id]);
        // 2️⃣ Replace members
        if (Array.isArray(members)) {
            await ggBaseQuery(`DELETE FROM team_members WHERE team_id = ?`, [id]);
            if (members.length > 0) {
                for (var i = 0; i < members.length; i++) {
                    var uid = members[i];
                    await ggBaseQuery("INSERT IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)", [id, uid]);
                }
            }
        }
        const [teamRows] = await ggBaseQuery(`SELECT * FROM teams WHERE id = ?`, [id]);
        res.json(teamRows[0]);
    } catch (err) {
        console.error("updateTeam error:", err);
        res.status(500).json({
            error: "Failed to update team",
            detail: err.message
        });
    } finally {}
}
// =====================
// DELETE /api/teams/:id
// =====================
async function deleteTeam(req, res) {
    try {
        const {
            id
        } = req.body;
        const userId = req.user.id;
        await ggBaseQuery(`DELETE FROM teams WHERE id = ?`, [id]);
        res.json({
            success: true
        });
    } catch (err) {
        console.error("deleteTeam error:", err);
        res.status(500).json({
            error: "Failed to delete team",
            detail: err.message
        });
    }
}
const getUserListWithOptions = async (req, res) => {
    try {
        // ✅ Support both query params and JSON body
        const filters = req.body.filters || {};
        const {
            locations = [], verticals = []
        } = filters;
        // 🔹 Base query
        let sql = `SELECT id, name, place_of_posting, vertical FROM users WHERE role NOT IN ('admin', 'super') AND status = 1`;
        const params = [];
        // 🔸 Apply filters dynamically
        if (locations.length > 0) {
            const placeholders = locations.map(() => "?").join(", ");
            sql += ` AND place_of_posting IN (${placeholders})`;
            params.push(...locations);
        }
        if (verticals.length > 0) {
            const placeholders = verticals.map(() => "?").join(", ");
            sql += ` AND vertical IN (${placeholders})`;
            params.push(...verticals);
        }
        // 🔹 Execute SQL
        const work_location_users = await ggBaseQuery(sql, params);
        // 🔹 Fetch dropdowns (verticals, locations)
        const getGlobalOptionsData = await getGlobalOptions();
        // ✅ Final response
        res.json({
            status: true,
            data: work_location_users || [],
            ...getGlobalOptionsData,
        });
    } catch (err) {
        console.error("Error fetching user list:", err);
        res.json({
            status: false,
            error: "Failed to fetch users",
            detail: err.message,
        });
    }
};
// const getTeamLeadByUsers = async (req, res) => {
//     try {
//         const {
//             location
//         } = req.query;
//         // #FETCH LOCATOIN WISE USERS LITS
//         // const team_leads = await ggBaseQuery(`SELECT id,name FROM users WHERE status = 1  AND designation ='Asst Mgr / Team Leader' AND place_of_posting = '${location}' `);
//         const team_leads = await ggBaseQuery(`SELECT id,name FROM crm_users WHERE status = 1  AND role= 'team_lead'`);
//         res.json({
//             status: true,
//             data: team_leads
//         })
//     } catch (err) {
//         console.error("Error fetching filters:", err);
//         res.json({
//             status: false,
//             error: "Failed to fetch users",
//             detail: err.message,
//         });
//     }
// };
const getLocationByTeams = async (req, res) => {
    try {
        const {
            location
        } = req.query;
        // #FETCH LOCATOIN WISE USERS LITS
        const team_leads = await ggBaseQuery(`SELECT id,name FROM teams where status='active' AND  FIND_IN_SET(?, location) > 0`, [location]);
        res.json({
            status: true,
            data: team_leads
        })
    } catch (err) {
        console.error("Error fetching filters:", err);
        res.json({
            status: false,
            error: "Failed to fetch users",
            detail: err.message,
        });
    }
};
const getTeamByMember = async (req, res) => {
    try {
        const {
            location
        } = req.query;
        // #FETCH LOCATOIN WISE USERS LITS
        const team_members = await ggBaseQuery(`SELECT us.name,tm.user_id as id FROM team_members tm  LEFT JOIN  users us ON us.id = tm.user_id  WHERE tm.team_id = ?  ORDER BY us.name ASC`, [location]);
        res.json({
            status: true,
            data: team_members
        });
    } catch (err) {
        console.error("Error fetching filters:", err);
        res.json({
            status: false,
            error: "Failed to fetch users",
            detail: err.message,
        });
    }
};
export default {
    getTeamByMember,
    LeadTeamsPreviewModule,
    getTeamExecutives,
    getLocationByTeams,
    getUserListWithOptions,
    listTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    getExecutiveCcount,
    assignLeadsModule,
    LeadPreviewModule,
    getTeamLeadByUsers,
    getLocationByUsers,
    fetchLeadsData,
    leadsImport,
    getFormOptions,
    viewInstitution,
    getInstitutions,
    createInstitution,
    updateInstitution,
    deleteInstitution,
    updateSettings,
    webSettings,
    viewUser,
    statusUpdate,
    userRecords,
    quoteRecords,
    leadRecords,
    dashBoard,
    index,
    view,
    edit,
    deleteData,
    register,
    login
};