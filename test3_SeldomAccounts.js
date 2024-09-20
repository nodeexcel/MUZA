async function jetTestSeldomAccounts({fileData, parameters, seldomnessThreshold}) {
    if(!seldomnessThreshold){
        alert('Please, enter the seldomness threshold!')
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

        let test3Result = []

        for (let i = 0; i < sheets.length; i++) {
            if(sheets[i].sheetName.includes('_review'))
                continue
            let rows = sheets[i].rows
            console.warn('rows ', rows)
            let accountNameIndex = rows[0].indexOf('AccountName')
            if(accountNameIndex == -1){
                alert(`Column Account Name is not present in sheet ${sheets[i].sheetName}`)
                continue
            }
            let result = await this.filterSeldomAccounts(rows, seldomnessThreshold)
            rows = result.rows
            if (rows && rows.length > 0) {
                rows = await this.validateDateColumn(rows)
                console.warn('rows date clean: ', rows)
            }
            rows.push([])
            rows = rows.concat(result.accountTable)
            test3Result.push({ sheetName: sheets[i].sheetName, rows: rows })
        }

        if(test3Result.length === 0){
            alert('Test failed : No valid data is available!')
            return
        }

        resultObject.cellUpdates = [];
            
        resultObject.cellUpdates.push({ columnId: 'jetTestSELACResult', value: test3Result }); 

        let fileNameWitoutExtension = fileData.fileName.split('.').shift()
        
        for(let sheet of test3Result){
            sheet.rows = await this.styleDataframe(sheet.rows)
        }

        let excelWorkbookBlob = await this.convertJsonToExcelBlob(test3Result)
        let excelUploadedFileData = await this.uploadFileToStorage(excelWorkbookBlob, parameters.fileUploadFolder, fileNameWitoutExtension + '-TEST3.xlsx' )
        console.warn('excelUploadedFileData: ', excelUploadedFileData)        
        resultObject.cellUpdates.push({ columnId: 'jetTestSELACResult', value: excelUploadedFileData });  
        alert('Test was completed successfully!')
        return resultObject
    }catch(e){
        console.error(e)
        alert('Error occured during the test. Please, check the document again.')
    }
    
}



async function filterSeldomAccounts(rows, seldomnessThreshold){
    let header = rows[0]
    let accountNameIndex = header.findIndex(c=> c.toLowerCase() === 'accountname')
    if(accountNameIndex === -1)
        return {rows, accountTable : [] }
    const accountMap = new Map();

    for(let i = 1; i<rows.length; i++){
        let row = rows[i]
        if (accountMap.has(row[accountNameIndex])) {
            accountMap.set(row[accountNameIndex], accountMap.get(row[accountNameIndex]) + 1);
        } else {
            accountMap.set(row[accountNameIndex], 1);
        }
    }

    const filteredAccounts = new Map([...accountMap.entries()].filter(([_, count]) => count <= seldomnessThreshold));
    const accountTable = [...filteredAccounts];
    rows = rows.filter(row => filteredAccounts.has(row[accountNameIndex]))
    rows.unshift(header)
    return ({rows, accountTable})
}