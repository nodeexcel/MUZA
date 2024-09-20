async function jetTestSignificantTransactions({fileData, parameters, threshold}) {
    if(!threshold){
        alert('Please, enter the threshold!')
        return
    }
    try{
        let resultObject = {}

        if (fileData && fileData.url) {
            console.warn('fileData.url: ', fileData.url);
        }
        console.warn('download function: ', this.downloadFileFromUrl)
        
        const data = await this.downloadFileFromUrl(fileData.url);
    
        console.warn('file downloaded: ',  data);
        // let JSONData = JSON.parse(data);
        let sheets = JSON.parse(await data.text());
        console.warn('sheets: ', sheets);

        let test1Result = []

        for (let i = 0; i < sheets.length; i++) {
            if(sheets[i].sheetName.includes('_review'))
                continue
            let rows = sheets[i].rows
            console.warn('rows ', rows)
            let creditIndex = rows[0].indexOf('Credit')
            let debitIndex = rows[0].indexOf('Debit')
            if(creditIndex == -1  && debitIndex == -1){
                alert(`Columns Credit and Debit are not present in sheet ${sheets[i].sheetName}`)
                continue
            }
            rows = await this.test1Filter(rows, threshold, ['Credit', 'Debit'])
            // if (rows && rows.length > 0) {
            //     rows = await this.validateDateColumn(rows)
            //     console.warn('rows date clean: ', rows)
            // }
            test1Result.push({ sheetName: sheets[i].sheetName, rows: rows })
        }

        if(test1Result.length === 0){
            alert('Test failed : No valid data is available!')
            return
        }

        resultObject.cellUpdates = [];
            
        resultObject.cellUpdates.push({ columnId: 'jetTest1Result', value: test1Result }); 

        let fileNameWitoutExtension = fileData.fileName.split('.').shift()

        for(let sheet of test1Result){
            sheet.rows = await this.styleDataframe(sheet.rows)
        }
        
        let excelWorkbookBlob = await this.convertJsonToExcelBlob(test1Result)
        let excelUploadedFileData = await this.uploadFileToStorage(excelWorkbookBlob, parameters.fileUploadFolder, fileNameWitoutExtension + '-TEST1.xlsx' )
        console.warn('excelUploadedFileData: ', excelUploadedFileData)        
        resultObject.cellUpdates.push({ columnId: 'jetTest1Result', value: excelUploadedFileData });  
        alert('Test was completed successfully!')
        return resultObject
    }catch(e){
        console.error(e)
        alert('Error occured during the test. Please, check the document again.')
    }
    
}

async function test1Filter(rows, threshold, columnsToCheck){
    let header = rows[0];
    let columnIndexes = []
    let filteredRows = []
    filteredRows.push(header)
    columnsToCheck = columnsToCheck.map(str => str.toLowerCase());
    for(let i = 0; i<header.length; i++){
        if(columnsToCheck.includes(header[i].toLowerCase())){
            columnIndexes.push(i)
        }
    }

    for(let i = 1; i<rows.length; i++){
        let matches = columnIndexes.some(cIndex => Math.abs(rows[i][cIndex]) >= threshold)
        if(matches){
            filteredRows.push(rows[i])
        }
    }

    return filteredRows
}