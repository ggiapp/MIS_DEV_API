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
    const existingFilePath = await ggBaseQuery(`SELECT ${columnName} FROM quotes WHERE user_id = ?`, [userId]);
    if (existingFilePath && existingFilePath[0] && existingFilePath[0][columnName]) {
        const fullPath = path.join(__dirname, existingFilePath[0][columnName]);
        await fs.unlink(fullPath);
        if (fs.existsSync(fullPath)) {
            await fs.unlink(fullPath);
        }
    }
};

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
        console.log(i + modulePath+" ::=> " + filePath);
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
    try {
        const {
            userId
        } = req.user;
        const quotes = await ggBaseQuery(`
            SELECT q.*,CASE
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
        WHERE
          u.id = ? and q.is_deleted =0
        ORDER BY created_at DESC
        `, [userId]);
        // extra options
        const thisOptionsQuery = `Select form_types,form_doc_types,form_kyc_types  from settings where id =1`;
        let optionsRows = await ggBaseQuery(thisOptionsQuery);
        res.status(200).send({
            status: true,
            results: quotes,
            total_recodes: quotes.length,
            options: optionsRows[0]
        });
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const documentEntry = async (docRecord) => {
    try {
        const insertQuery = 'INSERT INTO documents (document_path, document_type, type, ref_id, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
        await ggBaseQuery(insertQuery, docRecord);
    } catch (err) {
        console.log(err);
    }
}
const remarksEntry = async (remarkRecord) => {
    try {
        const insertQuery = 'INSERT INTO remarks (message, type, ref_id,user_type, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
        await ggBaseQuery(insertQuery, remarkRecord);
    } catch (err) {
        console.log(err);
    }
}
const add = async (req, res) => {
    try {
        const {
            doc_type,
            expiry_status,
            vehicle_number,
            vehicle_type,
            quote_type,
            user_id,
            remarks
        } = req.body;
        const {
            userId
        } = req.user;

        const [vehicle_check] = await ggBaseQuery(`SELECT status from  leads where vehiclenumber = ? `, [vehicle_number]);

        // const [agent_check] = await ggBaseQuery(`SELECT user_id from  quotes where vehicle_number = ? and user_id=? `, [vehicle_number, userId]);
        // if (agent_check) {
        //     res.status(200).json({
        //         status: false,
        //         message: 'Same Agent already quote issued.'
        //     });
        //     return;
        // }

        if (vehicle_check && vehicle_check.status === 3) {
            res.status(200).json({
                status: false,
                message: 'Lead is Rejected, so unable to create a quote.'
            });
            return;
        }

       
        // Save data to the database
        const result = await ggBaseQuery(`
            INSERT INTO quotes
            (doc_type,expiry_status,quote_type, vehicle_number, vehicle_type, user_id, created_at, modified_at)
            VALUES (?, ?, ?,?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        `, [doc_type, expiry_status, quote_type, vehicle_number, vehicle_type, user_id]);
        if (remarks && remarks != "") {
            await remarksEntry([remarks, "quote", result.insertId, "agent", user_id]);
        }

            req.ref_id = result.insertId;
            req.module = "quote";
            if (req.files) {
                await docUploader(req, req.files, 'quotes/documents');
            }

            // WALLET CLIAMS
            const {
                auto_credit,
                credit_amount
            } = await getSiteSettings('auto_credit,credit_amount');
            if (auto_credit == 1) {
                // console.log(auto_credit,credit_amount);
                const {
                    quote
                } = JSON.parse(credit_amount);
                const walletRemarks = `Vehicle No. ${vehicle_number} has been credited with quote incentive ${quote}. `;
                const ReqParams = [user_id, 1, "INCENTIVE", quote, walletRemarks, "1"];
                console.log(ReqParams);
                const walletResult = await ggBaseQuery('INSERT INTO transactions (agent_id, issued_by, transaction_type, amount, remarks,status) VALUES (?, ?, ?, ?, ?,? )', ReqParams);
            }
            // WALLET CLIAMS

        
        res.status(200).json({
            status: true,
            message: 'Quote created Sucesssfully.'
        });
    } catch (error) {
        console.error('Error creating quote:', error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const update = async (req, res) => {
    try {
        const {
            doc_type,
            expiry_status,
            vehicle_number,
            vehicle_type,
            quote_type,
            user_id,
            status,
            remarks
        } = req.body;

        // Retrieve existing lead information
        const existingQuote = await ggBaseQuery(`
      SELECT * FROM quotes WHERE id = ?
    `, [req.params.id]);
        if (!existingQuote || existingQuote.length === 0) {
            return res.status(404).send('Lead not found.');
        }
       

        // Save data to the database
        const result = await ggBaseQuery(`
            UPDATE quotes
            SET
                doc_type = ?,
                expiry_status = ?,
                quote_type = ?,
                vehicle_number = ?,
                vehicle_type = ?,
                user_id = ?,
                status =0,
                modified_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [doc_type, expiry_status, quote_type, vehicle_number, vehicle_type, user_id, req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: false,
                error: 'Quote not found'
            });
        }

        req.ref_id = req.params.id;
        req.module = "quote";
        if (req.files) {
            await docUploader(req, req.files, 'quotes/documents');
        }

        res.status(200).json({
            status: true,
            message: 'Quote updated successfully'
        });
    } catch (error) {
        console.error('Error updating quote:', error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const view = async (req, res) => {
    try {
        const leadId = req.params.id;
        // Retrieve lead information from the database
        const quoteData = await ggBaseQuery(`SELECT
  l.*,
  MAX(r.message) AS remark,  
  MAX(r.user_type) AS remark_user,
  MAX(r.created_at) AS remark_timestamp
FROM
  quotes l

LEFT JOIN (
  SELECT ref_id, message, user_type, created_at
  FROM remarks r1
  WHERE created_at = (
    SELECT MAX(created_at)
    FROM remarks r2
    WHERE r2.type='quote' and r2.ref_id = r1.ref_id
  )
) r ON l.id = r.ref_id
WHERE
  l.id = ?
GROUP BY
  l.id;`, [leadId]);
        if (!quoteData || quoteData.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Lead not found.'
            });
        }

         const documents = await ggBaseQuery(`SELECT id,document_type,type,CONCAT('${PublicBasePath}', document_path)as document_path  FROM documents  WHERE type="quote" and ref_id=?
    `, [leadId]);

        // Extract relevant lead details
        const dataInfo = quoteData[0];
        dataInfo.document = (dataInfo.document ? path.join(PublicBasePath, dataInfo.document) : "");
        dataInfo.public_path = PublicBasePath;
        dataInfo.documents = documents;
        res.status(200).json({
            status: true,
            data: dataInfo
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
        const existingQuote = await ggBaseQuery('SELECT * FROM quotes WHERE id = ?', [leadId]);
        if (!existingQuote || existingQuote.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Quote not found.'
            });
        }
        // Get file paths from the existing lead
        const imagePath = existingQuote[0].document;
        // Delete the lead from the database
        await ggBaseQuery('DELETE FROM quotes WHERE id = ?', [leadId]);
        try {
            await fs.access(path.join(__dirname, uploadBasePath + imagePath));
            await fs.unlink(path.join(__dirname, uploadBasePath + imagePath));
        } catch (err) {
            console.error('Error removing existing image:', path.join(__dirname, uploadBasePath + imagePath));
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