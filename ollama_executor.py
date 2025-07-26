import sys
import json
from langchain_core.prompts import PromptTemplate
from langchain_ollama.llms import OllamaLLM
# Ensure 'chain' is defined
from langchain.prompts import PromptTemplate
from langchain_ollama import OllamaLLM
import ast # To safely evaluate the string output from the LLM into a Python dictionary
import re # Import regex module for cleaning LLM output
import traceback  # For detailed error messages

# --- Configuration ---
MODEL = "llama3.2" # Make sure this model is pulled in your Ollama instance

# --- LLM Setup and Prompt Template ---
# Set temperature to a very low value for precise, less creative output
llm = OllamaLLM(model=MODEL, temperature=0.0, max_tokens=500) 

# Define the prompt template for the LLM
# This template instructs the LLM on how to generate GraphQL operation parameters
# It includes the available GraphQL queries and their expected arguments.
LLM_PROMPT_TEMPLATE = """
You are an expert in GraphQL queries and mutations for a movie database.
Your task is to convert natural language requests into a JSON object that represents a GraphQL operation.

Here is the GraphQL schema for the Movie and Genre types, and available queries/mutations:
Ensure all JSON keys are enclosed in double quotes.

GGraphQL Schema:
type Genre {{
  id: ID!
  name: String!
}}

type Movie {{
  id: ID!
  title: String!
  genres: [Genre!]!
  description: String
  director: String
  actors: [String]
  year: Int
  runtime: Int
  rating: Float
  votes: Int
  revenue: Float
}}

type Query {{
  getAllMovies: [Movie]
  getMovieByTitle(title: String!): Movie
}}

type Mutation {{
  createMovie(
    title: String!
    genreNames: [String!]!
    description: String
    director: String
    actors: [String]
    year: Int
    runtime: Int
    rating: Float
    votes: Int
    revenue: Float
  ): Movie
  updateMovie(
    title: String!
    genreNames: [String]
    description: String
    runtime: Int
    votes: Int
    rating: Float
  ): Movie
  deleteMovie(title: String!): String
}}
--- Examples ---
1.  **Query: Get all movies**
    Request: "Show me all movies"
    Output: {{
  "query": "query GetAllMovies {{ getAllMovies {{ title }} }}",
  "variables": {{}}
}}
For getAllMovies remember to select the subfield title of the Movie object to retrieve
2.  **Query: Get movie by title**
    Request: "Find the movie Inception"
    Output: {{
  "query": "query GetMovieByTitle($title: String!) {{ getMovieByTitle(title: $title) {{ id title genres {{ name }} description director actors year runtime rating votes revenue }} }}",
  "variables": {{
    "title": "Inception"
  }}
}}

3.  **Mutation: Create a movie**
    Request: "Add a new movie called 'Dune Part Two' from 2024, genre Sci-Fi, with a rating of 8.8, directed by Denis Villeneuve and starring Timothée Chalamet"
    Output: {{
  "query": "mutation CreateMovie($title: String!, $genreNames: [String!]!, $director: String, $year: Int, $rating: Float) {{ createMovie(title: $title, genreNames: $genreNames, director: $director, year: $year, rating: $rating) {{ id title }} }}",
  "variables": {{
    "title": "Dune Part Two",
    "genreNames": ["Sci-Fi"],
    "director": "Denis Villeneuve",
    "year": 2024,
    "rating": 8.8
  }}
}}

4.  **Mutation: Update a movie**
    Request: "Update the rating of 'The Dark Knight' to 9.0 and add description 'A superhero film'"
    Output: {{
  "query": "mutation UpdateMovie($title: String!, $rating: Float, $description: String) {{ updateMovie(title: $title, rating: $rating, description: $description) {{ id title rating description }} }}",
  "variables": {{
    "title": "The Dark Knight",
    "rating": 9.0,
    "description": "A superhero film"
  }}
}}

5.  **Mutation: Delete a movie**
    Request: "Delete the movie 'Avatar'"
    Output: {{
  "query": "mutation DeleteMovie($title: String!) {{ deleteMovie(title: $title) }}",
  "variables": {{
    "title": "Avatar"
  }}
}}

Now, convert the following natural language request into a single JSON object containing the GraphQL query and variables in a single line without any additional informantion, nextline, tab or (\)-escape sequence literals.
--- User Request ---
Request: "{input_prompt}"

GraphQL Operation:
"""

prompt = PromptTemplate(
    template=LLM_PROMPT_TEMPLATE,
    input_variables=["input_prompt"]
)

chain = prompt | llm

# --- Main function to process the natural language query ---
def main():
    """
    Receives a natural language query, generates GraphQL operation parameters
    (operationName and variables) using an LLM, and returns them as JSON.
    """
    if len(sys.argv) > 1:
        natural_language_query = sys.argv[1]
        print(f"[DEBUG] Received query: {natural_language_query}", file=sys.stderr)

        llm_response_str = "N/A"  # Initialize for error reporting
        cleaned_llm_response = "N/A"  # Initialize for error reporting

        try:
            # 1. Generate GraphQL operation parameters using Ollama LLM
            print("[DEBUG] Generating GraphQL operation with LLM...", file=sys.stderr)
            base_chain = prompt | llm
            llm_response_str = base_chain.invoke({"input_prompt": natural_language_query})
            print(f"[DEBUG] LLM raw response: {llm_response_str}", file=sys.stderr)

            # --- Robust Cleaning of LLM output before parsing ---
            # Step 1: Remove markdown code block fences (```python and ```)
            temp_cleaned = re.sub(r'```\n|```', '', llm_response_str).strip()
            print(f"[DEBUG] Cleaned LLM output: {temp_cleaned}", file=sys.stderr)
            # # Step 2: Ensure all keys in the variables field are properly quoted
            # temp_cleaned = re.sub(r'(?<=\{)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'"\1":', temp_cleaned)
            # Step 3: Extract the first complete Python dictionary found in the string
            match = re.search(r'\{[^{}]*(\{.*\})*[^{}]*\}', temp_cleaned, re.DOTALL)
            # Step 4: Strip extra tabs and spaces from the query field
            temp_cleaned = re.sub(r'\s+', ' ', temp_cleaned).strip()
            #step 5: Ensure the \ are not present in string
            temp_cleaned = temp_cleaned.replace('\\', '')

            if match:
                cleaned_llm_response = match.group(0)
                # Step 5: Ensure the query is not wrapped in backticks
                cleaned_llm_response = re.sub(r'("query":\s*")`([^`]*)`("\s*,)', r'\1\2\3', cleaned_llm_response)
            else:
                cleaned_llm_response = temp_cleaned
                print(f"[DEBUG] No clear dictionary match, attempting to parse raw cleaned string: {cleaned_llm_response}", file=sys.stderr)

            print(f"[DEBUG] Cleaned LLM output for parsing: {cleaned_llm_response}", file=sys.stderr)

            # Replace ast.literal_eval with json.loads for safer parsing
            llm_output_dict = json.loads(cleaned_llm_response)
            print(f"[DEBUG] Parsed LLM output: {llm_output_dict}", file=sys.stderr)

            # Ensure the LLM output is a dictionary and contains 'query' and 'variables'
            if not isinstance(llm_output_dict, dict) or "query" not in llm_output_dict or "variables" not in llm_output_dict:
                raise ValueError("LLM did not return a valid GraphQL operation dictionary.")

            # Adjust logic to prepend 'query' or 'mutation' based on the query type if the query value doesn't already start with it
            if not llm_output_dict['query'].startswith(('query ', 'mutation ')):
                print("[DEBUG] Adjusting query format based on operation type.", file=sys.stderr)
                if llm_output_dict['query'].startswith('get'):
                    llm_output_dict['query'] = f"query {llm_output_dict['query']}"
                    print("[DEBUG] Query format adjusted to include 'query'.", file=sys.stderr)
                elif llm_output_dict['query'].startswith(('add', 'create', 'update', 'delete')):
                    llm_output_dict['query'] = f"mutation {llm_output_dict['query']}"
                    print("[DEBUG] Query format adjusted to include 'mutation'.", file=sys.stderr)
                else:
                    llm_output_dict['query'] = "query getAllMovies { getAllMovies { id title year director rating genres { name } } }"
                    print("[DEBUG] Query format adjusted to default.", file=sys.stderr)
            else:
                print("[DEBUG] Query already starts with 'query' or 'mutation'. No adjustment needed.", file=sys.stderr)

            # 2. Return the generated query and variables as JSON
            response_data = {
                "status": "success",
                "message": "GraphQL operation parameters generated successfully.",
                "query": llm_output_dict.get("query", "getAllMovies"),  # Default to getAllMovies
                "variables": llm_output_dict.get("variables", {})  # Default to empty variables
            }
            print("[DEBUG] Success: Generated GraphQL operation parameters.", file=sys.stderr)
            print(json.dumps(response_data))

        except Exception as e:
            error_message = f"Error processing request: {e}"
            print(f"[DEBUG] {error_message}", file=sys.stderr)
            error_data = {
                "status": "error",
                "message": error_message,
                "llm_raw_output": llm_response_str,
                "cleaned_output_attempt": cleaned_llm_response
            }
            print(json.dumps(error_data))
            sys.exit(1)

    else:
        # If no argument was provided
        print("[DEBUG] No natural language query provided.", file=sys.stderr)
        error_data = {
            "status": "error",
            "message": "No natural language query provided as a command-line argument."
        }
        print(json.dumps(error_data))
        sys.exit(1)

def process_user_query(user_query):
    try:
        print("[DEBUG] User query received:", user_query, file=sys.stderr)
        # Generate the MongoDB query using the LLM
        mongodb_query = chain.invoke({"text_query": user_query})
        print("[DEBUG] LLM-generated MongoDB query:", mongodb_query, file=sys.stderr)

        # Clean up the generated query string
        mongodb_query = mongodb_query.strip()

        # Validate the query format
        if not mongodb_query.startswith("{") or not mongodb_query.endswith("}"):
            raise ValueError("LLM output is not a valid Python dictionary.")

        # Simulate GraphQL query generation for debugging
        graphql_response = {
            "status": "success",
            "query": "query getMovieByTitle($title: String!) { movie(title: $title) { title year } }",
            "variables": {"title": "Avatar"}
        }
        print("[DEBUG] Simulated GraphQL response:", graphql_response, file=sys.stderr)

        return json.dumps(graphql_response)
    except Exception as e:
        print("[ERROR] Exception during user query processing:", e, file=sys.stderr)
        traceback.print_exc()
        error_message = {
            "error": "Error processing user query.",
            "details": str(e),
            "user_query": user_query
        }
        return json.dumps(error_message)

if __name__ == "__main__":
    main()
