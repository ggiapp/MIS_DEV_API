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
        // yyyy-mm-dd (safe ISO)
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return new Date(value);
        }
        // dd-MMM-yyyy (e.g., 23-Aug-2021)
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
const getFormOptions = async (req, res) => {
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
        res.json({
            status: true,
            data: rows,
            form_data: formOptions
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const leadsImport = async (req, res) => {
    const reqBody = req.body;
    console.log(reqBody);
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
    // map Excel headers to DB field names
    const headerMap = {
        "state": "state",
        "prev_policy_type": "prev_policy_type",
        "product": "product",
        "vehicle_type": "vehicle_type",
        "company": "sub_product", // ✅ map COMPANY -> sub_product
        "tc": null, // ✅ TC not needed, skip
        "reg_no": "reg_no",
        "prev_policy_end_date": "prev_policy_end_date",
        "prev_insurer": "prev_insurer",
        "prev_pol_no": "prev_pol_no",
        "prev_pol_premium": "prev_pol_premium",
        "rto": "rto",
        "reg_date": "reg_date",
        "name": "name",
        "mobile": "mobile",
        "vehicle_make": "vehicle_make",
        "vehicle_model_variant": "vehicle_model_variant",
        "sale_amount": "sale_amount",
        "engine_no": "engine_no",
        "chasis_no": "chasis_no",
        "address": "address",
        "tc": "tc",
        "fuel": "fuel",
    };
    const excelHeaders = rawData[0].map(h => String(h || "").toLowerCase().replace(/\s+/g, "_").replace(/\./g, ""));
    const rows = rawData.slice(1);
    const values = [];
    const inValidCount = 0;
    const validCount = 0;
    for (const row of rows) {
        if (!row || row.every(c => c === undefined || c === null || String(c).trim() === "")) continue;
        const rowData = {};
        excelHeaders.forEach((header, idx) => {
            rowData[header] = row[idx] === undefined ? null : row[idx];
        });
        if (rowData["name"] != "" && rowData["reg_no"] != "" && rowData["mobile"] != "" && rowData["state"] != "" && rowData["prev_policy_end_date"] != "") {
            values.push([
                rowData["state"] || null,
                rowData["prev_policy_type"] || null,
                rowData["product"] || null,
                rowData["company"] || null, // mapped as sub_product
                rowData["vehicle_type"] || null,
                rowData["reg_no"] || null,
                rowData["prev_insurer"] || null,
                rowData["prev_policy_start_date"] ? parseExcelDate(rowData["prev_policy_start_date"]) : null,
                rowData["prev_policy_end_date"] ? parseExcelDate(rowData["prev_policy_end_date"]) : null,
                rowData["prev_pol_no"] || null,
                rowData["prev_pol_premium"] || null,
                rowData["rto"] || null,
                rowData["reg_date"] ? parseExcelDate(rowData["reg_date"]) : null,
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
                reqBody.lead_type,
                0 // status default
            ]);
            validCount++;
        } else {
            inValidCount++;
        }
    }
    if (values.length === 0) {
        return res.json({
            message: "No valid rows to import",
            count: 0
        });
    }
    const columns = ["state", "prev_policy_type", "product", "sub_product", "vehicle_type", "reg_no", "prev_insurer", "prev_policy_start_date", "prev_policy_end_date", "prev_pol_no", "prev_pol_premium", "rto", "reg_date", "name", "mobile", "vehicle_make", "vehicle_model_variant", "sale_amount", "engine_no", "chasis_no", "address", "tc", "fuel", "is_lead_type", "status"];
    const BATCH_SIZE = 500;
    try {
        for (let i = 0; i < values.length; i += BATCH_SIZE) {
            const batch = values.slice(i, i + BATCH_SIZE);
            const placeholdersPerRow = "(" + new Array(columns.length).fill("?").join(",") + ")";
            const allPlaceholders = new Array(batch.length).fill(placeholdersPerRow).join(",");
            const flatParams = [];
            for (const r of batch) flatParams.push(...r);
            const sql = `INSERT INTO temp_leads_management (${columns.join(",")}) VALUES ${allPlaceholders}`;
            await ggBaseQuery(sql, flatParams);
        }
        return res.json({
            message: "File uploaded and processed successfully",
            count: values.length,
            valid_count: validCount,
            invalid_count: inValidCount
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            error: "Failed to process file",
            detail: error.message
        });
    }
};
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
        const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
        // 1. Distinct values
        const [leadDistinctValues] = await ggBaseQuery(`
      SELECT 
        GROUP_CONCAT(DISTINCT state) AS states,
        GROUP_CONCAT(DISTINCT prev_policy_type) AS prev_policy_types,
        GROUP_CONCAT(DISTINCT product) AS products,
        GROUP_CONCAT(DISTINCT sub_product) AS sub_products,
        GROUP_CONCAT(DISTINCT vehicle_type) AS vehicle_types
      FROM temp_leads_management
     
    `);
        // 2. Lead Type Counts (Fresh vs Renewal)
        const leadTypeCounts = await ggBaseQuery(`
      SELECT status, COUNT(*) as total
      FROM temp_leads_management
      ${whereClause}
      GROUP BY status
    `);
        const is_lead_type = {};
        (leadTypeCounts || []).forEach((r) => {
            const key = r.status === 0 ? "Fresh" : "Renewal";
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
      SELECT status, COUNT(*) as total
      FROM temp_leads_management
      WHERE status IN (0,1)
      ${conditions.length ? `AND ${conditions.join(" AND ")}` : ""}
      GROUP BY status
    `);
        const assigned_status = {
            Unassigned: 0,
            Assigned: 0
        };
        (assignedCounts || []).forEach((r) => {
            if (r.status === 0) assigned_status.Unassigned = r.total;
            if (r.status === 1) assigned_status.Assigned = r.total;
        });
        // Work locations
        const work_locations = await ggBaseQuery(`
      SELECT DISTINCT label 
      FROM form_options 
      WHERE category = 'place_of_posting'
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
            sub_product: leadDistinctValues.sub_products.split(",") || [],
            vehicle_type: leadDistinctValues.vehicle_types.split(",") || [],
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
        const team_leads = await ggBaseQuery(`SELECT id,name FROM users WHERE status = 1  AND designation ='Asst Mgr / Team Leader' AND place_of_posting = '${location}' `);
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
const LeadAssigmentModule = async (req, res) => {
    try {
        const {
            filters,
            year_filters
        } = req.body;
        if (!filters || !year_filters) {
            return res.status(400).json({
                error: "Missing filters or year_filters"
            });
        }
        // 1️⃣ Base WHERE clauses (exclude "years")
        const baseClauses = [];
        if (filters.prev_policy_type.length) {
            baseClauses.push(`prev_policy_type IN (${filters.prev_policy_type
          .map((v) => `'${v.replace("'", "''")}'`)
          .join(",")})`);
        }
        if (filters.states.length) {
            baseClauses.push(`state IN (${filters.states
          .map((v) => `'${v.replace("'", "''")}'`)
          .join(",")})`);
        }
        if (filters.rf !== undefined && filters.rf !== null && filters.rf !== "") {
            baseClauses.push(`is_lead_type = ${typeof filters.rf === "number" ? filters.rf : `'${filters.rf}'`}`);
        }
        const baseWhere = baseClauses.length ? baseClauses.join(" AND ") : "1=1";
        const finalRows = [];
        // 2️⃣ Iterate over each year from year_filters
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
            const selectSql = `
        SELECT id,reg_no,name,mobile,is_lead_type,prev_policy_end_date
        FROM temp_leads_management
        ${whereForYear}
        ORDER BY prev_policy_end_date
        LIMIT ${take};
      `;
            const rows = await ggBaseQuery(selectSql);
            finalRows.push(...(rows || []));
        }
        // 6️⃣ Return
        return res.json({
            total: finalRows.length,
            leads: finalRows,
        });
    } catch (err) {
        console.error("fetchFilteredLeadsAndSample error:", err);
        return res.status(500).json({
            error: "Server error",
            detail: err.message
        });
    }
};
export default {
    LeadAssigmentModule,
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