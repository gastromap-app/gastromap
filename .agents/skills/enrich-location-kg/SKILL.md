# Enrich Location KG

Enriches GastroMap locations with Knowledge Graph data using Google Places API and Apify.

Supports two modes:
- `--weak`: Enrich only locations with fewer than 3 kg_dishes
- (default): Enrich all locations

Returns a list of enriched location IDs and dish counts.
