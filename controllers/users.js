import {
    ggBaseQuery,
    uploadBasePath,
    PublicBasePath,
    replaceBasePath,
    JWT_SECRET
}
from "./../db/connectdb";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import moment from 'moment';
const path = require('path');
const fs = require('fs').promises;
// const BASE_URL = `http://89.116.34.157:4444/cdn/`;

const BASE_URL = `https://misapi.ggindia.co.in/cdn/`;


const ggEmailTemplate = (name) => {
    // Normalize the name by removing spaces and converting to lowercase
    const normalized = name.replace(/\s+/g, '').toLowerCase();
    // Combine with the domain
    const email = `${normalized}@ggmis.com`;
    return email;
};
async function ensureDirectoryExists(directory) {
    try {
        await fs.access(directory);
    } catch (error) {
        await fs.mkdir(directory, {
            recursive: true
        });
    }
}
// DOCUMENT UPLOADER
const documentUpload = async (reqFiles) => {
    const {
        files,
        ref_id,
        module_type
    } = reqFiles;
    for (const key in files) {
        if (Object.hasOwnProperty.call(files, key)) {
            // Extract key name without index
            const originalKey = key.replace(/\[\d+\]/, '');
            const file = files[key];
            const ext = file.name.split('.').pop(); // Extract file extension
            const timestamp = Date.now(); // Generate timestamp
            // Create dynamically generated path
            const docPath = `${originalKey}/${timestamp}.${ext}`;
            const filePath = path.join(uploadBasePath, docPath);
            console.log(docPath, filePath);
            // const replacePath = replaceBasePath;
            // let filePath = path.join(replacePath, modulePath, fileName);
            // await ensureDirectoryExists(path.join(replacePath, uploadBasePath));
            // thisFile.mv(filePath);
            // filePath = filePath.replace(replacePath, "");
            // console.log(i + " ::=> " + filePath);
            await ensureDirectoryExists(path.dirname(filePath));
            // // Check if the directory exists, if not, create it
            // if (!fs.existsSync(path.dirname(filePath))) {
            //   fs.mkdirSync(path.dirname(filePath), { recursive: true });
            // }
            // Move the file to the dynamically generated path
            file.mv(filePath, async (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({
                        error: `Error uploading files => ${docPath}`
                    });
                } else {
                    const insertValues = [docPath, originalKey, module_type, ref_id, 1];
                    console.log(insertValues);
                    const insertQuery = 'INSERT INTO documents (document_path, document_type, type, ref_id, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
                    try {
                        // Execute the query
                        await ggBaseQuery(insertQuery, insertValues);
                        // Move the file to the destination (uncomment this line when you are ready)
                        // await thisFile.mv(filePath);
                        console.log(`File inserted successfully: ${filePath}`);
                    } catch (error) {
                        console.error(`Error inserting file: ${error.message}`);
                        // Handle the error accordingly
                    }
                }
            });
        }
    }
}
// COMMON FUNCTIONS
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
const docRemover = async (req, res) => {
    const {
        docId
    } = req.params;
    console.log(docId)
    try {
        // console.log(connectDB);
        const [existingDocs] = await ggBaseQuery('SELECT * FROM documents WHERE id = ?', [docId]);
        if (existingDocs) {
            const docPath = existingDocs.document_path;
            try {
                await fs.access(path.join(__dirname, uploadBasePath + docPath));
                await fs.unlink(path.join(__dirname, uploadBasePath + docPath));
            } catch (err) {
                console.error('Error removing existing image:', path.join(__dirname, uploadBasePath + docPath));
            }
            console.log(path.join(__dirname, uploadBasePath + docPath));
            const result = await ggBaseQuery(`DELETE FROM documents WHERE  id = ?`, [docId]);
        }
        res.send({
            status: true,
            message: "document deleted successfully."
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: false,
            error: 'Internal server error'
        });
    }
}
const distanceBetweenLocations = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Radius of the Earth in meters
    const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters
    return distance;
};
const isWithinRange = (userLocation, workLocation) => {
    if (!userLocation) return false;
    const distance = distanceBetweenLocations(userLocation.latitude, userLocation.longitude, workLocation.latitude, workLocation.longitude);
    // Define a threshold distance (in meters) within which the locations are considered a match
    const thresholdDistance = 1000; // Adjust as needed
    return distance <= thresholdDistance;
};
// Index method to fetch all users from the MySQL database
const index = async (req, res) => {
    try {
        // console.log(connectDB);
        const result = await ggBaseQuery(`SELECT us.id,
            (
        SELECT CONCAT('${BASE_URL}','',d.document_path) 
        FROM documents d
        WHERE d.ref_id = us.id AND  d.document_type = 'avatarImage'
        LIMIT 1
    ) AS avatar_url,
    (SELECT CONCAT(name, '-', initial) AS name FROM users WHERE id=us.team_lead) as team_lead_name,
    CONCAT(us.name, IFNULL(CONCAT(\'-\', initial), \'\')) AS fullname
    ,name,us.email_address,us.phone,us.dob,us.initial,us.mr_ms,us.father_name,us.mother_name,us.education,us.ug,us.pg,us.local_address,us.local_district,us.local_pincode,us.permanent_address,us.permanent_district,us.permanent_pincode,us.contact_number,us.father_contact,us.mother_contact,us.blood_group,us.date_of_joining,us.referred_by,us.interviewed_by,us.place_of_posting,us.vertical,us.designation,us.grade,us.salary_range,us.monthly_target,us.wallet,us.work_location,us.address_proof_type,us.id_proof_type,us.upi,us.payment,us.role,us.status,us.is_new,us.created_at,us.modified_at,
     team_lead,
    COUNT(me.id) AS mis_count  FROM users us LEFT JOIN 
    mis_entries me ON us.id = me.user_id  where role=\'agent\'  GROUP BY 
    us.id, us.name, us.email_address ORDER BY us.created_at DESC`);
        // AND is_deleted=false
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
// View method to fetch a single user by ID from the MySQL database
const view = async (req, res) => {
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
`, [userId]);
        const documents = await ggBaseQuery(`SELECT id,document_type,type,CONCAT('${PublicBasePath}', document_path)as document_path  FROM documents  WHERE type="user" and ref_id=?
    `, [userId]);
        if (!user) return res.status(404).json({
            status: false,
            message: 'No Data Found.'
        });
        delete user.password;
        user.avatar = user.avatar_url;
        user.kyc_document = user.kyc_documents_url;
        // extra options
        const thisOptionsQuery = `Select form_types,form_doc_types,form_kyc_types  from settings where id =1`;
        let optionsRows = await ggBaseQuery(thisOptionsQuery);
        // user.status = true;
        res.status(200).json({
            status: true,
            data: user,
            documents: documents,
            options: optionsRows[0]
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
            institute_type,
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
        const thisInsitution = {};
        if (institute_type == "unorganised") {
            const {
                unorganised_name,
                unorganised_type
            } = req.body;
            thisInsitution['name'] = unorganised_name;
            thisInsitution['type'] = unorganised_type;
        }
        if (institute_type == "organised") {
            const {
                organised_name
            } = req.body;
            thisInsitution['name'] = organised_name;
            thisInsitution['type'] = institute_type;
        }
        console.log(thisInsitution);
        // Insert a new user
        const regParams = [name, phone, whatsapp, institute_type, JSON.stringify(thisInsitution), hashedPassword, currentRole];
        console.log(regParams);
        await ggBaseQuery('INSERT INTO users (name, phone, whatsapp, institution,other_institution, password,role) VALUES (?, ?,?, ?, ?,?,?)', regParams);
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
            password,
            lat,
            long
        } = req.body;
        console.log(req.body);
        // Find the user by phone
        const [user] = await ggBaseQuery(`SELECT
    id,
    name,
    (
        SELECT CONCAT('${BASE_URL}','',d.document_path) 
        FROM documents d
        WHERE d.ref_id = us.id AND  d.document_type = 'avatarImage'
        LIMIT 1
    ) AS avatar_url,
    email_address,
    phone,
    password,
    work_location,
    role,
    is_deleted,
    is_new,
    vertical,
    grade,
    designation,
    monthly_target,
    place_of_posting,
    created_at

FROM
    users us where 
email_address =? 
`, [username]);
        console.log(user);
        // Compare the provided password with the hashed password stored in the database
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({
                status: false,
                message: 'Invalid Login credentials.'
            });
            return;
        }
        if (user.is_deleted) {
            res.status(401).json({
                status: false,
                message: 'Your login access is restricted.'
            });
            return;
        }
        // Location Check
        // if (user.work_location && user.work_location != "") {
        //     const isLocation = user.work_location.split(",");
        //     const workDblocation = {
        //         latitude: isLocation[0],
        //         longitude: isLocation[1]
        //     };
        //     const loginLocation = {
        //         latitude: lat,
        //         longitude: long
        //     };
        //     console.log(loginLocation, workDblocation);
        //     const isLocationValid = isWithinRange(loginLocation, workDblocation);
        //     console.log(isLocationValid);
        //     res.status(401).json({
        //         status: false,
        //         message: 'Invalid Location Access.'
        //     });
        //     return;
        // }
        // Create a JWT token
        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET ,{
            expiresIn: '1d'
        });

        const crm_token = jwt.sign({
            email : user.email_address
        }, JWT_SECRET ,{
            expiresIn: '5m'
        });

        delete user.password;
        console.log(user);
        // res.setHeader('Authorization', token);
        res.status(200).json({
            "success": true,
            "result": {
                "_id": user.id,
                "token": token,
                "crm_token":crm_token,
                "name": user.name,
                "monthly_target":user.monthly_target,
                "role": (user.designation === 'Asst Mgr / Team Leader' ? 'team_lead' : user.role),
                "vertical": user.vertical,
                "grade": user.grade,
                "plan": "free",
                "email": user.email_address,
                "pos_location":user.place_of_posting,
                "data": user
            },
            "message": "You have successfully logged in."
        });
        return;
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const edit = async (req, res) => {
    try {
        const {
            name,
            phone,
            whatsapp,
            institution,
            institute_type,
            email,
            password,
            dob,
            kyc_type,
            upi,
            doc_count
        } = req.body;
        // Handle file uploads
        const avatar = req.files && req.files.avatar ? req.files.avatar : null;
        if (avatar) {
            await handleFileUpload(avatar, uploadBasePath + 'users/avatar', 'avatar', req.params.id);
        }
        if (req.files) {
            await docUploader(req, req.files);
        }
        // Hash the password
        if (password && password !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            await ggBaseQuery('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);
            res.status(200).json({
                status: true,
                data: [],
                message: 'User updated successfully'
            });
            return;
        }
        const thisInsitution = {};
        if (institute_type == "unorganised") {
            const {
                unorganised_name,
                unorganised_type
            } = req.body;
            thisInsitution['name'] = unorganised_name;
            thisInsitution['type'] = unorganised_type;
        }
        if (institute_type == "organised") {
            const {
                organised_name
            } = req.body;
            thisInsitution['name'] = organised_name;
            thisInsitution['type'] = institute_type;
        }
        const ggReqParmas = [name, phone, whatsapp, institute_type, JSON.stringify(thisInsitution), email, dob, kyc_type, upi, req.params.id];
        console.log(ggReqParmas);
        if (doc_count && parseInt(doc_count) > 0) {
            // Update the user in the database
            const result = await ggBaseQuery('UPDATE users SET name = ?, phone = ?, whatsapp = ?, institution = ? ,other_institution = ?, email_address = ?, dob = ?, kyc_type = ?, upi = ? ,status=2 WHERE id = ?', ggReqParmas);
        } else {
            const result = await ggBaseQuery('UPDATE users SET name = ?, phone = ?, whatsapp = ?, institution = ? ,other_institution = ?, email_address = ?, dob = ?, kyc_type = ?, upi = ?  WHERE id = ?', ggReqParmas);
        }
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
const docUploader = async (req, files) => {
    const ggDocument = files;
    // console.log(ggDocument["document[0][file]"]);
    const reqBody = req.body;
    const {
        userId
    } = req.user;
    // console.log(reqBody);
    const documentTypes = [];
    // Iterate through the keys of reqBody
    for (const key in reqBody) {
        if (reqBody.hasOwnProperty(key)) {
            // Check if the key matches the pattern 'document[i][type]'
            const match = key.match(/^document\[(\d+)\]\[type\]$/);
            if (match) {
                const index = match[1];
                documentTypes[index] = reqBody[key];
            }
        }
    }
    // Iterate based on the provided doc_count
    const path = require('path');
    for (let i = 0; i < parseInt(reqBody.doc_count); i++) {
        const thisFile = ggDocument[`document[${i}][file]`];
        const thisType = documentTypes[i];
        const timestamp = new Date().getTime();
        const ext = path.extname(thisFile.name);
        const fileName = `${timestamp}${ext}`;
        const replacePath = replaceBasePath;
        let filePath = path.join(replacePath, "users/kyc", fileName);
        await ensureDirectoryExists(path.join(replacePath, uploadBasePath));
        thisFile.mv(filePath);
        filePath = filePath.replace(replacePath, "");
        console.log(i + " ::=> " + filePath);
        // Assuming `ggBaseQuery` is a function that executes the SQL query
        const insertQuery = 'INSERT INTO documents (document_path, document_type, type, ref_id, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
        const insertValues = [filePath, thisType, reqBody.module, userId, userId];
        console.log(insertValues)
        try {
            // Execute the query
            await ggBaseQuery(insertQuery, insertValues);
            // Move the file to the destination (uncomment this line when you are ready)
            // await thisFile.mv(filePath);
            console.log(`File inserted successfully: ${filePath}`);
        } catch (error) {
            console.error(`Error inserting file: ${error.message}`);
            // Handle the error accordingly
        }
    }
}
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
        // Retrieve user details from the database
        const user = await ggBaseQuery('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user || user.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }
        if (user[0].role !== 'admin') {
            // Update the user's 'deleted' field to true
            await ggBaseQuery('UPDATE users SET is_deleted = ?,status= ? WHERE id = ?', [true, false, userId]);
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
    console.log(req.user);
    try {
        const {
            userId
        } = req.user;
        const query = `
        SELECT

       
  COUNT(DISTINCT l.id) AS lead_count,
  COUNT(DISTINCT q.id) AS quote_count
FROM
  users u
  LEFT JOIN leads l ON l.user_id = u.id
  LEFT JOIN quotes q ON q.user_id = u.id
WHERE
  u.id = ?
GROUP BY
  u.id
ORDER BY 
  u.created_at DESC;
      `;
        const userWalletsQry = `SELECT
  

   COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) AS incentive_amount,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0) AS claim_amount,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0) AS commission_amount,
    (COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) 
    + COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0)) AS wallet_balance

FROM
  users u
LEFT JOIN 
    transactions t ON u.id = t.agent_id
WHere u.id =? `;
        const [rows] = await ggBaseQuery(query, [userId]);
        const [walletRows] = await ggBaseQuery(userWalletsQry, [userId]);
        if (rows.length === 0) {
            return res.json({
                status: false,
                results: {
                    lead_count: 0,
                    quote_count: 0,
                    incentive_amount: 0,
                    claim_amount: 0,
                    commission_amount: 0,
                    wallet_balance: 0
                },
                message: "No data found."
            });
        }
        res.send({
            status: true,
            results: { ...rows,
                ...walletRows
            }
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal Server Error."
        });
    }
};
const passUpdate = async (req, res) => {
    try {
        const {
            password
        } = req.body;
        const {
            userId
        } = req.user;
        console.log(req.body);
        if (!password && password != "") {
            res.status(401).json({
                status: false,
                message: 'Enter Valid Password'
            });
            return;
        }
        const tmpPassWord = password;
        // Hash the password
        const hashedPassword = await bcrypt.hash(tmpPassWord, 10);
        const reqParam = [hashedPassword, userId];
        console.log(reqParam);
        await ggBaseQuery('UPDATE users SET password = ?, is_new = 0 WHERE id = ?', reqParam);
        res.status(200).json({
            status: true,
            message: 'Password updated successfully.'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const forgotUser = async (req, res) => {
    try {
        const {
            username
        } = req.body;
        console.log(req.body);
        // Find the user by phone
        const [user] = await ggBaseQuery(`SELECT id,name,CASE
    WHEN avatar IS NOT NULL THEN CONCAT('${PublicBasePath}', avatar)
    ELSE avatar
  END AS avatar_url,phone,password,whatsapp,institution,role,is_deleted,created_at FROM users WHERE phone = ?`, [username]);
        if (!user) {
            res.status(401).json({
                status: false,
                message: 'Invalid Phone Number'
            });
            return;
        }
        if (user.is_deleted) {
            res.status(401).json({
                status: false,
                message: 'No User Found :('
            });
            return;
        }
        const tmpPassWord = await ggOnePassword();
        // Hash the password
        const hashedPassword = await bcrypt.hash(tmpPassWord, 10);
        const reqParam = [hashedPassword, user.id];
        console.log(reqParam);
        await ggBaseQuery('UPDATE users SET password = ? WHERE id = ?', reqParam);
        res.status(200).json({
            status: true,
            otp: tmpPassWord,
            message: 'Password reset successfully.'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const verifyStatus = async (req, res) => {
    try {
        const {
            userId
        } = req.user;
        // Find the user by phone
        const [user] = await ggBaseQuery(`SELECT status FROM users WHERE id = ?`, [userId]);
        res.status(200).json({
            status: true,
            user_status: user.status,
            message: 'User status fetched successfully.'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const employeeLogin = async (req, res) => {
    try {
        const {
            username,
            password,
            lat,
            long
        } = req.body;
        console.log(req.body);
        // Find the user by phone
        const [user] = await ggBaseQuery(`SELECT
    id,name,email,initial,mr_ms,dob,father_name,mother_name,education,ug,pg,local_address,local_district,local_pincode,permanent_address,permanent_district,permanent_pincode,contact_number,father_contact,mother_contact,blood_group,date_of_joining,referred_by,interviewed_by,place_of_posting,vertical,designation,grade,salary_range,monthly_target,created_at,password,designation

FROM
    mis_users  where 
email =? 
`, [username]);
        console.log(user);
        // Compare the provided password with the hashed password stored in the database
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({
                status: false,
                message: 'Invalid Login credentials.'
            });
            return;
        }
        // Location Check
        // if (user.work_location && user.work_location != "") {
        //     const isLocation = user.work_location.split(",");
        //     const workDblocation = {
        //         latitude: isLocation[0],
        //         longitude: isLocation[1]
        //     };
        //     const loginLocation = {
        //         latitude: lat,
        //         longitude: long
        //     };
        //     console.log(loginLocation, workDblocation);
        //     const isLocationValid = isWithinRange(loginLocation, workDblocation);
        //     console.log(isLocationValid);
        //     res.status(401).json({
        //         status: false,
        //         message: 'Invalid Location Access.'
        //     });
        //     return;
        // }
        // Create a JWT token
        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET, {
            expiresIn: '1d'
        });
        delete user.password;
        res.setHeader('Authorization', token);
        res.status(200).json({
            "success": true,
            "result": {
                "_id": user.id,
                "role": (user.designation === 'Asst Mgr / Team Leader' ? 'team_lead' : user.role),
                "token": token,
                "name": user.name,
                "monthly_target":user.monthly_target,
                "plan": "free",
                "grade": user.grade,
                "pos_location":user.place_of_posting,
                "email": user.email
            },
            "message": "Successfully login user"
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const getUniqueUserList = async (req, res) => {
    try {
        const {
            search,
            type
        } = req.query;
        // const user = await ggBaseQuery(`SELECT  CONCAT(name, '-', email_address) AS name,email_address FROM users where role='agent' AND  email_address LIKE ? GROUP BY email_address, name ` , [`%${search}%`]);
        // Find the user by phone
        const user = await ggBaseQuery((type === "tl" ? `SELECT  id,CONCAT(name, '-', email_address) AS name FROM users WHERE designation='Asst Mgr / Team Leader' GROUP BY email_address, name,id` : `SELECT  id,CONCAT(name, '-', email_address) AS name FROM users GROUP BY email_address, name,id`));
        // if(type==="tl"){
        // } else {
        //     const user = await ggBaseQuery(`SELECT  CONCAT(name, '-', email_address) AS name FROM users GROUP BY email_address, name`);
        // }
        const data = user.map(item => ({
            label: item.name, // Keep the original name
            value: (type === "tl" ? item.id : item.name),
            id: item.id, // Set the same name as value
        }))
        res.status(200).json({
            status: true,
            data: data,
            message: 'User List fetched successfully.'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const createUser = async (req, res) => {
    try {
        // Extract the request body
        // console.log( req.body);
        // console.log( req.files);
        let requestBody = req.body;
        // delete requestBody.idProofType;
        // delete requestBody.addressProofType;
        console.log(requestBody);
        requestBody.email_address = ggEmailTemplate(`${requestBody.name} ${requestBody.initial}`);
        requestBody.password = await bcrypt.hash('user@123456', 10);
        requestBody.work_location = requestBody.place_of_posting;
        requestBody.status = 1;
        // // Get keys and values from the request body
        // const columns = Object.keys(requestBody);
        // const values = Object.values(requestBody);
        const toSnakeCase = (str) => str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
        // Extract columns and values
        const columns = Object.keys(requestBody).map(toSnakeCase);
        const values = Object.values(requestBody);
        // Create placeholders
        const placeholders = columns.map(() => '?').join(', ');
        // Construct the query
        const query = `
    INSERT INTO users (${columns.join(', ')})
    VALUES (${placeholders})
`;
        console.log(query);
        console.log("*************************");
        console.log(values);
        // Execute the query
        const result = await ggBaseQuery(query, values);
        if (req.files && Object.keys(req.files).length) {
            req.ref_id = result.insertId;
            req.module_type = "user";
            await documentUpload(req);
        }
        console.log(result);
        res.status(200).json({
            data: result,
            status: true,
            message: 'User Created successfully.'
        });
    } catch (error) {
        console.error('Error inserting user:', error.message);
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
};
const updateUser = async (req, res) => {
    try {
        // Extract the request body
        let requestBody = req.body;
        const userId = req.params.id;
        requestBody.team_lead = (requestBody.team_lead || null);
        // Assuming the user ID is passed as a URL parameter
        // Remove any fields that shouldn't be updated or are not needed
        // delete requestBody.id_proof_type;
        // delete requestBody.address_proof_type;
        requestBody.dob = requestBody.dob ? moment(requestBody.dob).format('DD-MM-YYYY') : null;
        requestBody.date_of_joining = requestBody.date_of_joining ? moment(requestBody.date_of_joining).format('DD-MM-YYYY') : null;
        // Convert camelCase to snake_case for database columns
        const toSnakeCase = (str) => str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
        const columns = Object.keys(requestBody).map(toSnakeCase);
        const values = Object.values(requestBody);
        // Create SQL SET clause dynamically
        const setClause = columns.map((column, index) => `${column} = ?`).join(', ');
        // Add the user ID to the values array for the WHERE clause
        values.push(userId);
        // Construct the query
        const query = `
            UPDATE users
            SET ${setClause}
            WHERE id = ?
        `;
        // Execute the query
        const result = await ggBaseQuery(query, values);
        console.log(result);
        // If you want to handle file uploads
        if (req.files && Object.keys(req.files).length) {
            req.ref_id = userId;
            req.module_type = "user";
            await documentUpload(req);
        }
        res.status(200).json({
            data: result,
            status: true,
            message: 'User updated successfully.'
        });
    } catch (error) {
        console.error('Error updating user:', error.message);
        res.status(200).json({
            status: false,
            message: error.message
        });
    }
};
const userActions = async (req, res) => {
    try {
        const userId = req.params.id;
        const action = req.params.action;
       
        let reqQuery = [];
        if (action === "block") {
            reqQuery = [true, false, userId];
        }
        if (action === "unblock") {
            reqQuery = [false, true, userId];
        }

        if (!reqQuery.length) {
            res.status(200).json({
                status: false,
                message: 'Invalid Request'
            });
            return;
        }


        const user = await ggBaseQuery('UPDATE users SET is_deleted = ?, status= ? WHERE id = ?', reqQuery);
        res.status(200).json({
            data: [],
            status: true,
            message: `User ${action}ed Successfully.`
        });
    } catch (error) {
        console.log('Login error:', error);
        res.status(200).json({
            status: false,
            message: error
        });
    }
};
const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(userId);
        const user = await ggBaseQuery('UPDATE users SET is_deleted = ?, status= ? WHERE id = ?', [true, false, userId]);
        res.status(200).json({
            data: [],
            status: true,
            message: 'User Deleted Successfully.'
        });
    } catch (error) {
        console.log('Login error:', error);
        res.status(200).json({
            status: false,
            message: error
        });
    }
};

const getLiveContacts = async (req, res) => {
    try {
        console.log(req.query);
        const {
            filter
        } = req.query;
        const thisCondition = true;
        //             // Find the user by phone
        // const user = await ggBaseQuery(`SELECT  CONCAT(name, '-', email_address) AS name,email_address FROM users where role='agent' AND  email_address LIKE ? GROUP BY email_address, name ` , [`%${search}%`]);
        // Find the user by phone
        const user = await ggBaseQuery(`SELECT  id,name,email,phone,reg_no,report_created_at,report_ids,status,company,extra_info,created_at FROM contacts WHERE status = ? ORDER BY name ASC  `, [thisCondition]);
        res.status(200).json({
            status: true,
            data: user,
            message: 'User List fetched successfully.'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};

const getLiveUsers = async (req, res) => {
    try {
        console.log(req.query);
        const {
            filter
        } = req.query;
        const thisCondition = (filter === "active" ? false : (filter === "blocked" ? true : false));
        //             // Find the user by phone
        // const user = await ggBaseQuery(`SELECT  CONCAT(name, '-', email_address) AS name,email_address FROM users where role='agent' AND  email_address LIKE ? GROUP BY email_address, name ` , [`%${search}%`]);
        // Find the user by phone
        const user = await ggBaseQuery(`SELECT  CONCAT(name, IFNULL(CONCAT(' ', initial), '')) AS name,email_address,status,is_deleted  FROM users WHERE role='agent'AND is_deleted = ? `, [thisCondition]);
        res.status(200).json({
            status: true,
            data: user,
            message: 'User List fetched successfully.'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};
const getDocs = async (req, res) => {
    const {
        id
    } = req.params;
    try {
        // console.log(connectDB);
        const existingDocs = await ggBaseQuery('SELECT document_path,document_type FROM documents WHERE ref_id = ?', [id]);
        res.send({
            status: true,
            data: existingDocs,
            message: "document fetched successfully."
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: false,
            error: 'Internal server error'
        });
    }
};
const TopRankedUser = async ({
    vertical,
    limit,
    userId
}) => {
    const topUsers = await ggBaseQuery(`SELECT 
    us.id,
    CONCAT(us.name, IFNULL(CONCAT(\' \', initial), \'\')) AS name,
    us.vertical,
        DENSE_RANK() OVER (ORDER BY COUNT(me.id) DESC) AS rank_position,

    COUNT(me.id) AS mis_count,

     (
        SELECT CONCAT('${BASE_URL}','',d.document_path) 
        FROM documents d
        WHERE d.ref_id = us.id AND  d.document_type = 'avatarImage'
        LIMIT 1
    ) AS avatar_url
FROM 
    users us  LEFT JOIN 
    mis_entries me ON us.id = me.user_id

    ${( (vertical==="admin" ? `` : vertical ? `WHERE us.status=1 AND us.vertical='${vertical}' ${(limit===1 ? `AND us.status=1 AND us.id='${userId}'` : `` )}`    : `` ) )}

GROUP BY 
    us.id, us.name, us.email_address ORDER BY mis_count DESC LIMIT ${limit} `);
    return topUsers;
}
const getTopUser = async (req, res) => {
    const limit = (req.query.limit ? req.query.limit : 3);
    const {
        userId
    } = req.user;
    const {
        vertical
    } = req.query;
    try {
        // console.log(connectDB);
        const topUsers = await TopRankedUser({
            vertical,
            limit
        });
        const CurrentRAnk = await TopRankedUser({
            vertical,
            limit: 1,
            userId
        });
        res.send({
            status: true,
            data: topUsers,
            current: CurrentRAnk,
            message: "Top users fetched successfully."
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({
            status: false,
            error: 'Internal server error'
        });
    }
};
export default {
    verifyStatus,
    docRemover,
    passUpdate,
    forgotUser,
    dashBoard,
    index,
    view,
    edit,
    deleteData,
    register,
    login,
    employeeLogin,
    createUser,
    updateUser,
    deleteUser,
    getLiveUsers,
    getTopUser,
    getDocs,
    getUniqueUserList,
    userActions,
    getLiveContacts
};