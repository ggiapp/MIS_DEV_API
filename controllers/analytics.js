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
const fs = require("fs").promises;
const moment = require("moment");
const XLSX = require("xlsx");

const cleanVechileNo = (vechileNo) => vechileNo.replace(/[\\/\t\s\W]/g, "");
async function ensureDirectoryExists(directory) {
  try {
    await fs.access(directory);
  } catch (error) {
    await fs.mkdir(directory, {
      recursive: true,
    });
  }
}
// const GGcolors = [
//   'slate',
//   'gray',
//   'zinc',
//   'neutral',
//   'stone',
//   'red',
//   'orange',
//   'amber',
//   'yellow',
//   'lime',
//   'green',
//   'emerald',
//   'teal',
//   'cyan',
//   'sky',
//   'blue',
//   'indigo',
//   'violet',
//   'purple',
//   'fuchsia',
//   'pink',
//   'rose',
// ];
const GGcolors = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-gray-500",
  "bg-red-400",
  "bg-blue-400",
  "bg-green-400",
  "bg-yellow-400",
  "bg-purple-400",
  "bg-pink-400",
  "bg-indigo-400",
  "bg-teal-400",
  "bg-orange-400",
  "bg-gray-400",
  "bg-red-300",
  "bg-blue-300",
  "bg-green-300",
  "bg-yellow-300",
  "bg-purple-300",
];

function getRandomColors(count) {
  const selectedColors = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * GGcolors.length);
    selectedColors.push(GGcolors[randomIndex]);
  }
  return selectedColors;
}
// #  ANALYTICS & UTILITIES
const getDaysInMonth = (year, month) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};
const calculateAverage = (data, year, month) => {
  const daysInMonth = getDaysInMonth(year, month); // Get all days in the month
  const completedDays = daysInMonth.filter((day) => day <= new Date()); // Only include completed days
  const completedSundays = completedDays.filter((day) => day.getDay() === 0); // Get all completed Sundays
  const totalScore = data.reduce((acc, item) => acc + item.count, 0);
  const average = totalScore / (completedDays.length - completedSundays.length);
  return average;
};
// #  ANALYTICS & UTILITIES
// const getReports = async (req, res) => {
//     try {
//         console.log(req);
//         res.send({
//             status: true,
//             data: [],
//             counts: []
//         });
//     } catch(err){
//         res.send({
//             status: false,
//             data: [],
//             counts: []
//         });
//     }
// }
const getCompanyTlReports = async (req, res) => {
  let query = ``;
  try {
    const { chart_type, date_type, chart_count } = req.query;
    const { date_range } = req;
    const { userId } = req.user;
    console.log("$$$$$$$$$$$$$$");
    console.log(userId);
    console.log("$$$$$$$$$$$$$$");
    const StartRange = moment(date_range, "YYYY-MM-DD")
      .startOf(date_type)
      .format("YYYY-MM-DD");
    const EndRange = moment(date_range, "YYYY-MM-DD")
      .endOf(date_type)
      .format("YYYY-MM-DD");
    query = `SELECT 
    DATE_FORMAT(d.date, '%d') AS date,
     `;
    let results = [];
    let caseStatements = [];
    if (userId === 1 || userId === 208) {
      results = await ggBaseQuery(
        `SELECT DISTINCT name,id FROM users WHERE  designation ='Asst Mgr / Team Leader'`
      );
      caseStatements = results.map((tl) => {
        return `COALESCE(SUM(CASE WHEN i.user_id IN (SELECT id FROM users WHERE team_lead = ${tl.id}) OR i.user_id = ${tl.id} THEN 1 END), 0) AS "${tl.name}"`;
      });
    } else {
      results = await ggBaseQuery(
        `SELECT DISTINCT name, id FROM users WHERE (team_lead = ? AND status = 1) OR id= ?`,
        [userId,userId]
      );
      console.log(results);
      // const companies = results.map(row => row[chart_type.split(".")[1]].trim());
      // console.log(companies);
      // Start building the SQL query dynamically
      // COALESCE(COUNT(i.issued_date), 0) AS Total,
      const ChartCountVar = chart_count ? chart_count : 1;
      caseStatements = results.map((company) => {
        return `COALESCE(SUM(CASE WHEN ${chart_type} = '${company.name}' THEN ${ChartCountVar} ELSE 0 END), 0) AS "${company.name}"`;
      });
    }
    query += caseStatements.join(", ");
    // #NEW AVG  QUERY
    //     query +=` ,
    //    (
    //     (SELECT COUNT(*) FROM mis_entries WHERE STR_TO_DATE(issued_date, '%d-%m-%Y') BETWEEN '${StartRange}' AND '${EndRange}')
    //     /
    //     (SELECT COUNT(*) FROM
    //         (
    //             SELECT
    //                 DATE_ADD('${StartRange}', INTERVAL n.n DAY) AS date
    //             FROM
    //                 (SELECT a.N + b.N * 10 + c.N * 100 AS n
    //                  FROM
    //                    (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
    //                    (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
    //                    (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
    //                 ) n
    //             WHERE n.n <= 30
    //             AND DAYOFWEEK(DATE_ADD('${StartRange}', INTERVAL n.n DAY)) != 1  -- Exclude Sundays
    //         ) AS completed_days
    //     )
    // ) AS avg `;
    if (date_type === "year") {
      query += ` FROM (
                SELECT 
                    DATE_ADD('${StartRange}', INTERVAL n.n DAY) AS date
                FROM 
                    (SELECT a.N + b.N * 10 + c.N * 100 + d.N * 1000 AS n
                 FROM 
                   (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
                   (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
                   (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c,
                   (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d
                ) n
            WHERE 
                n.n <= 365
            ) d
        LEFT JOIN 
            mis_entries i ON STR_TO_DATE(i.issued_date, '%d-%m-%Y') = d.date
        GROUP BY 
            d.date
        ORDER BY 
            d.date ASC`;
    } else {
      query += ` FROM 
    (
        SELECT 
            DATE_ADD('${StartRange}', INTERVAL n.n DAY) AS date
        FROM 
            (SELECT a.N + b.N * 10 + c.N * 100 AS n
             FROM 
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
            ) n
        WHERE 
            n.n <= 30
    ) d
LEFT JOIN 
    mis_entries i ON STR_TO_DATE(i.issued_date, '%d-%m-%Y') = d.date  
            LEFT JOIN users us ON i.user_id = us.id
GROUP BY 
    d.date
ORDER BY 
    d.date ASC`;
    }
    console.log("Generated Query:", query);
    // Optionally execute the generated query
    const data = await ggBaseQuery(query);
    let thisColumns = data[0];
    // delete thisColumns.date;
    delete thisColumns.date;
    let thisCounts = Object.keys(thisColumns);
    thisCounts = thisCounts.map((key) => ({
      name: key,
      total: data.reduce((sum, item) => sum + parseInt(item[key]), 0),
      color: getRandomColors(1)[0],
    }));
    // const averageScore = calculateAverage(transformedData, 2024, 8);
    // const transformedData = data.flatMap(entry => {
    //     if(entry.date && entry.date!== undefined){
    //         return Object.keys(entry).filter(key => key !== 'date' && key !== 'avg' ).map(key => ({
    //             date: entry.date,
    //             label: key,
    //             count: parseInt(entry[key], 10),
    //             // average:parseInt(entry.avg, 10)
    //         }));
    //     }
    // });
    const transformedData = data
      .flatMap((entry) => {
        if (entry.date && entry.date !== undefined) {
          return Object.keys(entry)
            .filter(
              (key) =>
                key !== "date" &&
                key !== "avg" &&
                entry[key] !== null &&
                entry[key] !== undefined
            )
            .map((key) => ({
              date: entry.date,
              label: key,
              count: parseInt(entry[key], 10),
            }));
        }
      })
      .filter((item) => item !== null && item !== undefined);
    data.forEach((item) => {
      for (let key in item) {
        if (key !== "date") {
          item[key] = parseInt(item[key], 10);
        }
      }
    });
    // const averageLineData = transformedData
    //   .filter((item, index, self) => self.findIndex(i => i.date === item.date) === index) // Ensure unique dates
    //   .map(item => ({
    //     date: item.date,
    //     label: 'Average',
    //     count: averageScore,
    //   }));
    res.send({
      status: true,
      data: transformedData,
      counts: thisCounts,
      Avg: data,
      query: query,
    });
  } catch (err) {
    console.warn(err);
    console.log(err);
    res.send({
      status: false,
      data: [],
      counts: [],
      sqlQuery: query,
    });
  }
};
const getTlData = async (req, res) => {
  try {
    const { date_range, chart_type, date_type } = req.query;
    const { userId } = req.user;
    let currentYearMonth;
    if (date_type === "year") {
      currentYearMonth = moment(date_range, "YYYY-MM")
        .startOf("year")
        .format("YYYY-MM-DD");
    } else {
      currentYearMonth =
        (date_range ? date_range : moment().format("YYYY-MM")) + "-01";
    }
    req.date_range = currentYearMonth;
    // COMPANY REPORTS
    if (chart_type && chart_type !== "") {
      await getCompanyTlReports(req, res);
      //         const results = await ggBaseQuery(`SELECT DISTINCT name,id FROM users WHERE  designation ='Asst Mgr / Team Leader'`);
      //         const caseStatements = results.map(tl => {
      //             return `COUNT(CASE WHEN user_id IN (SELECT id FROM users WHERE team_lead = ${tl.id}) THEN 1 END) +
      // COUNT(CASE WHEN user_id = ${tl.id} THEN 1 END) AS "${tl.name}"`;
      //         });
      //         let sqlQuery = `SELECT`;
      //         sqlQuery += caseStatements.join(', ');
      //         sqlQuery += `FROM mis_entries ms`;
      //         res.send({
      //             status: true,
      //             data: [],
      //             counts: 0,
      //             Avg: [],
      //             query: sqlQuery
      //         });
      return;
    }
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({
      status: false,
      message: "An error occurred",
    });
  }
};

const getQcApprovedLIst = async (dateFilter,qc_status) => {
   // SELECT ir.* FROM mis_entries ir
   //  WHERE STR_TO_DATE(ir.issued_date, '%d-%m-%Y') BETWEEN '${dateFilter[0]}' AND '${dateFilter[1]}' AND  ir.qc_status = '${qc_status}'
   //  GROUP BY ir.regn_no
  
  const sqlQcQuery = `
    SELECT 
  MAX(ir.id) AS id,
  ir.regn_no,
  MAX(ir.customer_name) AS customer_name,
  MAX(ir.qc_status) AS qc_status,
  MAX(ir.issued_date) AS issued_date
  -- Add other columns as needed
FROM mis_entries ir
WHERE 
  STR_TO_DATE(ir.issued_date, '%d-%m-%Y') BETWEEN '${dateFilter[0]}' AND '${dateFilter[1]}'
  AND ir.qc_status = '${qc_status}'
GROUP BY ir.regn_no;

`;

  const qcMiseData = await ggBaseQuery(sqlQcQuery);
  return qcMiseData;
};
const qcCheckReports = async (req, res) => {
  const dsr_type = "ICICI DSR";
  const refMatchKey =
    dsr_type === "ICICI DSR" ? "REGISTRATION_NUMBER" : "VechileNo";
  try {
    const { date_range } = req.body;

    const dateFilter = date_range.split(",");

    if (!req.files || !req.files.file) {
      return res.status(400).send("No files were uploaded.");
    }

    const file = req.files.file;
    const workbook = XLSX.read(file.data, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    let excelData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const bookedTotal = excelData.length;

    // const QcvehicleNos = new Set(excelData.map(row => cleanVechileNo(row[refMatchKey])));

    // const QCvehicleNosQuery = [...QcvehicleNos].map(vn => `SELECT '${vn}' AS vehicle_no`).join(" UNION ALL ");
    // const vehicleNosQc = excelData.map((row) => cleanVechileNo(row[refMatchKey]));

    //     const sqlQcQuery = `
    //     SELECT ir.* FROM mis_entries ir

    //     WHERE STR_TO_DATE(ir.issued_date, '%d-%m-%Y') BETWEEN '${dateFilter[0]}' AND '${dateFilter[1]}' AND  ir.qc_status = '1'

    //     GROUP BY ir.regn_no
    // `;

    let qcMiseData = await getQcApprovedLIst(dateFilter,'1');

    const qcvehicleNos = new Set(
      qcMiseData.map((row) => cleanVechileNo(row.regn_no))
    );

    console.log(qcvehicleNos);

    console.log(excelData.length);
    excelData = excelData.filter(
      (excelItem) => !qcvehicleNos.has(excelItem[refMatchKey])
    );

    console.log(excelData.length);

    const vehicleNos = new Set(
      excelData.map((row) => cleanVechileNo(row[refMatchKey]))
    );

    const vehicleNosQuery = [...vehicleNos]
      .map((vn) => `SELECT '${vn}' AS vehicle_no`)
      .join(" UNION ALL ");

    const sqlQuery = `
            SELECT ir.* FROM mis_entries ir
            JOIN (
                ${vehicleNosQuery}
            ) t ON REGEXP_REPLACE(ir.regn_no, '[^A-Za-z0-9]', '') = t.vehicle_no
            WHERE STR_TO_DATE(ir.issued_date, '%d-%m-%Y') BETWEEN '${dateFilter[0]}' AND '${dateFilter[1]}'
          AND  ir.qc_status = '0'
            ORDER BY ir.issued_date DESC
        `;

    const misData = await ggBaseQuery(sqlQuery);

    console.log(misData.length);

    const vehicleDBNos = new Set(
      misData.map((row) => cleanVechileNo(row.regn_no))
    );

    const matchedExcelRecords = excelData.filter((excelItem) =>
      vehicleDBNos.has(cleanVechileNo(excelItem[refMatchKey]))
    );
    const notMatchedExcelRecords = excelData.filter(
      (excelItem) => !vehicleDBNos.has(cleanVechileNo(excelItem[refMatchKey]))
    );

    const matchedMisRecords = misData.filter((jsonItem) =>
      vehicleNos.has(cleanVechileNo(jsonItem.regn_no))
    );
    let notMatchedMisRecords = misData.filter(
      (jsonItem) => !vehicleNos.has(cleanVechileNo(jsonItem.regn_no))
    );

    const matchedVehicleIds = matchedMisRecords.map((row) => row.id);

    // if (matchedVehicleIds.length) {
    //   const updates = matchedMisRecords
    //     .map(
    //       (row) =>
    //         `(${row.id}, '1', '${JSON.stringify(
    //           excelData.find(
    //             (item) =>
    //               cleanVechileNo(item[refMatchKey]) ===
    //               cleanVechileNo(row.regn_no)
    //           )
    //         )}')`
    //     )
    //     .join(", ");
    //   await ggBaseQuery(
    //     `INSERT INTO mis_entries (id, qc_status, sync_data) VALUES ${updates} ON DUPLICATE KEY UPDATE qc_status = VALUES(qc_status), sync_data = VALUES(sync_data)`
    //   );
    // }

    if (matchedVehicleIds.length) {
      const updates = matchedMisRecords
        .map((row) => {
          const matchingExcelData = excelData.find(
            (item) =>
              cleanVechileNo(item[refMatchKey]) === cleanVechileNo(row.regn_no)
          );

          // Ensure the matching data is valid and stringify it safely
          const syncData = matchingExcelData
            ? JSON.stringify(matchingExcelData)
                .replace(/\\/g, "\\\\")
                .replace(/'/g, "\\'")
            : "{}";

          return `(${row.id}, '1', '${syncData}')`;
        })
        .join(", ");

      // Execute the query only if updates are generated
      if (updates) {
        await ggBaseQuery(
          `INSERT INTO mis_entries (id, qc_status, sync_data) VALUES ${updates} 
       ON DUPLICATE KEY UPDATE 
         qc_status = VALUES(qc_status), 
         sync_data = VALUES(sync_data)`
        );
      }
    }

    const syncedMisCount = misData.filter(
      (row) => row.qc_status === "1"
    ).length;
    const noSyncedMisCount = misData.filter(
      (row) => row.qc_status === "0"
    ).length;

    qcMiseData = await getQcApprovedLIst(dateFilter,'0');

    notMatchedMisRecords = qcMiseData.filter(
      (jsonItem) => !vehicleNos.has(cleanVechileNo(jsonItem.regn_no))
    );

    res.json({
      status: true,
      mis_data: notMatchedMisRecords,
      excel_data: matchedExcelRecords.length ? matchedExcelRecords : excelData,
      un_matched: notMatchedExcelRecords,
      mis_synced: qcMiseData.length,
      mis_unsynced: matchedExcelRecords.length,
      excel_data_total: excelData.length,
      qc_misdata: qcMiseData,
      booked_total: bookedTotal,
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.json({ status: false, data: error });
  }
};

const getCompanyReports = async (req, res) => {
  try {
    const { chart_type, date_type, chart_count } = req.query;
    const { date_range } = req;
    const { userId } = req.user;
    console.log("$$$$$$$$$$$$$$");
    console.log(userId);
    console.log("$$$$$$$$$$$$$$");
    const StartRange = moment(date_range, "YYYY-MM-DD")
      .startOf(date_type)
      .format("YYYY-MM-DD");
    const EndRange = moment(date_range, "YYYY-MM-DD")
      .endOf(date_type)
      .format("YYYY-MM-DD");
    let query = `SELECT 
    DATE_FORMAT(d.date, '%d') AS date,
     `;
    let results = [];
    if (chart_type === "vertical" || chart_type === "place_of_posting") {
      results = await ggBaseQuery(`SELECT DISTINCT ${chart_type} 
            FROM users 
            WHERE ${chart_type} IS NOT NULL 
              AND ${chart_type} != 'admin'
              AND ${chart_type} != 'super';
            `);
    } else {
      results = await ggBaseQuery(
        `SELECT DISTINCT ${chart_type} FROM mis_entries`
      );
    }
    console.log(results);
    const companies = results.map((row) => row[chart_type]);
    console.log(companies);
    // Start building the SQL query dynamically
    // COALESCE(COUNT(i.issued_date), 0) AS Total,
    const ChartCountVar = chart_count ? chart_count : 1;
    let caseStatements = ``;
    if (chart_type === "vertical" || chart_type === "place_of_posting") {
      caseStatements = companies.map((company) => {
        return `COALESCE(SUM(CASE WHEN us.${chart_type} = '${company}' THEN ${ChartCountVar} ELSE 0 END), 0) AS "${company}"`;
      });
    } else {
      caseStatements = companies.map((company) => {
        return `COALESCE(SUM(CASE WHEN ${chart_type} = '${company}' THEN ${ChartCountVar} ELSE 0 END), 0) AS "${company}"`;
      });
    }
    query += caseStatements.join(", ");
    // #NEW AVG  QUERY
    //     query +=` ,
    //    (
    //     (SELECT COUNT(*) FROM mis_entries WHERE STR_TO_DATE(issued_date, '%d-%m-%Y') BETWEEN '${StartRange}' AND '${EndRange}')
    //     /
    //     (SELECT COUNT(*) FROM
    //         (
    //             SELECT
    //                 DATE_ADD('${StartRange}', INTERVAL n.n DAY) AS date
    //             FROM
    //                 (SELECT a.N + b.N * 10 + c.N * 100 AS n
    //                  FROM
    //                    (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
    //                    (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
    //                    (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
    //                 ) n
    //             WHERE n.n <= 30
    //             AND DAYOFWEEK(DATE_ADD('${StartRange}', INTERVAL n.n DAY)) != 1  -- Exclude Sundays
    //         ) AS completed_days
    //     )
    // ) AS avg `;
    if (date_type === "year") {
      query += ` FROM (
                SELECT 
                    DATE_ADD('${StartRange}', INTERVAL n.n DAY) AS date
                FROM 
                    (SELECT a.N + b.N * 10 + c.N * 100 + d.N * 1000 AS n
                 FROM 
                   (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
                   (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
                   (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c,
                   (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d
                ) n
            WHERE 
                n.n <= 365
            ) d
        LEFT JOIN 
            mis_entries i ON STR_TO_DATE(i.issued_date, '%d-%m-%Y') = d.date
        GROUP BY 
            d.date
        ORDER BY 
            d.date ASC`;
    } else {
      query += ` FROM 
    (
        SELECT 
            DATE_ADD('${StartRange}', INTERVAL n.n DAY) AS date
        FROM 
            (SELECT a.N + b.N * 10 + c.N * 100 AS n
             FROM 
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
            ) n
        WHERE 
            n.n <= 30
    ) d
LEFT JOIN 
    mis_entries i ON STR_TO_DATE(i.issued_date, '%d-%m-%Y') = d.date `;
      if (chart_type === "vertical" || chart_type === "place_of_posting") {
        query += `LEFT JOIN users us ON i.user_id = us.id`;
      }
      query += ` 
GROUP BY 
    d.date
ORDER BY 
    d.date ASC`;
    }
    console.log("Generated Query:", query);
    // Optionally execute the generated query
    const data = await ggBaseQuery(query);
    let thisColumns = data[0];
    // delete thisColumns.date;
    delete thisColumns.date;
    let thisCounts = Object.keys(thisColumns);
    thisCounts = thisCounts.map((key) => ({
      name: key,
      total: data.reduce((sum, item) => sum + parseInt(item[key]), 0),
      color: getRandomColors(1)[0],
    }));
    // const averageScore = calculateAverage(transformedData, 2024, 8);
    // const transformedData = data.flatMap(entry => {
    //     if(entry.date && entry.date!== undefined){
    //         return Object.keys(entry).filter(key => key !== 'date' && key !== 'avg' ).map(key => ({
    //             date: entry.date,
    //             label: key,
    //             count: parseInt(entry[key], 10),
    //             // average:parseInt(entry.avg, 10)
    //         }));
    //     }
    // });
    const transformedData = data
      .flatMap((entry) => {
        if (entry.date && entry.date !== undefined) {
          return Object.keys(entry)
            .filter(
              (key) =>
                key !== "date" &&
                key !== "avg" &&
                entry[key] !== null &&
                entry[key] !== undefined
            )
            .map((key) => ({
              date: entry.date,
              label: key,
              count: parseInt(entry[key], 10),
            }));
        }
      })
      .filter((item) => item !== null && item !== undefined);
    data.forEach((item) => {
      for (let key in item) {
        if (key !== "date") {
          item[key] = parseInt(item[key], 10);
        }
      }
    });
    // const averageLineData = transformedData
    //   .filter((item, index, self) => self.findIndex(i => i.date === item.date) === index) // Ensure unique dates
    //   .map(item => ({
    //     date: item.date,
    //     label: 'Average',
    //     count: averageScore,
    //   }));
    res.send({
      status: true,
      data: transformedData,
      counts: thisCounts,
      Avg: data,
      query: query,
    });
  } catch (err) {
    console.log(err);
    res.send({
      status: false,
      data: [],
      counts: [],
    });
  }
};
const getData = async (req, res) => {
  try {
    const { date_range, chart_type, date_type } = req.query;
    let currentYearMonth;
    if (date_type === "year") {
      currentYearMonth = moment(date_range, "YYYY-MM")
        .startOf("year")
        .format("YYYY-MM-DD");
    } else {
      currentYearMonth =
        (date_range ? date_range : moment().format("YYYY-MM")) + "-01";
    }
    req.date_range = currentYearMonth;
    // COMPANY REPORTS
    if (chart_type && chart_type !== "") {
      await getCompanyReports(req, res);
      return;
    }
    // POCLIY TYPE REPORTS
    const rows = await ggBaseQuery(`
            SELECT 
    DATE_FORMAT(d.date, '%b %e') AS date,
    COALESCE(COUNT(i.issued_date), 0) AS Total,
    COALESCE(SUM(CASE WHEN i.policy_type = 'OD' THEN 1 ELSE 0 END), 0) AS OD,
    COALESCE(SUM(CASE WHEN i.policy_type = 'TP' THEN 1 ELSE 0 END), 0) AS TP,
    COALESCE(SUM(CASE WHEN i.policy_type = 'Comprehensive' THEN 1 ELSE 0 END), 0) AS Comprehensive

FROM 
    (
        SELECT 
            DATE_FORMAT(DATE_ADD('${currentYearMonth}', INTERVAL n.n DAY), '%Y-%m-%d') AS date
        FROM 
            (SELECT a.N + b.N * 10 + c.N * 100 AS n
             FROM 
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
               (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
            ) n
        WHERE 
            n.n <= 30
    ) d
LEFT JOIN 
    mis_entries i ON STR_TO_DATE(i.issued_date, '%d-%m-%Y') = d.date
GROUP BY 
    d.date
ORDER BY 
    d.date ASC
            `);
    // const institutionLists = rows.map(row => {
    //  date:data,
    //  OD: row.OD,
    //  TP: row.TP
    // });
    const updatedData = rows.map((item) => ({
      date: item.date,
      OD: parseInt(item.OD),
      TP: parseInt(item.TP),
      Comprehensive: parseInt(item.Comprehensive),
      // Total:parseInt(item.total_count),
    }));
    const thisColumns = rows[0];
    delete thisColumns.date;
    let thisCounts = Object.keys(rows[0]);
    thisCounts = thisCounts.map((key) => ({
      name: key,
      total: rows.reduce((sum, item) => sum + parseInt(item[key]), 0),
      color: getRandomColors(1)[0],
    }));
    res.send({
      status: true,
      data: updatedData,
      counts: thisCounts,
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({
      status: false,
      message: "An error occurred",
    });
  }
};
const bisData = async (req, res) => {
  try {
    // console.log(req);
    const result = await ggBaseQuery(
      `SELECT DISTINCT name, vertical, place_of_posting FROM users WHERE is_deleted!=1`
    );
    const filteredResult = result.filter(
      (item) => item.name && item.place_of_posting && item.vertical
    );
    const mappedResult = {
      name: [...new Set(filteredResult.map((item) => item.name))].map(
        (value) => ({
          value,
        })
      ),
      location: [
        ...new Set(filteredResult.map((item) => item.place_of_posting)),
      ].map((value) => ({
        value,
      })),
      vertical: [...new Set(filteredResult.map((item) => item.vertical))].map(
        (value) => ({
          value,
        })
      ),
    };
    res.send({
      status: true,
      data: mappedResult,
      counts: [],
    });
  } catch (err) {
    res.send({
      status: false,
      data: [],
      counts: [],
    });
  }
};
const bisReports = async (req, res) => {
  try {
    const { query } = req;
    console.log(query);
    const { dateRange, vertical, location, EmployeeName } = req.query;
    let [fromDate, toDate] = dateRange.split(",");
    fromDate = fromDate;
    toDate = toDate;
    let sqlQuery = `
        SELECT

COALESCE(SUM(CASE WHEN users.vertical = 'TeleCaller' THEN 1 ELSE 0 END), 0) AS teleCaller_count,
COALESCE(SUM(CASE WHEN users.vertical = 'Bunk' THEN 1 ELSE 0 END), 0) AS bunk_count,
COALESCE(SUM(CASE WHEN users.vertical = 'Agency' THEN 1 ELSE 0 END), 0) AS agency_count,
COALESCE(SUM(CASE WHEN users.vertical = 'Direct' THEN 1 ELSE 0 END), 0) AS direct_count,

COALESCE(SUM(CASE WHEN users.vertical = 'TeleCaller' THEN mi.gross_premium ELSE 0 END), 0) AS teleCaller_amount,
COALESCE(SUM(CASE WHEN users.vertical = 'Bunk' THEN mi.gross_premium ELSE 0 END), 0) AS bunk_amount,
COALESCE(SUM(CASE WHEN users.vertical = 'Agency' THEN mi.gross_premium ELSE 0 END), 0) AS agency_amount,
COALESCE(SUM(CASE WHEN users.vertical = 'Direct' THEN mi.gross_premium ELSE 0 END), 0) AS direct_amount,

COALESCE(SUM(CASE WHEN mi.policy_type = 'OD' THEN 1 ELSE 0 END), 0) AS OD,
COALESCE(SUM(CASE WHEN mi.policy_type = 'TP' THEN 1 ELSE 0 END), 0) AS TP,
COALESCE(SUM(CASE WHEN mi.policy_type = 'Comprehensive' THEN 1 ELSE 0 END), 0) AS Comprehensive,


COALESCE(SUM(CASE WHEN mi.motor_payment = 'Online' THEN 1 ELSE 0 END), 0) AS motor_payment_online,
COALESCE(SUM(CASE WHEN mi.motor_payment = 'UPI' THEN 1 ELSE 0 END), 0) AS motor_payment_upi,

COALESCE(SUM(CASE WHEN mi.py_policy = 'Live' THEN 1 ELSE 0 END), 0) AS py_policy_live,
COALESCE(SUM(CASE WHEN mi.py_policy = 'Expired' THEN 1 ELSE 0 END), 0) AS py_policy_expired,

SUM(COALESCE(mi.net_premium, 0)) AS net_premium,
SUM(COALESCE(mi.tp_premium, 0)) AS tp_total_amount,
SUM(COALESCE(mi.gross_premium, 0)) AS gross_total_amount,
SUM(COALESCE(mi.od_premium, 0)) AS od_total_amount,
SUM(COALESCE(mi.pa_amount, 0)) AS pa_total_amount
    
FROM mis_entries mi
 JOIN users ON mi.user_id = users.id
WHERE  

STR_TO_DATE(mi.issued_date, '%d-%m-%Y') BETWEEN '${fromDate}' AND '${toDate}'

`;
    if (vertical && vertical !== "undefined") {
      const verticalSet = vertical
        .split(",")
        .map((city) => `'${city}'`)
        .join(", ");
      console.log(verticalSet);
      sqlQuery += ` AND users.vertical IN(${verticalSet}) `;
      // sqlQuery += ` AND users.vertical = '${vertical}'`;
    }
    if (location && location !== "undefined") {
      const locationSet = location
        .split(",")
        .map((city) => `'${city}'`)
        .join(", ");
      console.log(locationSet);
      // sqlQuery += ` AND users.place_of_posting = '${location}'`;
      sqlQuery += ` AND users.place_of_posting IN(${locationSet}) `;
    }
    if (EmployeeName && EmployeeName !== "undefined") {
      // sqlQuery += ` AND users.name = '${EmployeeName}'`;
      const EmployeeNameSet = EmployeeName.split(",")
        .map((city) => `'${city}'`)
        .join(", ");
      sqlQuery += ` AND users.name IN(${EmployeeNameSet})`;
    }
    console.log(sqlQuery);
    const result = await ggBaseQuery(sqlQuery);
    res.send({
      status: true,
      data: result[0],
      counts: [],
    });
  } catch (err) {
    console.log(err);
    res.send({
      status: false,
      data: [],
      counts: [],
    });
  }
};

export default {
  getData,
  bisData,
  bisReports,
  getTlData,
  qcCheckReports,
};
