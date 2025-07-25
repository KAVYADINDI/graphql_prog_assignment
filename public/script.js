document.addEventListener('DOMContentLoaded', () => {
    const requestInput = document.getElementById('request-input');
    const runButton = document.getElementById('run-button');
    const responseOutput = document.getElementById('response-output');
    const movieList = document.getElementById('movie-list');

    runButton.addEventListener('click', async () => {
        const naturalLanguageRequest = requestInput.value.trim();

        if (!naturalLanguageRequest) {
            responseOutput.textContent = "Please enter a request.";
            return;
        }

        responseOutput.textContent = "Processing request with LLM...";
        movieList.innerHTML = ''; // Clear previous movie list

        try {
            // --- Step 1: Send natural language request to your new backend endpoint ---
            const response = await fetch('/api/natural-language', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ naturalLanguageQuery: naturalLanguageRequest }), // Send NL query
            });

            const result = await response.json();

            if (response.ok) { // Check if the HTTP response status is OK (200-299)
                // --- Step 2: Display the LLM-processed MongoDB result ---
                responseOutput.textContent = JSON.stringify(result, null, 2); // Display raw JSON response from Python

                // Generic display for 'find' operation results (assuming 'find' returns an array of documents)
                if (Array.isArray(result) && result.length > 0 && result[0].title) {
                    movieList.innerHTML = '<h3>Movies Found:</h3>';
                    result.forEach(movie => {
                        const movieDiv = document.createElement('div');
                        movieDiv.classList.add('movie-item');
                        movieDiv.innerHTML = `
                            <h3>${movie.title} (${movie.year || 'N/A'})</h3>
                            <p><strong>Director:</strong> ${movie.director || 'N/A'}</p>
                            <p><strong>Rating:</strong> ${movie.rating || 'N/A'}</p>
                            <p><strong>Actors:</strong> ${movie.actors ? movie.actors.join(', ') : 'N/A'}</p>
                            <p><strong>Genres:</strong> ${movie.genres ? movie.genres.map(g => g.name || g).join(', ') : 'N/A'}</p>
                        `;
                        movieList.appendChild(movieDiv);
                    });
                } else if (result.inserted_ids || result.updated_count || result.deleted_count) {
                    // Handle messages for insert, update, delete operations
                    movieList.innerHTML = `<p>Operation Result: ${JSON.stringify(result, null, 2)}</p>`;
                } else {
                    movieList.innerHTML = `<p>No specific movie list to display. Raw response shown above.</p>`;
                }
            } else {
                // Handle non-OK HTTP responses (e.g., 400, 500 from your Node.js backend)
                responseOutput.textContent = `Error from server: ${result.error || 'Unknown error'}\nDetails: ${result.details || ''}`;
                console.error("Server Error Response:", result);
            }

        } catch (error) {
            console.error('Fetch or network error:', error);
            responseOutput.textContent = `Network error or unexpected issue: ${error.message}`;
        }
    });
});