import {
    ggBaseQuery,
    uploadBasePath,
    PublicBasePath,
    replaceBasePath,
} from "./../db/connectdb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
const path = require("path");
const XLSX = require("xlsx");
const moment = require("moment");
const fs = require("fs").promises;
async function ensureDirectoryExists(directory) {
    try {
        await fs.access(directory);
    } catch (error) {
        await fs.mkdir(directory, {
            recursive: true,
        });
    }
}
let thisSQL = ["ms.id", "ms.user_id", "ms.issued_date", "ms.point_of_sale", "ms.customer_name", "ms.customer_email_id", "ms.product_type", "ms.regn_no", "ms.sub_product", "ms.make", "ms.model", "ms.policy_type", "ms.company_name", "ms.tp_premium", "ms.od_premium", "ms.net_premium", "ms.gross_premium", "ms.spot_to_customer", "ms.sc_from_customer", "ms.sc_to_office", "ms.intermediary_name", "ms.issued_at", "ms.issued_by", "ms.personal_accident", "ms.pa_company", "ms.pa_amount", "ms.motor_payment", "ms.sc_payment", "ms.pa_payment", "ms.cross_sell_opportunity", "ms.payment_mode", "ms.py_policy", "ms.vehicle_type", "ms.previous_document_type", "ms.status", "ms.qc_status", "ms.created_at", "ms.sync_data"];
const cleanVechileNo = (vechileNo) => vechileNo.replace(/[\\/\t\s\W]/g, "");
// COMMON FUNCTIONS
const misFileUpload = async (reqFiles) => {
    const {
        files,
        ref_id,
        module_type
    } = reqFiles;
    for (const key in files) {
        if (Object.hasOwnProperty.call(files, key)) {
            // Extract key name without index
            const originalKey = key.replace(/\[\d+\]/, "");
            const file = files[key];
            const ext = file.name.split(".").pop(); // Extract file extension
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
                        error: `Error uploading files => ${docPath}`,
                    });
                } else {
                    const insertValues = [docPath, originalKey, module_type, ref_id, 1];
                    console.log(insertValues);
                    const insertQuery = "INSERT INTO documents (document_path, document_type, type, ref_id, user_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())";
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
};
const getSiteSettings = async () => {
    const thisOptionsQuery = `Select institution,form_types,form_doc_types,form_kyc_types  from settings where id =1`;
    let optionsRows = await ggBaseQuery(thisOptionsQuery);
    return optionsRows ? optionsRows[0] : {};
};
const createMis = async (req, res) => {
    try {
        // Check if files were uploaded
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send("No documents were uploaded.");
        }

         const data = req.body;

        const [MisRecord] = await ggBaseQuery(`SELECT id FROM mis_entries WHERE regn_no = ? LIMIT 1`, [data.regn_no]);
        console.log(MisRecord);


        const checkSQL = `SELECT 
  r.*,
  COUNT(r.id) AS MIS_COUNT
FROM mis_entries r
WHERE 
  REGEXP_REPLACE(r.regn_no, '[^A-Za-z0-9]', '') = REGEXP_REPLACE('${data.regn_no}', '[^A-Za-z0-9]', '')
  AND STR_TO_DATE(r.issued_date, '%d-%m-%Y') >= DATE_SUB(CURDATE(), INTERVAL 10 MONTH);
`;
        console.log(checkSQL);
        const [results] = await ggBaseQuery(checkSQL);
        console.log(results);
        if (results && parseInt(results.MIS_COUNT) > 0) {
             res.json({
                status: false,
                record_id: `#Duplicate - (${results.MIS_COUNT})`,
                message: "Duplicate registration number within 11 months",
            });
            return;
        }

       
        // Assuming the request body contains the data to be inserted
        delete data.previous_document;
        delete data.vehicle_images;
        delete data.engine_chassis_no;
        delete data.odometer;
        data.status = "1";
        data.pa_payment = data.pa_payment || "-";
        data.motor_payment = data.motor_payment || "-";
        data.sc_payment = data.sc_payment || "-";
        data.customer_email_id = "-";
        data.product_type = "-";
        data.sub_product = "-";
        data.policy_type = "-";
        data.company_name = "-";
        // Extract keys and values from the request payload
        const keys = Object.keys(data);
        const Reqvalues = Object.values(data);
        console.log(keys);
        console.log("=============");
        console.log(Reqvalues);
        // Construct the SQL query dynamically
        const sqlQuery = `INSERT INTO mis_entries (${keys.join(
      ", "
    )}, created_at, deleted_at)
  VALUES (${Array(Reqvalues.length).fill("?").join(", ")}, NOW(), NULL)`;
        const rows = await ggBaseQuery(sqlQuery, Reqvalues);
        console.log(rows);
        if (req.files && Object.keys(req.files).length) {
            req.ref_id = rows.insertId;
            req.module_type = "mis";
            await misFileUpload(req);
        }
        res.json({
            status: true,
            record_id: rows.insertId,
            message: "MIS created successfully",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: "Internal Server Error",
        });
    }
};
const createMisNew = async (req, res) => {
    try {
        // Check if files were uploaded
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send("No documents were uploaded.");
        }
        const [MisRecord] = await ggBaseQuery(`SELECT id FROM mis_entries WHERE id = ? LIMIT 1`, [ref_id]);
        console.log(MisRecord);
        if (MisRecord) {
            res.json({
                status: false,
                record_id: '#NULL',
                message: "This Reg No. number already exists. Please try a different one.",
            });
            return;
        }
        const data = req.body; // Assuming the request body contains the data to be inserted
        delete data.previous_document;
        delete data.vehicle_images;
        delete data.engine_chassis_no;
        delete data.odometer;
        data.status = "1";
        data.pa_payment = data.pa_payment || "-";
        data.motor_payment = data.motor_payment || "-";
        data.sc_payment = data.sc_payment || "-";
        // Extract keys and values from the request payload
        const keys = Object.keys(data);
        const Reqvalues = Object.values(data);
        console.log(keys);
        console.log("=============");
        console.log(Reqvalues);
        // Construct the SQL query dynamically
        const sqlQuery = `INSERT INTO mis_entries (${keys.join(
      ", "
    )}, created_at, deleted_at)
  VALUES (${Array(Reqvalues.length).fill("?").join(", ")}, NOW(), NULL)`;
        const rows = await ggBaseQuery(sqlQuery, Reqvalues);
        console.log(rows);
        if (req.files && Object.keys(req.files).length) {
            req.ref_id = rows.insertId;
            req.module_type = "mis";
            await misFileUpload(req);
        }
        res.json({
            status: true,
            record_id: rows.insertId,
            message: "MIS created successfully",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            error: "Internal Server Error",
        });
    }
};
const getMisRecords = async (req, res) => {
    try {
        const rsync = req.query.sync || false;
        console.log(req.query);
        const {
            filter
        } = req.query;
        const currentDate = moment().format("YYYY-MM-DD");
        let dateFilter = [currentDate, currentDate];
        if (filter) {
            const {
                date
            } = filter;
            console.log(date);
            dateFilter = filter.date.split(",");
            console.log(dateFilter);
        }
        // #PAGINATION MODULE
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 10; // Default limit is 10 per page
        const offset = (page - 1) * limit;
        // #PAGINATION MODULE
        const {
            user_id
        } = req.body;
        const {
            vertical
        } = req.query;
        let misRecords = [];
        let misCurrentMOnthRecords = [];
        let misTotal = 0;
        const thisQry = [...thisSQL];
        // Retrieve user details from the database
        if (user_id === 208) {
            thisQry.push(["ms.mobile_number"]);
        }
        if (user_id === 1 || user_id === 208) {
            const thisSQLQuery = `SELECT users.name AS created_by, ${thisQry.join()}
FROM mis_entries ms
JOIN users ON ms.user_id = users.id WHERE STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${
        dateFilter[0]
      }' AND '${dateFilter[1]}'  ORDER BY ms.created_at DESC   ${
        rsync ? `` : `LIMIT  ${offset}, ${limit}`
      }  `;
            console.log(thisSQLQuery);
            misRecords = await ggBaseQuery(thisSQLQuery);
            const [total] = await ggBaseQuery(`SELECT COUNT(*) as total FROM mis_entries JOIN users ON mis_entries.user_id = users.id `);
            misTotal = total.total;
            misCurrentMOnthRecords = await ggBaseQuery(`SELECT 
    COUNT(*) AS count
FROM 
    mis_entries
WHERE 
    MONTH(created_at) = MONTH(CURRENT_DATE())`);
        } else {
            misRecords = await ggBaseQuery(`SELECT users.name AS created_by, ${thisQry.join()}
FROM mis_entries ms
JOIN users ON ms.user_id = users.id WHERE users.id=? ORDER BY ms.created_at DESC `, [user_id]);
            misCurrentMOnthRecords = await ggBaseQuery(`SELECT 
    COUNT(*) AS count
FROM 
    mis_entries
WHERE 
    mis_entries.user_id=?  AND MONTH(created_at) = MONTH(CURRENT_DATE())`, [user_id]);
        }
        console.log(misCurrentMOnthRecords);
        // SELECT * FROM mis_entries  ORDER BY created_at DESC
        const misRecordsData = misRecords.map(report => {
            if (report.qc_status === "1" && report.sync_data) {
                // Convert all keys in report and sync_data to lowercase
                const reportLower = Object.fromEntries(Object.entries(report).map(([key, value]) => [key.toLowerCase(), value]));
                const syncDataLower = Object.fromEntries(Object.entries(report.sync_data).map(([key, value]) => [key.toLowerCase(), value]));
                // Merge with priority to syncDataLower
                return { ...reportLower,
                    ...syncDataLower,
                    sync_data: undefined
                };
            }
            return Object.fromEntries(Object.entries(report).map(([key, value]) => [key.toLowerCase(), value])); // Keep as is with lowercase keys
        });
        res.send({
            status: true,
            data: misRecordsData,
            total: misTotal,
            limit: limit,
            month: misCurrentMOnthRecords[0]["count"],
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            data: [],
            message: "An error occurred",
        });
    }
};
const checkMisValidation = async (req, res) => {
    try {
        const {
            key,
            value
        } = req.params;
        console.log(key, value);
        const ReGNumber = cleanVechileNo(value);
        //         const checkSQL = `SELECT m.*, sub.MIS_COUNT
        // FROM (
        //   SELECT *
        //   FROM mis_entries
        //   WHERE REGEXP_REPLACE(regn_no, '[^A-Za-z0-9]', '') = REGEXP_REPLACE('${ReGNumber}', '[^A-Za-z0-9]', '')
        //     AND STR_TO_DATE(issued_date, '%d-%m-%Y') >= DATE_SUB(CURDATE(), INTERVAL 10 MONTH)
        // ) AS m
        // JOIN (
        //   SELECT COUNT(id) AS MIS_COUNT
        //   FROM mis_entries
        //   WHERE REGEXP_REPLACE(regn_no, '[^A-Za-z0-9]', '') = REGEXP_REPLACE('${ReGNumber}', '[^A-Za-z0-9]', '')
        //     AND STR_TO_DATE(issued_date, '%d-%m-%Y') >= DATE_SUB(CURDATE(), INTERVAL 10 MONTH)
        // ) AS sub ON 1=1;`;
        const checkSQL = `SELECT 
  r.*,
  COUNT(r.id) AS MIS_COUNT
FROM mis_entries r
WHERE 
  REGEXP_REPLACE(r.regn_no, '[^A-Za-z0-9]', '') = REGEXP_REPLACE('${ReGNumber}', '[^A-Za-z0-9]', '')
  AND STR_TO_DATE(r.issued_date, '%d-%m-%Y') >= DATE_SUB(CURDATE(), INTERVAL 10 MONTH);
`;
        console.log(checkSQL);
        const [results] = await ggBaseQuery(checkSQL);
        console.log(results);
        if (results && parseInt(results.MIS_COUNT) > 0) {
            res.send({
                status: true,
                renewal: results.MIS_COUNT,
                message: "Duplicate registration number within 11 months",
                data: results,
            });
            return;
        }
        res.send({
            status: false,
            message: "",
            renewal: results.MIS_COUNT,
            data: results,
        });
        return;
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            data: [],
            message: "An error occurred",
        });
    }
};
const getMisMakeModel = async (req, res) => {
    try {
        console.log(req.body);
        const workbook = XLSX.readFile(path.resolve(uploadBasePath, "dataset/make-model.xlsx"));
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Convert the worksheet to JSON format
        const data = XLSX.utils.sheet_to_json(worksheet);
        // Group the data by the "Make" column
        const groupedData = data.reduce((acc, item) => {
            const {
                Make,
                Model
            } = item;
            acc[Make] = acc[Make] || [];
            acc[Make].push(Model.trim()); // Trim to remove any leading/trailing spaces
            return acc;
        }, {});
        res.send({
            status: true,
            data: groupedData,
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            data: [],
            message: "An error occurred",
        });
    }
};
const getMisOneRecord = async (req, res) => {
    try {
        const misId = req.params.id;
        const thisQry = [...thisSQL];
        const {
            vertical
        } = req.query;
        if (vertical === "super") {
            thisQry.push(["ms.mobile_number"]);
        }
        // Retrieve user details from the database
        const [rows] = await ggBaseQuery(`SELECT ${thisQry.join()},ms.sync_data FROM mis_entries ms where id=? ORDER BY created_at DESC`, [misId]);
        const documents = await ggBaseQuery(`SELECT id, document_type, type, CONCAT("http://89.116.34.157:4444/cdn/", document_path) AS document_path  
FROM documents  
WHERE ref_id = ?`, [misId]);
        rows.documents = documents;
        res.send({
            status: true,
            data: rows,
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            data: [],
            message: "An error occurred",
        });
    }
};
const getMisForMatchIds = async (req, res) => {
    try {
        const {
            ids
        } = req.body;
        const {
            userId
        } = req.user;
        const thisQry = [...thisSQL];
        // if (vertical === "super") {
        //     thisQry.push(["ms.mobile_number"]);
        // }
        const reqIds = ids.split(",");
        // Retrieve user details from the database
        const mis_reports = await ggBaseQuery(`SELECT ${thisQry.join()},ms.sync_data FROM mis_entries ms where id IN (${reqIds.join(',')}) ORDER BY created_at DESC`);
        const documents = await ggBaseQuery(`SELECT id,ref_id, document_type, type, CONCAT("http://89.116.34.157:4444/cdn/", document_path) AS document_path  
FROM documents  
WHERE  ref_id IN (${reqIds.join(',')})`);
        // const mis_reports =  rows.map((record,index)=>{
        //      ...{record},
        //      documents : documents.find((rw)=> rw.ref_id === record.id)
        //  });
        // rows.documents = documents;
        res.send({
            status: true,
            documents: documents,
            data: mis_reports,
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            data: [],
            message: "An error occurred",
        });
    }
};
const webSettings = async (req, res) => {
    try {
        const userId = 1;
        // Retrieve user details from the database
        const settings = await ggBaseQuery("SELECT * FROM settings WHERE id = ?", [
            userId,
        ]);
        res.send({
            status: true,
            data: settings[0],
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            message: "An error occurred",
        });
    }
};
const deleteMisRecords = async (req, res) => {
    try {
        const {
            record
        } = req.body;
        // const {
        //     userId
        // } = req.user;
        // if (record && record.length && userId !== 1 && userId !== 208) {
        //     res.send({
        //         status: false,
        //         message: "An error occurred",
        //     });
        //     return;
        // }
        // console.log(record,userId);
        // Retrieve user details from the database
        const deleteMisRecords = await ggBaseQuery(`DELETE FROM mis_entries WHERE id IN (${record.join(',')})`);
        res.send({
            status: true,
            data: "Entries Deleted successfully.",
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            message: "An error occurred",
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
            credit_amount,
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
            credit_amount,
        ]);
        res.send({
            status: true,
            data: rows.affectedRows ? true : false,
        });
    } catch (err) {
        console.error("Error ", err);
        res.status(500).json({
            status: false,
            message: "An error occurred",
        });
    }
};
const getTlDashboard = async (req, res) => {
    try {
        const userId = 1;
        // Retrieve user details from the database
        const settings = await ggBaseQuery(`SELECT 
    SUM(CASE WHEN today_reports.today_count > 1 THEN 1 ELSE 0 END) AS today_users,
     COALESCE(SUM(today_reports.today_premium_amount), 0) AS today_premium,
    SUM(CASE WHEN month_reports.month_count > 1 THEN 1 ELSE 0 END) AS month_users,
    COALESCE(SUM(month_reports.month_premium_amount), 0) AS month_premium
FROM users u
LEFT JOIN (
    SELECT 
        r.user_id,
        COUNT(r.id) AS today_count,
        SUM(CAST(REPLACE(r.gross_premium, ',', '') AS DECIMAL(10, 0))) AS today_premium_amount
    FROM mis_entries r
    WHERE STR_TO_DATE(r.issued_date, '%d-%m-%Y') = CURDATE()
    GROUP BY r.user_id
) AS today_reports ON u.id = today_reports.user_id
LEFT JOIN (
    SELECT 
        r.user_id,
        COUNT(r.id) AS month_count,
        SUM(CAST(REPLACE(r.gross_premium, ',', '') AS DECIMAL(10, 0))) AS month_premium_amount
    FROM mis_entries r
    WHERE DATE_FORMAT(STR_TO_DATE(r.issued_date, '%d-%m-%Y'), '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
    GROUP BY r.user_id
) AS month_reports ON u.id = month_reports.user_id`);
        // NEW DASHBOARD WIDGETS
        const anayltics = await ggBaseQuery(`SELECT 
   
    COUNT(CASE WHEN us.vertical = 'Telecaller' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS today_telecaller,

   
    COUNT(CASE WHEN us.vertical = 'Bunk' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS today_bunk,

    COUNT(CASE WHEN us.vertical = 'Agency' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS today_agency,

      COUNT(CASE WHEN us.vertical = 'Direct' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS today_direct,

   
    COUNT(CASE WHEN us.vertical = 'Telecaller' AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS month_telecaller,

   
    COUNT(CASE WHEN us.vertical = 'Bunk' AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS month_bunk,


       
    COUNT(CASE WHEN us.vertical = 'Agency' AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS month_agency,



    COUNT(CASE WHEN us.vertical = 'Direct' AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS month_direct,


   
    COUNT(CASE WHEN us.vertical = 'Telecaller' THEN 1 END) AS overall_telecaller,

   
    COUNT(CASE WHEN us.vertical = 'Bunk' THEN 1 END) AS overall_bunk,

     COUNT(CASE WHEN us.vertical = 'Agency' THEN 1 END) AS overall_agency,

     COUNT(CASE WHEN us.vertical = 'Direct' THEN 1 END) AS overall_direct,


   
    COUNT(CASE WHEN STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS total_count_today,

   
    COUNT(CASE WHEN MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS total_count_month,

   
    COUNT(*) AS total_count_overall

FROM 
    mis_entries ms
    LEFT JOIN users us on ms.user_id=us.id
    
WHERE
    us.vertical IN ('Telecaller', 'Bunk','Agency','Direct')`);
        // Premium Analytics
        const premiumAnayltics = await ggBaseQuery(`SELECT 
   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_telecaller,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_bunk,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_agency,

      COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_direct,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_telecaller,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_bunk,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_agency,

       COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_direct,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_telecaller,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_bunk,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_agency,


   COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_direct,
   
    COALESCE(SUM(CASE 
        WHEN STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS total_count_today,

   
    COALESCE(SUM(CASE 
        WHEN MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS total_count_month,

   
    COALESCE(SUM(CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED)), 0) AS total_count_overall

FROM 
    mis_entries ms
    LEFT JOIN users us ON ms.user_id = us.id
    
WHERE
    us.vertical IN ('Telecaller', 'Bunk', 'Agency')`);
        const premiumCounts = premiumAnayltics.map((obj) => Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, parseInt(value, 10)])));
        res.send({
            status: true,
            data: settings,
            anayltics: anayltics,
            premium_anayltics: premiumCounts,
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            message: "An error occurred",
        });
    }
};
const getMisDashboard = async (req, res) => {
    try {
        const {
            userId
        } = req.user;
        const {
            currentDate
        } = req.query;
        console.log("DDDDDDDDDDDDDDDDD");
        console.log(userId);
        console.log("DDDDDDDDDDDDDDDDD");
        const isAdmin = ([1, 208].indexOf(userId) !== -1 ? true : false);
        // Retrieve user details from the database
        const dashBoardSqlQuery = (isAdmin === true ? `SELECT 
    SUM(CASE WHEN today_reports.today_count > 1 THEN 1 ELSE 0 END) AS today_users,
     COALESCE(SUM(today_reports.today_premium_amount), 0) AS today_premium,
    SUM(CASE WHEN month_reports.month_count > 1 THEN 1 ELSE 0 END) AS month_users,
    COALESCE(SUM(month_reports.month_premium_amount), 0) AS month_premium
FROM users u
LEFT JOIN (
    SELECT 
        r.user_id,
        COUNT(r.id) AS today_count,
        SUM(CAST(REPLACE(r.gross_premium, ',', '') AS DECIMAL(10, 0))) AS today_premium_amount
    FROM mis_entries r
    WHERE STR_TO_DATE(r.issued_date, '%d-%m-%Y') = CURDATE()
    GROUP BY r.user_id
) AS today_reports ON u.id = today_reports.user_id
LEFT JOIN (
    SELECT 
        r.user_id,
        COUNT(r.id) AS month_count,
        SUM(CAST(REPLACE(r.gross_premium, ',', '') AS DECIMAL(10, 0))) AS month_premium_amount
    FROM mis_entries r
    WHERE DATE_FORMAT(STR_TO_DATE(r.issued_date, '%d-%m-%Y'), '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
    GROUP BY r.user_id
) AS month_reports ON u.id = month_reports.user_id` : `SELECT 
    COALESCE(SUM(today_reports.today_count), 0) AS today_count, 
    COALESCE(SUM(today_reports.today_premium_amount), 0) AS today_premium,
    COALESCE(SUM(month_reports.month_count), 0) AS month_count,
    COALESCE(SUM(month_reports.month_premium_amount), 0) AS month_premium,
    SUM(CASE WHEN today_reports.today_count > 1 THEN 1 ELSE 0 END) AS today_users,
    SUM(CASE WHEN month_reports.month_count > 1 THEN 1 ELSE 0 END) AS month_users
FROM users u
LEFT JOIN (
   SELECT 
        r.user_id,
        COUNT(r.id) AS today_count,
        SUM(CAST(REPLACE(r.gross_premium, ',', '') AS DECIMAL(10, 0))) AS today_premium_amount
    FROM mis_entries r
    WHERE r.user_id IN (
        SELECT DISTINCT id FROM users WHERE team_lead = ${userId}
    )
    AND STR_TO_DATE(r.issued_date, '%d-%m-%Y') = CURDATE()
    GROUP BY r.user_id
) AS today_reports ON u.id = today_reports.user_id
LEFT JOIN (
    SELECT 
        r.user_id,
        COUNT(r.id) AS month_count,
        SUM(CAST(REPLACE(r.gross_premium, ',', '') AS DECIMAL(10, 0))) AS month_premium_amount
    FROM mis_entries r
    WHERE r.user_id IN (
        SELECT DISTINCT id FROM users WHERE team_lead = ${userId}
    )
    AND DATE_FORMAT(STR_TO_DATE(r.issued_date, '%d-%m-%Y'), '%Y-%m') = '${currentDate}'
    GROUP BY r.user_id
) AS month_reports ON u.id = month_reports.user_id`);
        let settings = await ggBaseQuery(dashBoardSqlQuery);
        let anayltics = [];
        let premiumAnayltics = [];
        if (isAdmin) {
            // NEW DASHBOARD WIDGETS
            anayltics = await ggBaseQuery(`SELECT 
   
    COUNT(CASE WHEN us.vertical = 'Telecaller' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS today_telecaller,

   
    COUNT(CASE WHEN us.vertical = 'Bunk' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS today_bunk,

    COUNT(CASE WHEN us.vertical = 'Agency' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS today_agency,

      COUNT(CASE WHEN us.vertical = 'Direct' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS today_direct,

   
    COUNT(CASE WHEN us.vertical = 'Telecaller' AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS month_telecaller,

   
    COUNT(CASE WHEN us.vertical = 'Bunk' AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS month_bunk,


       
    COUNT(CASE WHEN us.vertical = 'Agency' AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS month_agency,



    COUNT(CASE WHEN us.vertical = 'Direct' AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS month_direct,


   
    COUNT(CASE WHEN us.vertical = 'Telecaller' THEN 1 END) AS overall_telecaller,

   
    COUNT(CASE WHEN us.vertical = 'Bunk' THEN 1 END) AS overall_bunk,

     COUNT(CASE WHEN us.vertical = 'Agency' THEN 1 END) AS overall_agency,

     COUNT(CASE WHEN us.vertical = 'Direct' THEN 1 END) AS overall_direct,


   
    COUNT(CASE WHEN STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() THEN 1 END) AS total_count_today,

   
    COUNT(CASE WHEN MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
    AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) THEN 1 END) AS total_count_month,

   
    COUNT(*) AS total_count_overall

FROM 
    mis_entries ms
    LEFT JOIN users us on ms.user_id=us.id
    
WHERE
    us.vertical IN ('Telecaller', 'Bunk','Agency','Direct')`);
            // Premium Analytics
            premiumAnayltics = await ggBaseQuery(`SELECT 
   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_telecaller,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_bunk,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_agency,

      COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_direct,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_telecaller,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_bunk,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_agency,

       COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        AND MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_direct,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_telecaller,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_bunk,

   
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_agency,


   COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_direct,
   
    COALESCE(SUM(CASE 
        WHEN STR_TO_DATE(ms.issued_date, '%d-%m-%Y') = CURDATE() 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS total_count_today,

   
    COALESCE(SUM(CASE 
        WHEN MONTH(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = MONTH(CURDATE()) 
        AND YEAR(STR_TO_DATE(ms.issued_date, '%d-%m-%Y')) = YEAR(CURDATE()) 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS total_count_month,

   
    COALESCE(SUM(CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED)), 0) AS total_count_overall

FROM 
    mis_entries ms
    LEFT JOIN users us ON ms.user_id = us.id
    
WHERE
    us.vertical IN ('Telecaller', 'Bunk', 'Agency')`);
        }
        const premiumCounts = premiumAnayltics.map((obj) => Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, parseInt(value, 10)])));
        res.send({
            status: true,
            data: settings,
            anayltics: anayltics,
            premium_anayltics: premiumCounts,
            sql: dashBoardSqlQuery,
        });
    } catch (err) {
        console.error("Error :", err);
        res.status(500).json({
            status: false,
            message: "An error occurred",
        });
    }
};
const getMisDashboardFilter = async (req, res) => {
    try {
        const userId = 1;
        const {
            dates
        } = req.query;
        console.log(dates);
        const [fromDate, toDate] = dates.split(",");
        console.log(fromDate, toDate);
        console.log("*******************");
        // NEW DASHBOARD WIDGETS
        const anayltics = await ggBaseQuery(`
            SELECT 
    COUNT(CASE WHEN us.vertical = 'Telecaller' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS today_telecaller,

    COUNT(CASE WHEN us.vertical = 'Bunk' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS today_bunk,

    COUNT(CASE WHEN us.vertical = 'Agency' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS today_agency,

    COUNT(CASE WHEN us.vertical = 'Direct' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS today_direct,

    COUNT(CASE WHEN us.vertical = 'Telecaller' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS month_telecaller,

    COUNT(CASE WHEN us.vertical = 'Bunk' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS month_bunk,

    COUNT(CASE WHEN us.vertical = 'Agency' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS month_agency,

    COUNT(CASE WHEN us.vertical = 'Direct' AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS month_direct,

    COUNT(CASE WHEN us.vertical = 'Telecaller' THEN 1 END) AS overall_telecaller,

    COUNT(CASE WHEN us.vertical = 'Bunk' THEN 1 END) AS overall_bunk,

    COUNT(CASE WHEN us.vertical = 'Agency' THEN 1 END) AS overall_agency,

    COUNT(CASE WHEN us.vertical = 'Direct' THEN 1 END) AS overall_direct,

    COUNT(CASE WHEN STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS total_count_today,

    COUNT(CASE WHEN STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' THEN 1 END) AS total_count_month,

    COUNT(*) AS total_count_overall

FROM 
    mis_entries ms
    LEFT JOIN users us ON ms.user_id = us.id
WHERE
    us.vertical IN ('Telecaller', 'Bunk', 'Agency', 'Direct')
    AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' `);
        // Premium Analytics
        const premiumAnayltics = await ggBaseQuery(`SELECT 
    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_telecaller,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_bunk,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_agency,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS today_direct,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_telecaller,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_bunk,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_agency,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS month_direct,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Telecaller' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_telecaller,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Bunk' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_bunk,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Agency' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_agency,

    COALESCE(SUM(CASE 
        WHEN us.vertical = 'Direct' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS overall_direct,

    COALESCE(SUM(CASE 
        WHEN STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS total_count_today,

    COALESCE(SUM(CASE 
        WHEN STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}' 
        THEN CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED) 
    END), 0) AS total_count_month,

    COALESCE(SUM(CAST(CAST(REPLACE(gross_premium, ',', '') AS DECIMAL(10,2)) AS UNSIGNED)), 0) AS total_count_overall

FROM 
    mis_entries ms
    LEFT JOIN users us ON ms.user_id = us.id
    
WHERE
    us.vertical IN ('Telecaller', 'Bunk', 'Agency', 'Direct')
    AND STR_TO_DATE(ms.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}';
`);
        const premiumCounts = premiumAnayltics.map((obj) => Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, parseInt(value, 10)])));
        res.send({
            status: true,
            anayltics: anayltics,
            premium_anayltics: premiumCounts,
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            message: "An error occurred",
        });
    }
};
const misSync = async (req, res) => {
    try {
        const {
            location,
            username,
            vertical,
            booked_data
        } = req.body;
        console.log(booked_data);
        console.log(location, username, vertical);
        res.json({
            status: true,
            data: [],
        });
    } catch (error) {
        console.error("Error processing file:", error);
        // res.status(500).send("Error processing file");
        res.json({
            status: false,
            data: error,
        });
    }
};
const qcCheckImport = async (req, res) => {
    try {
        let data = req.body;
        const {
            ref_id
        } = req.body;
        console.log(data);
        // #REMAP FUNCTION
        if (data.remap) {
            if (data.regn_no) {
                const [qcMisRecord] = await ggBaseQuery(`SELECT id FROM mis_entries WHERE id = ? LIMIT 1`, [ref_id]);
                console.log(qcMisRecord);
                const sqlUpdate = `UPDATE mis_entries SET regn_no = ?,sync_data = ?, via = ?, qc_status = ?  WHERE id = ?`;
                const updateValues = [data.regn_no, data.BookedData, 'QC', '1', qcMisRecord.id];
                await ggBaseQuery(sqlUpdate, updateValues);
                res.json({
                    status: true,
                    record_id: qcMisRecord.id,
                    message: "MIS QC data Re-Map successfully.",
                });
            } else {
                res.json({
                    status: false,
                    message: "MIS QC data Re-Map Unsuccessfull.",
                });
                return;
            }
        }
        const existingData = {
            mobile_number: data.mobile_number || "-",
            customer_email_id: data.customer_email_id || "-",
            point_of_sale: data.point_of_sale || "-",
            py_policy: data.py_policy || "-",
            policy_type: data.policy_type || "-",
            net_premium: data.net_premium || "-",
            gross_premium: data.gross_premium || "-",
            spot_to_customer: data.spot_to_customer || "-",
            sc_from_customer: data.sc_from_customer || "-",
            sc_to_office: data.sc_to_office || "-",
            issued_by: data.issued_by || "-",
            personal_accident: data.personal_accident || "-",
            pa_company: data.pa_company || "-",
            pa_amount: data.pa_amount || "-",
            cross_sell_opportunity: data.cross_sell_opportunity || "-",
            previous_document_type: data.previous_document_type || "-",
            vehicle_type: data.vehicle_type || "-",
            payment_mode: data.payment_mode || "-",
            issued_at: data.issued_at || "-",
        };
        data = { ...req.body,
            ...existingData
        };
        delete data.previous_document;
        delete data.vehicle_images;
        delete data.engine_chassis_no;
        delete data.odometer;
        delete data.chassis_number;
        delete data.payment_status;
        delete data.place_of_posting;
        delete data.vertical;
        const [userRecord] = await ggBaseQuery(`SELECT id  FROM users WHERE '${data.assigned_by}' LIKE CONCAT('%-', email_address) LIMIT 1`);
        console.log("+++++++");
        console.log(userRecord);
        console.log("+++++++");
        data.user_id = userRecord ? userRecord.id : 1;
        delete data.assigned_by;
        data.status = "1";
        data.qc_status = "1";
        data.via = "QC";
        data.regn_no = cleanVechileNo(data.reg_no);
        data.issued_date = data.issued_date || "-";
        delete data.reg_no;
        data.pa_payment = data.pa_payment || "-";
        data.motor_payment = data.motor_payment || "-";
        data.sc_payment = data.sc_payment || "-";
        data.sync_data = JSON.stringify(data.bookedData);
        delete data.bookedData;
        console.log(data);
        // Check if regn_no already exists
        const [existingRecord] = await ggBaseQuery(`SELECT id FROM mis_entries WHERE regn_no = ? LIMIT 1`, [data.regn_no]);
        if (existingRecord) {
            // Update existing record
            delete data.issued_date;
            const keysToCheck = ["mobile_number", "customer_email_id", "point_of_sale", "py_policy", "policy_type", "net_premium", "gross_premium", "spot_to_customer", "sc_from_customer", "sc_to_office", "issued_by", "personal_accident", "pa_company", "pa_amount", "cross_sell_opportunity", "previous_document_type", "vehicle_type", "payment_mode", "issued_at", ];
            // Iterate over each key and delete if its value is null, undefined, or "-"
            keysToCheck.forEach((key) => {
                if (!data[key] || data[key] === "0" || data[key] === "-") {
                    delete data[key];
                }
            });
            const updateFields = Object.keys(data).map((key) => `${key} = ?`).join(", ");
            const sqlUpdate = `UPDATE mis_entries SET ${updateFields}  WHERE id = ?`;
            const updateValues = [...Object.values(data), existingRecord.id];
            await ggBaseQuery(sqlUpdate, updateValues);
            res.json({
                status: true,
                record_id: existingRecord.id,
                message: "Record updated successfully.",
            });
            return;
        }
        if (!existingRecord) {
            // Insert new record if regn_no does not exist
            const keys = Object.keys(data);
            const values = Object.values(data);
            const sqlInsert = `INSERT INTO mis_entries (${keys.join(", ")}, created_at, deleted_at)
              VALUES (${Array(values.length).fill("?").join(", ")}, NOW(), NULL)`;
            const rows = await ggBaseQuery(sqlInsert, values);
            res.json({
                status: true,
                record_id: rows.insertId,
                message: "MIS QC data synced successfully.",
            });
        }
    } catch (error) {
        console.error(error);
        res.json({
            status: false,
            error: "Internal Server Error",
        });
    }
};
const getMisTLEntires = async (req, res) => {
    try {
        const {
            userId
        } = req.user;
        console.log("***************");
        console.log(userId);
        console.log("***************");
        const rsync = req.query.sync || false;
        console.log(req.query);
        const {
            filter
        } = req.query;
        const currentDate = moment().format("YYYY-MM-DD");
        let dateFilter = [currentDate, currentDate];
        if (filter) {
            const {
                date
            } = filter;
            console.log(date);
            dateFilter = filter.date.split(",");
            console.log(dateFilter);
        }
        // #PAGINATION MODULE
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = parseInt(req.query.limit) || 10; // Default limit is 10 per page
        const offset = (page - 1) * limit;
        // #PAGINATION MODULE
        const user_id = userId;
        const {
            vertical
        } = req.query;
        let misRecords = [];
        let misCurrentMOnthRecords = [];
        let misTotal = 0;
        const thisQry = [...thisSQL];
        // Retrieve user details from the database
        thisQry.push(["us.name as created_by"]);
        misRecords = await ggBaseQuery(`SELECT ${thisQry.join()}

FROM mis_entries ms
JOIN users us ON ms.user_id = us.id WHERE us.team_lead=? AND YEAR(ms.created_at) = YEAR(CURRENT_DATE())
  AND MONTH(ms.created_at) = MONTH(CURRENT_DATE()) ORDER BY ms.created_at DESC `, [user_id]);
        misCurrentMOnthRecords = await ggBaseQuery(`SELECT 
    COUNT(*) AS count
FROM mis_entries ms
JOIN users us ON ms.user_id = us.id WHERE us.team_lead=? AND YEAR(ms.created_at) = YEAR(CURRENT_DATE())
  AND MONTH(ms.created_at) = MONTH(CURRENT_DATE()) ORDER BY ms.created_at DESC`, [user_id]);
        console.log(misCurrentMOnthRecords);
        // SELECT * FROM mis_entries  ORDER BY created_at DESC
        const misRecordsData = misRecords.map(report => {
            if (report.qc_status === "1" && report.sync_data) {
                // Convert all keys in report and sync_data to lowercase
                const reportLower = Object.fromEntries(Object.entries(report).map(([key, value]) => [key.toLowerCase(), value]));
                const syncDataLower = Object.fromEntries(Object.entries(report.sync_data).map(([key, value]) => [key.toLowerCase(), value]));
                // Merge with priority to syncDataLower
                return { ...reportLower,
                    ...syncDataLower,
                    sync_data: undefined
                };
            }
            return Object.fromEntries(Object.entries(report).map(([key, value]) => [key.toLowerCase(), value])); // Keep as is with lowercase keys
        });
        res.send({
            status: true,
            data: misRecordsData,
            total: misTotal,
            limit: limit,
            month: misCurrentMOnthRecords[0]["count"],
        });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({
            status: false,
            data: [],
            message: "An error occurred",
        });
    }
};
export default {
    getMisDashboardFilter,
    getMisDashboard,
    getTlDashboard,
    getMisMakeModel,
    getMisOneRecord,
    getMisTLEntires,
    createMis,
    createMisNew,
    updateSettings,
    webSettings,
    getMisRecords,
    checkMisValidation,
    misSync,
    qcCheckImport,
    deleteMisRecords,
    getMisForMatchIds
};