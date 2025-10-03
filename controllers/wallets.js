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
const index = async (req, res) => {
    try {
        const {
            userId
        } = req.user;
        const quotes = await ggBaseQuery(`
            SELECT * FROM transactions
        WHERE
          agent_id = ?
        ORDER BY created_at DESC
        `, [userId]);
        // extra options
        const thisOptionsQuery = `Select form_types,form_doc_types,form_kyc_types  from settings where id =1`;
        let optionsRows = await ggBaseQuery(thisOptionsQuery);
        const {
            wallet_balance
        } = await checkWalletBalance(userId);
        res.status(200).send({
            status: true,
            results: quotes,
            total_recodes: quotes.length,
            current_balance: wallet_balance,
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
const checkWalletBalance = async (userId) => {
    try {
        const [thisWalletQuery] = await ggBaseQuery(`SELECT
            u.id,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) 
    + COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM'  AND t.status ='1' THEN t.amount ELSE 0 END), 0) AS wallet_balance
FROM
    users u
LEFT JOIN 
    transactions t ON u.id = t.agent_id
WHERE
    u.id = ?
GROUP BY
    u.id;
`, [userId]);
        console.log(thisWalletQuery);
        return thisWalletQuery;
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
}
const add = async (req, res) => {
    try {
        const {
            agent_id,
            issued_by,
            transaction_type,
            amount,
            remarks,
            role,
            status
        } = req.body;
        console.log(req.body);
        const {
            userId
        } = req.user;
        const {
            wallet_balance
        } = await checkWalletBalance(userId);
        if (amount <= wallet_balance) {
            const ReqParams = [(role == "agent" ? userId : agent_id), userId, (role == "agent" ? "CLAIM" : transaction_type), amount, remarks, ((role == "agent" ? "0" : "1"))];
            console.log(ReqParams);
            const result = await ggBaseQuery('INSERT INTO transactions (agent_id, issued_by, transaction_type, amount, remarks,status) VALUES (?, ?, ?, ?, ?,? )', ReqParams);
            res.status(200).json({
                status: true,
                message: "Wallet CLAIM initiated Sucessfully.",
                ...req.body
            });
        } else {
            res.status(200).json({
                status: false,
                message: "Insufficient Wallet.",
                ...req.body
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
};
const addAdminWallet = async (req, res) => {
    try {
        const {
            agent_id,
            issued_by,
            transaction_type,
            amount,
            remarks,
            role,
            status
        } = req.body;
        console.log(req.body);
        const {
            userId
        } = req.user;
        const {
            wallet_balance
        } = await checkWalletBalance(userId);
        const ReqParams = [(role == "agent" ? userId : agent_id), userId, (role == "agent" ? "CLAIM" : transaction_type), amount, remarks, ((role == "agent" ? "0" : "1"))];
        console.log(ReqParams);
        const result = await ggBaseQuery('INSERT INTO transactions (agent_id, issued_by, transaction_type, amount, remarks,status) VALUES (?, ?, ?, ?, ?,? )', ReqParams);
        res.status(200).json({
            status: true,
            message: "wallet initiated Sucessfully.",
            ...req.body
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
};
const view = async (req, res) => {
    try {
        const leadId = req.params.id;
        // Retrieve lead information from the database
        const quoteData = await ggBaseQuery(`SELECT * from transactions WHERE id = ?`, [leadId]);
        if (!quoteData || quoteData.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Transactions not found.'
            });
        }
        // Extract relevant lead details
        const dataInfo = quoteData[0];
        dataInfo.document = (dataInfo.document ? path.join(PublicBasePath, dataInfo.document) : "");
        dataInfo.public_path = PublicBasePath;
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
const adminWallet = async (req, res) => {
    const {
        startDate,
        endDate
    } = req.query;
    console.log(req.query);
    // console.log(req);
    // console.log(req.params);
    // console.log(req.body);
    console.log(startDate, endDate);
    try {
        //         const wallet = await ggBaseQuery(`
        // SELECT  u.name,u.upi,u.institution,t.*
        // FROM transactions t
        // LEFT JOIN users u ON u.id = t.agent_id 
        // ORDER BY t.created_at DESC;
        //         `);
        let query = `
    SELECT  u.name, u.upi, u.institution, t.*
    FROM transactions t
    LEFT JOIN users u ON u.id = t.agent_id
`;
        const queryParams = [];
      
        if (startDate && endDate) {
            const startDateFull = startDate;
            const endDateFull = endDate;
            query += ` WHERE t.created_at BETWEEN ? AND ?`;
            queryParams.push(startDateFull, endDateFull);
        }

        query += ` ORDER BY t.created_at DESC;`;


        // console.log(query);
        const wallet = await ggBaseQuery(query, queryParams);
        //     const overallCount = await ggBaseQuery(`SELECT COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) AS incentive_amount,
        // COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0) AS claim_amount,
        // COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION'  THEN t.amount ELSE 0 END), 0) AS commission_amount,
        // (COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) 
        // + COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0)
        // - COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0)) AS wallet_balance from  transactions t`);
        let overallCountQuery = `
    SELECT COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) AS incentive_amount,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0) AS claim_amount,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0) AS commission_amount,
    (COALESCE(SUM(CASE WHEN t.transaction_type = 'INCENTIVE' THEN t.amount ELSE 0 END), 0) 
    + COALESCE(SUM(CASE WHEN t.transaction_type = 'COMMISSION' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.transaction_type = 'CLAIM' AND t.status ='1' THEN t.amount ELSE 0 END), 0)) AS wallet_balance
    FROM transactions t
`;
        const overallCountParams = [];
        if (startDate && endDate) {
            const startDateFull = startDate;
            const endDateFull = endDate;
            overallCountQuery += ` WHERE t.created_at BETWEEN ? AND ?`;
            overallCountParams.push(startDateFull, endDateFull);
        }
        const overallCount = await ggBaseQuery(overallCountQuery, overallCountParams);
        res.status(200).send({
            status: true,
            results: wallet,
            overallCount: overallCount[0],
            total_recodes: wallet.length
        });
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
const walletUpate = async (req, res) => {
    try {
        const reqBody = req.body;
        const result = await ggBaseQuery(`
            UPDATE transactions
            SET
                remarks= ?,
                status = ?
            WHERE id = ?
        `, [reqBody.remarks, reqBody.status, req.params.id]);
        res.status(200).json({
            status: true,
            message: 'status updated Sucessfully.'
        });
    } catch (error) {
        console.error('Error updating quote:', error);
        res.status(500).json({
            status: false,
            error: 'Internal Server Error'
        });
    }
};
export default {
    index,
    add,
    addAdminWallet,
    walletUpate,
    view,
    adminWallet
};