const express = require('express'); 
const { ApolloServer } = require('apollo-server-express');
const { typeDefs } = require("./schema/type-defs");
const { resolvers } = require("./schema/resolvers");
const mongoose = require("mongoose");
const path = require('path'); 

const MONGODB = "mongodb+srv://kavyadindi:JaceClary02@cluster-k.cpyw4ag.mongodb.net/imdb?retryWrites=true&w=majority&appName=Cluster-K";

const app = express();

// Middleware to parse JSON requests
app.use(express.json());

const server = new ApolloServer({ typeDefs, resolvers });

mongoose.connect(MONGODB, {})
    .then(() => {
        console.log("MongoDB Connection Successful");
        // Start Apollo Server 
        return server.start(); 
    })
    .then(() => {
        // Apply Apollo Server middleware to the Express app
        server.applyMiddleware({ app }); 
        app.use(express.static(path.join(__dirname, 'public'))); 
        //set base path
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Endpoint to handle natural language requests
        app.post('/api/natural-language', (req, res) => {
            const { query, variables } = req.body;
            if (!query) {
                return res.status(400).json({ error: "Query is required" });
            }

            server.executeOperation({ query, variables })
                .then((result) => res.json(result))
                .catch((err) => res.status(500).json({ error: err.message }));
        });

        // Use environment variable or default to 4000
        const PORT = process.env.PORT || 4000; 

        // Start the Express server
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`GraphQL endpoint at http://localhost:${PORT}${server.graphqlPath}`);
        });
    })
    .catch(err => console.log(`error: ${err}`));