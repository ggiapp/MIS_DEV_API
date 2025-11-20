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
// Helper function to sanitize folder name from document type
const sanitizeFolderName = (documentType) => {
    if (!documentType) {
        return 'other';
    }
    // Convert to lowercase, replace spaces with underscores, remove special characters
    return documentType
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'other';
};

// Function to handle file uploads
const docUploader = async (req, files, modulePath) => {
    const ggDocument = files;
    const reqBody = req.body;
    const { userId } = req.user;

    // Determine document count safely
    const rawDocCount = reqBody.doc_count != null ? reqBody.doc_count : reqBody.docCount;
    const docCount = Number(rawDocCount);

    if (!Number.isInteger(docCount) || docCount <= 0) {
        throw new Error("Invalid document count supplied.");
    }

    // Collect document types from request body
    const documentTypes = [];
    for (const key in reqBody) {
        if (Object.prototype.hasOwnProperty.call(reqBody, key)) {
            const match = key.match(/^document\[(\d+)\]\[type\]$/);
            if (match) {
                const index = Number(match[1]);
                documentTypes[index] = reqBody[key];
            }
        }
    }

    for (let i = 0; i < docCount; i++) {
        const fileKey = `document[${i}][file]`;
        let thisFile = ggDocument[fileKey];

        if (!thisFile) {
            console.warn(`File not found for key ${fileKey}, skipping.`);
            continue;
        }

        // express-fileupload may provide an array when multiple files share the same field name
        if (Array.isArray(thisFile) && thisFile.length > 0) {
            thisFile = thisFile[0];
        }

        const thisType = documentTypes[i] || null;
        
        // Create folder name based on document type
        const folderName = sanitizeFolderName(thisType);
        const documentFolderPath = path.join(modulePath, folderName);
        
        const timestamp = Date.now();
        const ext = path.extname(thisFile.name);
        const fileName = `${timestamp}${ext}`;
        const replacePath = replaceBasePath;
        let filePath = path.join(replacePath, documentFolderPath, fileName);

        // Ensure the document type folder exists
        await ensureDirectoryExists(path.join(replacePath, documentFolderPath));

        await new Promise((resolve, reject) => {
            thisFile.mv(filePath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        filePath = filePath.replace(replacePath, "");

        const insertQuery =
            "INSERT INTO documents (document_path, document_type, type, ref_id, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())";
        const insertValues = [filePath, thisType, req.module, req.ref_id, userId];

        try {
            await ggBaseQuery(insertQuery, insertValues);
        } catch (error) {
            console.error(`Error inserting document record: ${error.message}`);
            throw error;
        }
    }
};
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

const recordsview = async (req, res) => {
    try {
      const { userId } = req.user;
      
      if (!userId) {
        return res.status(400).json({
          status: false,
          message: "Missing user ID.",
        });
      }

      // Get user role from users table
      const userRole = await ggBaseQuery(`
        SELECT r.name as role
        FROM users u
        join user_roles ur on ur.user_id = u.id
        join roles r on r.id = ur.role_id
        WHERE u.id = ?
      `, [userId]);
      const role = userRole && userRole.length > 0 && userRole[0].role ? userRole[0].role : null;
      console.log('Role:',role);
     
      // Pagination - read from request body (POST) or query (fallback)
      const pageCount = Number(req.body.pagecount || req.body.pageCount || req.query.pagecount) || 20;
      const page = Number(req.body.page || req.query.page) || 1;
      const offset = (page - 1) * pageCount;
  
      // Default sort by RED date
      const sort = req.body.sort || req.query.sort || "RED";
      const sortBy = req.body.sortby || req.body.sortBy || req.query.sortby || "DESC";

      // Validate to prevent SQL injection
      const validSortColumn = /^[a-zA-Z0-9_]+$/.test(sort)
        ? sort
        : "RED";
      const validSortBy = sortBy.toUpperCase() === "DESC" ? "DESC" : "ASC";
  
      // Build WHERE clause based on user role and optional status filter
      const whereConditions = [];
      const whereParams = [];

      // If agent, show only records where user is TEAMLEADER or EXECUTIVE
      if (role === "agent") {
        whereConditions.push(`(i.TEAMLEADER = ? OR i.EXECUTIVE = ?)`);
        whereParams.push(userId, userId);
      }

      // If operation, show only records with statuses: Confirmed, Policy issued, and Closed_QCpass
      if (role === "operations") {
        const operationStatuses = await ggBaseQuery(`
          SELECT id FROM statuses 
          WHERE LOWER(name) IN ('confirmed', 'policy issued', 'closed_qcpass') AND is_active = 1
        `);
        
        if (operationStatuses && operationStatuses.length > 0) {
          const statusIds = operationStatuses.map(s => s.id);
          const placeholders = statusIds.map(() => '?').join(',');
          whereConditions.push(`i.status IN (${placeholders})`);
          whereParams.push(...statusIds);
        } else {
          // If no matching statuses found, return empty result
          whereConditions.push(`1 = 0`);
        }
      }

      // Optional status filter from body or query
      const statusId = req.body.statusId || req.body.status_id || req.query.statusId || req.query.status_id;
      if (statusId) {
        whereConditions.push(`i.status = ?`);
        whereParams.push(statusId);
      }

      const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(" AND ")}` : ``;

      // Count total records with role-based filtering
      const countQuery = `SELECT COUNT(*) AS total FROM insurdata i ${whereClause}`;
      const countResult = await ggBaseQuery(countQuery, whereParams);
      const total = countResult && countResult.length > 0 ? countResult[0].total || 0 : 0;

      // Query with team leader and executive names from crm_users table
      // If sorting by RED, convert date format for proper sorting
      const orderByClause = validSortColumn === 'RED' 
        ? `ORDER BY STR_TO_DATE(i.RED, '%d-%m-%Y') ${validSortBy}`
        : `ORDER BY i.\`${validSortColumn}\` ${validSortBy}`;
      
      const query = `
        SELECT 
          i.*,
          u.name AS TEAMLEADER,
          u2.name AS EXECUTIVE,
          s.name AS status_name,
          ss.name AS sub_status_name
        FROM insurdata i
        LEFT JOIN statuses s ON i.status = s.id
        LEFT JOIN substatuses ss ON i.sub_status = ss.id
        LEFT JOIN users u ON i.TEAMLEADER = u.id
        LEFT JOIN users u2 ON i.EXECUTIVE = u2.id
        ${whereClause}
        ${orderByClause}
        LIMIT ${Number(pageCount)} OFFSET ${Number(offset)}
      `;
      
      const data = await ggBaseQuery(query, whereParams);

      // Attach documents for each record by matching insurdata.id with documents.ref_id
      if (data && data.length > 0) {
        const recordIds = data
          .map(record => record.id)
          .filter(id => id !== undefined && id !== null);

        if (recordIds.length > 0) {
          const placeholders = recordIds.map(() => '?').join(',');
          const documentsQuery = `
            SELECT 
              id,
              document_type,
              document_path,
              ref_id,
              created_at
            FROM documents
            WHERE type = 'lead' AND ref_id IN (${placeholders})
          `;

          const documents = await ggBaseQuery(documentsQuery, recordIds);
          const documentsMap = {};

          if (documents && documents.length > 0) {
            documents.forEach(doc => {
              if (!documentsMap[doc.ref_id]) {
                documentsMap[doc.ref_id] = [];
              }

              documentsMap[doc.ref_id].push({
                id: doc.id,
                document_type: doc.document_type,
                document_path: doc.document_path,
                document_url: doc.document_path ? `${PublicBasePath}${doc.document_path}` : null,
                created_at: doc.created_at
              });
            });
          }

          // Attach documents to each record
          data.forEach(record => {
            record.documents = documentsMap[record.id] || [];
          });
        } else {
          data.forEach(record => {
            record.documents = [];
          });
        }
      }
  
      const lastPage = Math.ceil(total / pageCount) || 1;
  
      res.json({
        status: true,
        data: data,
        pagination: {
          current_page: page,
          per_page: pageCount,
          total,
          last_page: lastPage,
          from: total > 0 ? (page - 1) * pageCount + 1 : 0,
          to: Math.min(page * pageCount, total),
        },
      });
    } catch (error) {
      console.error("Error in recordsview:", error);
      res.status(500).json({
        status: false,
        message: "Something went wrong!",
        error: error.message,
      });
    }
  };

const getStatus = async (req, res) => {
    try {
        const { userId } = req.user;
        
        // Get user role from users table
        const userRole = await ggBaseQuery(`
            SELECT r.name as role
            FROM users u
            join user_roles ur on ur.user_id = u.id
            join roles r on r.id = ur.role_id
            WHERE u.id = ?

        `, [userId]);
        
        const role = userRole && userRole.length > 0 && userRole[0].role ? userRole[0].role : null;
        
        // Build query - exclude id 5 if user is agent, or show only ids 2,4,5 if operation
        let statusQuery = `SELECT id, name FROM statuses WHERE is_active = 1`;
        const queryParams = [];
        
        if (role === "agent") {
            statusQuery += ` AND id != ?`;
            queryParams.push(5);
        } else if (role === "operations") {
            statusQuery += ` AND id IN (?, ?, ?)`;
            queryParams.push(2, 4, 5);
        }
        
        statusQuery += ` ORDER BY id ASC`;
        
        const statusResult = await ggBaseQuery(statusQuery, queryParams);
        
        res.json({
            status: true,
            data: statusResult
        });
    } catch (error) {
        console.error("Error in getStatus:", error);
        res.status(500).json({
            status: false,
            message: "Something went wrong!",
            error: error.message,
        });
    }
};

const getSubstatus = async (req, res) => {
    try {
        const { statusId } = req.params;
        const { userId } = req.user;

        // Validate statusId
        if (!statusId) {
            return res.status(400).json({
                status: false,
                message: "Status ID is required."
            });
        }

        // Determine user role
        const userRole = await ggBaseQuery(
            `
            SELECT r.name as role
            FROM users u
            join user_roles ur on ur.user_id = u.id
            join roles r on r.id = ur.role_id
            WHERE u.id = ?
        `,
            [userId]
        );

        const role =
            userRole && userRole.length > 0 && userRole[0].role ? userRole[0].role : null;

        // Build query for substatuses, excluding specific ids for agents
        let substatusQuery = `SELECT id, name FROM substatuses WHERE status_id = ? AND is_active = 1`;
        const queryParams = [statusId];

        if (role === "agent") {
            const excludedIds = [21, 11, 3, 9];
            const placeholders = excludedIds.map(() => "?").join(", ");
            substatusQuery += ` AND id NOT IN (${placeholders})`;
            queryParams.push(...excludedIds);
        }
        substatusQuery += ` ORDER BY id ASC`;

        const substatusResult = await ggBaseQuery(substatusQuery, queryParams);

        res.json({
            status: true,
            data: substatusResult
        });
    } catch (error) {
        console.error("Error in getSubstatus:", error);
        res.status(500).json({
            status: false,
            message: "Something went wrong!",
            error: error.message,
        });
    }
};

const updateInsurDataStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, sub_status, latterdate, remarks } = req.body;
        const { userId } = req.user;

        // Validate required parameters
        if (!id) {
            return res.status(400).json({
                status: false,
                message: "Record ID is required."
            });
        }

        if (status === undefined && sub_status === undefined) {
            return res.status(400).json({
                status: false,
                message: "At least one of status or sub_status is required."
            });
        }

        // Check if the record exists in insurdata table
        const existingRecord = await ggBaseQuery(
            `SELECT id, status, sub_status FROM insurdata WHERE id = ?`,
            [id]
        );

        if (!existingRecord || existingRecord.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Record not found in insurdata table."
            });
        }

        // Build update query dynamically based on provided fields
        const updateFields = [];
        const updateValues = [];

        let shouldUpdateLatterDate = false;
        let newLatterDateValue = null;

        if (status !== undefined) {
            updateFields.push('status = ?');
            updateValues.push(status);

            if (Number(status) === 3) {
                shouldUpdateLatterDate = true;
                if (latterdate) {
                    newLatterDateValue = isNaN(Date.parse(latterdate))
                        ? latterdate
                        : new Date(latterdate).toISOString().slice(0, 19).replace('T', ' ');
                } else {
                    const now = new Date();
                    newLatterDateValue = now.toISOString().slice(0, 19).replace('T', ' ');
                }
                updateFields.push('LATTERDATE = ?');
                updateValues.push(newLatterDateValue);
            }
        }

        if (sub_status !== undefined) {
            updateFields.push('sub_status = ?');
            updateValues.push(sub_status);
        }

        // Always update updated_at timestamp
        updateFields.push('updated_at = NOW()');

        // Add id to update values for WHERE clause
        updateValues.push(id);

        // Execute main update query (status and sub_status)
        const updateQuery = `
            UPDATE insurdata 
            SET ${updateFields.join(', ')} 
            WHERE id = ?
        `;

        await ggBaseQuery(updateQuery, updateValues);

        // Update status_history if status is being updated (separate query for resilience)
        if (status !== undefined) {
            try {
                // Get status name from statuses table
                const statusQuery = `SELECT name FROM statuses WHERE id = ? AND is_active = 1`;
                const statusResult = await ggBaseQuery(statusQuery, [status]);
                
                if (statusResult && statusResult.length > 0) {
                    const statusName = statusResult[0].name;
                    // Get existing status_history or create new one
                    const historyQuery = `SELECT status_history FROM insurdata WHERE id = ?`;
                    const historyResult = await ggBaseQuery(historyQuery, [id]);
                    
                    let statusHistory = [];
                    if (historyResult && historyResult[0] && historyResult[0].status_history) {
                        try {
                            const parsed = JSON.parse(historyResult[0].status_history);
                            statusHistory = Array.isArray(parsed) ? parsed : [parsed];
                        } catch (e) {
                            statusHistory = [];
                        }
                    }
                    
                    // Add new status entry
                    statusHistory.push({
                        status: statusName,
                        status_id: status,
                        date: new Date().toISOString()
                    });
                    
                    // Update status_history separately
                    await ggBaseQuery(
                        `UPDATE insurdata SET status_history = ? WHERE id = ?`,
                        [JSON.stringify(statusHistory), id]
                    );
                }
            } catch (historyError) {
                // Log error but don't fail the entire request
                console.error("Error updating status_history:", historyError);
            }
        }

        // Add remarks if provided
        if (remarks && remarks.trim() !== "") {
            await remarksEntry([remarks, "insurdata", id, "agent", userId]);
        }

        const responseData = {
            id: id,
            status: status !== undefined ? status : existingRecord[0].status,
            sub_status: sub_status !== undefined ? sub_status : existingRecord[0].sub_status
        };

        if (shouldUpdateLatterDate && newLatterDateValue) {
            responseData.latterdate = newLatterDateValue;
        }

        res.json({
            status: true,
            message: "Record status and substatus updated successfully.",
            data: responseData
        });
    } catch (error) {
        console.error("Error in updateInsurDataStatus:", error);
        res.status(500).json({
            status: false,
            message: "Something went wrong!",
            error: error.message,
        });
    }
};

const uploadDocuments = async (req, res) => {
    try {
        const { userId } = req.user;
        const { type, ref_id, doc_count } = req.body;

        // Validate required fields
        if (!type) {
            return res.status(400).json({
                status: false,
                message: "Type is required (e.g., 'lead', 'insurdata')."
            });
        }

        if (!ref_id) {
            return res.status(400).json({
                status: false,
                message: "Reference ID (ref_id) is required."
            });
        }

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({
                status: false,
                message: "No files were uploaded."
            });
        }

        const documentCount = Number(doc_count);

        if (!Number.isInteger(documentCount) || documentCount <= 0) {
            return res.status(400).json({
                status: false,
                message: "Document count (doc_count) is required and must be greater than 0."
            });
        }

        // Set module and ref_id for docUploader
        req.module = type;
        req.ref_id = ref_id;
        req.body.doc_count = documentCount;

        // Determine module path based on type
        let modulePath = 'documents';
        if (type === 'lead') {
            modulePath = 'leads/documents';
        } else if (type === 'insurdata') {
            modulePath = 'insurdata/documents';
        } else {
            modulePath = `${type}/documents`;
        }

        // Upload documents using existing docUploader function
        // This function handles file storage and database insertion
        await docUploader(req, req.files, modulePath);

        // // Fetch uploaded documents to return in response
        // const uploadedDocs = await ggBaseQuery(
        //     `SELECT id, document_type, type, CONCAT('${PublicBasePath}', document_path) AS document_path, created_at 
        //      FROM documents 
        //      WHERE type = ? AND ref_id = ? 
        //      ORDER BY created_at DESC 
        //      LIMIT ?`,
        //     [type, ref_id, documentCount]
        // );

        res.status(200).json({
            status: true,
            message: 'Documents uploaded successfully and stored in database.',
            // data: uploadedDocs,
            // count: uploadedDocs.length
        });
    } catch (error) {
        console.error('Error uploading documents:', error);
        res.status(500).json({
            status: false,
            message: 'Something went wrong while uploading documents.',
            error: error.message
        });
    }
};

export default {
    index,
    add,
    update,
    view,
    deleteItem,
    recordsview,
    getStatus,
    getSubstatus,
    updateInsurDataStatus,
    uploadDocuments
}