import xlsx from "xlsx";
const json2csv = require("json2csv").parse;

function generateXLSXAndXLSExport(
  data: any,
  columnNames: any,
  format: any,
  sheetName: any
) {
  try {
    const ws = xlsx.utils.aoa_to_sheet([columnNames]);

    data.forEach((item: any) => {
      const row = columnNames.map((columnName: any) => item[columnName]);
      xlsx.utils.sheet_add_aoa(ws, [row], { origin: -1 });
    });

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, sheetName);

    const buffer = xlsx.write(wb, { bookType: format, type: "buffer" });
    return buffer;
  } catch (error) {
    console.error(`Error generating ${format} export:`, error);
    throw error;
  }
}

function generateCSVExport(data: any, columnNames: any) {
  try {
    //add options
    const options: any = {
      fields: columnNames,
    };
    // Use json2csv to convert data to CSV with specific fields
    const csvString = json2csv(data, options);
    const buffer = Buffer.from(csvString, "utf-8");

    return buffer;
  } catch (error) {
    throw error;
  }
}

export { generateXLSXAndXLSExport, generateCSVExport };
