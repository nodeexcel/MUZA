async function jetTestKeywordSearch({fileData, parameters, keyword, columnsForSearch, useFuzzySearch}) {
    try{
        if(!keyword){
            alert('Please, enter keyword!')
            return
        }
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

        let test4Result = []
        if(columnsForSearch)
            columnsForSearch = columnsForSearch.map(c=> c._id)
        else
            columnsForSearch = []

        for (let i = 0; i < sheets.length; i++) {
            if(sheets[i].sheetName.includes('_review'))
                continue
            let rows = sheets[i].rows
            console.warn('rows ', rows)
            rows = await this.filterByKeyword(rows, keyword, columnsForSearch, useFuzzySearch)
            // if (rows && rows.length > 0) {
            //     rows = await this.validateDateColumn(rows)
            //     console.warn('rows date clean: ', rows)
            // }
            test4Result.push({ sheetName: sheets[i].sheetName, rows: rows })
        }

        if(test4Result.length === 0){
            alert('Test failed : No valid data is available!')
            return
        }

        resultObject.cellUpdates = [];
            
        resultObject.cellUpdates.push({ columnId: 'jetTestKEYSERResult', value: test4Result }); 

        let fileNameWitoutExtension = fileData.fileName.split('.').shift()

        for(let sheet of test4Result){
            sheet.rows = await this.styleDataframe(sheet.rows)
        }
        
        let excelWorkbookBlob = await this.convertJsonToExcelBlob(test4Result)
        let excelUploadedFileData = await this.uploadFileToStorage(excelWorkbookBlob, parameters.fileUploadFolder, fileNameWitoutExtension + '-TEST4.xlsx' )
        console.warn('excelUploadedFileData: ', excelUploadedFileData)        
        resultObject.cellUpdates.push({ columnId: 'jetTestKEYSERResult', value: excelUploadedFileData });  
        alert('Test was completed successfully!')
        return resultObject
    }catch(e){
        console.error(e)
        alert('Error occured during the test. Please, check the document again.')
    }
}



async function filterByKeyword(rows, keyword, columns, useFuzzySearch = 'no'){
    useFuzzySearch = 'no' // update and fix it
    let header = rows[0]
    let columnIndecies = []
    if(columns.length == 0){
        columns = header.map(c=> c.replace(/\s+/g, '').toLowerCase());
    }
    for(let column of columns){
        let columnIndex = header.findIndex(c=> c.replace(/\s+/g, '').toLowerCase() === column.toLowerCase())
        
        if(columnIndex>-1){
            columnIndecies.push(columnIndex)
        }
    }
    let filteredRows = []
    filteredRows.push(header) 
    for(let i = 1; i<rows.length; i++){
        let row = rows[i]
        
        let matches = false;
        if(useFuzzySearch === 'yes'){
            let words = columnIndecies.map(ix=> row[ix])
            matches = await this.isWordInList(keyword, words)
        }else{
            for(let index of columnIndecies){
                if(row[index] && String(row[index]).toLowerCase().includes(keyword.toLowerCase())){
                    matches = true
                    break
                }
            }
        }
        if(matches){
            filteredRows.push(row)
        }

    }
    return filteredRows
}

async function isWordInList(word, list, threshold = 0.3) {
    const fuse = new Fuse(list, {
        includeScore: true,
        threshold: threshold
    });

    const result = fuse.search(word);
    return result.length > 0; // Returns true if there's a match
}