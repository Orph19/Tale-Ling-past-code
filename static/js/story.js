// A global variable to store the current story ID, populated from the URL
let currentStoryId = null;
let countdownTimerId = null;
marked.setOptions({
  gfm: true,  
  breaks: true  
});

document.addEventListener('DOMContentLoaded', () => {
    const storyTitleElement = document.getElementById('storyTitle');
    const storyContentDiv = document.getElementById('storyContent');
    let nextSegmentButton = document.getElementById('nextSegmentButton');
    const backToListButton = document.getElementById('backToListButton');

    // Create message container once at DOMContentLoaded
    // It will always exist and be managed by display/hide functions
    const messageContainer = document.createElement('div');
    messageContainer.id = 'story-message-container';
    messageContainer.style.display = 'none'; // Initially hidden
    storyContentDiv.appendChild(messageContainer); // Append it once

    // --- SVG Icons ---
    const translateIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-700">
            <path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 4.796l4.397 4.398a.75.75 0 0 1-1.06 1.06l-4.398-4.397A8.25 8.25 0 0 1 2.25 10.5Z" clip-rule="evenodd" />
            <path d="M12 11.25a.75.75 0 0 1-.75-.75V7.5a.75.75 0 0 1 1.5 0v3A.75.75 0 0 1 12 11.25Z" />
            <path d="M12 15a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75Z" />
            <path d="M15.75 12a.75.75 0 0 1-.75-.75V8.25a.75.75 0 0 1 1.5 0v3A.75.75 0 0 1 15.75 12Z" />
            <path d="M8.25 12a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75Z" />
            <path d="M18.75 12a.75.75 0 0 1-.75-.75V8.25a.75.75 0 0 1 1.5 0v3A.75.75 0 0 1 18.75 12Z" />
            <path d="M5.25 12a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75Z" />
        </svg>
    `;

    // New icon for "Hide Translation": Close/X icon (keeping this as is as it's intuitive)
    const hideIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-gray-700">
            <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM8.25 9.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z" clip-rule="evenodd" />
        </svg>
    `;


    // --- Function to parse storyId from URL ---
    function getStoryIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('storyId');
    }

    function displayCountdownMessage(initialCount, messagePrefix = 'Reloading in ', messageSuffix = ' seconds...', callback) {
        if (!storyContentDiv || !messageContainer) return;

        // Clear previous content and reset dynamic styles
        messageContainer.innerHTML = '';
        messageContainer.style.backgroundColor = '';
        messageContainer.style.padding = '';
        messageContainer.style.borderRadius = '';
        messageContainer.style.marginBottom = '';
        messageContainer.className = ''; // Clear existing type classes
        messageContainer.classList.add('info'); // Default class for countdown message

        // Clear any existing countdown timer
        if (countdownTimerId) {
            clearInterval(countdownTimerId);
        }

        let currentCount = initialCount;
        const messageElement = document.createElement('p');
        messageElement.className = 'text-blue-600 font-italic'; // Styling for countdown message
        messageContainer.appendChild(messageElement);

        // Function to update the countdown display
        const updateCountdown = () => {
            messageElement.textContent = `${messagePrefix}${currentCount}${messageSuffix}`;
            if (currentCount <= 0) {
                clearInterval(countdownTimerId); // Stop the countdown
                messageContainer.style.display = 'none'; // Hide the message container
                if (typeof callback === 'function') {
                    callback(); // Execute callback when countdown finishes
                }
            }
            currentCount--;
        };

        // Initial display
        updateCountdown();

        // Start the countdown timer
        countdownTimerId = setInterval(updateCountdown, 1000);

        // Show the message container
        messageContainer.style.display = 'block';
        storyContentDiv.appendChild(messageContainer);
    }


    // --- Function to display a message (loading, error, etc.) ---
    function displayMessage(message, type = 'info') {
        if (!storyContentDiv || !messageContainer) return; // Ensure messageContainer exists

        // Clear previous content and reset dynamic styles
        messageContainer.innerHTML = '';
        messageContainer.style.backgroundColor = '';
        messageContainer.style.padding = '';
        messageContainer.style.borderRadius = '';
        messageContainer.style.marginBottom = '';
        messageContainer.className = ''; // Clear existing type classes

        let messageElement;
        if (type === 'loading') {
            messageElement = document.createElement('div');
            messageElement.className = 'loading-indicator';
            messageElement.innerHTML = `
                <div class="loading-spinner"></div>
                <p>${message}</p>
            `;
            messageContainer.appendChild(messageElement);
            // Apply loading specific styles to the container itself
            messageContainer.classList.add('loading'); 
        } else { // For error or info messages
            messageElement = document.createElement('p');
            let colorClass = 'text-gray-600 italic';
            if (type === 'error') {
                colorClass = 'text-red-600 font-semibold';
                messageContainer.classList.add('error'); // Add error class
            } else {
                messageContainer.classList.add('info'); // Add info class
            }
            messageElement.className = colorClass;
            messageElement.textContent = message;
            messageContainer.appendChild(messageElement);
        }

        // Show the message container
        messageContainer.style.display = 'block';
        // Ensure messageContainer is always at the very end of storyContentDiv
        storyContentDiv.appendChild(messageContainer);
    }

    // --- Function to hide the message container ---
    function hideMessage() {
        if (messageContainer) {
            messageContainer.innerHTML = ''; // Clear content
            messageContainer.style.display = 'none'; // Hide the container
            // Reset any dynamic styles applied by displayMessage
            messageContainer.style.backgroundColor = '';
            messageContainer.style.padding = '';
            messageContainer.style.borderRadius = '';
            messageContainer.style.marginBottom = '';
            messageContainer.className = ''; 
        }
    }

    // --- Function to attach event listeners to translation buttons ---
    function attachTranslationButtonListeners() {
        const buttons = document.querySelectorAll('.show-translation');

        buttons.forEach(button => {
            button.removeEventListener('click', handleTranslationButtonClick);
            button.addEventListener('click', handleTranslationButtonClick);
        });
    }

    // --- Handler for translation button clicks ---
    async function handleTranslationButtonClick(event) {
        // Find the actual button element, even if a child (like SVG) was clicked
        const actualButton = event.target.closest('.show-translation');
        if (!actualButton) {
            console.error("Clicked element is not part of a .show-translation button.");
            return;
        }

        const parentParagraph = actualButton.closest('.story-segment');

        if (!parentParagraph) {
            console.error("Could not find a parent .story-segment element for the clicked button.");
            //Change button icon to an error state
            actualButton.innerHTML = `<span class="text-red-500">!</span>`;
            return;
        }

        // Check if translation already exists and is stored
        const existingTranslation = actualButton.translatedParagraph;

        if (existingTranslation) {
            // Toggle visibility
            if (existingTranslation.style.display === 'none') {
                existingTranslation.style.display = 'block';
                actualButton.innerHTML = hideIcon;
            } else {
                existingTranslation.style.display = 'none';
                actualButton.innerHTML = translateIcon;
            }
            return;
        }

        // If no existing translation, proceed to fetch
        actualButton.disabled = true;
        // Show pulsing translate icon
        actualButton.innerHTML = `<span class="animate-pulse">${translateIcon}</span>`;

        // Extract content of the paragraph, excluding the button itself
        let segmentContent = '';
        parentParagraph.childNodes.forEach(node => {
            // Only include text nodes or element nodes that are not the button
            if (node.nodeType === Node.TEXT_NODE) {
                segmentContent += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE && node !== actualButton && !node.classList.contains('translation-output')) {
                // To avoid including existing HTML from marked.parse or previous translations
                segmentContent += node.textContent;
            }
        });
        segmentContent = segmentContent.trim(); // Clean up leading/trailing whitespace

        const segmentIndex = parentParagraph.getAttribute('index');

        
        const translatedParagraph = await getTranslation(parentParagraph, segmentContent, segmentIndex, currentStoryId);
        if (translatedParagraph) {
            // Store the created translation element reference on the button
            actualButton.translatedParagraph = translatedParagraph;
            actualButton.innerHTML = hideIcon; // Change icon to hide
        } else {
            actualButton.innerHTML = `<span class="text-red-500">!</span>`; // Error icon
        }
        
        actualButton.disabled = false; // Re-enable button
    }


    // --- Function to fetch and display the full story ---
    async function loadStory(storyId) {
        if (!storyId) {
            displayMessage('No story ID found in URL. Please go back to the main page.', 'error');
            return;
        }

        displayMessage('Loading story segments...', 'loading');
        if (nextSegmentButton) nextSegmentButton.disabled = true;

        try {
            const response = await fetch(`/api/stories/${storyId}`);
            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                data = { message: responseText || 'No specific error message provided.' };
            }

            if (!response.ok) {
                console.error(`Server error (${response.status}): ${data.error || data.message}`)
                throw new Error('Failed to load story');
            }

            if (data && data.segments && Array.isArray(data.segments)) {
                storyTitleElement.textContent = data.title;
                // Clear only the segments, but keep the messageContainer
                const existingSegments = storyContentDiv.querySelectorAll('.story-segment');
                existingSegments.forEach(segment => segment.remove());

                hideMessage(); // Hide any existing message


                if (data.is_ended) {
                    nextSegmentButton.remove();
                    nextSegmentButton = null;
                }

                data.segments.forEach((segment, index) => {
                    const p = document.createElement('p');
                    p.className = 'story-segment relative';
                    p.setAttribute('index', index);

                    // Create a temporary div to parse the segment HTML and extract text
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = marked.parse(segment);

                    // Append all child nodes from the parsed Markdown to the paragraph
                    while (tempDiv.firstChild) {
                        p.appendChild(tempDiv.firstChild);
                    }

                    const buttonTranslate = document.createElement('button');
                    buttonTranslate.className = 'show-translation';
                    buttonTranslate.innerHTML = translateIcon;
                    p.appendChild(buttonTranslate); // Append button after the text content
                    storyContentDiv.appendChild(p);
                });

                // Ensure messageContainer is always the last child after segments are added
                storyContentDiv.appendChild(messageContainer);

                attachTranslationButtonListeners();

                // Scroll to the bottom of the content or to the next segment button
                if (nextSegmentButton) {
                    if (data.is_generating) {
                        nextSegmentButton.disabled = true;

                        displayCountdownMessage(10, 'Next segment generation in progress, please wait. The page will reload automaticly in ', ' seconds...', function() {
                            location.reload();
                        });
                        setTimeout(function() {
                            location.reload();
                        }, 10000); 
                    } else {

                        nextSegmentButton.disabled = false; // Enable if not generating
                    }
                    if (data.segments.length!==1){ //Do not scroll if the story was recently created
                        nextSegmentButton.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                    
                } else if (backToListButton) { // If nextSegmentButton is removed, scroll to backToListButton
                    backToListButton.scrollIntoView({ behavior: 'smooth', block: 'end' });

                } else {

                    storyContentDiv.scrollTop = storyContentDiv.scrollHeight;
                }

            } else {
                displayMessage('Story data is missing or malformed.', 'error');
            }
        } catch (error) {
            console.error('Error loading story:', error);
            displayMessage(`Error loading story: ${error.message}`, 'error');
        }
    }

    // --- Function to fetch and append the next segment ---
    async function getNextSegment() {
        if (!currentStoryId) {
            displayMessage('No active story to continue.', 'error');
            return;
        }

        displayMessage('Generating next segment...', 'loading');
        nextSegmentButton.disabled = true;

        try {
            const response = await fetch(`/api/stories/${currentStoryId}/continue`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                nextSegmentButton.disabled = false;

                const result = await response.text()
                const errorData = JSON.parse(result)

                console.error(`Server error (${response.status}): ${errorData.error}`)
                
                throw new Error('Failed to get next segment, please try again');
                
            }

            const responseBody = await response.text();

            let data;
            try {
                data = JSON.parse(responseBody);
            } catch (parseError) {
                data = { message: responseBody || 'No specific error message provided.' };

                console.error('Error parsing next segment data:', data.message)
                throw new Error('Failed to acces the generated content, please reload the page')
            }

            //Check if the story ended to remove the button for next segment generation
            if (data.is_ended===true) {
                if (nextSegmentButton) {
                    nextSegmentButton.remove();
                }
            } 

            if (data.newSegment) {
                hideMessage(); // Hide any existing message

                const p = document.createElement('p');
                p.className = 'story-segment relative'; // Simplified class
                p.setAttribute('index', data.countSegment);

                // Create a temporary div to parse the segment HTML and extract text
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = marked.parse(data.newSegment);

                // Append all child nodes from the parsed Markdown to the paragraph
                while (tempDiv.firstChild) {
                    p.appendChild(tempDiv.firstChild);
                }


                const buttonTranslate = document.createElement('button');
                buttonTranslate.className = 'show-translation';
                buttonTranslate.innerHTML = translateIcon;
                p.appendChild(buttonTranslate);
                storyContentDiv.appendChild(p);

                // Ensure messageContainer is always the last child after new segment is added
                storyContentDiv.appendChild(messageContainer);

                attachTranslationButtonListeners();

                nextSegmentButton.disabled = false; //Enable next segment button

                // Scroll to the new segment 
                p.scrollIntoView({ behavior: 'smooth', block: 'end' });
                

            } else {
                displayMessage('Failed to get next segment. No content received.', 'error');
            }
        } catch (error) {
            console.error('Error continuing story:', error);
            hideMessage();
            displayMessage(`Error continuing story: ${error.message}`, 'error');
        } 
    }

    // This function now returns the created translation paragraph
    async function getTranslation(parentElement, segContent, segIndex, storyId) {
        try {
            const response = await fetch('/api/translations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    segment: segContent,
                    segmentIndex: segIndex,
                    storyId: storyId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error('Translation API error:', response.status, response.statusText, errorData);
                return null;
            }

            const data = await response.json();

            const segTranslated = data.translation;
            if (!segTranslated) {
                console.warn('Translation response was empty.');
                return null;
            }

            const pTranslation = document.createElement('p');
            pTranslation.textContent = segTranslated;

            pTranslation.classList.add('translation-output'); // Apply translation styles
            pTranslation.style.display = 'block'; // Ensure it's visible initially

            parentElement.appendChild(pTranslation);
            return pTranslation;

        } catch (error) {
            console.error('Error fetching translation:', error);
            return null;
        }
    }

    // --- Initialization Logic ---
    currentStoryId = getStoryIdFromUrl();

    if (currentStoryId) {
        loadStory(currentStoryId);
    } else {
        displayMessage('No story ID found in the URL. Please go back to the main page to start or select a story.', 'error');
        if (nextSegmentButton) nextSegmentButton.disabled = true;
    }

    // --- Event Listeners for static buttons ---
    if (nextSegmentButton) {
        nextSegmentButton.addEventListener('click', getNextSegment);
    }

    if (backToListButton) {
        backToListButton.addEventListener('click', () => {
            window.location.href = '/';
        });
    }
});
