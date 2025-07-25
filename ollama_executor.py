import sys
import json
from pymongo import MongoClient
from bson import ObjectId
from langchain_core.prompts import PromptTemplate
from langchain_ollama.llms import OllamaLLM
import ast
import re 

MODEL = "llama3.2" 

# MongoDB Connection 
MONGODB_URI = "mongodb+srv://kavyadindi:JaceClary02@cluster-k.cpyw4ag.mongodb.net/imdb?retryWrites=true&w=majority&appName=Cluster-K"
DATABASE_NAME = "imdb"
COLLECTION_NAME = "movies"

# --- MongoDB Setup ---
try:
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    movies_collection = db[COLLECTION_NAME]
    # Log successful connection to stderr for debugging in Node.js
    print("[DEBUG] MongoDB Connection Successful", file=sys.stderr)
except Exception as e:
    print(json.dumps({"status": "error", "message": f"MongoDB connection failed: {e}"}))
    sys.exit(1)

# --- Helper for JSON serialization of ObjectIds ---
class JSONEncoder(json.JSONEncoder):
    """
    Custom JSON encoder to handle MongoDB's ObjectId when serializing results.
    """
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return json.JSONEncoder.default(self, obj)

# --- LLM Setup and Prompt Template ---
# Set temperature to a very low value for precise, less creative output
llm = OllamaLLM(model=MODEL, temperature=0.1, max_tokens=500) 

LLM_PROMPT_TEMPLATE = """
You are an expert in MongoDB queries. Convert the following natural language request into a valid MongoDB query for collection 'movies',
which has fields: ids, title, description, directors, actors, year, runtime, genre, rating, votes, revenue.
Output only the Python dictionary form of the query.
For example:
Use either a .find() format like:
    {{'rating': {{'$gt': 8}}}}
Or the full MongoDB command form:
    {{
        'find': 'movies',
        'filter': {{'rating': {{'$gt': 8}}}},
        'projection': {{'title': 1, '_id': 0}}
    }}

Request: "{input_prompt}"

MongoDB Query:
"""
prompt = PromptTemplate(
    template=LLM_PROMPT_TEMPLATE,
    input_variables=["input_prompt"]
)

# --- Main function to process the natural language query ---
def main():
    if len(sys.argv) > 1:
        natural_language_query = sys.argv[1]
        print(f"[DEBUG] Received query: {natural_language_query}", file=sys.stderr)

        llm_response_str = "N/A" # Initialize for error reporting
        cleaned_llm_response = "N/A" # Initialize for error reporting

        try:
            # 1. Generate MongoDB query using Ollama LLM
            print("[DEBUG] Generating MongoDB query with LLM...", file=sys.stderr)
            base_chain = prompt | llm
            llm_response_str = base_chain.invoke({"input_prompt": natural_language_query})
            print(f"[DEBUG] LLM raw response: {llm_response_str}", file=sys.stderr)

            # --- Robust Cleaning of LLM output before parsing ---
            # Step 1: Remove markdown code block fences (```python and ```)
            temp_cleaned = re.sub(r'```python\n|```', '', llm_response_str).strip()
            
            # Step 2: Extract the first complete Python dictionary found in the string
            # This regex looks for a string starting with '{' and ending with '}'
            # and tries to capture the most encompassing dictionary.
            # re.DOTALL makes '.' match newlines as well.
            match = re.search(r'\{[^{}]*(\{.*\})*[^{}]*\}', temp_cleaned, re.DOTALL)
            
            if match:
                cleaned_llm_response = match.group(0)
                # Further clean up any trailing non-dictionary characters if the regex was too broad
                # This is a heuristic to ensure only the dictionary remains
                if cleaned_llm_response.endswith("`"): # Remove trailing backticks if any
                    cleaned_llm_response = cleaned_llm_response.rstrip("`").strip()
                # Remove any trailing commas that might cause SyntaxError in ast.literal_eval
                if cleaned_llm_response.endswith(","):
                    cleaned_llm_response = cleaned_llm_response.rstrip(",").strip()
            else:
                # If no dictionary found, try to use the temp_cleaned string directly,
                # assuming it might just be the dictionary without extra formatting.
                cleaned_llm_response = temp_cleaned
                print(f"[DEBUG] No clear dictionary match, attempting to parse raw cleaned string: {cleaned_llm_response}", file=sys.stderr)

            print(f"[DEBUG] Cleaned LLM output for parsing: {cleaned_llm_response}", file=sys.stderr)

            # Attempt to parse the LLM's string output into a Python dictionary
            # Use ast.literal_eval for safer parsing of Python-like dictionary strings
            try:
                llm_output_dict = ast.literal_eval(cleaned_llm_response)
                print(f"[DEBUG] Parsed LLM output: {llm_output_dict}", file=sys.stderr)
            except (ValueError, SyntaxError) as e:
                # Include the cleaned output in the error message for better debugging
                raise ValueError(f"Failed to parse LLM output as a Python dictionary: {e}. Cleaned output: '{cleaned_llm_response}'")

            # Ensure the LLM output is a dictionary and contains 'find' or 'aggregate'
            if not isinstance(llm_output_dict, dict) or not ("find" in llm_output_dict or "aggregate" in llm_output_dict):
                raise ValueError("LLM did not return a valid MongoDB command dictionary.")

            # 2. Execute the MongoDB query
            print("[DEBUG] Executing MongoDB command...", file=sys.stderr)
            result = db.command(llm_output_dict)
            print(f"[DEBUG] MongoDB command raw result: {result}", file=sys.stderr)

            documents = []
            if "cursor" in result:
                # For find commands, results are typically in a cursor
                documents = list(result["cursor"]["firstBatch"])

            else:
                # For other commands (e.g., aggregate, count), the result might be directly in the top level
                if isinstance(result, dict) and "ok" in result and result["ok"] == 1:
                    if "n" in result: # Example for count
                        documents = {"count": result["n"]}
                    elif "result" in result and isinstance(result["result"], list): # For some aggregate results
                        documents = result["result"]
                    else:
                        documents = result # Fallback for other direct results
                else:
                    documents = result # Directly take the result if no cursor

            # 3. Return results as JSON
            response_data = {
                "status": "success",
                "query": llm_output_dict,
                "results": documents
            }
            print(json.dumps(response_data, indent=2, cls=JSONEncoder))

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
        error_data = {
            "status": "error",
            "message": "No natural language query provided as a command-line argument."
        }
        print(json.dumps(error_data))
        sys.exit(1)

if __name__ == "__main__":
    main()
