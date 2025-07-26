const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { typeDefs } = require("./schema/type-defs");
const { resolvers } = require("./schema/resolvers");
const mongoose = require("mongoose");
const path = require('path');
const { spawn } = require('child_process'); 
const Movie = require("./models/Movie"); 
const Genre = require("./models/Genre");

const MONGODB = "mongodb+srv://kavyadindi:JaceClary02@cluster-k.cpyw4ag.mongodb.net/imdb?retryWrites=true&w=majority&appName=Cluster-K";

const app = express();

// Middleware to parse JSON requests
app.use(express.json());

const server = new ApolloServer({ typeDefs, resolvers });

mongoose.connect(MONGODB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log("MongoDB Connection Successful");
        return server.start();
    })
    .then(() => {
        server.applyMiddleware({ app });
        app.use(express.static(path.join(__dirname, 'public')));

        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Endpoint to handle natural language requests via LLM
        app.post('/api/natural-language', (req, res) => {
            const { naturalLanguageQuery } = req.body; // Expect naturalLanguageQuery from frontend

            if (!naturalLanguageQuery) {
                return res.status(400).json({ error: "Natural language query is required" });
            }

            console.log(`Received natural language query: "${naturalLanguageQuery}"`);

            // Spawn a Python child process to execute the LLM logic.
            // The Python script (ollama_executor.py) will now return GraphQL operation parameters.
            const pythonProcess = spawn('python', [path.join(__dirname, 'ollama_executor.py'), naturalLanguageQuery]);

            let pythonOutput = '';
            let pythonError = '';

            pythonProcess.stdout.on('data', (data) => {
                pythonOutput += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                pythonError += data.toString();
                console.error(`Python stderr: ${data.toString()}`); // Log Python errors for debugging
            });

            pythonProcess.on('close', async (code) => { // Made async to await GraphQL execution
                console.log(`Python process exited with code ${code}`);
                console.log("[DEBUG] Raw Python output:", pythonOutput); // Log raw output for debugging
                if (code !== 0) {
                    return res.status(500).json({
                        error: `Python script failed with code ${code}.`,
                        details: pythonError || "No stderr output.",
                        llm_raw_output: pythonOutput // Include raw LLM output for debugging
                    });
                }

                try {
                  const llmResponse = JSON.parse(pythonOutput);
                   // const llmResponse = {query: "mutation CreateMovie($title: String!, $genreNames: [String!]!, $description: String, $director: String, $actors: [String], $year: Int, $rating: Float) { createMovie(  title: $title genreNames: $genreNames description: $description director: $director actors: $actors year: $year rating: $rating ) { id title year genres { name } } }", variables: {"title": "Taare Zameen Par", "genreNames": ["drama"], "description": "A coming-of-age story about a child who is dyslexic.", "director": "Aamir Khan", "actors": ["Darsheel Safary", "Aamir Khan"], "year": 2007, "rating": 8.8}};
           // Assuming pythonOutput is an object with query and variables}
                    if (llmResponse.status === "error") {
                        return res.status(500).json({
                            error: "LLM failed to generate query components.",
                            details: llmResponse.message,
                            llm_raw_output: llmResponse.llm_raw_output,
                            cleaned_output_attempt: llmResponse.cleaned_output_attempt
                        });
                    }

                    console.log("Query: ", llmResponse.query);
                    console.log("Variables: ", llmResponse.variables);

                    // Execute the GraphQL operation using Apollo Server's executeOperation method
                    const result = await server.executeOperation({
                        query: llmResponse.query,
                        variables: llmResponse.variables,
                    });

                    if (result.errors) {
                        console.error("GraphQL Errors:", result.errors);
                        return res.status(400).json({ errors: result.errors });
                    }

                    res.json(result.data);
                } catch (error) {
                    console.error("Error executing GraphQL operation:", error);
                    res.status(500).json({ error: "Failed to execute GraphQL operation", details: error.message });
                }
            });
        });     

        const PORT = process.env.PORT || 4000;
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}${server.graphqlPath}`);
        }); 
        })
    .catch(err => {
        console.error("Error starting server:", err);
    });
