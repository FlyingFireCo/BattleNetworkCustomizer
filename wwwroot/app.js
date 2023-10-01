const SAVE_START_OFFSET = 0x0100;
const SAVE_SIZE = 0x6710;
const MASK_OFFSET = 0x1064;
const GAME_NAME_OFFSET = 0x1c70;
const CHECKSUM_OFFSET = 0x1c6c;
const SHIFT_OFFSET = 0x1060;

const EREADER_NAME_OFFSET = 0x1186;
const EREADER_NAME_SIZE = 0x18;
const EREADER_DESCRIPTION_OFFSET = 0x07d6;
const EREADER_DESCRIPTION_SIZE = 0x64;

const CHIP_FOLDER_OFFSET = 0x2178;
const CHIP_SIZE = 2; // based on RawChip
const CHIPS_PER_FOLDER = 30;


new Vue({
    el: '#app',
    data: {
        stringPosition: -1,
        gameName: "REXE6",
        numFolders: 0,
        gameVariant: "Gregar",

        selectedFolder: 0,  // We default to the first folder
        chips: [],  // This will hold the chips for the selected folder
        gigaList: [],  // This will hold the data from Giga.json
        megaList: [],  // This will hold the data from Giga.json
        standardList: [],  // This will hold the data from Giga.json
        allChips: [],
        searchQuery: '',
        sortField: null,  // Will store the current field to sort by.
        sortDirection: 0,  // 0: none, 1: ascending, -1: descending.
        currentTab: 'Standard',
        showDetailedFilter: false,
        folderName: '',
        folderNames: [],
        selectedItems: null,
        tangoSaveFolderName: '',
        showDialog: false,
        dialogTitle: "",
        dialogItems: [],
        selectedItem: null,
        dialogFilter: "",
        dialogCallback: null, // This will store a function to be executed on confirmation
        fullByteArray: null,
        byteArray: null,
        detailedFilter: {
            Name: '',
            Description: '',
            Damage: '',
            Code: '',
            Element: '',
            MB: ''
        },
        selectedItemsChips: [], // Chips currently in the folder
        highlightedFolderChips: [], // Chips highlighted in the folder
        highlightedLibraryChips: [], // Chips highlighted in the library

    },
    computed: {
        flattenedChips() {
            let currentChips;  // Variable to hold chips based on current tab

            switch (this.currentTab) {
                case 'Giga':
                    currentChips = this.gigaList;
                    break;
                case 'Mega':
                    currentChips = this.megaList;
                    break;
                case 'Standard':
                    currentChips = this.standardList;
                    break;
                case 'All':
                default:
                    currentChips = this.allChips;
                    break;
            }

            const flattened = [];
            for (let chip of currentChips) {
                if (chip.Code && Array.isArray(chip.Code)) {
                    for (let code of chip.Code) {
                        // Create a shallow copy of the chip object with a single code
                        let chipCopy = { ...chip, Code: code };
                        flattened.push(chipCopy);
                    }
                } else {
                    // If the chip doesn't have an array of codes, just add it as is
                    flattened.push(chip);
                }
            }
            return flattened;
        },
        filteredChips() {
            // Using flattenedChips to get the flattened list of chips
            const flattened = this.flattenedChips;

            return flattened.filter(chip => {

                // General search
                if (this.searchQuery && !this.showDetailedFilter) {
                    let regex = new RegExp(this.searchQuery, 'i');
                    for (let key in chip) {
                        if (chip[key] && regex.test(chip[key].toString())) {
                            return true;
                        }
                    }
                    return false;
                }

                // Detailed search
                if (this.showDetailedFilter) {
                    for (let key in this.detailedFilter) {
                        if (this.detailedFilter[key] && chip[key]) {
                            if (key === 'Code') {
                                let searchCodes = this.detailedFilter.Code.split(',').map(code => code.trim());
                                if (!searchCodes.includes(chip.Code)) {
                                    return false;
                                }
                            } else if (!chip[key].toString().toLowerCase().includes(this.detailedFilter[key].toLowerCase())) {
                                return false;
                            }
                        }
                    }
                    return true;
                }

                return true;
            });

        }
        ,
        sortedAndFilteredChips() {
            const chips = [...this.filteredChips];  // Copy the filtered chips array.

            if (this.sortField) {
                chips.sort((a, b) => {
                    if (a[this.sortField] < b[this.sortField]) return -1 * this.sortDirection;
                    if (a[this.sortField] > b[this.sortField]) return 1 * this.sortDirection;
                    return 0;
                });
            }

            return chips;
        },
        rows() {
            const placeholders = Array(30 - this.chips.length).fill({
                chip: {
                    MId: '',
                    SId: '',
                    Image: null, // an image for empty rows if you have one
                    Name: '',
                    Description: '',
                    Damage: '',
                    Code: '',
                    Element: '',
                    MB: '',
                }
            });
            return [...this.chips, ...placeholders];
        },
        filteredOptions() {
            if (!this.dialogFilter) return this.dialogItems;

            // Convert the filter string to lowercase for case-insensitive search
            const filter = this.dialogFilter.toLowerCase();

            // Return filtered items using our simple fuzzy search
            return this.dialogItems.filter(item => {
                let lastIndex = -1;
                for (let char of filter) {
                    lastIndex = item.toLowerCase().indexOf(char, lastIndex + 1);
                    if (lastIndex === -1) return false; // Char was not found
                }
                return true; // Every char in filter was found in item in order
            });
        }

    },
    watch: {
        tangoSaveFolderName(newVal) {
            // When tangoSaveFolderName changes, save the new value to a cookie
            this.setCookie('tangoSaveFolderName', newVal, 365);
        }
    },

    mounted() {
        this.fetchChips('giga', this.gigaList);
        this.fetchChips('mega', this.megaList);
        this.fetchChips('standard', this.standardList);
        this.tangoSaveFolderName = this.getCookie('tangoSaveFolderName') || '';

    },

    methods: {
        setCookie(name, value, days) {
            let expires = "";
            if (days) {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            document.cookie = name + "=" + (value || "") + expires + "; path=/";
        },
        getCookie(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) == ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        },
        async loadFolders() {
            try {
                const response = await fetch(`/folders`);

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                this.folderNames = await response.json();
            } catch (error) {
                console.error('Error loading the folder names', error);
            }
        },

        async loadSelectedFolder() {
            if (!this.selectedItem) return;

            try {
                const response = await fetch(`/folders/${encodeURIComponent(this.selectedItem)}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const folderData = await response.json();
                this.loadFolderFromJson(folderData);
            } catch (error) {
                console.error('Error loading the selected folder', error);
            }
        },

        loadFolderFromJson(jsonChips) {
            this.chips = []; // Clear chips array

            jsonChips.forEach(chipData => {
                const chip = this.readChipData(chipData.Id, chipData.Code);
                this.chips.push({ chip });
            });
        },

        openFolderDialog() {
            this.loadFolders();
            this.showDialog = true;
            this.dialogTitle = "Select a Folder";
        },

        confirmFolder() {
            this.loadSelectedFolder();
            this.showDialog = false;
        },
        openDialog(title, fetchUrl, callback) {
            this.dialogTitle = title;
            this.dialogCallback = callback;
            fetch(fetchUrl)
                .then(res => res.json())
                .then(data => {
                    this.dialogItems = data;
                    this.showDialog = true;
                });
        },
        openDialogPost(title, fetchUrl, callback) {
            this.dialogTitle = title;
            this.dialogCallback = callback;

            // Define the request payload
            const payload = {
                path: this.tangoSaveFolderName
            };

            // Make the POST request
            fetch(fetchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    this.dialogItems = data;
                    this.showDialog = true;
                })
                .catch(error => {
                    console.error('There was a problem with the fetch operation:', error.message);
                });
        },
        confirmDialog() {
            if (this.dialogCallback && typeof this.dialogCallback === 'function') {
                this.dialogCallback(this.selectedItem);
            }
            this.showDialog = false;
        },
        removeFolderChip(chip) {
            const chipIndex = this.chips.indexOf(chip);
            this.chips.splice(chipIndex, 1);
            this.$forceUpdate();
        },
        toggleSort(field) {
            if (this.sortField !== field) {
                // New field, start with ascending sort.
                this.sortField = field;
                this.sortDirection = 1;
            } else {
                // Cycle between none, ascending, and descending for the current field.
                this.sortDirection = this.sortDirection === 0 ? 1 : this.sortDirection === 1 ? -1 : 0;

                // If back to none, clear the sortField as well.
                if (this.sortDirection === 0) {
                    this.sortField = null;
                }
            }
        },
        addToFolder(chip) {
            if (this.chips.length >= 30
                || !this.checkCanAddToFolder(chip)) return; // Don't add if the folder is full
            //deep clone chip
            let newChip = Object.assign({}, chip);
            if (newChip.MId) {
                newChip.id = newChip.MId;
            }
            else {
                newChip.id = newChip.SId;
            }

            newChip.code = newChip.Code;
            this.chips.push({
                chip: newChip
            });
            this.$forceUpdate();
        },

        checkCanAddToFolder(chip) {
            //todo check MB and limitiations
            return true;
        },
        fetchChips(chipType, chipList) {
            fetch(`/chips/${chipType}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    chipList.splice(0, chipList.length, ...data);  // Replace the content of chipList with the fetched data

                    // append all chips to the all chips list
                    this.allChips.push(...data);
                })
                .catch(error => {
                    console.error(`There was an error fetching the ${chipType} chip JSON data:`, error);
                });
        },

        async loadSaveFileFromAPI() {
            try {
                let response = await this.fetchSaveData(this.selectedItem);

                if (response) {
                    this.fullByteArray = new Uint8Array(response);
                    this.byteArray = this.fullByteArray.slice(SAVE_START_OFFSET, SAVE_START_OFFSET + SAVE_SIZE);
                    this.loadSaveFile();
                }
            } catch (error) {
                console.error("Error fetching save data:", error);
            }
        },
        async fetchSaveData(filePath) {
            const requestConfig = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: filePath })
            };
            
            let response = await fetch("/Save/GetSaveData", requestConfig);
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return response.arrayBuffer();
        },
        mask(byteArray) {
            const mask = new DataView(byteArray.buffer).getUint32(MASK_OFFSET, true); // assuming little-endian
            const maskByte = mask & 0xFF; // Take only the least significant byte

            for (let i = 0; i < byteArray.length; i++) {
                byteArray[i] ^= maskByte;
            }

            // Write the original mask value back to its offset
            const maskBytes = new Uint8Array(new Uint32Array([mask]).buffer);
            byteArray.set(maskBytes, MASK_OFFSET);
        }
        ,
        loadSaveFile() {

            // const originalByteArray = new Uint8Array(byteArray); // Make a copy of the original bytes for comparison later

            const expectedBytes = new TextEncoder().encode(this.gameName);
            
            // Mask the entire data
            this.mask(this.byteArray);

            // Find the start position of the game name in the masked data
            this.stringPosition = this.indexOfSequence(this.byteArray, expectedBytes);

            // Extract the bytes for the full game name
            const gameNameBytes = this.byteArray.slice(GAME_NAME_OFFSET, GAME_NAME_OFFSET + 20);
            this.numFolders = this.byteArray[0x1c09];
            this.getEquippedFolder(this.byteArray);


            // Attempt to decode the bytes to a string
            try {
                this.gameName = new TextDecoder().decode(gameNameBytes);
            } catch (error) {
                console.error("Error decoding game name:", error);
                this.gameName = "Decoding error";
            }

            // Logging for debugging purposes
            const hexBytes = Array.from(gameNameBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log("Hex representation:", hexBytes);

            // At the end of the loadSaveFile, load the chip data for the selected folder
            this.loadFolderChips(this.byteArray, this.selectedFolder);

            const originalChecksum = new DataView(this.byteArray.buffer).getUint32(CHECKSUM_OFFSET, true); // assuming little-endian
            console.log(`Original Checksum: ${originalChecksum}`);

            // Log bytes around the checksum for inspection
            const startLogOffset = CHECKSUM_OFFSET - 10; // 10 bytes before
            const endLogOffset = CHECKSUM_OFFSET + 14; // 10 bytes after + 4 bytes of checksum itself
            console.log(`Bytes around the checksum: ${Array.from(this.byteArray.slice(startLogOffset, endLogOffset)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            if (true) {//checksum debug
                const newChecksum = this.computeChecksum(this.byteArray);
                const checksumBytes = new Uint8Array(new Uint32Array([newChecksum]).buffer);
                this.byteArray.set(checksumBytes, CHECKSUM_OFFSET);
            }
            const newChecksum = new DataView(this.byteArray.buffer).getUint32(CHECKSUM_OFFSET, true); // assuming little-endian
            console.log(`New Checksum: ${newChecksum}`);


            // Re-mask the entire data before saving
            this.mask(this.byteArray);
            // this.compareAndLogDifferences(originalByteArray, byteArray);

            // Merge the modified byteArray back into fullByteArray
            this.fullByteArray.set(this.byteArray, SAVE_START_OFFSET);



            // Add a call to download the modified file
            // this.downloadModifiedFile(fullByteArray); // Using fullByteArray here

        },

        loadRom(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target.result;
                const dataView = new DataView(buffer);

                const chipData = this.extractChipData(dataView);
                console.log(chipData);
            };

            reader.readAsArrayBuffer(file);
        },

        extractChipData(dataView) {
            const target = [99, 97, 110, 110, 111, 110]; // Target sequence of bytes to search for

            for (let i = 0; i < dataView.byteLength - target.length + 1; i++) {
                let found = true;

                for (let j = 0; j < target.length; j++) {
                    if (dataView.getUint8(i + j) !== target[j]) {
                        found = false;
                        break;
                    }
                }

                if (found) {
                    console.log("Found at address:", i);

                    // Extract the next 20 characters
                    const charsToLog = Math.min(80, dataView.byteLength - i);
                    const chars = [];
                    for (let j = 0; j < charsToLog; j++) {
                        const byteValue = dataView.getUint8(i + j);

                        // Assuming printable ASCII characters are between 32 and 126.
                        if (byteValue >= 32 && byteValue <= 126) {
                            chars.push(String.fromCharCode(byteValue));
                        } else {
                            chars.push('.');
                        }
                    }

                    console.log(chars.join(""));
                }
            }
        },


        logSurroundingBytes(fullByteArray, before = 20, after = 20) {
            // Log bytes before SAVE_START_OFFSET
            const beforeBytes = Array.from(fullByteArray.slice(Math.max(0, SAVE_START_OFFSET - before), SAVE_START_OFFSET))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            console.log(`Bytes before byteArray: ${beforeBytes}`);

            // Log bytes after SAVE_START_OFFSET + SAVE_SIZE
            const afterBytes = Array.from(fullByteArray.slice(SAVE_START_OFFSET + SAVE_SIZE, SAVE_START_OFFSET + SAVE_SIZE + after))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            console.log(`Bytes after byteArray: ${afterBytes}`);
        },
        compareAndLogDifferences(original, modified) {
            for (let i = 0; i < original.length; i++) {
                if (original[i] !== modified[i]) {
                    console.log(`Difference at index ${i}: Original Byte: ${original[i]}, Modified Byte: ${modified[i]}`);
                }
            }
        },
        getEquippedFolder(byteArray) {
            // Use the method to get the naviStatsOffset
            const naviStatsOffset = this.getNaviStatsOffset(0); // Here I've assumed `0` for `naviId`, you'll need to adjust as necessary.
            this.selectedFolder = byteArray[naviStatsOffset + 0x2d];
        },

        getNaviStatsOffset(naviId) {
            return 0x47cc + 0x64 * (naviId === 0 ? 0 : 1);
        },



        // This method will extract the chips for the given folder
        loadFolderChips(byteArray, folderIndex) {
            const chipStartOffset = CHIP_FOLDER_OFFSET + (folderIndex * CHIPS_PER_FOLDER * CHIP_SIZE);
            this.chips = []; // Clear chips array

            for (let i = 0; i < CHIPS_PER_FOLDER; i++) {
                const chipOffset = chipStartOffset + (i * CHIP_SIZE);
                const chipBytes = byteArray.slice(chipOffset, chipOffset + CHIP_SIZE);

                const rawId = chipBytes[0];
                const rawCode = chipBytes[1];

                const chip = this.readChipData(rawId, rawCode);

                // Set the changes back to the byteArray
                byteArray.set(chipBytes, chipOffset);
                console.log(`Chip ${i}:`, chipBytes);

                this.chips.push({ chip });
            }
        },

        readChipData(rawId, rawCode) {
            let id = rawId;
            let codeIndex = rawCode;
            let isSet2 = false;

            if (rawCode % 2 == 1) {
                codeIndex = parseInt(rawCode / 2);
                isSet2 = true; //look at the MId
            }
            else {
                codeIndex = rawCode / 2;
            }

            const codeIndexes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ*";
            const code = codeIndexes[codeIndex];

            const chip = this.allChips.find(c =>
                (isSet2) ? c.MId == id : c.SId == id);

            const chipInstance = Object.assign({}, chip);
            chipInstance.code = code;

            return chipInstance;
        },


        async saveFolder() {
            // Convert this.chips to raw data
            const rawChips = this.chips.map(chipObj => this.chipToRaw(chipObj.chip));

            // Make an HTTP POST request using fetch
            try {
                const response = await fetch(`/folders/${this.folderName}`, {  // Modified the URL to include folderName
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(rawChips)  // Sending rawChips directly without wrapping in an object
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                } else {
                    console.log('Folder saved successfully', await response.text());
                }
            } catch (error) {
                console.error('Error saving the folder', error);
            }
        },

        chipToRaw(chip) {
            // Constants
            const codeIndexes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ*";

            // Determine ID - We'll prefer MId if present since isSet2 checks for MId first in your method
            const id = chip.MId || chip.SId;

            // Find the code index. Using the indexOf method to get the position of the code in the codeIndexes string.
            const rawCode = codeIndexes.indexOf(chip.code);

            // If the chip has an MId, we adjust the rawCode value.
            let code = (chip.MId) ? (2 * rawCode) + 1 : 2 * rawCode;

            return { id, code };
        },
        getChip() {
            //right now just get a random chip from all chips
            let chip = this.allChips[Math.floor(Math.random() * this.allChips.length)];
            return chip;
        },
        // Method to download the modified byteArray as a file
        downloadModifiedFile(byteArray) {
            const blob = new Blob([byteArray], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "modified_save.sav"; // Name your save file
            a.click();

            // cleanup
            URL.revokeObjectURL(url);
            a.remove();
        },
        // Method to compute the checksum
        computeChecksum(byteArray) {
            let checksum = this.computeRawChecksum(byteArray, CHECKSUM_OFFSET);

            if (this.gameName.includes("REXE6 G")) {
                checksum += 0x72;
            } else if (this.gameName.includes("REXE6 F")) {
                checksum += 0x18;
            }

            return checksum;
        },

        computeRawChecksum(byteArray, checksumOffset) {
            // Sum all the byte values in the byteArray
            let totalSum = 0;
            for (let i = 0; i < byteArray.length; i++) {
                if (i >= checksumOffset && i < checksumOffset + 4) {
                    // Log the bytes we're skipping to verify if they match the original checksum
                    console.log(`Skipped byte at index ${i}: ${byteArray[i].toString(16).padStart(2, '0')}`);
                    continue; // Skip the 4 bytes at the checksum offset
                }
                totalSum = (totalSum + byteArray[i]) >>> 0;
            }

            return totalSum;
        }

        ,

        indexOfSequence(array, sequence) {
            for (let i = 0; i < array.length - sequence.length + 1; i++) {
                let found = true;
                for (let j = 0; j < sequence.length; j++) {
                    if (array[i + j] !== sequence[j]) {
                        found = false;
                        break;
                    }
                }
                if (found) return i;
            }
            return -1;
        }

    }
});

