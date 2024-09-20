async function cleanGLExcelFile({fileData, parameters}) {
    try {
        let resultObject = {};
        console.warn("fileData: ", fileData)
        console.warn('parameters: ', parameters)
        if (fileData && fileData.url) {
            console.warn('fileData.url: ', fileData.url);
        }
        console.warn('download function: ', this.downloadFileFromUrl)
        const data = await this.downloadFileFromUrl(fileData.url);
        console.warn('file downloaded: ',  data);
        
        let dictionary = await this.getDictionary();
        console.warn('dictionary: ', dictionary)

        let mandatoryColumns = Object.entries(dictionary)
        .filter(([key, value]) => value.isMandatory === 'yes')
        .map(([key, value]) => key);

        let sheets = await this.convertExcelToJson(data);
        let cleanedSheets = []
        if (sheets && sheets.length) {
            console.warn('sheets: ', sheets);
            
            for (let i = 0; i < sheets.length; i++) {
                let sheet = sheets[i]
                console.warn('sheet: ', sheet)
                let rows = sheet.rows
                let isEmptySheet = await this.isEmptySheet(rows)
                if(isEmptySheet)
                    continue
                try{
                    rows = await this.removeEmptyRowsAndColumns(rows);
                    console.warn('rows 1: ', rows)
                    if (rows && rows.length > 0) {
                        let headerIndex = await this.getHeaderIndex(rows, dictionary)
                        console.warn('headerIndex: ', headerIndex)                

                        rows = rows.slice(headerIndex)
                        console.warn('rows 2: ', rows)

                        if (rows && rows.length > 0) {
                            rows = await this.renameUnnamedColumns(rows)
                            console.warn('rows 3: ', rows)

                            if (rows && rows.length > 0) {
                                rows = await this.validateMandatoryColumns(rows)
                                console.warn('Columns validated: ', rows)
                                
                                let unnamedColumns = rows[0].filter( c=> c != null && String(c).includes('Column'))
                                let columnsToFill = ['AccountName'].concat(unnamedColumns)

                                rows = await this.fillRows(rows, columnsToFill)
                                console.warn('rows 5: ', rows)
                                
                                if (rows && rows.length > 0) {
                                    rows = await this.validateDateColumn(rows)
                                    console.warn('rows 6: ', rows)
                                    
                                    if (rows && rows.length > 0) {
                                        rows = await this.removeEmptyRowsAndColumns(rows);
                                        rows = await this.splitAmountToCreditAndDebit(rows)
                                        rows = await this.fillAccountNameOrAccountCodeIfAbsent(rows)
                                        // let accountReview = await this.createAccountReview(rows)
                                        let missingColumns = mandatoryColumns.filter(column => !rows[0].includes(column))
                                        if(missingColumns.length){
                                            alert(`Some columns are missing in sheet ${sheet.sheetName} :\n${missingColumns.join(', ')}`)
                                            // continue
                                        }
                                        cleanedSheets.push({ sheetName: sheet.sheetName, rows: rows })
                                        // cleanedSheets.push({ sheetName: sheet.sheetName + '_review', rows: accountReview })
                                    }
                                }
                            }
                        }
                    }
                }catch(e){
                    console.error(e)
                    alert(`Error occured during the cleaning the sheet ${sheet.sheetName}. Please, make sure file is in suitable format`)
                }
                
            }

            if(cleanedSheets.length === 0){
                alert('Cleaning process failed : No valid data is available!')
                return
            }
        
            resultObject.cellUpdates = [];

            let fileNameWitoutExtension = fileData.fileName.split('.').shift() 
            let fileExtension = fileData.fileName.split('.').pop()
            
            let jsonFileBlob = await this.jsonToBlob(sheets)
            let jsonUploadedFileData = await this.uploadFileToStorage(jsonFileBlob, parameters.fileUploadFolder, fileNameWitoutExtension + '.json' )
            console.warn('jsonUploadedFileData: ', jsonUploadedFileData)
            if (jsonUploadedFileData) {
                resultObject.cellUpdates.push({ columnId: 'glJsonFile', value: jsonUploadedFileData });   
            }
            
            
            let jsonFileBlobCleaned = await this.jsonToBlob(cleanedSheets)
            let jsonUploadedCleanedFileData = await this.uploadFileToStorage(jsonFileBlobCleaned, parameters.fileUploadFolder, fileNameWitoutExtension + '-CLEAN.json' )
            console.warn('jsonUploadedCleanedFileData: ', jsonUploadedCleanedFileData)
            resultObject.cellUpdates.push({ columnId: 'cleanedGlJsonFile', value: jsonUploadedCleanedFileData });
            
            for(let sheet of cleanedSheets){
                sheet.rows = await this.styleDataframe(sheet.rows)
            }
            let excelWorkbookBlob = await this.convertJsonToExcelBlob(cleanedSheets)
            let excelUploadedFileData = await this.uploadFileToStorage(excelWorkbookBlob, parameters.fileUploadFolder, fileNameWitoutExtension + '-CLEAN.xlsx' )
            console.warn('excelUploadedFileData: ', excelUploadedFileData)        
            resultObject.cellUpdates.push({ columnId: 'cleanedGlExcelFile', value: excelUploadedFileData });
        }
        let message = 'Cleaning is finished. File is ready.\n'
        // for(const sheet of cleanedSheets){
        //     let missingColumns = mandatoryColumns.filter(column => !sheet.rows[0].includes(column))
        //     if(missingColumns.length){
        //         message += `\nSome columns are missing in sheet ${sheet.sheetName} :\n${missingColumns.join(', ')}\n`
        //     }
        // }
        alert(message)
        return resultObject;
    } catch (e) {
        console.error(e)
        alert('Error occured during the cleaning process. Please, make sure file is in suitable format')
    } finally {
    
    }

}