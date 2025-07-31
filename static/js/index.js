document.addEventListener('DOMContentLoaded', () => {
    // --- Event Listeners for Existing Story Cards ---
    const storyCards = document.querySelectorAll('.story-card');
    storyCards.forEach(card => {
        card.addEventListener('click', () => {
            const storyId = card.getAttribute('data-story-id');
            if (storyId) {
                // Redirect to the backend route that serves story.ejs with the specific storyId
                window.location.href = `/story?storyId=${storyId}`;
            } else {
                console.warn('Clicked story card has no data-story-id attribute.');
            }
        });
    });

    // --- Logic for Start a New Story Button ---
    const startStoryButton = document.getElementById('startStoryButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const statusMessage = document.getElementById('statusMessage');

    if (startStoryButton && loadingSpinner && statusMessage) {
        startStoryButton.addEventListener('click', async () => {
            // Only trigger if not already loading
            if (!startStoryButton.disabled) {
                // Show loading spinner and update status message
                loadingSpinner.classList.remove('hidden');
                statusMessage.textContent = 'Generating your captivating story... Please wait.'; // Initial message
                
                startStoryButton.disabled = true; // Disable button during loading

                if (!window.initialSupabaseSession) {

                    statusMessage.textContent = 'Please sign in... Redirecting...';
                    setTimeout(() => {
                        window.location.href = '/logIn'; // Redirect to your login page
                    }, 1500); // Give user a moment to see the message
                    return; // Stop further execution
                }

                try {
                    // Make a POST request to the backend to start story generation
                    const response = await fetch('/api/stories', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                    });
                    if (!response.ok) {
                        let errorData;
                        try {
                            errorData = await response.json();
                        } catch (err) {
                            errorData = { message: await response.text() };
                        }
                        throw new Error(`Server error (${response.status}): ${errorData.error || errorData.message || 'Unknown error occurred on the server.'}`);
                    }
                    
                    if (response.status ===204){
                        statusMessage.textContent = 'Before we generate your first story, first share with us your favorite entities';

                        setTimeout(function() {
                            window.location.href = "/search"; 
                        }, 3000);
                        return;
                    }
                    
                    const data = await response.json();
                    if (data && data.storyId) {

                        statusMessage.textContent = 'Story created! Redirecting...';
                        // Redirect to the story display page, passing the storyId in the URL
                        window.location.href = `/story?storyId=${data.storyId}`;
                    } else {
                        console.warn('Backend response was OK, but no storyId found:', data);
                        statusMessage.innerHTML = '<p class="text-red-500">Failed to start story. Server did not provide a story ID.</p>';
                    }

                } catch (err) {
                    console.error('An error occurred during story generation:', err);
                    statusMessage.innerHTML = `<p class="text-red-600 font-semibold">Error: ${err.message || 'An unexpected error occurred. Please try again.'}</p>`;
                } finally {
                    // Re-enable the button and hide loading spinner if not redirected
                    if (startStoryButton.disabled) { // Check if still disabled
                        loadingSpinner.classList.add('hidden'); // Hide the loading spinner
                        startStoryButton.disabled = false; // Re-enable button
                    }
                }
            }
        });
    } else {
        console.warn('Elements for start story button logic not found.');
    }
});
