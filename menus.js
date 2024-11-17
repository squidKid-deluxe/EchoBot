function initContextMenu() {
    // Get references to the context menu and the content area
    const contextMenu = document.getElementById('context-menu');
    const content = document.getElementById('container');

    let clickedCell = null;

    // Show the custom context menu
    content.addEventListener('contextmenu', function (event) {
        let clickedElem = null;

        // Walk up the DOM to find the <td> if the target is a child element
        clickedElem = event.target;
        while (clickedElem && clickedElem.tagName !== 'TR') {
            clickedElem = clickedElem.parentElement;
        }

        // If we did find a <TR> element
        if (clickedElem && clickedElem.tagName === 'TR' && clickedElem.id.startsWith("personalMessage")) {
            clickedCell = clickedElem.id
            // Prevent the default right-click menu
            event.preventDefault();

            // Get the mouse position
            const mouseX = event.clientX;
            const mouseY = event.clientY;

            // Set the position of the custom context menu
            contextMenu.style.left = `${mouseX}px`;
            contextMenu.style.top = `${mouseY}px`;

            // Show the context menu
            contextMenu.style.display = 'block';
        }
    });

    // Hide the context menu when clicking anywhere else
    document.addEventListener('click', function () {
        contextMenu.style.display = 'none';
    });

    // Attach a single event listener to the context menu container
    contextMenu.addEventListener('click', function (event) {
        // Check if a <li> was clicked
        if (event.target && event.target.tagName === 'LI') {
            const clickedElement = event.target; // The clicked <li> element
            // Check if the "Copy" option was selected
            if (clickedElement.textContent === "Edit") {
                openModal("editModal", clickedCell);
            } else if (clickedElement.textContent === "Delete") {
                openModal("confirmationModal", clickedCell);
            }

            contextMenu.style.display = 'none'; // Hide the menu
        }
    });
}

function openUserList() {
    document.getElementById("userListContainer").style.width = "15vw";
    document.getElementById("container").style.marginRight = "15vw";
}

function closeUserList() {
    document.getElementById("userListContainer").style.width = "0";
    document.getElementById("container").style.marginRight = "0";
}

function openChatList() {
    document.getElementById("chatListContainer").style.width = "15vw";
    document.getElementById("container").style.marginLeft = "15vw";
}

function closeChatList() {
    document.getElementById("chatListContainer").style.width = "0";
    document.getElementById("container").style.marginLeft = "0";
}