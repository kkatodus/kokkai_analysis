import { MANIFESTO_DATA_DIR } from "./constants.js";
import { readFileSync, existsSync } from "fs";
import path from "path";

export function getPartyManifesto(request, response) {
  try {
    const { partyName } = request.params;
    
    if (!partyName) {
      return response.status(400).json({ 
        error: "Party name is required" 
      });
    }
    
    // Decode URL-encoded party name (in case of Japanese characters)
    const decodedPartyName = decodeURIComponent(partyName);
    
    const partyDir = path.join(MANIFESTO_DATA_DIR, decodedPartyName);
    const policiesPath = path.join(partyDir, "policies.json");
    const coherencePath = path.join(partyDir, "investigated_coherence.json");
    
    // Check if party directory exists
    if (!existsSync(partyDir)) {
      return response.status(404).json({ 
        error: `Party '${decodedPartyName}' not found` 
      });
    }
    
    let policies = null;
    let coherence = null;
    
    // Read policies file if it exists
    if (existsSync(policiesPath)) {
      try {
        const policiesData = readFileSync(policiesPath, 'utf8');
        policies = JSON.parse(policiesData);
      } catch (err) {
        console.error(`Error reading policies for ${decodedPartyName}:`, err);
      }
    }
    
    // Read coherence file if it exists
    if (existsSync(coherencePath)) {
      try {
        const coherenceData = readFileSync(coherencePath, 'utf8');
        coherence = JSON.parse(coherenceData);
      } catch (err) {
        console.error(`Error reading coherence data for ${decodedPartyName}:`, err);
      }
    }
    
    // Return the data
    response.json({
      party: decodedPartyName,
      policies: policies,
      coherence: coherence
    });
    
  } catch (error) {
    console.error("Error in getPartyManifesto:", error);
    response.status(500).json({ 
      error: "Internal server error" 
    });
  }
}