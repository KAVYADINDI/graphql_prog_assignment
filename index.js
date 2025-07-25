const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { typeDefs } = require("./schema/type-defs");
const { resolvers } = require("./schema/resolvers");
const mongoose = require("mongoose");
const path = require('path');
const { spawn } = require('child_process'); // Import child_process module

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

            // Spawn a Python child process to execute the LLM/MongoDB logic
            // Ensure 'python' or 'python3' is in your system's PATH, or provide the full path to your Python executable
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

            pythonProcess.on('close', (code) => {
                console.log(`Python process exited with code ${code}`);
                if (code !== 0) {
                    return res.status(500).json({
                        error: `Python script failed with code ${code}.`,
                        details: pythonError || "No stderr output.",
                        llm_raw_output: pythonOutput // Include raw LLM output for debugging
                    });
                }

                try {
                    const result = JSON.parse(pythonOutput);
                    res.json(result); // Send the parsed JSON result to the frontend
                } catch (parseError) {
                    console.error('Failed to parse Python output as JSON:', parseError);
                    res.status(500).json({
                        error: "Failed to parse Python script output.",
                        details: parseError.message,
                        raw_output: pythonOutput
                    });
                }
            });

            pythonProcess.on('error', (err) => {
                console.error('Failed to start Python process:', err);
                res.status(500).json({ error: "Failed to execute LLM script.", details: err.message });
            });
        });

        const PORT = process.env.PORT || 4000;
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`GraphQL endpoint at http://localhost:${PORT}${server.graphqlPath}`);
        });
    })
    .catch(err => console.error(`Error connecting to MongoDB or starting server: ${err}`));