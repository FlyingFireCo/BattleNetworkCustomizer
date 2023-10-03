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

class SeededRandom {
    constructor(seed) {
        const m = 0x80000000; // 2**31;
        const a = 1664525;
        const c = 1013904223;

        // Convert string seed to a number if a string is provided
        if (typeof seed === 'string') {
            seed = this.stringToSeed(seed);
        }

        this.state = seed ? seed % m : Math.floor(Math.random() * m);
    }

    stringToSeed(str) {
        let hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to a 32bit integer
        }
        return hash;
    }

    next() {
        this.state = (1664525 * this.state + 1013904223) % 0x80000000;
        return this.state / 0x80000000;
    }
}



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
        warnMessage: "",
        infoMessage: "",
        selectedItems: null,
        tangoSaveFolderName: '',
        showDialog: false,
        dialogTitle: "",
        maxMega: 5,
        maxGiga: 1,
        includeMaxMega: true,
        includeMaxGiga: true,
        includeFailsafeMaxMega: true,
        includeFailsafeMaxGiga: true,
        regged: null,
        tagged: [],
        dialogItems: [],
        selectedItem: null,
        dialogFilter: "",
        dialogCallback: null, // This will store a function to be executed on confirmation
        fullByteArray: null,
        byteArray: null,
        allowedCodes: "",
        allowedElements: "",
        allowFolderRules: true,
        alphabetSoup: false,
        alphabetSoupCodes: "ABCDEFGHIJKLMNOPQRSTUVWXYZ*",
        allowedTypes: { Standard: true, Mega: true, Giga: true },
        damageRange: { min: 0, max: 300 },
        mbRange: { min: 0, max: 99 },
        seed: null,
        numChips: 30,
        settingReg: false,
        settingTag: false,
        detailedFilter: {
            Name: '',
            Description: '',
            Damage: '',
            Code: '',
            Element: '',
            MB: ''
        },
        saveFileName: '',
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
                // If the chip has a damage range, extract the maximum value
                if (chip.Damage) {
                    //first check if string
                    if (typeof chip.Damage === 'string') {
                        if (chip.Damage.includes('-')) {
                            let parts = chip.Damage.split('-');
                            chip.Damage = parseInt(parts[1]);
                        }
                        else {
                            chip.Damage = parseInt(chip.Damage);
                        }
                    }
                }

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
                        if (this.detailedFilter[key]) {
                            if (key === 'Code') {
                                let searchCodes = this.detailedFilter.Code.split(',').map(code => code.trim());
                                if (!chip[key] || !searchCodes.includes(chip.Code)) {
                                    return false;
                                }
                            } else if (key === 'Element') {
                                let searchCodes = this.detailedFilter.Element.split(',').map(code => code.trim());
                                if (!chip[key] || !searchCodes.includes(chip.Element)) {
                                    return false;
                                }
                            } else {
                                // It checks for the presence of a chip key and if it doesn't match the filter, return false.
                                if (!chip[key] || !chip[key].toString().toLowerCase().includes(this.detailedFilter[key].toLowerCase())) {
                                    return false;
                                }
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
        setReg() {
            if (this.settingReg) {
                this.settingReg = false;
                return;
            }
            this.settingReg = true;
            this.settingTag = false;
        },
        setTag() {
            if (this.settingTag) {
                this.settingTag = false;
                return;
            }
            this.settingTag = true;
            this.settingReg = false;
            this.tagged = [];
        },
        clickChip(chip, index) {
            if (this.settingReg
                && !this.tagged.includes(index)) {
                if (this.regged == index) {
                    this.regged = 255;
                    return;
                }
                if (parseInt(chip.chip.MB) <= 50) {
                    this.regged = index;
                    this.settingReg = false;
                    return;
                }
            }
            if (this.settingTag
                && !this.tagged.includes(index)
                && this.regged != index) {
                this.tagged.push(index);
                if (this.tagged.length == 2) {
                    this.settingTag = false;
                    this.sortTaggedChips();
                }
                if (this.tagged.length > 2) {
                    this.tagged = [];
                    this.tagged.push(index);
                }
            }
        },

        sortTaggedChips() {
            // Store the tagged chips
            let firstTagged = this.chips[this.tagged[0]];
            let secondTagged = this.chips[this.tagged[1]];

            // Track if regged was displaced by the sort
            let reggedDisplaced = false;

            // Check if regged lies between the original positions of the tagged chips
            if (this.regged > this.tagged[0] && this.regged <= this.tagged[1]) {
                reggedDisplaced = true;
            }

            // Remove the tagged chips starting from the highest index
            if (this.tagged[0] > this.tagged[1]) {
                this.chips.splice(this.tagged[0], 1);
                this.chips.splice(this.tagged[1], 1);
            } else {
                this.chips.splice(this.tagged[1], 1);
                this.chips.splice(this.tagged[0], 1);
            }

            // Insert them back next to each other at the position of the first tagged chip
            this.chips.splice(this.tagged[0], 0, firstTagged, secondTagged);

            // Update the tagged indices
            this.tagged = [this.tagged[0], this.tagged[0] + 1];

            // If the regged index was displaced, adjust it
            if (reggedDisplaced) {
                this.regged += 1;
            }

            // Check if the regged index now matches a tagged index and move it if needed
            if (this.regged === this.tagged[0] || this.regged === this.tagged[1]) {
                this.regged += 1;  // Bump it one place forward
            }
        }
        ,

        canAddChipToFolder(newChip) {
            if (!this.allowFolderRules) return true;
            const currentCount = this.chips.filter(chip => chip.chip.Name === newChip.Name).length;

            // Check MB based limitations
            if (newChip.MB < 20 && currentCount >= 5) return false;
            if (newChip.MB >= 20 && newChip.MB < 30 && currentCount >= 4) return false;
            if (newChip.MB >= 30 && newChip.MB < 40 && currentCount >= 3) return false;
            if (newChip.MB >= 40 && newChip.MB < 50 && currentCount >= 2) return false;
            if (newChip.MB >= 50 && currentCount >= 1) return false;

            // Check Mega-class chips limitation
            if (this.megaList.some(chip => chip.Name === newChip.Name) && this.chips.filter(chip => this.megaList.some(megaChip => megaChip.Name === chip.chip.Name)).length >= this.maxMega) return false;

            // Check Giga-class chips limitation
            if (this.gigaList.some(chip => chip.Name === newChip.Name) && this.chips.filter(chip => this.gigaList.some(gigaChip => gigaChip.Name === chip.chip.Name)).length >= this.maxGiga) return false;

            return true;
        },
        generateRandomFolder() {
            let codeRequirements = {};  // e.g. { 'A': 15, 'E': 6 }
            let elementRequirements = {};  // e.g. { 'Aqua': 9, 'Break': 15 }

            let totalCodeCount = 0;
            let totalElementCount = 0;

            let didCodePercent = false;
            let didElementPercent = false;

            if (this.allowedCodes) {
                const codeParts = this.allowedCodes.split(',');
                for (let part of codeParts) {
                    let code, percentage;
                    if (part.includes('(')) {
                        [code, percentage] = part.split('(');
                        const actualPercentage = parseInt(percentage);
                        if (actualPercentage) {
                            const requiredChips = Math.round((actualPercentage / 100) * this.numChips);
                            codeRequirements[code.trim()] = requiredChips;
                            totalCodeCount += requiredChips;
                            didCodePercent = true;
                        }
                    } else {
                        code = part.trim();
                        codeRequirements[code] = 0; // Placeholder, we will compute the real number later.
                    }
                }
            }

            if (this.allowedElements) {
                const elementParts = this.allowedElements.split(',');
                for (let part of elementParts) {
                    let element, percentage;
                    if (part.includes('(')) {
                        [element, percentage] = part.split('(');
                        const actualPercentage = parseInt(percentage);
                        if (actualPercentage) {
                            const requiredChips = Math.round((actualPercentage / 100) * this.numChips);
                            elementRequirements[element.trim()] = requiredChips;
                            totalElementCount += requiredChips;
                            didElementPercent = true;
                        }
                    } else {
                        element = part.trim();
                        elementRequirements[element] = 0; // Placeholder, we will compute the real number later.
                    }
                }
            }

            // Check for any discrepancies in total counts and assign the rest to the "catch-all" categories.
            if (!codeRequirements['*'] && totalCodeCount < this.numChips && this.allowedCodes.length > 0 && didCodePercent) {
                codeRequirements['*'] = this.numChips - totalCodeCount;
            }

            if (!elementRequirements[''] && totalElementCount < this.numChips && this.allowedElements.length > 0 && didElementPercent) {
                elementRequirements[''] = this.numChips - totalElementCount; // Using empty string for the "None" element.
            }

            //create comma separated list of codeRequirement keys and allowed elements keys
            let codeKeys = Object.keys(codeRequirements).join(',');
            let elementKeys = Object.keys(elementRequirements).join(',');

            // Initialize random function with seed if provided
            const randomGenerator = this.seed ? new SeededRandom(this.seed) : { next: () => Math.random() };
            const alphabetSoupCodes = this.alphabetSoup ? [...this.alphabetSoupCodes] : [];

            // Consolidate chips based on allowedTypes
            let consolidatedChips = [];
            if (this.allowedTypes.Standard) consolidatedChips.push(...this.standardList);
            if (this.allowedTypes.Mega) consolidatedChips.push(...this.megaList);
            if (this.allowedTypes.Giga) consolidatedChips.push(...this.gigaList);

            // Dedicated filtering for alphabet soup
            let alphabetSoupFilteredChips = consolidatedChips.filter(chip => chip.Code.some(code => alphabetSoupCodes.includes(code)));
            this.chips = [];

            // For "alphabet soup", try to find a chip for each code
            for (let code of alphabetSoupCodes) {
                let matchingChips = alphabetSoupFilteredChips.filter(chip => chip.Code.includes(code));
                if (matchingChips.length > 0) {
                    let randomIndex = Math.floor(randomGenerator.next() * matchingChips.length);
                    let selectedChip = { ...matchingChips[randomIndex] };
                    selectedChip.code = code;
                    this.chips.push({ chip: selectedChip });
                    // Remove the selected chip from both lists
                    // consolidatedChips.splice(consolidatedChips.indexOf(selectedChip), 1);
                    // alphabetSoupFilteredChips.splice(alphabetSoupFilteredChips.indexOf(selectedChip), 1);
                }
            }


            // Standard filtering for the rest of the folder
            let standardFilteredChips = consolidatedChips.filter(chip => {
                // Filter by allowed elements
                if (elementKeys && !elementKeys.split(',').map(element => element.trim()).includes(chip.Element)) return false;

                // Filter by damage range
                // Check if string
                if (typeof chip.Damage === 'string') {
                    if (chip.Damage.includes('-')) {
                        let parts = chip.Damage.split('-');
                        chip.Damage = parseInt(parts[1]);
                    } else {
                        chip.Damage = parseInt(chip.Damage);
                    }
                }
                let damageValue = isNaN(chip.Damage) ? 0 : chip.Damage; // Treat NaN as 0
                if (this.damageRange.min && damageValue < this.damageRange.min) return false;
                if (this.damageRange.max && damageValue > this.damageRange.max) return false;

                // Filter by MB range
                let mbValue = parseInt(chip.MB);
                mbValue = isNaN(mbValue) ? 0 : mbValue; // Treat NaN as 0
                if (this.mbRange.min && mbValue < this.mbRange.min) return false;
                if (this.mbRange.max && mbValue > this.mbRange.max) return false;

                // If allowedCodes is specified, check if the chip has at least one matching code
                if (codeKeys) {
                    const allowedCodesArray = codeKeys.split(',').map(code => code.trim());
                    if (!chip.Code.some(code => allowedCodesArray.includes(code))) return false;
                }

                return true;
            });


            this.infoMessage = "";
            this.infoMessage += `Total available chips: ${standardFilteredChips.length}\n`;
            // Initialize dictionaries for counting elements and codes
            let elementCount = {};
            let codeCount = {};

            // Loop through standardFilteredChips to count elements and codes
            for (let chip of standardFilteredChips) {
                // Count elements
                if (chip.Element in elementCount) {
                    elementCount[chip.Element]++;
                } else {
                    elementCount[chip.Element] = 1;
                }

                // Count codes
                for (let code of chip.Code) {
                    if (code in codeCount) {
                        codeCount[code]++;
                    } else {
                        codeCount[code] = 1;
                    }
                }
            }

            // Sort and log element counts
            let sortedElementCounts = Object.entries(elementCount).sort(([, a], [, b]) => b - a);
            this.infoMessage += "Element Counts:\n";
            for (let [element, count] of sortedElementCounts) {
                this.infoMessage += `${element}: ${count}\n`;
            }

            // Sort and log code counts
            let sortedCodeCounts = Object.entries(codeCount).sort(([, a], [, b]) => b - a);
            this.infoMessage += "Code Counts:\n";
            for (let [code, count] of sortedCodeCounts) {
                this.infoMessage += `${code}: ${count}\n`;
            }


            // Function to check if a chip meets the code and element requirements.
            const meetsRequirements = (chip, requiredCode, requiredElement) => {
                const meetsCode = requiredCode ? chip.Code.includes(requiredCode) : true;
                const meetsElement = requiredElement ? chip.Element === requiredElement : true;
                return meetsCode && meetsElement;
            };

            // Function to add a certain amount of chips of a specific type, adhering to filters.
            const addChipsOfType = (typeList, maxCount, includeFailsafe, failsafeAlertMessage, requiredCount = null, requiredElement = null) => {
                let addedCount = 0;
                // This section of code needs modification:
                let filteredChipsOfType = standardFilteredChips.filter(chip => typeList.includes(chip) && meetsRequirements(chip, null, requiredElement));
                let failsafe = 0;
                while (((requiredCount && addedCount < requiredCount) || (addedCount < maxCount && !requiredCount)) && failsafe < 1000) {
                    if (this.chips.length >= 30) { break };
                    ++failsafe;
                    if (filteredChipsOfType.length == 0) {
                        break;
                    }
                    let randomIndex = Math.floor(randomGenerator.next() * filteredChipsOfType.length);
                    let selectedChip = { ...filteredChipsOfType[randomIndex] };
                    const allowedCodesArray = codeKeys ? codeKeys.split(',').map(code => code.trim()) : selectedChip.Code;
                    const validCodes = selectedChip.Code.filter(code => allowedCodesArray.includes(code));
                    selectedChip.code = validCodes[Math.floor(randomGenerator.next() * validCodes.length)];

                    if (this.canAddChipToFolder(selectedChip)) {
                        this.chips.push({ chip: selectedChip });
                        addedCount++;

                        // // Remove the selected chip from the list
                        // standardFilteredChips.splice(standardFilteredChips.indexOf(selectedChip), 1);
                        // filteredChipsOfType.splice(filteredChipsOfType.indexOf(selectedChip), 1);
                    }
                }

                // If we didn't add enough chips and failsafe is checked, select any chip of that type
                if (addedCount < maxCount && includeFailsafe) {
                    let failsafe = 0;
                    while (addedCount < maxCount && typeList.length > 0 && failsafe < 1000) {
                        ++failsafe;
                        let randomIndex = Math.floor(randomGenerator.next() * typeList.length);
                        let selectedChip = { ...typeList[randomIndex] };
                        //set the code to a random one from the list
                        selectedChip.code = selectedChip.Code[Math.floor(randomGenerator.next() * selectedChip.Code.length)];
                        this.chips.push({ chip: selectedChip });
                        addedCount++;

                        // Alert that failsafe was used
                        this.warnMessage += `\n${failsafeAlertMessage} - ${selectedChip.Name}`
                    }
                }
            };
            this.warnMessage = "";
            // Add Giga chips
            if (this.includeMaxGiga && !this.alphabetSoup) {
                addChipsOfType(this.gigaList, this.maxGiga, this.includeFailsafeMaxGiga, "Included Giga chips that don't match the filter due to failsafe.");
            }
            // Add Mega chips
            if (this.includeMaxMega && !this.alphabetSoup) {
                addChipsOfType(this.megaList, this.maxMega, this.includeFailsafeMaxMega, "Included Mega chips that don't match the filter due to failsafe.");
            }

            // Adding chips based on code requirements
            // Modify the loops for adding chips based on code and element requirements:
            for (let code in codeRequirements) {
                const requiredCount = codeRequirements[code];
                const chipsForCode = standardFilteredChips.filter(chip => chip.Code.includes(code));
                addChipsOfType(chipsForCode, requiredCount, false, `Not enough chips for code ${code} added.`, requiredCount);
            }

            for (let element in elementRequirements) {
                const requiredCount = elementRequirements[element];
                // Note: Now passing the required element into addChipsOfType
                addChipsOfType(standardFilteredChips, requiredCount, false, `Not enough chips for element ${element} added.`, requiredCount, element);
            }


            let failCount = 0;
            // Fill the rest of the folder with chips that adhere to the standard filtering criteria
            while (this.chips.length < this.numChips && standardFilteredChips.length > 0 && failCount < 1000) {
                let potentialChips = [];

                // If any code requirement is still unmet, filter chips for that code.
                for (let code in codeRequirements) {
                    if (this.chips.filter(chip => chip.code === code).length < codeRequirements[code]) {
                        potentialChips = standardFilteredChips.filter(chip => chip.Code.includes(code));
                        break;
                    }
                }
                // If any element requirement is still unmet, filter chips for that element.
                if (!potentialChips.length) {
                    for (let element in elementRequirements) {
                        if (this.chips.filter(chip => chip.Element === element).length < elementRequirements[element]) {
                            potentialChips = standardFilteredChips.filter(chip => chip.Element === element);
                            break;
                        }
                    }
                }

                // If there are no potential chips based on remaining requirements, fall back to standard logic.
                if (!potentialChips.length) {
                    potentialChips = standardFilteredChips;
                }

                let randomIndex = Math.floor(randomGenerator.next() * potentialChips.length);
                let selectedChip = { ...potentialChips[randomIndex] };

                // Assign a random code to the chip based on allowed codes or chip codes
                const allowedCodesArray = this.allowedCodes ? this.allowedCodes.split(',').map(code => code.trim()) : selectedChip.Code;
                const validCodes = selectedChip.Code.filter(code => allowedCodesArray.includes(code));
                selectedChip.code = validCodes[Math.floor(randomGenerator.next() * validCodes.length)];

                if (this.canAddChipToFolder(selectedChip)) {
                    this.chips.push({ chip: selectedChip });
                }
                else {
                    failCount++;
                }
            }

            //randomly reg a chip index 0-29
            this.regged = 255;
            let tryCount = 0;
            while (this.regged > 29 && tryCount < 1000) {
                ++tryCount;
                let index = Math.floor(randomGenerator.next() * 30);
                if (this.chips[index].chip.MB <= 50) {
                    this.regged = index;
                }
            }
            //randomly tag 2 chips that are not regged
            this.tagged = [];
            while (this.tagged.length < 2) {
                let randomIndex = Math.floor(randomGenerator.next() * 30);
                if (randomIndex != this.regged
                    && !this.tagged.includes(randomIndex)) {
                    this.tagged.push(randomIndex);
                }
            }
            this.sortTaggedChips();
            this.reorderRegTag();
            this.$forceUpdate();
        },
        reorderRegTag() {
            // Extract the regged and tagged chips
            const reggedChip = this.chips[this.regged];
            const firstTaggedChip = this.chips[this.tagged[0]];
            const secondTaggedChip = this.chips[this.tagged[1]];

            // Remove the regged and tagged chips from the array
            const removedChips = [reggedChip, firstTaggedChip, secondTaggedChip];
            this.chips = this.chips.filter((chip, index) => {
                return !removedChips.includes(chip);
            });

            // Insert the regged chip at the start
            this.chips.unshift(reggedChip);

            // Insert the tagged chips right after the regged chip
            this.chips.splice(1, 0, firstTaggedChip, secondTaggedChip);

            // Update the indices
            this.regged = 0;
            this.tagged = [1, 2];
        },
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

        loadFolderFromJson(folder) {
            this.chips = []; // Clear chips array
            jsonChips = folder.RawChips;
            this.regged = folder.Regged;
            this.tagged = folder.Tagged;
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
                || !this.canAddChipToFolder(chip)) return; // Don't add if the folder is full
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
                this.saveFileName = this.selectedItem;

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



            // Mask the entire data
            this.mask(this.byteArray);


            // Add a call to download the modified file
            // this.downloadModifiedFile(fullByteArray); // Using fullByteArray here

        },


        async overwriteSave() {

            // Re-mask the entire data before saving
            this.mask(this.byteArray);

            const originalChecksum = new DataView(this.byteArray.buffer).getUint32(CHECKSUM_OFFSET, true); // assuming little-endian
            console.log(`Original Checksum: ${originalChecksum}`);

            // Log bytes around the checksum for inspection
            const startLogOffset = CHECKSUM_OFFSET - 10; // 10 bytes before
            const endLogOffset = CHECKSUM_OFFSET + 14; // 10 bytes after + 4 bytes of checksum itself
            console.log(`Bytes around the checksum: ${Array.from(this.byteArray.slice(startLogOffset, endLogOffset)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);


            const rawChips = this.chips.map(chipObj => this.chipToRaw(chipObj.chip));

            const chipStartOffset = CHIP_FOLDER_OFFSET + (this.selectedFolder * CHIPS_PER_FOLDER * CHIP_SIZE);

            for (let i = 0; i < CHIPS_PER_FOLDER; i++) {
                const chipOffset = chipStartOffset + (i * CHIP_SIZE);
                const chipBytes = this.byteArray.slice(chipOffset, chipOffset + CHIP_SIZE);

                chipBytes[0] = rawChips[i].id;
                chipBytes[1] = rawChips[i].code;

                // Set the changes back to the byteArray
                this.byteArray.set(chipBytes, chipOffset);
            }

            // Set the reg chip index
            const regChipIndexOffset = this.getNaviStatsOffset(0) + 0x2e + this.selectedFolder;
            if (this.regged < 30) {
                this.byteArray[regChipIndexOffset] = this.regged;
            } else {
                this.byteArray[regChipIndexOffset] = 0xff; // default or error value
            }

            // Set the tagged chip indexes
            const taggedChipsOffset = this.getNaviStatsOffset(0) + 0x56 + this.selectedFolder * 2;
            if (this.tagged && this.tagged.length >= 2) {
                this.byteArray[taggedChipsOffset] = this.tagged[0];
                this.byteArray[taggedChipsOffset + 1] = this.tagged[1];
            } else {
                this.byteArray[taggedChipsOffset] = 0xff; // default or error value
                this.byteArray[taggedChipsOffset + 1] = 0xff; // default or error value
            }




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

            // Call the API to overwrite the save file
            await this.saveToServer(this.saveFileName, this.fullByteArray);
        },

        async saveToServer(filename, data) {
            try {
                const requestData = {
                    filename: filename,
                    data: Array.from(data) // Convert Uint8Array to regular array for JSON serialization
                };

                const response = await fetch("/save/OverwriteSaveData", {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const responseData = await response.json();
                if (responseData.success) {
                    console.log("Save data successfully written to server.");
                } else {
                    console.error("Error from server:", responseData.message);
                }

            } catch (error) {
                console.error("Error saving data to server:", error);
            }
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

        regularChipIndex(folderIndex) {
            if (folderIndex >= this.numFolders || !this.byteArray) {
                return null;
            }

            const naviStatsOffset = this.getNaviStatsOffset(0);
            const idx = this.byteArray[naviStatsOffset + 0x2e + folderIndex];

            return idx >= 30 ? null : idx;
        },

        tagChipIndexes(folderIndex) {
            if (folderIndex >= this.numFolders || !this.byteArray) {
                return null;
            }


            const naviStatsOffset = this.getNaviStatsOffset(0);
            const tagChipsOffset = naviStatsOffset + 0x56 + folderIndex * 2;

            const idx1 = this.byteArray[tagChipsOffset];
            const idx2 = this.byteArray[tagChipsOffset + 1];

            return idx1 === 0xff || idx2 === 0xff ? null : [idx1, idx2];
        },
        isRegged(chipIndex) {
            return this.regged === chipIndex;
        },

        isTagged(chipIndex) {
            if (this.tagged) {
                return this.tagged.includes(chipIndex);
            }
            return false;
        },

        // This method will extract the chips for the given folder
        loadFolderChips(byteArray, folderIndex) {
            const chipStartOffset = CHIP_FOLDER_OFFSET + (folderIndex * CHIPS_PER_FOLDER * CHIP_SIZE);
            this.chips = []; // Clear chips array

            this.regged = this.regularChipIndex(folderIndex);
            this.tagged = this.tagChipIndexes(folderIndex);

            if (!this.tagged) {
                this.tagged = [];
            }

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
            let folder = {
                regged: this.regged,
                tagged: this.tagged,
                rawChips: rawChips,
            }

            // Make an HTTP POST request using fetch
            try {
                const response = await fetch(`/folders/${this.folderName}`, {  // Modified the URL to include folderName
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(folder)  // Sending rawChips directly without wrapping in an object
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

