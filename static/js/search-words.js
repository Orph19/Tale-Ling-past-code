document.addEventListener('DOMContentLoaded', function() {
    const wordGroupViewRadios = document.querySelectorAll('input[name="wordGroupView"]');
    const baseWordsContainer = document.getElementById('base_wordsContainer');
    const gettingWordsContainer = document.getElementById('getting_used_wordsContainer');
    const comfortabWordsContainer = document.getElementById('comfortable_wordsContainer');
    const moveWordsBtn = document.getElementById('moveWordsBtn');
    const targetGroupSelect = document.getElementById('targetGroupSelect');
    const moveWordsMessage = document.getElementById('moveWordsMessage');
    const searchInput = document.querySelector('input[name="query"]'); // Get the search input field
    const searchButton = document.querySelector('form[action="/search"] button[type="submit"]'); // Get the search button

    const allWordGroupContainers = {
        'base_words': baseWordsContainer,
        'getting_used_words': gettingWordsContainer,
        'comfortable_words': comfortabWordsContainer
    };

    /**
     * Toggles the visibility of word group containers based on the selected radio button.
     * @param {string} selectedGroup - The value of the selected radio button ('base_words', 'getting_used_words', 'comfortable_words').
     */
    function showSelectedWordGroup(selectedGroup) {
        for (const group in allWordGroupContainers) {
            if (allWordGroupContainers[group]) { // Ensure the container element exists
                if (group === selectedGroup) {
                    allWordGroupContainers[group].classList.remove('hidden');
                } else {
                    allWordGroupContainers[group].classList.add('hidden');
                }
            }
        }
        // After changing the group, re-apply the search filter
        applySearchFilter();
    }

    /**
     * Updates the visual style of a word item based on its checkbox's checked state.
     * @param {HTMLInputElement} checkbox - The checkbox element.
     */
    function updateWordItemStyle(checkbox) {
        const parentLabel = checkbox.closest('label'); 
        if (parentLabel) {
            if (checkbox.checked) {
                parentLabel.classList.add('selected'); 
            } else {
                parentLabel.classList.remove('selected'); 
            }
        }
        updateMoveWordsButtonText(); // Call this to update the button text
    }

    /**
     * Retrieves all currently selected words from all visible groups.
     * @returns {Array<{id: string, value: string}>} An array of objects with id and value of the selected words.
     */
    function getSelectedWords() {
        const selected = [];
        // Select all checkboxes with the name 'selectedWords'
        const checkboxes = document.querySelectorAll('input[type="checkbox"][name="selectedWords"]');
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.push({id: checkbox.id, value: checkbox.value});
            }
        });
        return selected;
    }

    /**
     * Generates the HTML string for a single word item.
     * @param {string} wordValue - The word string.
     * @param {string} groupName - The full group name ('base_words', 'getting_used_words', 'comfortable_words').
     * @returns {string} The HTML string for the word item.
     */
    function createWordItemHtml(wordValue, groupName) {
        // Create a unique ID for the checkbox, combining group name, sanitized word, and a timestamp
        const uniqueId = `word-${groupName}-${wordValue.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
        
        return `
            <label for="${uniqueId}" class="group word-item flex items-center justify-between p-4 bg-[#FBFBFC] rounded-lg border border-[#E0E0E0] text-[#2C3E50] shadow-sm transition-all duration-200 ease-in-out cursor-pointer
                hover:border-blue-300 hover:shadow-md active:bg-blue-50 active:shadow-inner
                has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:shadow-md">
                
                <p class="text-lg font-medium truncate">${wordValue}</p>
                <input
                    type="checkbox"
                    id="${uniqueId}"
                    name="selectedWords"
                    value="${wordValue}"
                    data-group="${groupName}"
                    class="h-6 w-6 text-[#007BFF] border-[#90CDF4] rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ml-4 flex-shrink-0"
                    aria-label="Select word ${wordValue}"
                >
            </label>
        `;
    }

    /**
     * Sends selected words and target group to the backend API.
     * @param {Array<{id: string, value: string}>} wordsWithIds - An array of objects with id and value of the words to send.
     * @param {string} targetGroup - The group to move the words to ('base_words', 'getting_used_words', 'comfortable_words').
     */
    async function updateWords(wordsWithIds, targetGroup) {
        try {
            const response = await fetch('/api/words', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    selectedWords: wordsWithIds,
                    target: targetGroup
                })
            });

            if (!response.ok) {
                let errorDetails;
                try {
                    errorDetails = await response.json();
                } catch (parseError) {
                    errorDetails = await response.text();
                }
                const errorMessage = errorDetails.message || errorDetails.error || (typeof errorDetails === 'string' ? errorDetails : 'An unknown error occurred.');
                console.error('Backend Update Error:', response.status, errorMessage);
                displayMessage(`Error moving words: ${errorMessage}`, 'error');
                return false; 
            } else {
                const responseData = await response.json();
                console.log(responseData.message);
                displayMessage(responseData.message || 'Words moved successfully!', 'success');
                return true;
            }
        } catch (networkError) {
            console.error('Network Error during word update:', networkError);
            displayMessage('Network error. Please check your connection.', 'error');
            return false;
        }
    }

    /**
     * Displays a message to the user.
     * @param {string} message - The message to display.
     * @param {string} type - 'success' or 'error' for styling.
     */
    function displayMessage(message, type) {
        moveWordsMessage.textContent = message;
        moveWordsMessage.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');
        if (type === 'success') {
            moveWordsMessage.classList.add('bg-green-100', 'text-green-800');
        } else if (type === 'error') {
            moveWordsMessage.classList.add('bg-red-100', 'text-red-800');
        }
    }

    /**
     * Filters the words displayed in the currently active group based on the search input.
     */
    function applySearchFilter() {
        const searchQuery = searchInput.value.toLowerCase();
        // Find the currently visible word group container
        const activeContainer = document.querySelector('.word-group-display:not(.hidden)');

        if (activeContainer) {
            const wordItems = activeContainer.querySelectorAll('.word-item');
            wordItems.forEach(item => {
                const wordText = item.querySelector('p').textContent.toLowerCase();
                if (wordText.includes(searchQuery)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        }
    }

    /**
     * Updates the text of the "Move Words" button based on the number of selected words.
     */
    function updateMoveWordsButtonText() {
        const selectedCount = getSelectedWords().length;
        if (selectedCount > 0) {
            moveWordsBtn.textContent = `Move ${selectedCount} Selected Words`;
        } else {
            moveWordsBtn.textContent = 'Move Selected Words';
        }
    }

    // --- Event Listeners ---

    // 1. Listen for changes on word group view radio buttons
    wordGroupViewRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            showSelectedWordGroup(this.value);

            // Clear any previous messages
            moveWordsMessage.classList.add('hidden');
            updateMoveWordsButtonText(); // Update button text when group view changes
        });
    });

    // 2. Listen for changes on individual checkboxes for visual styling and button text update
    // This uses event delegation on the document for efficiency
    document.addEventListener('change', function(event) {
        if (event.target.matches('input[type="checkbox"][name="selectedWords"]')) {
            updateWordItemStyle(event.target);
            // Clear any previous messages when selection changes
            moveWordsMessage.classList.add('hidden');
            updateMoveWordsButtonText(); // Update the button text
        }
    });

    // 3. Listen for clicks on the "Move Words To" button
    if (moveWordsBtn) {
        moveWordsBtn.addEventListener('click', async function() {
            moveWordsBtn.disabled = true;
            const selected = getSelectedWords(); // Get words with their IDs and values
            const targetGroupBackendName = targetGroupSelect.value; 

            if (selected.length === 0) {
                moveWordsBtn.disabled = false;
                displayMessage('Please select at least one word to move.', 'error');
                return;
            }

            if (!targetGroupBackendName) {
                moveWordsBtn.disabled = false;
                displayMessage('Please select a target group to move words to.', 'error');
                return;
            }

            // Attempt to update words on the backend, passing the array of {id, value} objects
            const success = await updateWords(selected, targetGroupBackendName);

            if (success) {
                // Get the target container directly using the backend group name as the key
                const targetContainer = allWordGroupContainers[targetGroupBackendName];

                if (!targetContainer) {
                    console.error("Error: Target container not found for group:", targetGroupBackendName);
                    displayMessage("Error: Could not find the target group's display area.", "error");
                    moveWordsBtn.disabled = false;
                    return;
                }
                
                // If backend update is successful, update frontend view
                selected.forEach(word => {
                    // 1. Remove the word from its current display location using its original ID
                    const wordItemElement = document.getElementById(word.id);
                    if (wordItemElement && wordItemElement.closest('.word-item')) {
                        wordItemElement.closest('.word-item').remove();
                    }

                    // 2. Create and append the word to the new display location with a new ID
                    // Pass the full group name to createWordItemHtml
                    const newWordHtml = createWordItemHtml(word.value, targetGroupBackendName);
                    
                    // Ensure the .grid div exists within the container
                    let gridDiv = targetContainer.querySelector('.grid');
                    if (!gridDiv) {
                        // If for some reason the grid doesn't exist (e.g., first word in an empty group),
                        // create it. This ensures words can be moved into empty groups correctly.
                        gridDiv = document.createElement('div');
                        gridDiv.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-4');
                        targetContainer.appendChild(gridDiv);
                        // Also, remove the "No words to show" message if it exists
                        const noWordsMessage = targetContainer.querySelector('p.text-gray-600');
                        if (noWordsMessage) {
                            noWordsMessage.remove();
                        }
                    }
                    gridDiv.insertAdjacentHTML('beforeend', newWordHtml);
                });
                moveWordsBtn.disabled = false;
                // After words are moved and re-added, re-apply the search filter
                applySearchFilter();
                updateMoveWordsButtonText(); // Update button text after words are moved
            }
        });
    }

    // 4. Listen for input on the search bar for real-time filtering
    if (searchInput) {
        searchInput.addEventListener('input', applySearchFilter);

        // Listen for 'keydown' event on the search input to handle Enter key press
        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent form submission
                applySearchFilter();
                searchInput.value = ''; // Clear the search bar
            }
        });
    }

    // 5. Listen for click on the search button
    if (searchButton) {
        searchButton.addEventListener('click', function(event) {
            event.preventDefault(); // Prevent form submission
            applySearchFilter();
            searchInput.value = ''; // Clear the search bar
        });
    }


    // --- Initial Setup ---
    // Ensure only the 'base_words' group is visible on initial load
    showSelectedWordGroup('base_words');

    // Apply initial styling to any pre-checked checkboxes
    document.querySelectorAll('input[type="checkbox"][name="selectedWords"]').forEach(checkbox => {
        updateWordItemStyle(checkbox);
    });

    // Apply initial search filter in case there's a pre-filled query or on page load
    applySearchFilter();
    updateMoveWordsButtonText(); // Call this on initial load to set the correct button text
});
