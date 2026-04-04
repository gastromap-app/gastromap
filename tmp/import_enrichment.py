import json

def generate_update_sql(json_path):
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    sql_commands = []
    
    # Locations
    for loc in data.get('locations', []):
        id = loc.get('id')
        keywords = loc.get('keywords', [])
        context = loc.get('context', '').replace("'", "''")
        embedding = str(loc.get('embedding', []))
        
        # Prepare keywords for SQL (array of strings)
        formatted_keywords = []
        for k in keywords:
            safe_k = k.replace("'", "''")
            formatted_keywords.append(f"'{safe_k}'")
        
        kw_sql = "ARRAY[" + ", ".join(formatted_keywords) + "]"
        
        # In SQL, vectors are represented as '[v1, v2, ...]'
        # The JSON already has the list, so we just wrap it in single quotes
        sql = f"UPDATE locations SET ai_keywords = {kw_sql}, ai_context = '{context}', embedding = '{embedding}' WHERE id = '{id}';"
        sql_commands.append(sql)
        
    # Cuisines
    for cuisine in data.get('cuisines', []):
        id = cuisine.get('id')
        embedding = str(cuisine.get('embedding', []))
        
        sql = f"UPDATE cuisines SET embedding = '{embedding}' WHERE id = '{id}';"
        sql_commands.append(sql)
        
    return "\n".join(sql_commands)

if __name__ == "__main__":
    sql = generate_update_sql('tmp/enrichment_results.json')
    with open('tmp/import_vectors.sql', 'w') as f:
        f.write(sql)
    print("SQL generation complete: tmp/import_vectors.sql")
