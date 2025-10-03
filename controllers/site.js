import {
    ggBaseQuery,
    uploadBasePath,
    PublicBasePath,
    replaceBasePath
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


const index = async (req, res) => {
  try {
        const userId = 1;
        // Retrieve user details from the database
        const settings = await ggBaseQuery('SELECT * FROM settings WHERE id = ?', [userId]);

        const rows = await ggBaseQuery('SELECT CONCAT(name, "-", city) AS institution_list FROM institutions  ORDER BY name ASC');
        const institutionLists = rows.map(row => row.institution_list);

       

        res.send({
            status: true,
            data: settings[0],
            institution_list:institutionLists
        });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({
            status: false,
            message: 'An error occurred'
        });
    }
};


const update = async (req, res) => {
  try {

    const reqParams = req.body;
    const updateQuery = `
  UPDATE settings
  SET 
    colors = ?,
    form_doc_types = ?,
    form_kyc_types = ?,
    form_types = ?,
    institution = ?,
    logo = ?,
    meta_data = ?,
    site_description = ?,
    site_name = ?,
    terms = ?,
    token_time = ?
  WHERE id = ?;`;

  console.log(reqParams);

  const values = Object.values(reqParams);
    values.push(1);

        // Retrieve user details from the database
        const settings = await ggBaseQuery(updateQuery, values);

        console.log(settings);
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

export default {
    index,
    update
};