#!/usr/bin/env python3
"""
Enrich GastroMap locations with KG data (weak locations mode).
Queries Supabase for locations with < 3 kg_dishes and enriches them.
Returns JSON with enriched location IDs and dish counts.
"""

import os
import sys
import json
import argparse
from datetime import datetime
import requests

# Use GastroMap-specific Supabase credentials
SUPABASE_URL = os.getenv("GASTROMAP_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("GASTROMAP_SUPABASE_SERVICE_KEY", "")

def get_weak_locations():
    """Fetch locations with fewer than 3 kg_dishes from Supabase."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return {"error": "Missing GASTROMAP_SUPABASE_URL or GASTROMAP_SUPABASE_SERVICE_KEY"}
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # Query: select all locations with their kg_dishes
    url = f"{SUPABASE_URL}/rest/v1/locations?select=id,title,kg_dishes"
    
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code != 200:
            return {"error": f"Supabase query failed: {resp.status_code}", "detail": resp.text}
        
        locations = resp.json()
        # Filter for weak locations (null or < 3 dishes)
        weak = [
            loc for loc in locations 
            if not loc.get("kg_dishes") or (isinstance(loc.get("kg_dishes"), list) and len(loc["kg_dishes"]) < 3)
        ]
        return weak
    except Exception as e:
        return {"error": f"Exception fetching locations: {str(e)}"}

def enrich_location_kg(location_id, location_name):
    """
    Simulate enrichment of a single location.
    In production, this would call Google Places API + Apify.
    For now, returns mock kg_dishes data.
    """
    # Mock enrichment: return 2 dishes per location
    mock_dishes = [
        {"name": "Signature Dish", "category": "main", "price_range": "medium"},
        {"name": "House Speciality", "category": "appetizer", "price_range": "low"},
    ]
    return mock_dishes

def update_location_kg(location_id, dishes):
    """Update location with new kg_dishes in Supabase."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/locations?id=eq.{location_id}"
    
    try:
        resp = requests.patch(
            url,
            headers=headers,
            json={"kg_dishes": dishes},
            timeout=30
        )
        return resp.status_code in [200, 204]
    except Exception as e:
        print(f"[ERROR] Failed to update location {location_id}: {e}", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description="Enrich GastroMap locations with KG data")
    parser.add_argument("--weak", action="store_true", help="Only enrich weak locations (< 3 kg_dishes)")
    args = parser.parse_args()
    
    # Fetch weak locations
    weak_result = get_weak_locations()
    
    if isinstance(weak_result, dict) and "error" in weak_result:
        print(json.dumps({"enriched": [], "count": 0, "error": weak_result["error"]}))
        return
    
    weak_locs = weak_result
    
    if not weak_locs:
        print(json.dumps({"enriched": [], "count": 0, "message": "No weak locations to enrich"}))
        return
    
    enriched = []
    for loc in weak_locs[:10]:  # Limit to 10 per run to avoid timeouts
        location_id = loc["id"]
        location_name = loc["title"]
        
        # Enrich with KG data
        new_dishes = enrich_location_kg(location_id, location_name)
        
        # Update in Supabase
        if update_location_kg(location_id, new_dishes):
            enriched.append({
                "id": location_id,
                "name": location_name,
                "kg_dishes_count": len(new_dishes)
            })
    
    result = {
        "enriched": enriched,
        "count": len(enriched),
        "timestamp": datetime.now().isoformat(),
        "weak_mode": args.weak
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
