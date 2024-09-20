async function isDate_old(value) {
    /**
     * Checks if string is in valid date format.
     */
    // Convert the value to a string
    const valueStr = String(value);
    // Check if the value is purely numeric
    if (this.isNumber(valueStr)) {
        return false;
    }
    // Regular expression to check for common date-specific characters or patterns
    // if date is valid, it should contain at least one of these characters
    const datePattern = /[a-zA-Z\-\/\.\s]/;
    if (!datePattern.test(valueStr)) {
        return false;
    }
    try {
        // Attempt to parse the value
        const parsedDate = new Date(valueStr);
        if (!isNaN(parsedDate)) {
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function validateMandatoryColumns_Old(dataframe) {
    let columnDict = await this.getDictionary()
    let header = dataframe[0]
    for (let key in columnDict) {
        let samples = columnDict[key].samples
        let type = columnDict[key].type
        for (let i = 0; i < header.length; i++) {
            let column = header[i]
            if(column !== null && typeof column === 'string'){
                console.warn("Type checking")
                let validatedColumn = await this.removeNonAlpha(column.toLowerCase())
                // let isMatchingColumn = await this.typeMatches(dataframe, i, type);
                if(samples.includes(validatedColumn)){
                    console.warn(`Valid column : ${validatedColumn}`)
                    header[i] = key
                    dataframe = await this.cleanColumn(dataframe, i, type)
                    break
                }
            }
        }
    }
    
    dataframe[0] = header
    return dataframe
}

async function resetHeaders(data, dictionary) {
    // Identify and set header row
    const headerIndex = await this.getHeaderIndex(data);
    if (headerIndex > -1) {
        const headers = data[headerIndex].map((val, i) => val === null ? `Unnamed: ${i}` : val);
        data = data.slice(headerIndex + 1);
        data.forEach(row => {
            headers.forEach((header, i) => {
                row[header] = row[i];
                delete row[i];
            });
        });
    }
    return data;
}

async function excelDateToJSDate_old(serial) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    const dateStr = date.toISOString().split('T')[0];
    return dateStr;
}


async function getHeaderIndex_old(rows, dictionary) {
    const maxLinesToCheck = 100;
    let bestMatchIndex = -1;
    let maxMatches = 0;

    for (let i = 0; i < Math.min(rows.length, maxLinesToCheck); i++) {
        const row = rows[i];
        let matchCount = 0;

        for (let cell of row) {
            const normalizedCell = await this.removeNonAlpha(String(cell).toLowerCase());
            // console.warn('normalizedCell: ', normalizedCell)

            for (let key in dictionary) {
                if (dictionary[key].samples.includes(normalizedCell)) {
                    matchCount++;
                    break;
                }
            }
        }

        if (matchCount > maxMatches) {
            maxMatches = matchCount;
            bestMatchIndex = i;
        }
    }

    return bestMatchIndex;
}