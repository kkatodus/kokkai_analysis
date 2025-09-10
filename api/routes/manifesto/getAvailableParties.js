import { MANIFESTO_DATA_DIR } from "./constants.js";
import { readdirSync, statSync, existsSync } from "fs";
import path from "path";

export function getAvailableParties(request, response) {
  try {
    if (!existsSync(MANIFESTO_DATA_DIR)) {
      return response.status(404).json({ 
        error: "Manifesto data directory not found" 
      });
    }
    
    // Read directory contents
    const items = readdirSync(MANIFESTO_DATA_DIR);
    
    // Filter for directories only (party folders)
    const parties = items.filter(item => {
      const itemPath = path.join(MANIFESTO_DATA_DIR, item);
      return statSync(itemPath).isDirectory();
    });
    
    // For each party, check what files are available
    const partiesWithFiles = parties.map(party => {
      const partyDir = path.join(MANIFESTO_DATA_DIR, party);
      const policiesPath = path.join(partyDir, "policies.json");
      const coherencePath = path.join(partyDir, "investigated_coherence.json");
      
      return {
        name: party,
        hasPolicies: existsSync(policiesPath),
        hasCoherence: existsSync(coherencePath)
      };
    });
    
    response.json({
      parties: partiesWithFiles,
      count: partiesWithFiles.length
    });
    
  } catch (error) {
    console.error("Error in getAvailableParties:", error);
    response.status(500).json({ 
      error: "Internal server error" 
    });
  }
}