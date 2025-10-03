import {
    ggBaseQuery,
    uploadBasePath,
    replaceBasePath,
    PublicBasePath
} from "./../db/connectdb";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
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
// Helper function to remove existing files
const removeExistingFiles = async (userId, columnName, uploadPath) => {
    const existingFilePath = await ggBaseQuery(`SELECT ${columnName} FROM leads WHERE user_id = ?`, [userId]);
    if (existingFilePath && existingFilePath[0] && existingFilePath[0][columnName]) {
        const fullPath = path.join(__dirname, existingFilePath[0][columnName]);
        await fs.unlink(fullPath);
        if (fs.existsSync(fullPath)) {
            await fs.unlink(fullPath);
        }
    }
};
// const documentEntry = async (docRecord) => {
//     try {
//         const insertQuery = 'INSERT INTO documents (document_path, document_type, type, ref_id, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
//         await ggBaseQuery(insertQuery, docRecord);
//     } catch (err) {
//         console.log(err);
//     }
// }
const remarksEntry = async (remarkRecord) => {
    try {
        const insertQuery = 'INSERT INTO remarks (message, type, ref_id,user_type, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
        await ggBaseQuery(insertQuery, remarkRecord);
    } catch (err) {
        console.log(err);
    }
}
const getSiteSettings = async (columnName) => {
    const thisOptionsQuery = `Select ${columnName}  from settings where id =1`;
    let [optionsRows] = await ggBaseQuery(thisOptionsQuery);
    return optionsRows;
}
// Function to handle file uploads
const docUploader = async (req, files, modulePath) => {
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
    for (let i = 0; i < parseInt(reqBody.doc_count); i++) {
        const thisFile = ggDocument[`document[${i}][file]`];
        const thisType = documentTypes[i];
        const timestamp = new Date().getTime();
        const ext = path.extname(thisFile.name);
        const fileName = `${timestamp}${ext}`;
        const replacePath = replaceBasePath;
        let filePath = path.join(replacePath, modulePath, fileName);
        await ensureDirectoryExists(path.join(replacePath, uploadBasePath));
        thisFile.mv(filePath);
        filePath = filePath.replace(replacePath, "");
        console.log(i + " ::=> " + filePath);
        // Assuming `ggBaseQuery` is a function that executes the SQL query
        const insertQuery = 'INSERT INTO documents (document_path, document_type, type, ref_id, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
        const insertValues = [filePath, thisType, req.module, req.ref_id, userId];
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
const index = async (req, res) => {
    console.log(req.user);
    try {
        const {
            userId
        } = req.user;
        const query = `
       SELECT
       u.name,
       u.id as user_id,
    l.*,
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
WHERE
    u.id = ? AND l.is_deleted = 0
ORDER BY created_at DESC
      `;
        // extra options
        const thisOptionsQuery = `Select form_types,form_doc_types,form_kyc_types  from settings where id =1`;
        let optionsRows = await ggBaseQuery(thisOptionsQuery);
        const rows = await ggBaseQuery(query, [userId]);
        if (rows.length === 0) {
            return res.json({
                status: true,
                results: [],
                options: optionsRows[0],
                message: "No data found."
            });
        }
        res.send({
            status: true,
            results: rows,
            options: optionsRows[0],
            total_recodes: rows.length
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal Server Error."
        });
    }
};
const add = async (req, res) => {
    console.log("CREATE LEAD");
    try {
        const {
            type,
            vehiclenumber,
            regname,
            contactno,
            expirydate,
            document_type,
            user_id,
            remarks
        } = req.body;
        const alreadyExists = await ggBaseQuery("select COUNT(id) as is_count from leads where vehiclenumber = ? ", [vehiclenumber]);
        const {
            is_count
        } = alreadyExists[0];


        if (is_count) {
            res.status(200).send({
                status: false,
                message: 'Vehicle Number Already exists.'
            });
        } else {
            // IF NOT CHECK 
            console.log(req.body);
            // console.log(req.files);
            // if (req.files) {
            //     return res.status(400).send({status:false,message:"devprocess"});
            // }
            // if (!req.files || Object.keys(req.files).length === 0) {
            //     return res.status(400).send('No files were uploaded.');
            // }
            const requestParams = [
                type,
                vehiclenumber,
                regname,
                contactno,
                expirydate,
                user_id
            ];
            console.log(requestParams);
            // Save file paths to the database
            const result = await ggBaseQuery(`
      INSERT INTO leads 
      (type, vehiclenumber, regname, contactno, expirydate, user_id) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, requestParams);
            console.log(result);
            if (remarks && remarks != "") {
                await remarksEntry([remarks, "lead", result.insertId, "agent", user_id]);
            }
            req.ref_id = result.insertId;
            req.module = "lead";
            if (req.files) {
                await docUploader(req, req.files, 'leads/documents');
            }
            // WALLET CLIAMS
            const {
                auto_credit,
                credit_amount
            } = await getSiteSettings('auto_credit,credit_amount');
            if (auto_credit == 1) {
                // console.log(auto_credit,credit_amount);
                const {
                    lead
                } = JSON.parse(credit_amount);
                const walletRemarks = `Vehicle No. ${vehiclenumber} has been credited with lead incentive ${lead}. `;
                const ReqParams = [user_id, 1, "INCENTIVE", lead, walletRemarks, "1"];
                console.log(ReqParams);
                const walletResult = await ggBaseQuery('INSERT INTO transactions (agent_id, issued_by, transaction_type, amount, remarks,status) VALUES (?, ?, ?, ?, ?,? )', ReqParams);
            }
            // WALLET CLIAMS
            res.status(200).send({
                status: true,
                message: 'Lead created successfully'
            });
        }
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).send({
            status: true,
            message: 'Something Went Wrong :('
        });
    }
};
const update = async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).send({
                status: false,
                message: 'Invalid parameter found.'
            });
        }
        const {
            type,
            vehiclenumber,
            regname,
            contactno,
            expirydate,
            user_id
        } = req.body;
        // Retrieve existing lead information
        const existingLead = await ggBaseQuery(`
      SELECT * FROM leads WHERE id = ?
    `, [req.params.id]);
        if (!existingLead || existingLead.length === 0) {
            return res.status(404).send({
                status: false,
                message: 'Lead not found.'
            });
        }
        req.ref_id = req.params.id;
        req.module = "lead";
        if (req.files) {
            await docUploader(req, req.files, 'leads/documents');
        }
        // Update lead information in the database
        const updateParams = [
            type,
            vehiclenumber,
            regname,
            contactno,
            expirydate,
            req.params.id
        ];
        console.log(updateParams);
        const updateResult = await ggBaseQuery(`
      UPDATE leads 
      SET 
        type=?, 
        vehiclenumber=?, 
        regname=?, 
        contactno=?, 
        expirydate=?,
        status=0
      WHERE id=?
    `, updateParams);
        res.status(200).send({
            status: true,
            message: 'Lead updated successfully'
        });
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).send({
            status: false,
            message: 'Internal Server Error'
        });
    }
};
const view = async (req, res) => {
    try {
        const leadId = req.params.id;
        // Retrieve lead information from the database
        const leadResult = await ggBaseQuery(`SELECT
  l.*,
  
  MAX(r.message) AS remark,  
  MAX(r.user_type) AS remark_user,
  MAX(r.created_at) AS remark_timestamp
FROM
  leads l

LEFT JOIN (
  SELECT ref_id, message, user_type, created_at
  FROM remarks r1
  WHERE created_at = (
    SELECT MAX(created_at)
    FROM remarks r2
    WHERE r2.type='lead' and r2.ref_id = r1.ref_id
  )
) r ON l.id = r.ref_id
WHERE
  l.id = ?
GROUP BY
  l.id;`, [leadId]);
        if (!leadResult || leadResult.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Lead not found.'
            });
        }

        const documents = await ggBaseQuery(`SELECT id,document_type,type,CONCAT('${PublicBasePath}', document_path)as document_path  FROM documents  WHERE type="lead" and ref_id=?
    `, [leadId]);

        // Extract relevant lead details
        let leadDetails = {
            id: leadResult[0].id,
            type: leadResult[0].type,
            vehiclenumber: leadResult[0].vehiclenumber,
            regname: leadResult[0].regname,
            contactno: leadResult[0].contactno,
            expirydate: leadResult[0].expirydate,
            document_type: leadResult[0].document_type,
            documentimg: leadResult[0].documentimg,
            vehiclephoto: leadResult[0].vehiclephoto,
            user_id: leadResult[0].user_id,
            // Add other fields as needed
        };
        // let leadDetailsObj  = leadResult[0];
        // leadDetailsObj.documentimg = (leadDetails.documentimg ? path.join(PublicBasePath, leadDetails.documentimg) : "");
        // leadDetailsObj.vehiclephoto = (leadDetails.vehiclephoto ? path.join(PublicBasePath, leadDetails.vehiclephoto) : "");
        const thisData = leadResult[0];
        thisData.public_path = PublicBasePath;
        thisData.documents = documents;

        res.status(200).json({
            status: true,
            data: thisData
        });
    } catch (error) {
        console.error('Error fetching lead:', error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
};
const deleteItem = async (req, res) => {
    try {
        const leadId = req.params.id;
        // Check if the lead exists
        const existingLead = await ggBaseQuery('SELECT * FROM leads WHERE id = ?', [leadId]);
        if (!existingLead || existingLead.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Lead not found.'
            });
        }
        // Get file paths from the existing lead
        const imagePath = existingLead[0].documentimg;
        const docPath = existingLead[0].vehiclephoto;
        // Delete the lead from the database
        await ggBaseQuery('DELETE FROM leads WHERE id = ?', [leadId]);
        try {
            await fs.access(path.join(__dirname, uploadBasePath + imagePath));
            await fs.unlink(path.join(__dirname, uploadBasePath + imagePath));
        } catch (err) {
            console.error('Error removing existing image:', path.join(__dirname, uploadBasePath + imagePath));
        }
        try {
            await fs.access(path.join(__dirname, uploadBasePath + docPath));
            await fs.unlink(path.join(__dirname, uploadBasePath + docPath));
        } catch (err) {
            console.error('Error removing existing document:', docPath);
        }
        res.status(200).json({
            status: true,
            message: 'Lead and associated files deleted successfully.'
        });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
};
export default {
    index,
    add,
    update,
    view,
    deleteItem
}