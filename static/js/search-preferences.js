document.getElementById('searchButton').addEventListener('click', async () => {
    performSearch();
});

document.getElementById('searchInput').addEventListener('keypress', async (event) => {
    if (event.key === 'Enter') {
        performSearch();
    }
});

async function performSearch() {
    const searchQuery = document.getElementById('searchInput').value.trim();
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<p class="text-gray-600">Searching...</p>';

    if (!searchQuery) {
        resultsDiv.innerHTML = '<p class="text-red-500">Please enter a search query.</p>';
        return;
    }

    try {
        const response = await fetch(`/api/entities?query=${encodeURIComponent(searchQuery)}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        resultsDiv.innerHTML = ''; // Clear "Searching..."

        if (data.length === 0) {
            resultsDiv.innerHTML = '<p class="text-center text-gray-600 col-span-full">No results found for that query. Please try again.</p>';
            return;
        }

        data.forEach(entity => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'bg-white rounded-xl shadow-lg overflow-hidden flex flex-col transform hover:scale-102 transition-all duration-300 ease-in-out cursor-pointer group';
            itemDiv.id = entity.id;
            itemDiv.innerHTML = `
                ${entity.image_url ? `
                    <div class="w-full h-64 flex items-center justify-center overflow-hidden rounded-t-xl bg-gray-100">
                        <img src="${entity.image_url}" alt="${entity.name}" class="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300 ease-in-out">
                    </div>
                ` : `
                    <div class="w-full h-64 flex items-center justify-center bg-gray-200 text-gray-500 text-center p-4 rounded-t-xl">
                        <span class="text-lg font-semibold">${entity.name || 'No Title'} <br> (No Image)</span>
                    </div>
                `}
                
                <div class="p-4 flex-grow flex flex-col justify-between items-center text-center"> 
                    <div class="mb-4 w-full">
                        <h3 class="text-xl font-bold text-gray-800 mb-2">${entity.name}</h3>
                        <p class="text-gray-700 text-sm mb-1">Type: <span class="font-semibold capitalize">${(entity.type || 'N/A').replace('_', ' ')}</span></p>
                        ${entity.release_year ? `<p class="text-gray-700 text-sm">Year: <span class="font-semibold">${entity.release_year}</span></p>` : ''}
                    </div>
                    <button class="add-entity w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-full text-base hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out">
                        Add to Preferences
                    </button>
                </div>
            `;
            resultsDiv.appendChild(itemDiv);
        });

        document.querySelectorAll('.add-entity').forEach(button => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation(); // Prevent card click event from firing when button is clicked
                
                // --- Start: Login Check for Add to Preferences button ---
                
                if (!window.initialSupabaseSession) {
                    // Display a temporary message before redirecting
                    event.target.textContent = 'Sign in to add...';
                    event.target.disabled = true;
                    event.target.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                    event.target.classList.add('bg-orange-500', 'cursor-not-allowed');

                    setTimeout(() => {
                        window.location.href = '/auth'; 
                    }, 1500); // Give user a moment to see the message
                    return; 
                }
                // --- End: Login Check ---

                const clickedButton = event.target;
                const parentDiv = clickedButton.closest('[id]'); 

                const entityId = parentDiv ? parentDiv.id : null;

                if (!entityId) {
                    console.error("Could not find entity ID for the selected item.");
                    // Use a custom message box 
                    const messageBox = document.createElement('div');
                    messageBox.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                    messageBox.innerHTML = `
                        <div class="bg-white p-6 rounded-lg shadow-xl text-center">
                            <p class="text-lg font-semibold text-red-600 mb-4">Error: Could not determine entity to add.</p>
                            <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" onclick="this.closest('.fixed').remove()">OK</button>
                        </div>
                    `;
                    document.body.appendChild(messageBox);
                    return;
                }

                const originalButtonText = clickedButton.textContent;
                const originalButtonClass = clickedButton.className; 
                clickedButton.textContent = 'Adding...';
                clickedButton.disabled = true; 
                clickedButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-green-500', 'bg-red-500'); // Remove previous colors
                clickedButton.classList.add('bg-blue-300', 'cursor-not-allowed');

                try {
                    const response = await fetch('/api/entity', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ id: entityId })
                    });

                    if (!response.ok) {
                        let errorDetails;
                        try {
                            errorDetails = await response.json();
                        } catch (parseError) {
                            errorDetails = await response.text();
                        }
                        console.error('Backend Save Error:', errorDetails);
                        // Display detailed error message from backend
                        clickedButton.textContent = `${errorDetails.message || errorDetails || 'Unknown error'}`;
                        clickedButton.classList.remove('bg-blue-300');
                        clickedButton.classList.add('bg-red-500');
                    } else {
                        clickedButton.textContent = 'Added!';
                        clickedButton.classList.remove('bg-blue-300');
                        clickedButton.classList.add('bg-green-500');
                    }

                } catch (error) {
                    console.error('Network or unexpected error during add operation:', error);
                    // Display network error message
                    clickedButton.textContent = `Network Error: ${error.message || 'Please try again.'}`;
                    clickedButton.classList.remove('bg-blue-300');
                    clickedButton.classList.add('bg-red-500');
                    
                } finally {
                    // Revert button state after a short delay, but only if not an error state
                    setTimeout(() => {
                        clickedButton.disabled = false;

                        // Only revert text and style if it's not currently showing an error
                        if (!clickedButton.classList.contains('bg-red-500')) {
                            clickedButton.textContent = originalButtonText;
                            clickedButton.className = originalButtonClass; // Restore original classes for success
                        } else {
                            // If it's an error, keep the error text and red color, but re-enable interaction
                             clickedButton.classList.remove('cursor-not-allowed');
                             clickedButton.classList.add('hover:bg-red-600'); // Allow re-interaction on error button
                        }
                    }, 2500); 
                }
            });
        });

    } catch (error) {
        console.error('Initial Search Error:', error);
        resultsDiv.innerHTML = `<p class="text-center text-red-600 col-span-full">An error occurred during search: ${error.message}. Please try again later.</p>`;
    }
}
