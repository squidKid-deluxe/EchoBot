function stringToColor(str) {
    // Create a simple hash by taking the sum of character codes of the string
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i); // Simple hash formula
        hash |= 0; // Convert to 32-bit integer
    }

    // Use the hash to generate Hue, Saturation, and Value
    const hue = (hash & 0xFF) / 255 * 360; // Use the lower byte of the hash for Hue (0-360)
    const saturation = 0.5 + ((hash >> 8 & 0xFF) / 255) * 0.5; // Use the next byte for Saturation
    const value = 1; // Use the next byte for Value

    // Convert HSV to RGB (Using a simple conversion function)
    const rgb = hsvToRgb(hue, saturation, value);

    // Return the RGB color in CSS format
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// HSV to RGB conversion function
function hsvToRgb(h, s, v) {
    let r, g, b;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else {
        r = c;
        g = 0;
        b = x;
    }

    // Convert to RGB with the offset m and return as an object
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return [
        r,
        g,
        b
    ];
}

function findSubArrayIndex(arrays, target) {
    return arrays.findIndex(subArray =>
        subArray.length === target.length &&
        subArray.every((value, index) => value === target[index])
    );
}


function renderMessageDocument(message) {
    // Convert caption to HTML for display
    message.message.caption = message.message.caption ? message.message.caption.replaceAll("\n", "<br>") : "";
    return (
        `<a onclick="getFile('` +
        JSON.stringify(message.message.document).replaceAll('"', '&quot;').replaceAll("'", "&#39;").replaceAll("\n", "") +
        `')">` +
        message.message.document.file_name +
        ` (click)</a><br>` +
        DOMPurify.sanitize(converter.makeHtml(message.message.caption)) +
        `</td></tr>\n`
    );
}


async function renderMessagePhoto(message) {
    const url = new URL(apiUrl + '/getFile'); // Construct API endpoint for retrieving file
    url.searchParams.append('file_id', message.message.photo[message.message.photo.length - 1].file_id); // Specify file ID for Telegram API

    let fileURL = '';

    try {
        // Send request to retrieve file info from Telegram
        const response = await fetch(url);
        const data = await response.json();

        if (data.ok) {
            // Initiate download if the file retrieval was successful
            fileURL = `https://api.telegram.org/file/bot${TOKEN}/${data.result.file_path}`;
        } else {
            console.error('Failed to retrieve file info:', data);
        }
    } catch (error) {
        console.error('Error:', error); // Log error in case of failure
    }

    let row = `<img src="${fileURL}" height="300px">`;

    // Convert caption to HTML for display
    message.message.caption = (message.message.caption || "").replaceAll("\n", "<br>");
    row += `<br>${DOMPurify.sanitize(converter.makeHtml(message.message.caption))}</td></tr>\n`;

    return row;
}


async function renderMessageVideo(message) {
    const url = new URL(apiUrl + '/getFile'); // Construct API endpoint for retrieving file
    url.searchParams.append('file_id', message.message.video.file_id); // Specify file ID for Telegram API

    let fileURL = '';
    try {
        // Send request to retrieve file info from Telegram
        const response = await fetch(url);
        const data = await response.json();

        if (data.ok) {
            // Initiate download if the file retrieval was successful
            fileURL = `https://api.telegram.org/file/bot${TOKEN}/${data.result.file_path}`;
        } else {
            console.error('Failed to retrieve file info:', data);
        }
    } catch (error) {
        console.error('Error:', error); // Log error in case of failure
    }
    let row = `<video controls>
        <source src="${fileURL}">
        Your browser does not support HTML video.
    </video>
    `;

    // Convert caption to HTML for display
    message.message.caption = (message.message.caption || "").replaceAll("\n", "<br>");
    row += `<br>${DOMPurify.sanitize(converter.makeHtml(message.message.caption))}</td></tr>\n`;

    return row;
}


async function renderMessageAudio(message) {
    const url = new URL(apiUrl + '/getFile'); // Construct API endpoint for retrieving file
    url.searchParams.append('file_id', message.message.audio.file_id); // Specify file ID for Telegram API

    let fileURL = '';
    try {
        // Send request to retrieve file info from Telegram
        const response = await fetch(url);
        const data = await response.json();

        if (data.ok) {
            // Initiate download if the file retrieval was successful
            fileURL = `https://api.telegram.org/file/bot${TOKEN}/${data.result.file_path}`;
        } else {
            console.error('Failed to retrieve file info:', data);
        }
    } catch (error) {
        console.error('Error:', error); // Log error in case of failure
    }
    let row = `<audio controls>
        <source src="${fileURL}">
        Your browser does not support HTML audio.
    </audio>
    `;
    // audio files only
    if (!message.message.voice) {
        row += `<br>${message.message.audio.performer || ""} ${message.message.audio.title || ""} ${message.message.audio.file_name || ""}`
    }

    // Convert caption to HTML for display
    message.message.caption = (message.message.caption || "").replaceAll("\n", "<br>");
    row += `<br>${DOMPurify.sanitize(converter.makeHtml(message.message.caption))}</td></tr>\n`;

    return row;
}

function reverseObjectKeys(obj) {
    return Object.fromEntries(
        Object.entries(obj)
        .map(([key, value]) => [value, key])
    )
}

function getCurrentChat() {
    const radioButtons = document.getElementsByName('chatList');

    let selectedValue;
    // Get the selected radio button
    for (const radioButton of radioButtons) {
        if (radioButton.checked) {
            selectedValue = [radioButton.id.split("radioChat - ")[1], radioButton.value];
        }
    }
    if (!selectedValue) {
        selectedValue = [" - ", " - "]
    }
    return selectedValue;
}