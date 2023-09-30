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
        chips: []  // This will hold the chips for the selected folder
    },
    methods: {
        mask(byteArray, start, size) {
            const maskValue = byteArray[MASK_OFFSET];
            for (let i = start; i < start + size; i++) {
                byteArray[i] ^= maskValue;
            }
        },
        loadSaveFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            const expectedBytes = new TextEncoder().encode(this.gameName);

            const reader = new FileReader();
            reader.onload = (e) => {
                const byteArray = new Uint8Array(e.target.result);

                // Mask the entire data
                const mask = byteArray[MASK_OFFSET];
                for (let i = 0; i < byteArray.length; i++) {
                    byteArray[i] ^= mask;
                }

                // Find the start position of the game name in the masked data
                // this.stringPosition = this.indexOfSequence(byteArray, expectedBytes);

                // Extract the bytes for the full game name
                const gameNameBytes = byteArray.slice(SAVE_START_OFFSET + GAME_NAME_OFFSET, SAVE_START_OFFSET + GAME_NAME_OFFSET + 20);
                this.numFolders = byteArray[SAVE_START_OFFSET + 0x1c09];
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

                // Re-mask the entire data before saving
                for (let i = 0; i < byteArray.length; i++) {
                    byteArray[i] ^= mask;
                }
                const originalChecksum = new DataView(byteArray.buffer).getUint32(SAVE_START_OFFSET + CHECKSUM_OFFSET, true); // assuming little-endian
                console.log(`Original Checksum: ${originalChecksum}`);
                if (true) {//checksum debug
                    const newChecksum = this.computeChecksum(byteArray);
                    const checksumBytes = new Uint8Array(new Uint32Array([newChecksum]).buffer);
                    byteArray.set(checksumBytes, SAVE_START_OFFSET + CHECKSUM_OFFSET);

                }
                const newChecksum = new DataView(byteArray.buffer).getUint32(SAVE_START_OFFSET + CHECKSUM_OFFSET, true); // assuming little-endian
                console.log(`New Checksum: ${newChecksum}`);


                // Add a call to download the modified file
                this.downloadModifiedFile(byteArray);
            };

            reader.readAsArrayBuffer(file);
        },
        getEquippedFolder(byteArray) {
            // Use the method to get the naviStatsOffset
            const naviStatsOffset = this.getNaviStatsOffset(0); // Here I've assumed `0` for `naviId`, you'll need to adjust as necessary.
            this.selectedFolder = byteArray[naviStatsOffset + 0x2d];
        },

        getNaviStatsOffset(naviId) {
            return SAVE_START_OFFSET + 0x47cc + 0x64 * (naviId === 0 ? 0 : 1);
        },

        // This method will extract the chips for the given folder
        loadFolderChips(byteArray, folderIndex) {
            const chipStartOffset = CHIP_FOLDER_OFFSET + (folderIndex * CHIPS_PER_FOLDER * CHIP_SIZE);
            this.chips = []; // Clear chips array

            for (let i = 0; i < CHIPS_PER_FOLDER; i++) {
                const chipOffset = SAVE_START_OFFSET + chipStartOffset + (i * CHIP_SIZE);
                const chipBytes = byteArray.slice(chipOffset, chipOffset + CHIP_SIZE);

                // Extract the ID and Code from chipBytes
                const id = (chipBytes[0] | ((chipBytes[1] & 0x1F) << 8)); // Get the first 9 bits
                const code = (chipBytes[1] >> 4); // Get the next 7 bits
                // byteArray[chipOffset + 1] &= 0x0F; // Set the top 4 bits to 0


                this.chips.push({ id, code });
            }
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
            let checksum = this.computeRawChecksum(byteArray, SAVE_START_OFFSET + CHECKSUM_OFFSET);

            if (this.gameVariant === "Gregar") {
                checksum += 0x72;
            } else if (this.gameVariant === "Falzar") {
                checksum += 0x18;
            }

            return checksum;
        },

        computeRawChecksum(byteArray, checksumOffset) {
            // Sum all byte values in the buffer except the checksum bytes
            const totalSum = byteArray.reduce((acc, val, idx) => {
                // If the current index is within the range of the checksum bytes, don't include it in the sum
                if (idx >= checksumOffset && idx < checksumOffset + 4) {
                    return acc;
                }
                return acc + val;
            }, 0);

            const checksumSum = new DataView(byteArray.buffer).getUint32(checksumOffset, true);

            return totalSum - checksumSum;
        },

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

