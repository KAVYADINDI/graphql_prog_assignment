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

        responseOutput.textContent = "Processing request...";
        movieList.innerHTML = ''; // Clear previous movie list

        try {
            // --- Step 1: Send natural language request to your LLM (Backend Proxy Recommended) ---
            // For a production setup, you'd likely have a backend endpoint that acts as a proxy
            // to your LLM (e.g., Ollama). For this assignment, you might directly call Ollama's
            // API if it's exposed, or, more realistically for a simple setup, simulate the LLM
            // by creating a simple "translation" function on your Node.js backend that maps
            // natural language to a predefined GraphQL query/mutation based on keywords.

            // Since this assignment requires LLM to translate to MongoDB queries,
            // the LLM integration logic usually happens on the Node.js backend for Ollama.
            // You'd send the naturalLanguageRequest to a new Express endpoint,
            // which then talks to Ollama, gets the MongoDB query, converts it to GraphQL,
            // and executes it.

            // For demonstration purposes *if you don't have a direct LLM integration set up yet*,
            // let's hardcode a simple GraphQL query.
            // Replace this with actual LLM integration later.

            let graphqlQuery = '';
            let graphqlVariables = {};
            let operationType = 'query'; // or 'mutation'

            // A very simple "LLM simulation" for demonstration
            if (naturalLanguageRequest.toLowerCase().includes('all movies')) {
                graphqlQuery = `
                    query GetAllMovies {
                        getAllMovies {
                            _id
                            title
                            director
                            year
                            rating
                            actors
                            genres {
                                name
                            }
                        }
                    }
                `;
            } else if (naturalLanguageRequest.toLowerCase().includes('create movie')) {
                // Example for create: In a real scenario, the LLM would extract title, genre, etc.
                // For a simple test, you might hardcode or parse from specific input fields.
                // This is a placeholder; real LLM integration for mutations is complex.
                const titleMatch = naturalLanguageRequest.match(/title: "(.*?)"/i);
                const directorMatch = naturalLanguageRequest.match(/director: "(.*?)"/i);
                const yearMatch = naturalLanguageRequest.match(/year: (\d+)/i);
                const actorsMatch = naturalLanguageRequest.match(/actors: \[(.*?)\]/i); // Expects [ "Actor1", "Actor2" ]
                const genresMatch = naturalLanguageRequest.match(/genres: \[(.*?)\]/i); // Expects [ "Genre1", "Genre2" ]

                const title = titleMatch ? titleMatch[1] : `New Movie ${Date.now()}`;
                const director = directorMatch ? directorMatch[1] : "Unknown Director";
                const year = yearMatch ? parseInt(yearMatch[1]) : 2025;
                const actors = actorsMatch ? actorsMatch[1].split(',').map(a => a.trim().replace(/"/g, '')) : ["Actor One", "Actor Two"];
                const genreNames = genresMatch ? genresMatch[1].split(',').map(g => g.trim().replace(/"/g, '')) : ["Action", "Sci-Fi"];


                graphqlQuery = `
                    mutation CreateMovie($input: MovieInput!) {
                        createMovie(input: $input) {
                            _id
                            title
                            director
                            year
                        }
                    }
                `;
                graphqlVariables = {
                    input: {
                        title: title,
                        description: "A movie created by NL request.",
                        director: director,
                        actors: actors,
                        year: year,
                        runtime: 120,
                        rating: 7.5,
                        votes: 1000,
                        revenue: 50.0,
                        genreNames: genreNames // Pass genre names for backend processing
                    }
                };
                operationType = 'mutation';

            } else if (naturalLanguageRequest.toLowerCase().includes('delete movie')) {
                const titleMatch = naturalLanguageRequest.match(/title: "(.*?)"/i);
                const titleToDelete = titleMatch ? titleMatch[1] : null;

                if (titleToDelete) {
                    graphqlQuery = `
                        mutation DeleteMovie($title: String!) {
                            deleteMovie(title: $title)
                        }
                    `;
                    graphqlVariables = {
                        title: titleToDelete
                    };
                    operationType = 'mutation';
                } else {
                    responseOutput.textContent = "Please specify a movie title to delete (e.g., 'Delete movie title: \"Test Movie\"').";
                    return;
                }
            }
            // Add more conditions for Update, specific Retrieve queries etc.


            if (!graphqlQuery) {
                 responseOutput.textContent = "LLM could not interpret the request or the feature is not implemented yet.";
                 return;
            }


            // --- Step 2: Send the GraphQL query/mutation to your backend ---
            const response = await fetch('/graphql', { // Ensure this URL matches your Apollo Server endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: graphqlQuery,
                    variables: graphqlVariables
                }),
            });

            const result = await response.json();

            if (result.errors) {
                responseOutput.textContent = "Error: " + result.errors.map(err => err.message).join('\n');
            } else {
                responseOutput.textContent = JSON.stringify(result.data, null, 2); // Display raw JSON response

                // Example of displaying retrieved movies
                if (operationType === 'query' && result.data && result.data.getAllMovies) {
                    movieList.innerHTML = '<h3>Movies Found:</h3>';
                    result.data.getAllMovies.forEach(movie => {
                        const movieDiv = document.createElement('div');
                        movieDiv.classList.add('movie-item');
                        movieDiv.innerHTML = `
                            <h3>${movie.title} (${movie.year})</h3>
                            <p><strong>Director:</strong> ${movie.director}</p>
                            <p><strong>Rating:</strong> ${movie.rating}</p>
                            <p><strong>Actors:</strong> ${movie.actors ? movie.actors.join(', ') : 'N/A'}</p>
                            <p><strong>Genres:</strong> ${movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A'}</p>
                        `;
                        movieList.appendChild(movieDiv);
                    });
                }
            }

        } catch (error) {
            console.error('Fetch Error:', error);
            responseOutput.textContent = `Network error or unexpected issue: ${error.message}`;
        }
    });
});