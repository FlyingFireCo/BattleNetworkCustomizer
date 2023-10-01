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

    },
    mounted() {
        this.fetchChips('giga', this.gigaList);
        this.fetchChips('mega', this.megaList);
        this.fetchChips('standard', this.standardList);
    },
    methods: {

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
        loadSaveFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            const expectedBytes = new TextEncoder().encode(this.gameName);

            const reader = new FileReader();
            reader.onload = (e) => {
                let fullByteArray = new Uint8Array(e.target.result);
                const byteArray = fullByteArray.slice(SAVE_START_OFFSET, SAVE_START_OFFSET + SAVE_SIZE);

                const originalByteArray = new Uint8Array(byteArray); // Make a copy of the original bytes for comparison later


                // Mask the entire data
                this.mask(byteArray);

                // Find the start position of the game name in the masked data
                this.stringPosition = this.indexOfSequence(byteArray, expectedBytes);

                // Extract the bytes for the full game name
                const gameNameBytes = byteArray.slice(GAME_NAME_OFFSET, GAME_NAME_OFFSET + 20);
                this.numFolders = byteArray[0x1c09];
                this.getEquippedFolder(byteArray);


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
                this.loadFolderChips(byteArray, this.selectedFolder);

                const originalChecksum = new DataView(byteArray.buffer).getUint32(CHECKSUM_OFFSET, true); // assuming little-endian
                console.log(`Original Checksum: ${originalChecksum}`);

                // Log bytes around the checksum for inspection
                const startLogOffset = CHECKSUM_OFFSET - 10; // 10 bytes before
                const endLogOffset = CHECKSUM_OFFSET + 14; // 10 bytes after + 4 bytes of checksum itself
                console.log(`Bytes around the checksum: ${Array.from(byteArray.slice(startLogOffset, endLogOffset)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                if (true) {//checksum debug
                    const newChecksum = this.computeChecksum(byteArray);
                    const checksumBytes = new Uint8Array(new Uint32Array([newChecksum]).buffer);
                    byteArray.set(checksumBytes, CHECKSUM_OFFSET);
                }
                const newChecksum = new DataView(byteArray.buffer).getUint32(CHECKSUM_OFFSET, true); // assuming little-endian
                console.log(`New Checksum: ${newChecksum}`);


                // Re-mask the entire data before saving
                this.mask(byteArray);
                this.compareAndLogDifferences(originalByteArray, byteArray);

                // Merge the modified byteArray back into fullByteArray
                fullByteArray.set(byteArray, SAVE_START_OFFSET);



                // Add a call to download the modified file
                this.downloadModifiedFile(fullByteArray); // Using fullByteArray here
            };

            reader.readAsArrayBuffer(file);
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
                let chipBytes = byteArray.slice(chipOffset, chipOffset + CHIP_SIZE);
                // chipBytes[0] = 250 + i;
                // chipBytes[1] = 0;

                const rawId = chipBytes[0];
                let id = rawId;
                let codeIndex = chipBytes[1]
                let isSet2 = false;
                if (chipBytes[1] % 2 == 1) {
                    codeIndex = parseInt(chipBytes[1] / 2);
                    //look at the MId
                    isSet2 = true;
                }
                else{
                    codeIndex = chipBytes[1] / 2;
                }



                // const chip = this.getChip();

                let codeIndexes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ*";

                let code = codeIndexes[codeIndex];

                let chip = this.allChips.find(c =>
                    (isSet2) ? c.MId == id : c.SId == id);

                //clone this chip object and create an instance of it with the current code
                chip = Object.assign({}, chip);
                chip.code = code;




                // codeIndex = codeIndexes.indexOf(chip.Code[0]);



                // let id = 0;
                // let code = 0;

                // if (chip.SId) {
                //     id = chip.SId;
                //     code = codeIndex * 2;
                // }
                // else if (chip.MId) {
                //     id = chip.MId;
                //     code = codeIndex * 2 +1;
                // }



                chipBytes[0] = id;
                chipBytes[1] = code;
                //i * 2 - 1 mega codes a-*
                //some mega chips are in standard set

                //need to remember to skip 18 (gun del sol ex)
                //37-39 are corn shot, but 

                // Extract the ID and Code from chipBytes
                // let id = (chipBytes[0]); // Get the first 9 bits

                // let code = (chipBytes[1]); // Get the first 9 bits

                //if id is 1 set the bytes to 2
                // if (id === 1) {
                //     chipBytes[0] = 0x04;
                //     chipBytes[1] = 0x00;
                //     id = (chipBytes[0] | ((chipBytes[1] & 0x1F) << 8)); // Get the first 9 bits
                // }

                //byteArray[chipOffset + 1] &= 0x0F; // Set the top 4 bits to 0
                // chipBytes = byteArray.slice(chipOffset, chipOffset + CHIP_SIZE);
                // const code = (chipBytes[1] >> 4); // Get the next 7 bits


                //set the changes back to the byteArray
                byteArray.set(chipBytes, chipOffset);
                console.log(`Chip ${i}:`, chipBytes);

                this.chips.push({ chip });
            }
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

            if (this.gameVariant === "Gregar") {
                checksum += 0x72;
            } else if (this.gameVariant === "Falzar") {
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

