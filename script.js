let currentFilteredCombinations = [];

async function loadMatches() {
    const response = await fetch("matches1.json");
    const matches = await response.json();

    const tbody = document.getElementById("matchesBody");
    tbody.innerHTML = "";

    matches.forEach((match, index) => {
        const i = index + 1;
        tbody.insertAdjacentHTML("beforeend", `
            <tr>
                <td>${i}</td>
                <td>${match.home}</td>
                <td>${match.away}</td>
                <td class="choices">
                    <label><input type="checkbox" name="match${i}" value="1"> 1</label>
                    <label><input type="checkbox" name="match${i}" value="0"> 0</label>
                    <label><input type="checkbox" name="match${i}" value="2"> 2</label>
                </td>
            </tr>
        `);
    });
}

window.onload = loadMatches;

function generateCombinations() {
    const selections = [];
    const totalMatches = 15;
    const MAX_COMBINATIONS = 20000;

    for (let i = 1; i <= totalMatches; i++) {
        const checked = document.querySelectorAll(`input[name="match${i}"]:checked`);
        if (checked.length === 0) {
            alert(`Please select at least one option for match ${i}`);
            return;
        }
        selections.push(Array.from(checked).map(cb => cb.value));
    }

    const maxDrawsAllowed = parseInt(document.getElementById("maxDraws").value);
    const maxConsecDraws = parseInt(document.getElementById("maxConsecutiveDraws").value);
    const maxHome = document.getElementById("maxHomeWins").value === "15" ? 15 : parseInt(document.getElementById("maxHomeWins").value);
    const minAway = parseInt(document.getElementById("minAwayWins").value);
    const minDrawsAllowed = parseInt(document.getElementById("minDraws").value);
    const minDrawsGroup1 = parseInt(document.getElementById("minDrawsGroup1").value);
    const maxDrawsGroup1 = parseInt(document.getElementById("maxDrawsGroup1").value);
    const minDrawsGroup2 = parseInt(document.getElementById("minDrawsGroup2").value);
    const maxDrawsGroup2 = parseInt(document.getElementById("maxDrawsGroup2").value);

    let combinations = [[]];
    for (const matchChoices of selections) {
        const newCombinations = [];
        for (const combo of combinations) {
            for (const choice of matchChoices) {
                newCombinations.push([...combo, choice]);
            }
        }
        combinations = newCombinations;

        if (combinations.length > MAX_COMBINATIONS * 2) {
            alert("Too many combinations before filtering. Reduce double/closed matches.");
            return;
        }
    }

    function hasTooManyConsecutiveDraws(combo) {
        let streak = 0;
        for (const r of combo) {
            if (r === "0") {
                streak++;
                if (streak > maxConsecDraws) return true;
            } else {
                streak = 0;
            }
        }
        return false;
    }

    currentFilteredCombinations = combinations.filter(combo => {
        const draws = combo.filter(r => r === "0").length;
        const homes = combo.filter(r => r === "1").length;
        const aways = combo.filter(r => r === "2").length;
        const tooManyConsec = hasTooManyConsecutiveDraws(combo);

        // NEW: Group draw counts
        const drawsGroup1 = combo.slice(0, 8).filter(r => r === "0").length;   // Matches 1–8
        const drawsGroup2 = combo.slice(8, 15).filter(r => r === "0").length;  // Matches 9–15

        return draws <= maxDrawsAllowed &&
               draws >= minDrawsAllowed &&
               !tooManyConsec &&
               homes <= maxHome &&
               aways >= minAway &&
               drawsGroup1 >= minDrawsGroup1 &&
               drawsGroup1 <= maxDrawsGroup1 &&
               drawsGroup2 >= minDrawsGroup2 &&
               drawsGroup2 <= maxDrawsGroup2;
    });

    let output = `Raw combinations: ${combinations.length.toLocaleString()}\n`;
    output += `Filtered down to: ${currentFilteredCombinations.length.toLocaleString()} columns\n`;
    output += `Estimated cost: ~${(currentFilteredCombinations.length * 10).toLocaleString()} TL\n\n`;

    output += `Active filters:\n`;
    output += `  • Global draws: ${minDrawsAllowed}–${maxDrawsAllowed}\n`;
    output += `  • Group 1 (1–8): ${minDrawsGroup1}–${maxDrawsGroup1} draws\n`;
    output += `  • Group 2 (9–15): ${minDrawsGroup2}–${maxDrawsGroup2} draws\n`;
    output += `  • Max ${maxConsecDraws} consecutive draws\n`;
    output += `  • Max ${maxHome === 15 ? "unlimited" : maxHome} home wins\n`;
    output += `  • Min ${minAway} away wins\n\n`;

    if (currentFilteredCombinations.length === 0) {
        output += "No combinations left! Try loosening some filters.";
    } else if (currentFilteredCombinations.length > 1000) {
        output += `First 500 shown (total: ${currentFilteredCombinations.length}):\n\n`;
        currentFilteredCombinations.slice(0, 500).forEach((combo, idx) => {
            output += `${(idx + 1).toString().padStart(3)}: ${combo.join(" ")}\n`;
        });
        output += `\n... and ${currentFilteredCombinations.length - 500} more.`;
    } else {
        currentFilteredCombinations.forEach((combo, idx) => {
            output += `${(idx + 1).toString().padStart(3)}: ${combo.join(" ")}\n`;
        });
    }

    document.getElementById("output").textContent = output;
    document.getElementById("filterInfo").textContent = 
        `Active: Global ${minDrawsAllowed}–${maxDrawsAllowed} draws | Group1 ${minDrawsGroup1}–${maxDrawsGroup1} | Group2 ${minDrawsGroup2}–${maxDrawsGroup2} | ≤${maxConsecDraws} consec. | ≤${maxHome === 15 ? "∞" : maxHome} home | ≥${minAway} away`;    
    document.getElementById("checkButton").disabled = currentFilteredCombinations.length === 0;
    document.getElementById("copyButton").disabled = currentFilteredCombinations.length === 0;
    document.getElementById("csvButton").disabled = currentFilteredCombinations.length === 0;
    document.getElementById("copyFeedback").textContent = "";
}

function checkResults() {
    const input = document.getElementById("officialResults").value.trim();
    if (!input) {
        alert("Please paste the official 15 results first!");
        return;
    }

    const official = input.split(/\s+/).filter(s => s !== "");
    if (official.length !== 15 || official.some(r => !["0","1","2"].includes(r))) {
        alert("Invalid format! Must be exactly 15 numbers (0, 1, or 2) separated by spaces.");
        return;
    }

    if (currentFilteredCombinations.length === 0) {
        alert("Generate filtered combinations first!");
        return;
    }

    let hits15 = 0, hits14 = 0, hits13 = 0, hits12 = 0;
    let winningLines = [];

    currentFilteredCombinations.forEach((combo, idx) => {
        let correct = 0;
        for (let i = 0; i < 15; i++) {
            if (combo[i] === official[i]) correct++;
        }

        if (correct >= 12) {
            if (correct === 15) hits15++;
            else if (correct === 14) hits14++;
            else if (correct === 13) hits13++;
            else if (correct === 12) hits12++;

            let mark = "";
            if (correct === 15) mark = '<span class="highlight-15">***15***</span>';
            else if (correct === 14) mark = '<span class="highlight-14">**14**</span>';
            else if (correct === 13) mark = '<span class="highlight-13">*13*</span>';
            else if (correct === 12) mark = '<span class="highlight-12">12</span>';

            winningLines.push(`${(idx + 1).toString().padStart(4)}: ${combo.join(" ")} → ${correct} correct ${mark}`);
        }
    });

    let output = `<strong>RESULTS CHECK SUMMARY</strong>\n`;
    output += `Official results: ${official.join(" ")}\n\n`;

    if (winningLines.length > 0) {
        output += `<strong>Hits ≥12 correct:</strong>\n`;
        output += winningLines.join("\n") + "\n\n";
    }

    output += `<strong>SUMMARY:</strong>\n`;
    if (hits15 > 0) output += `🎉 ${hits15} column(s) with 15 correct! (Jackpot!)\n`;
    if (hits14 > 0) output += `✅ ${hits14} column(s) with 14 correct\n`;
    if (hits13 > 0) output += `👍 ${hits13} column(s) with 13 correct\n`;
    if (hits12 > 0) output += `💰 ${hits12} column(s) with 12 correct\n`;
    if (winningLines.length === 0) output += `😔 No columns with 12 or more correct.\n`;

    output += `\nTotal prize-winning columns (≥12): ${winningLines.length}\n`;
    output += `(Actual prize amounts vary weekly — check official sites!)\n`;

    document.getElementById("output").innerHTML = output;
    document.getElementById("checkFeedback").textContent = "✓ Results checked successfully!";
    setTimeout(() => document.getElementById("checkFeedback").textContent = "", 4000);
}

function copyToClipboard() {
    if (currentFilteredCombinations.length === 0) return;

    const cleanText = currentFilteredCombinations
        .map(combo => combo.join(" "))
        .join("\n");

    navigator.clipboard.writeText(cleanText).then(() => {
        document.getElementById("copyFeedback").textContent = "✓ Copied all columns to clipboard!";
        setTimeout(() => document.getElementById("copyFeedback").textContent = "", 3000);
    });
}

function clearSelections() {
    document.getElementById("output").textContent = "Cleared.";
    document.getElementById("filterInfo").textContent = "";
    document.getElementById("copyFeedback").textContent = "";
    document.getElementById("checkFeedback").textContent = "";
    document.getElementById("officialResults").value = "";
    document.getElementById("checkButton").disabled = true;
    document.getElementById("copyButton").disabled = true;
    currentFilteredCombinations = [];

    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function downloadCSV() {
    if (currentFilteredCombinations.length === 0) {
        alert("No columns to export! Generate filtered combinations first.");
        return;
    }

    // Header row
    let csvContent = "Column,Match1,Match2,Match3,Match4,Match5,Match6,Match7,Match8,Match9,Match10,Match11,Match12,Match13,Match14,Match15\n";

    // Data rows
    currentFilteredCombinations.forEach((combo, index) => {
        const columnNumber = index + 1;
        const row = [columnNumber, ...combo].join(",");
        csvContent += row + "\n";
    });

    // Create downloadable file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `zlg-columns-${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function checkCSVResults() {
    const fileInput = document.getElementById("csvFileInput");
    const officialInput = document.getElementById("officialResults").value.trim();

    if (!fileInput.files.length) {
        alert("Please upload a CSV file first!");
        return;
    }

    if (!officialInput) {
        alert("Please paste the official 15 results first!");
        return;
    }

    const official = officialInput.split(/\s+/).filter(s => s !== "");
    if (official.length !== 15 || official.some(r => !["0","1","2"].includes(r))) {
        alert("Invalid official results! Must be 15 numbers (0/1/2) separated by spaces.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',');

        if (headers.length < 16 || !headers.includes('Column')) {
            alert("Invalid CSV! Must have 'Column' + 'Match1' to 'Match15'.");
            return;
        }

        const predictions = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            const matches = row.slice(1, 16); // Match1 to Match15
            if (matches.length === 15) {
                predictions.push(matches);
            }
        }

        let hitsAbove12 = 0, hits13 = 0, hits14 = 0, hits15 = 0;
        let winningDetails = [];

        predictions.forEach((combo, idx) => {
            let correct = 0;
            for (let j = 0; j < 15; j++) {
                if (combo[j] === official[j]) correct++;
            }

            if (correct > 12) {
                hitsAbove12++;
                if (correct === 13) hits13++;
                else if (correct === 14) hits14++;
                else if (correct === 15) hits15++;
                winningDetails.push(`Column ${idx + 1}: ${combo.join(" ")} → ${correct} correct`);
            }
        });

        let output = `<strong>CSV CHECK SUMMARY</strong>\n`;
        output += `Total columns in CSV: ${predictions.length}\n`;
        output += `Columns with more than 12 correct: ${hitsAbove12}\n`;
        output += ` - 13 correct: ${hits13}\n`;
        output += ` - 14 correct: ${hits14}\n`;
        output += ` - 15 correct: ${hits15}\n\n`;

        if (winningDetails.length > 0) {
            output += `<strong>Good columns (>12 correct):</strong>\n`;
            output += winningDetails.join("\n") + "\n";
        } else {
            output += "No columns with more than 12 correct.\n";
        }

        document.getElementById("output").innerHTML = output;
        document.getElementById("checkFeedback").textContent = "✓ CSV checked!";
        setTimeout(() => document.getElementById("checkFeedback").textContent = "", 4000);
    };

    reader.readAsText(file);
}

async function loadLatestWeek() {
    try {
        // Use a CORS proxy to fetch Misli page (free, no key)
        const proxyUrl = "https://cors-anywhere.herokuapp.com/";
        const targetUrl = "https://www.misli.com/spor-toto/"; // Or /mac-sonuclari for results
        const response = await fetch(proxyUrl + targetUrl);
        const html = await response.text();

        // Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Find match rows (Misli uses <tr> with class for matches)
        const matchRows = doc.querySelectorAll("tr.match-row"); // Adjust selector based on real page
        if (matchRows.length !== 15) {
            alert("Could not find 15 matches! Check site or try again.");
            return;
        }

        const matches = [];
        matchRows.forEach(row => {
            const home = row.querySelector(".home-team").textContent.trim();
            const away = row.querySelector(".away-team").textContent.trim();
            matches.push({ home, away });
        });

        // Populate table (same as loadMatches)
        const tbody = document.getElementById("matchesBody");
        tbody.innerHTML = "";

        matches.forEach((match, index) => {
            const i = index + 1;
            tbody.insertAdjacentHTML("beforeend", `
                <tr>
                    <td>${i}</td>
                    <td>${match.home}</td>
                    <td>${match.away}</td>
                    <td class="choices">
                        <label><input type="checkbox" name="match${i}" value="1"> 1</label>
                        <label><input type="checkbox" name="match${i}" value="0"> 0</label>
                        <label><input type="checkbox" name="match${i}" value="2"> 2</label>
                    </td>
                </tr>
            `);
        });

        alert("Latest week loaded successfully!");
    } catch (error) {
        alert("Error loading latest week: " + error.message + "\nTry refreshing or use manual JSON.");
    }
}

// Enable/disable Check CSV button when file is selected
document.addEventListener("DOMContentLoaded", function() {
    const fileInput = document.getElementById("csvFileInput");
    const checkButton = document.getElementById("checkCSVButton");

    if (fileInput && checkButton) {
        fileInput.addEventListener("change", function() {
            checkButton.disabled = this.files.length === 0;
        });
    }
});



