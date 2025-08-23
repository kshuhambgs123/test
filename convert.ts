const xlsx = require('xlsx');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const workbook = xlsx.readFile('industries.xlsx');
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

// const jsonOutput = data.map((row) => ({
//   industry_id: String(row.id || row.ID || row.Industry_ID).trim(),
//   display_name: String(row.display_name || row.Display_Name).trim(),
//   cleaned_name: String(row.display_name || row.Display_Name).trim()
// }));


// fs.writeFileSync('industries.json', JSON.stringify(jsonOutput, null, 2), 'utf-8');
console.log('✅ JSON file created: industries.json');

