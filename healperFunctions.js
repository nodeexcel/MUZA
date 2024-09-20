async function readExcelWithValidation(sheets, emptyThreshold = 0.6) {
    /**
     * Process all sheets in the JSON object.
     */
    return sheets.map(sheet => {
        

        // Drop all null columns
        df = df.map(row => row.filter(cell => cell !== null));
        // Drop all null rows
        df = df.filter(row => row.length > 0);

        // Get the index of the row which is the possible header of the sheet
        let headerIndex = this.getHeaderIndex(df, emptyThreshold);
        if (headerIndex > -1) {
            // Read values in this row
            let rowValues = df[headerIndex].map((val, i) => val === null ? `Unnamed: ${i}` : val);
            // Remove the rows before the header
            df = df.slice(headerIndex + 1);
            // Set the columns of the data frame
            df = df.map(row => {
                let obj = {};
                rowValues.forEach((col, i) => {
                    obj[col] = row[i] || null;
                });
                return obj;
            });
        }

        // Check for duplicate column names
        let columns = Object.keys(df[0]);
        if (this.hasDuplicateIgnoreCase(columns)) {
			console.warn(`Invalid data frame in sheet ${sheet.sheetName} : duplicate column names - Skipping sheet`);
			return {
				sheetName: sheet.sheetName,
				data: []
			};
        } else {
			return {
				sheetName: sheet.sheetName,
				data: df
			};
		}
    });
}


async function removeEmptyRowsAndColumns(rows) {
    console.warn('original rows: ', rows)
    
    const maxColumnCount = Math.max(...rows.map(row => row.length)); // Find max columns
    // Make null for all empty cells
    let updatedRows = rows.map(row => {
        let updatedRow = [];
        for (let i = 0; i < maxColumnCount; i++) {
            let cell = row[i];
            if (cell === null || cell === undefined || cell === '') {
                updatedRow.push(null);
            } else {
                updatedRow.push(cell);
            }
        }
        return updatedRow;
    })
    console.warn('updatedRows 1: ', updatedRows)

    
    let noneEmptyRows = []
    for (let row of updatedRows) {
        let isEmpty = true
        if (row.length) { // No field in row
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                if (row[colIndex] !== null && row[colIndex] !== undefined) { // Find a non null field
                    isEmpty = false
                }
            }
        }
        if (isEmpty === false) {
            noneEmptyRows.push(row)
        }
    }
    updatedRows = noneEmptyRows
    console.warn('updatedRows 2: ', updatedRows)
    
    // None empty columns
    const columnsToKeep = Array(maxColumnCount).fill(false);

    for(let i = 1; i<updatedRows.length; i++){
        let row = updatedRows[i];
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
            if (row[colIndex] !== null) {
                columnsToKeep[colIndex] = true;
            }
        }
    }

    // Filter rows based on columnsToKeep
    updatedRows = updatedRows.map(row => row.filter((_, colIndex) => columnsToKeep[colIndex]));
    
    return updatedRows
}

async function renameUnnamedColumns(dataframe) {
    let header = dataframe[0];
    for(let i=0; i<header.length; i++){
        if(header[i]===null){
            header[i] = 'Column '+i;
        }
    }
    dataframe[0] = header
    return dataframe
}


async function validateMandatoryColumns(dataframe) {
    let columnDict = await this.getDictionary()
    let header = dataframe[0]
    for (let key in columnDict) {
        let samples = columnDict[key].samples
        let type = columnDict[key].type
        sampleCheck : for(const sample of samples){
            for (let i = 0; i < header.length; i++) {
                let column = header[i]
                if(column !== null && typeof column === 'string'){
                    console.warn("Type checking")
                    let validatedColumn = await this.removeNonAlpha(column.toLowerCase())
                    // let isMatchingColumn = await this.typeMatches(dataframe, i, type);
                    if(sample === validatedColumn){
                        console.warn(`Valid column : ${validatedColumn}`)
                        header[i] = key
                        dataframe = await this.cleanColumn(dataframe, i, type)
                        break sampleCheck
                    }
                }
            }
        }
        
    }
    
    dataframe[0] = header
    return dataframe
}


async function typeMatches(dataframe, columnIndex, columndataType, threshold = 0.7) {
    let matcher = await this.getMatcher(columndataType)
    if(matcher === null)
        return false
    let matchCount = (await this.filterTable(dataframe, columnIndex, matcher)).length
    if(matchCount/dataframe.length >= threshold)
        return true
    return false
}


async function filterTable(table, columnIndex, matcher) {
    if(columnIndex === -1)
        return table
    let arr = []
    arr.push(table[0])
    for (let i = 1; i < table.length; i++) {
        const cellValue = table[i][columnIndex];
        if(await matcher(cellValue)){
            arr.push(table[i])
        }
    }
    return arr
}


async function getMatcher(columndataType) {
    if(columndataType === 'date')
        return this.isDate
    else if(columndataType === 'number')
        return this.isNumber
    else if(columndataType === 'string')
        return this.isValidString
    else
        return null
}

async function excelDateToJSDate(serial) {
    // Excel's date format starts from January 1, 1900, so subtract 1 for proper conversion
    const excelStartDate = new Date(Date.UTC(1899, 11, 30)); // December 30, 1899
    const jsDate = new Date(excelStartDate.getTime() + (serial * 86400 * 1000));
    const day = jsDate.getUTCDate().toString().padStart(2, '0');
    const month = (jsDate.getUTCMonth() + 1).toString().padStart(2, '0'); // getUTCMonth() is zero-based
    const year = jsDate.getUTCFullYear();

    return `${month}/${day}/${year}`;
}


async function getDictionary() {
    let dictionary = {
        'Date': {
            type: 'date',
            isMandatory: 'yes',
            samples: ['date', 'fecha', 'ultmov']
        },
        'AccountCode':{
            isMandatory: 'no',
            type: 'string',
            samples: ['accountcode']
        },
        'AccountName':{
            isMandatory: 'yes',
            type: 'string',
            samples: ['accountname', 'account', 'cuenta']
        },
        'AccountType':{
            isMandatory: 'no',
            type: 'string',
            samples: ['accounttype', 'type']
        },
        'Description':{
            isMandatory: 'yes',
            type: 'string',
            samples: ['description', 'memo', 'descripcion', 'descripcin', 'discription', 'nota', 'memodescription', 'concepto']
        },
        'Debit': {
            type: 'number',
            isMandatory: 'yes',
            samples: ['debit', 'debitos','db', 'debe', 'cargosdlaramericano']
        },
        'Credit': {
            type: 'number',
            isMandatory: 'yes',
            samples: ['credit', 'creditos', 'cr', 'haber', 'abonosdlaramericano']
        },
        'Balance': {
            type: 'number',
            isMandatory: 'yes',
            samples: ['balance', 'finalbalance', 'runningbalance', 'closingbalance', 'saldo', 'saldodlaramericano', 'nuevosaldo', 'saldofinalcuenta']
        }, 
        'OldBalance': {
            type: 'number',
            isMandatory: 'no',
            samples: ['oldbalance', 'previousbalance', 'saldoanterior']
        }, 
        'JournalId':{
            isMandatory: 'no',
            type: 'string',
            samples: ['journalid', '#', 'num']
        },
        'Split':{
            isMandatory: 'no',
            type: 'string',
            samples: ['split']
        },
        'InvoiceNumber':{
            isMandatory: 'no',
            type: 'string',
            samples: ['invoicenumber', 'nit']
        },
        'Reference':{
            isMandatory: 'no',
            type: 'string',
            samples : ['reference', 'referencia']
        },
        'Counterparty':{
            isMandatory: 'no',
            type: 'string',
            samples : ['tercero']
        },
        'Name':{
            isMandatory: 'no',
            type: 'string',
            samples : ['name', 'nombre']
        }
    }
    
    return dictionary
}


async function isNullOrEmpty(value) {
    return value === null || value === undefined || String(value).trim() === ""
}


async function isNumber(value) {
    /**
     * Tries to parse value to number, to check if it is a valid number.
     */
    if (value === null || value === undefined || value === '' || isNaN(value)) {
        return false;
    }

    try {
        // replace ' ' with ''
        value = String(value).replace(/ /g, '');
        // Try converting the value to a float
        if (!isNaN(parseFloat(value)) && isFinite(value)) {
            // If successful, return True
            return true;
        }
        return false;
    } catch (e) {
        // If conversion fails, return False
        return false;
    }
}


async function hasDuplicateIgnoreCase(array) {
    /**
     * Checks if list contains duplicate values.
     */
    const pack = [];
    for (let el of array) {
        if (pack.includes(String(el).toLowerCase())) {
            return true;
        }
        pack.push(String(el).toLowerCase());
    }
    return false;
}


async function isValidString(value) {
    /**
     * Checks if string is valid.
     */
    return !(await this.isNullOrEmpty(value));
}


async function isDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}


async function getHeaderIndex(rows, dictionary) {
    const maxLinesToCheck = 100;
    let bestMatchIndex = -1;
    let maxMatches = -1;

    for (let i = 0; i < Math.min(rows.length, maxLinesToCheck); i++) {
        const row = rows[i];
        let matchCount = 0;
        let nonNullCells = 0;

        for (let cell of row) {
            let isCellEmpty = await this.isNullOrEmpty(cell)
            if(!isCellEmpty)
                nonNullCells++
            const normalizedCell = await this.removeNonAlpha(String(cell).toLowerCase());
            // console.warn('normalizedCell: ', normalizedCell)

            for (let key in dictionary) {
                if (dictionary[key].samples.includes(normalizedCell)) {
                    matchCount++;
                    break;
                }
            }
        }

        if (matchCount > maxMatches && nonNullCells/row.length > 0.6) {
            maxMatches = matchCount;
            bestMatchIndex = i;
        }
    }

    return bestMatchIndex;
}


async function cleanColumn(df, columnIndex, type) {
    /**
     * Removes any cell value to the new column if its type does not match with the type of the column.
     */
    console.warn("cleaning")
    let newColumn = [null];
    // Get matcher function for this type.
    const matcher = await this.getMatcher(type);
    if (matcher === null) {
        return df;
    }

    // Iterate data frame rows
    for(let i=1; i<df.length; i++){
        let row = df[i];
        let matches = await matcher(row[columnIndex])
        if (matches) {
            newColumn.push(null);
        } else {
            newColumn.push(row[columnIndex]);
            row[columnIndex] = null;
        }
    }
    
    let hasNonNull = newColumn.some(el=> el !== null)
    // If there is any non-empty cell in this new column, add it to the data frame with some default name
    if (hasNonNull) {
        const newColumnName = `Column ${df[0].length + 1}`;
        df[0].push(newColumnName)
        df.forEach((row, i) => {
            if(i>0)
                row.push(newColumn[i]);
        });
    }
    console.log(`New column: ${newColumn.slice(0, 50)}`)
    return df
}


async function fillRows(df, columns, dropTotal = true) {
    let fillValue = null;
    console.log('filling')
    console.log(`columns to fill : ${columns}`)
    for (let cName of columns) {
        if (df[0].includes(cName)) {
            let cIndex = df[0].indexOf(cName)
            if(cIndex > -1){
                for (let i = 1; i < df.length; i++) {
                    let cellValue = df[i][cIndex];
    
                    // if the cell value starts with 'Total', or it is the same as fillValue
                    // fill all rows from startIndex to the current index with fillValue
                    if (cellValue !== null) {
                        if (String(cellValue).includes("Total")) {
                            if(dropTotal){
                                df.splice(i, 1);
                                i--; // adjust index after removal
                            }
                        }else{
                            fillValue = cellValue
                            startIndex = i
                        } 
                    }else{
                        console.log("filled")
                        df[i][cIndex] = fillValue
                    }
                }
            }
            
        }
        fillValue = null
    }
    return df;
}


async function removeNonAlpha(text) {
    /**
     * Remove non alpha characters from the string and return
     */
    return text.replace(/[^A-Za-z]/g, '');
}

async function generateRandomId(length){
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

async function validateDateColumn(df){
    let dateColumnIndex = df[0].indexOf('Date')
    if(dateColumnIndex>-1){
        let rows = await this.filterTable(df, dateColumnIndex, async (el)=> el !== null)
        for(let i=1; i<rows.length; i++){
            let row = rows[i];
            let isExcelDate = await this.isNumber(row[dateColumnIndex])
            if(isExcelDate)
                row[dateColumnIndex] = await this.excelDateToJSDate(row[dateColumnIndex])
        }
        return rows
    }
    return df
}

async function isEmptySheet(rows){
    return rows === undefined || rows === null || rows.length <2
}

async function createAccountReview(rows){
    let header = rows[0]
    let accountNameIndex = header.findIndex(c=> c.toLowerCase() === 'account name')
    if(accountNameIndex === -1)
        accountNameIndex = header.findIndex(c=> c.toLowerCase() === 'account')
    if(accountNameIndex === -1)
        return []
    const accountMap = new Map();

    for(let i = 1; i<rows.length; i++){
        let row = rows[i]
        if (accountMap.has(row[accountNameIndex])) {
            accountMap.get(row[accountNameIndex]).push(row)
        } else {
            accountMap.set(row[accountNameIndex], [row]);
        }
    }

    let debit = header.findIndex(c=> c.toLowerCase() === 'debit')
    let credit = header.findIndex(c=> c.toLowerCase() === 'credit')
    let balance = header.findIndex(c=> c.toLowerCase().includes('balance'))
    let date = header.findIndex(c=> c.toLowerCase() === 'date')

    let tableHeader = [
            'Account Name',
            'First Transaction Date',
            'Last Transaction Date',
            'Opening Balance',
            'Ending Balance',
            'Transaction Count',
            'Debit Transaction Count',
            'Credit Transaction Count',
            'Debit Total Amount', 
            'Credit Total Amount',
            'Debit And Credit Diffirence'
    ]
    let reviewTable = [tableHeader]
    for (const [key, transactions] of accountMap.entries()) {
        let debitCount = 0;
        let creditCount = 0;
        let debitTotal = 0;
        let creditTotal = 0;
        for (let row of transactions){
            if(debit>-1 && row[debit]){
                let isValidDebit = await this.isNumber(row[debit])
                if(isValidDebit){
                    debitCount++;
                    debitTotal += parseFloat(row[debit])
                }  
            }
            if(credit>-1 && row[credit]){
                let isValidCredit = await this.isNumber(row[credit])
                if(isValidCredit){
                    creditCount++;
                    creditTotal += parseFloat(row[credit])
                }
            }
        }
        let accountReview = [
            key,
            date>-1 ? transactions[0][date] : null,
            date>-1 ? transactions[transactions.length-1][date] : null,
            balance > -1 ? transactions[0][balance] : null,
            balance > -1 ? transactions[transactions.length-1][balance] : null,
            transactions.length,
            debit > -1 ? debitCount : null,
            credit > -1 ? creditCount : null,
            debit > -1 ? debitTotal : null, 
            credit > -1 ? creditTotal : null,
            Math.abs(debitTotal-creditTotal)
        ]
       
        reviewTable.push(accountReview)
    }

    return reviewTable
}

async function normalizeSpaces(str) {
  // Trim trailing white space and reduce multiple spaces to a single space
  return str.trim().replace(/\s+/g, ' ');
}

async function getColumnIndex(header, column){
    return header.indexOf(column)
}

async function styleDataframe(df){
    const columnNameStyle = {
        font: { bold: true, color: { argb: "0E0237" }, size: 12 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: "F0F0F0" } } ,
        alignment: { wrapText: true }
    }
    const dataValueStyle = {
        font: { size: 12, color: { argb: "000000" } },
        alignment: { wrapText: true }
    }

    df[0] = df[0].map(c => ({ value: c, style: columnNameStyle, width: 20 }))
    for(let i=1; i<df.length; i++){
        df[i] = df[i].map(cell => ({ value: cell, style: dataValueStyle, width: 20 }))
    }
    return df
}

async function splitAmountToCreditAndDebit(df){
    let amountColumnIndex = df[0].findIndex(element => String(element).toLowerCase() === 'amount')
    if( amountColumnIndex > -1 && !(df[0].includes('Debit') || df[0].includes('Credit'))){
        df[0].push('Credit')
        df[0].push('Debit')
        for(let i=1; i<df.length; i++){
            if(df[i][amountColumnIndex]>0){
                df[i].push(0)
                df[i].push(df[i][amountColumnIndex])
            }else{
                df[i].push(Math.abs(df[i][amountColumnIndex]))
                df[i].push(0)
            }
        }
    }
    return df
}

async function fillAccountNameOrAccountCodeIfAbsent(df){
    alert(df,"DFFFFFF")
    console.log(df,"DFFFFFF",df[0])
    let accountNameColumnIndex = df[0].indexOf('AccountName')
    let accountCodeColumnIndex = df[0].indexOf('AccountCode')
    console.log(accountNameColumnIndex,"----",accountCodeColumnIndex)
    if(accountNameColumnIndex > -1 && accountCodeColumnIndex === -1){
        df[0].push('AccountCode')
        for(let i=1; i<df.length; i++){
            df[i].push(df[i][accountNameColumnIndex])
        }
        console.log("account code pushed-----")
    }else if(accountNameColumnIndex === -1 && accountCodeColumnIndex > -1){
        df[0].push('AccountName')
        for(let i=1; i<df.length; i++){
            df[i].push(df[i][accountCodeColumnIndex])
        }
        console.log("account name pushed-----")
    }
    return df
}

