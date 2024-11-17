// Replace with your own Telegram Bot API token
const TOKEN = ''; // Add your bot token here
const BACKUP_PORT = 8123;

const DEV_NOTIFY = false;

const apiUrl = `https://api.telegram.org/bot${TOKEN}`; // Base URL for Telegram Bot API

// Markdown converter for formatting messages
const converter = new showdown.Converter();

// Store message IDs of messages sent in the chat, but keep messages sent and those received separate
var personalMessageIds = {};
var serverMessageIds = {};

// Offset to avoid receiving duplicate messages (to track latest updates)
let lastUpdateId = 0;

// Timeout in seconds for long polling
const timeout = 300;

// List of allowed update types (only listening for messages here)
const allowedUpdates = ['message', 'edited_message'];

let chatsAvailable = [];

let userList = {};

function updateChatList() {
    const radioContainer = document.getElementById('chatList-container');

    const selectedValue = getCurrentChat();
    // Clear existing options
    radioContainer.innerHTML = '';

    chatsAvailable.sort((a, b) => (a[0] + a[2]).localeCompare(b[0] + b[2]));

    // Add new options from the list
    chatsAvailable.forEach(optionData => {
        // Create a div to wrap the radio button and label
        const radioWrapper = document.createElement('div');

        // Create the radio input
        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = 'chatList'; // All radio buttons will have the same name to be part of the same group
        radioInput.value = optionData[0] + " - " + optionData[2]; // Value is the same as textcontent
        radioInput.id = "radioChat - " + optionData[1] + " - " + (optionData[3] || ""); // id is unique

        // Create the label
        const label = document.createElement('label');
        label.setAttribute('for', radioInput.id); // Associate the label with the radio button
        label.textContent = optionData[0] + " - " + optionData[2]; // Set the label text

        // Append the radio button and label to the wrapper
        radioWrapper.appendChild(radioInput);
        radioWrapper.appendChild(label);

        // Add the wrapper to the container (where radio buttons will be displayed)
        radioContainer.appendChild(radioWrapper);
    });

    // Restore the selected option based on the saved value
    if (selectedValue) {
        const selectedOption = Array.from(document.getElementsByName("chatList")).find(opt => opt.id.split("radioChat - ")[1] === selectedValue[0] && opt.value === selectedValue[1]);
        if (selectedOption) {
            selectedOption.checked = true; // Mark the option as selected
        }
    }

    // Update list of tables.  Keep table if existing, otherwise create fresh table
    tables = document.getElementsByClassName("chatTable");
    tableHolder = document.getElementById("chatHolder");
    // for each chat we have access to
    chatsAvailable.forEach(optionData => {
        // chat id - chat name - topic name
        const tableId = optionData[1] + " - " + optionData[0] + " - " + optionData[2]
        // if there is not a table for it
        if (!document.querySelector(`table[id="${tableId}"]`)) {
            // create one
            // Create a new table element
            const newTable = document.createElement('table');
            newTable.id = tableId;
            newTable.classList.add('chatTable');

            // Create a row with a placeholder message
            const newRow = document.createElement('tr');
            const newCell = document.createElement('th');
            newCell.textContent = 'Loading chat data...'; // Set the placeholder message
            newRow.appendChild(newCell); // Append the cell to the row

            // Append the row to the table
            newTable.appendChild(newRow);

            // Append the new table to the tableHolder
            tableHolder.appendChild(newTable);
        }
    })
    for (table of tables) {
        table.style.display = "none";
        // if the table is not an available chat, delete it.
        if (!chatsAvailable.some(sub => sub[1] + " - " + sub[0] + " - " + sub[2] == table.id)) {
            tableHolder.removeChild(table)
        }
    }
    try {
        document.getElementById(selectedOption.id.split(" - ")[1] + " - " + selectedOption.value).style.display = "block";
    } catch {}
}

/**
 * Escapes special characters in messages to adhere to Telegram MarkdownV2 formatting requirements
 * @param {string} message - Message text to escape
 * @returns {string} - Escaped message
 */
function escapeMessage(message) {
    // "inverts" the characters required to be escaped
    // i.e. "(escape) \(escape\)" becomes "\(escape\) (escape)"
    return message.replace(
        /[\!\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.]/g, "\\$&"
    ).replace(
        /\\{2}([\!\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.])/g, "$1"
    );
}

/**
 * Opens the specified modal by setting its display to flex and populates it with data
 * @param {string} elem_id - The ID of the modal element
 * @param {string} data - Data to be displayed or edited in the modal
 */
function openModal(elem_id, data) {
    const modal = document.getElementById(elem_id);
    modal.style.display = "flex"; // Show the modal
    modal.dataElemId = data; // Store data ID within the modal for later use
    if (elem_id === "editModal") { // If edit modal, load data into edit box
        const editBox = document.getElementById("editBox");
        editBox.value = converter.makeMarkdown(document.getElementById(data).cells[1].innerHTML).replaceAll("<br>", "").replaceAll("\n\n", "\n");
        editBox.focus()
        auto_height(editBox); // Adjust height to fit content
    }
}

/**
 * Closes the specified modal by hiding it
 * @param {string} elem_id - The ID of the modal element
 */
function closeModal(elem_id) {
    document.getElementById(elem_id).style.display = "none"; // Hide modal
}

/**
 * Adjusts the height of the textarea dynamically to fit its content
 * @param {HTMLElement} elem - The textarea element to resize
 */
function auto_height(elem) {
    elem.style.height = '1px'; // Reset height to enable resizing
    elem.style.height = `${elem.scrollHeight}px`; // Set height based on content
}

/**
 * Edits an existing message using the Telegram API and updates the displayed message in the interface
 */
function editMessage() {
    const message = document.getElementById("editBox").value; // Get edited message text
    const url = new URL(apiUrl + '/editMessageText'); // Construct API endpoint for editing message
    url.searchParams.append('chat_id', getCurrentChat()[0].split(" - ")[0]); // Specify the chat ID
    url.searchParams.append('message_id', personalMessageIds[document.getElementById("editModal").dataElemId].split("/")[0]); // Specify message ID
    url.searchParams.append('text', escapeMessage(message)); // Escape and append message text
    url.searchParams.append('parse_mode', 'MarkdownV2'); // Set parse mode for formatting

    // Send the edit request to the Telegram API
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                // Handle message response if successful
                handleMessages([{
                    "message": data.result
                }], true);
            }
        })
        .catch(error => {
            console.error('Error:', error); // Log error in case of failure
        });
}

/**
 * Deletes a message by calling the Telegram API and removes it from the chat display
 * @param {string} elem_id - The ID of the message element to delete
 */
function deleteMessage(elem_id) {
    const url = new URL(apiUrl + '/deleteMessage'); // Construct API endpoint for deleting message
    url.searchParams.append('chat_id', getCurrentChat()[0].split(" - ")[0]); // Specify the chat ID
    url.searchParams.append('message_id', personalMessageIds[elem_id].split("/")[0]); // Specify message ID

    // Send delete request to Telegram API
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                // Remove the message from the HTML document if deletion was successful
                document.getElementById(elem_id).remove();
            }
        })
        .catch(error => {
            console.error('Error:', error); // Log error in case of failure
        });
}


function updateAvailChats(message) {
    if (findSubArrayIndex(chatsAvailable, [message.message.chat.title, message.message.chat.id, message.message.topic_name, message.message.topic_id]) === -1) {
        chatsAvailable.push([message.message.chat.title, message.message.chat.id, message.message.topic_name, message.message.topic_id]);
        updateChatList();
    }
}


function updateUserList(chat_id) {
    userListElement = document.getElementById("userList");

    userListElement.innerHTML = ""

    const new_chat_id = chat_id ? chat_id : parseInt(getCurrentChat()[0].split(" - ")[0]);

    if (new_chat_id) {
        for (const user of userList[new_chat_id]) {
            userListElement.innerHTML += `<li style="color:${stringToColor(user)}">${user}</li>`;
        }
    }
}


function viewReply(message_id) {
    const chat_id = getCurrentChat()[0].split(" - ")[0];

    const row = document.getElementById(reverseObjectKeys(serverMessageIds)[message_id + "/" + chat_id] || reverseObjectKeys(personalMessageIds)[message_id + "/" + chat_id]);
    if (row) {
        row.scrollIntoView();
        // Remove the animation class if it exists, to reset the animation
        row.classList.remove('reply-animation');
        // Trigger a reflow/repaint (this is necessary for the animation to restart)
        void row.offsetWidth;
        // Re-add the animation class
        row.classList.add('reply-animation');
    } else {
        // Telegram api does not support fetching messages previous to the bot's starting.
    }
}


function renderMessageUser(message, chatTable, messageType) {
    let rowToEdit = null; // Optional variable to track row for editing purposes

    const absoluteId = message.message.message_id + "/" + message.message.chat.id

    // Select the appropriate ID map based on the message type
    const reversedIds = reverseObjectKeys(messageType === 'personal' ? personalMessageIds : serverMessageIds);

    let clientMessageId = null; // Variable for client-side message ID
    if (reversedIds[absoluteId]) {
        clientMessageId = reversedIds[absoluteId];
        rowToEdit = Array.from(chatTable.rows).indexOf(document.getElementById(clientMessageId));
    } else {
        clientMessageId = `${messageType}Message${Object.keys(messageType === 'personal' ? personalMessageIds : serverMessageIds).length}id${message.message.chat.id}`;
    }
    if (!userList[message.message.chat.id]) {
        userList[message.message.chat.id] = [];
    }
    if (!userList[message.message.chat.id].includes(message.message.from.first_name)) {
        userList[message.message.chat.id].push(message.message.from.first_name);
        updateUserList(message.message.chat_id);
    }

    // Create the row HTML
    const row = (
        `<td style="color:` +
        stringToColor(message.message.from.first_name) +
        `">` +
        ((message.message.reply_to_message && !message.message.topic_name) ? `<a class="reply" onclick="viewReply(${message.message.reply_to_message.message_id})">⮣${message.message.reply_to_message.from.first_name}<br></a>` : "") +
        message.message.from.first_name +
        `<br>` +
        new Date(message.message.date * 1000).toLocaleString() +
        `</td><td>`
    );

    // Update the appropriate ID map
    if (messageType === 'personal') {
        personalMessageIds[clientMessageId] = absoluteId;
    } else {
        serverMessageIds[clientMessageId] = absoluteId;
    }

    return [row, rowToEdit, clientMessageId];
}

/**
 * Handles incoming messages by processing and displaying them in the chat interface
 * @param {Array} messages - Array of messages to process
 * @param {boolean} personal - Flag indicating if the messages are personal messages
 */
function handleMessages(messages, personal) {
    messages.forEach(async message => {
        let row = ''; // Initialize row variable to construct message row
        let rowToEdit = null; // Optional variable to track row for editing purposes
        let clientMessageId;

        // messages and edited messages are handled in the same way, so call them the same thing
        if (!message.message && message.edited_message) {
            message.message = message.edited_message;
        }
        // private messages have names, not titles
        if (message.message.chat.type === "private") {
            message.message.chat.title = message.message.chat.first_name;
        }
        // topics come through as replies to the topic creation event
        message.message.topic_name = ""
        message.message.topic_id = ""
        if (message.message.reply_to_message && message.message.reply_to_message.forum_topic_created) {
            message.message.topic_name = message.message.reply_to_message.forum_topic_created.name
            message.message.topic_id = message.message.reply_to_message.message_id
        }

        updateAvailChats(message);
        // chat id - chat name - topic name
        const chatTable = document.getElementById(message.message.chat.id + " - " + message.message.chat.title + " - " + message.message.topic_name); // Chat display table element
        if (!chatTable) {
            return; // This isn't strictly required, but prevents browser crash in the event of certain typos in the code.
        }
        if (personal) {
            [row, rowToEdit, clientMessageId] = renderMessageUser(message, chatTable, "personal");
        } else {
            [row, rowToEdit, clientMessageId] = renderMessageUser(message, chatTable, "server");
        }

        // Process document messages
        if (message.message.document) {
            row += renderMessageDocument(message);
        } else if (message.message.photo) {
            row += await renderMessagePhoto(message)
        } else if (message.message.video) {
            row += await renderMessageVideo(message)
        } else if (message.message.audio || message.message.voice) {
            if (message.message.voice) {
                message.message.audio = message.message.voice;
            }
            row += await renderMessageAudio(message)
        } else if (message.message.text) { // Process regular text messages
            // Convert text to HTML for display
            message.message.text = message.message.text.replaceAll("\n", "<br>");
            row += `${DOMPurify.sanitize(converter.makeHtml(message.message.text))}</td>\n`;
        } else {
            console.log("Unknown message type", message)
        }

        // Display message, replacing any "Loading..." placeholder if needed
        if (!chatTable.innerText || chatTable.rows[0].cells[0].textContent === "Loading chat data...") {
            // Clear the table first (if necessary) to remove any placeholder or old content
            while (chatTable.rows.length > 0) {
                chatTable.deleteRow(0);
            }

            // Create the new row element and append it to the table
            const newRow = document.createElement('tr');
            newRow.id = clientMessageId;
            newRow.innerHTML = row; // Set the row's HTML content
            chatTable.appendChild(newRow); // Append the new row

            if (message.edited_message) {
                newRow.style.borderRadius = "15px";
            }
        } else if (rowToEdit !== null) {
            // Edit an existing row
            const rowToEditElement = chatTable.rows[rowToEdit];
            rowToEditElement.id = clientMessageId;
            rowToEditElement.innerHTML = row; // Update the row content
            rowToEditElement.style.borderRadius = "15px";
        } else {
            // Append a new row to the table
            const newRow = document.createElement('tr');
            newRow.id = clientMessageId;
            newRow.innerHTML = row; // Set the row's HTML content
            chatTable.appendChild(newRow); // Append the new row

            // Scroll to the newly added row
            newRow.scrollIntoView();

            if (message.edited_message) {
                newRow.style.borderRadius = "15px";
            }
        }
        // If the message was in a different chat and notifications are on
        const selectedChat = getCurrentChat();
        if (((chatTable !== document.getElementById(selectedChat[0].split(" - ")[0] + " - " + selectedChat[1])) || DEV_NOTIFY) && document.getElementById("notificationButton").checked) {
            // oneShotWiggle the chat name
            const chatName = document.querySelector(`label[for="${"radioChat - " + message.message.chat.id + " - " + message.message.topic_id}"]`);
            if (chatName) {
                chatName.classList.remove('ping-animation');
                void chatName.offsetWidth;
                chatName.classList.add('ping-animation');
            }
        }
    });
    dataExport()
}

/**
 * Initiates a file download by creating a temporary <a> element for downloading the file
 * @param {string} url - The URL of the file to download
 * @param {string} fileName - The filename to save the file as
 */
function downloadFile(url, fileName) {
    const a = document.createElement('a'); // Create a temporary link element
    a.href = url; // Set link URL to file download link
    a.download = fileName; // Set download attribute to specify filename
    document.body.appendChild(a); // Append link to document
    a.click(); // Trigger click to download file
    document.body.removeChild(a); // Remove link after download starts
}

/**
 * Retrieves a file from Telegram and downloads it
 * @param {string} doc - Document metadata as JSON string
 */
function getFile(doc) {
    const docu = JSON.parse(doc); // Parse document metadata
    const url = new URL(apiUrl + '/getFile'); // Construct API endpoint for retrieving file
    url.searchParams.append('file_id', docu.file_id); // Specify file ID for Telegram API

    // Send request to retrieve file info from Telegram
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                // Initiate download if the file retrieval was successful
                downloadFile(
                    `https://api.telegram.org/file/bot${TOKEN}/${data.result.file_path}`,
                    docu.file_name
                );
            }
        })
        .catch(error => {
            console.error('Error:', error); // Log error in case of failure
        });
}

/**
 * Starts a long polling loop to continuously fetch updates from Telegram
 */
function longPoll() {
    const url = new URL(apiUrl + '/getUpdates'); // API endpoint for getting updates
    url.searchParams.append('offset', lastUpdateId); // Avoid fetching old updates
    url.searchParams.append('timeout', timeout); // Set timeout for long polling
    url.searchParams.append('allowed_updates', allowedUpdates); // Specify allowed update types

    // Recursive long polling request for continuous updates
    fetch(url)
        .then(response => response.json())
        .then(data => {
            try {
                if (data.ok) {
                    // Process each update and display it
                    if (data.result.length) {
                        handleMessages(data.result, false);
                    }
                    data.result.forEach(update => {
                        lastUpdateId = update.update_id + 1; // Update the lastUpdateId to prevent duplicate updates
                    });
                }
            } catch (err) {
                console.log(err)
            }
        })
        .catch(error => {
            console.error('Polling error:', error); // Log error in case of failure
        })
        .finally(() => {
            setTimeout(longPoll, 1000); // Restart polling after 1 second
        });
}

/**
 * Sends a message via Telegram's API and displays it in the chat interface
 * @param {string} message - The message text to send
 */
function sendMessage(message) {
    const url = apiUrl + '/sendMessage'; // Construct API endpoint for sending message
    const chat_id = getCurrentChat()[0];
    const params = {
        chat_id: chat_id.split(" - ")[0], // Set chat ID for the channel
        text: escapeMessage(message), // Escape and send message
        parse_mode: 'MarkdownV2', // Set parse mode for formatting

    };
    if (chat_id.split(" - ")[1]) {
        params.reply_parameters = {
            "message_id": chat_id.split(" - ")[1],
            "chat_id": chat_id.split(" - ")[0]
        }
    }

    // Send message to Telegram and process response
    fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        })
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                // Update interface with sent message if successful
                handleMessages([{
                    "message": data.result
                }], true);
            }
        })
        .catch(error => {
            console.error('Error:', error); // Log error in case of failure
        });
}

/**
 * Sends a file or document to the Telegram channel
 */
function sendDocument() {
    const fileInput = document.getElementById('fileInput'); // Get file input element
    const file = fileInput.files[0]; // Access first selected file

    const photoTypes = ['jpeg', 'jpg', 'gif', 'png', 'webp', 'heif', 'heic', 'tiff', 'bmp', 'psd', 'pdf', 'raw', 'eps', 'ai', 'indd', 'dwg'];
    const audioTypes = ['mp3', 'm4a'];
    const videoTypes = ['mp4'];
    let fileExtension = file.name.split(".");
    fileExtension = fileExtension[fileExtension.length - 1].toLowerCase();

    let url;
    let type;

    if (photoTypes.includes(fileExtension)) {
        url = apiUrl + '/sendPhoto';
        type = "photo";
    } else if (audioTypes.includes(fileExtension)) {
        url = apiUrl + '/sendAudio';
        type = "audio";
    } else if (videoTypes.includes(fileExtension)) {
        url = apiUrl + '/sendVideo';
        type = "video";
    } else {
        url = apiUrl + '/sendDocument';
        type = "document";
    }
    const captionBox = document.getElementById("captionBox");

    const chat_id = getCurrentChat()[0];
    const formData = new FormData(); // Create form data for file upload
    if (chat_id.split(" - ")[1]) {
        formData.append('reply_parameters', {
            "message_id": chat_id.split(" - ")[1],
            "chat_id": chat_id.split(" - ")[0]
        })
    }
    formData.append('chat_id', chat_id.split(" - ")[0]);
    formData.append('caption', escapeMessage(captionBox.value));
    formData.append(type, file); // Attach file as document

    captionBox.value = "";

    closeModal("fileModal");
    // Send the document to Telegram
    fetch(url, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                // Update interface with sent document if successful
                handleMessages([{
                    "message": data.result
                }], true);
            }
        })
        .catch(error => {
            console.error('Error:', error); // Log error in case of failure
        });
}

function dataExport() {
    const exportData = {
        "chats": chatsAvailable,
        "userList": userList,
        "personalMessages": personalMessageIds,
        "serverMessages": serverMessageIds,
        "chatHistory": document.getElementById("chatHolder").innerHTML,
        "selected": getCurrentChat()[0],
    }
    fetch(`http://127.0.0.1:${BACKUP_PORT}/backup`, {
            method: 'POST',
            body: JSON.stringify(exportData)
        })
        .catch(error => {
            console.error('Error on data backup attempt:', error); // Log error in case of failure
        });
}


function dataImport() {
    fetch(`http://127.0.0.1:${BACKUP_PORT}/backup`, {
            method: 'GET',
        })
        .then(data => data.json())
        .then(data => {
            if (data && data["chats"]) {
                chatsAvailable = data["chats"];
                personalMessageIds = data["personalMessages"];
                serverMessageIds = data["serverMessages"];
                updateChatList();
                userList = data["userList"];
                updateUserList(parseInt(data["selected"].split(" - ")[0]));
                document.getElementById("chatHolder").innerHTML = data["chatHistory"]
                const selectedValue = data["selected"]; // This is the value you want to select

                // Get all radio buttons in the group
                const radios = document.getElementsByName('chatList');

                // Loop through the radio buttons and select the one that matches the value
                for (const radio of radios) {
                    if (radio.id === ("radioChat - " + selectedValue)) {
                        radio.checked = true; // Set the selected radio button to checked
                        break; // Stop once the correct radio button is selected
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error on data import attempt:', error); // Log error in case of failure
        });
}

function toggleInputField() {
    const selectedChat = getCurrentChat();

    for (table of document.getElementsByClassName("chatTable")) {
        table.style.display = "none";
    }
    const currentTable = document.getElementById(selectedChat[0].split(" - ")[0] + " - " + selectedChat[1]);
    if (currentTable) {
        currentTable.style.display = "block";
    }
    const chatName = document.querySelector(`label[for="${"radioChat - " + selectedChat[0]}"]`);
    if (chatName) {
        chatName.classList.remove('ping-animation');
        void chatName.offsetWidth;
    }
    updateUserList();
}


/**
 * Sets up event callbacks and initializes polling
 */
function setCallbacks() {
    try {
        dataImport();
    } catch {}
    // Initialize chat input events
    const inputElement = document.getElementById('chatbox');
    inputElement.value = ""; // Clear input field on page load

    // Adjust height dynamically based on input content for the two textareas
    auto_height(inputElement);
    auto_height(document.getElementById('captionBox'));

    // Add keypress event listener for sending message with Ctrl+Enter
    inputElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && event.ctrlKey && inputElement.value.trim() !== '') {
            sendMessage(inputElement.value);
            inputElement.value = ""; // Clear input after sending
            auto_height(inputElement);
        }
    });


    // Access the checkbox and its wrapper
    const checkbox = document.getElementById('notificationButton');
    const checkboxWrapper = document.getElementById('notifyWrapper');
    // Listen for the checkbox change event
    checkbox.addEventListener('change', function () {
        if (checkbox.checked) {
            checkboxWrapper.classList.add('checked'); // Add checked class when checked
        } else {
            checkboxWrapper.classList.remove('checked'); // Remove checked class when unchecked
        }
    });

    // Modal control events for confirming and canceling actions
    document.getElementById("confirmBtn").addEventListener("click", function () {
        deleteMessage(document.getElementById("confirmationModal").dataElemId);
        closeModal("confirmationModal");
    });
    document.getElementById("cancelBtn").addEventListener("click", function () {
        closeModal("confirmationModal");
    });
    document.getElementById("editCancelBtn").addEventListener("click", function () {
        closeModal("editModal");
    });
    document.getElementById("editConfirmBtn").addEventListener("click", function () {
        editMessage();
        closeModal("editModal");
    });
    document.getElementById("fileCancelBtn").addEventListener("click", function () {
        closeModal("fileModal");
    });
    document.getElementById("fileConfirmBtn").addEventListener("click", function () {
        sendDocument();
    });

    // Close modal if the user clicks outside of it
    window.addEventListener("click", function (event) {
        for (const modal of ["confirmationModal", "editModal", "fileModal"]) {
            if (event.target === document.getElementById(modal)) {
                closeModal(modal);
            }
        }
    });

    updateChatList();

    longPoll(); // Begin long polling for updates from Telegram
}