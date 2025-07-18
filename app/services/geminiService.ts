import { GEMINI_API_KEY } from '../api/config';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const EXAMPLE_JSON_CONFIG = `{
  "hz1sv": {
    "name": "HARDENING ZONE 1 SETPOINT",
    "type": "temperature",
    "zone": "zone1",
    "unit": "°C",
    "isAnalog": true
  },
  "hz1pv": {
    "name": "HARDENING ZONE 1 TEMPERATURE",
    "type": "temperature", 
    "zone": "zone1",
    "unit": "°C",
    "isAnalog": true
  },
  "oilpv": {
    "name": "OIL TEMPERATURE",
    "type": "temperature",
    "unit": "°C", 
    "isAnalog": true
  },
  "oiltemphigh": {
    "name": "OIL TEMPERATURE HIGH",
    "type": "temperature",
    "isBinary": true
  },
  "hz1hfail": {
    "name": "HARDENING ZONE 1 HEATER FAILURE",
    "type": "heater",
    "zone": "zone1",
    "isBinary": true
  }
}`;

const SYSTEM_PROMPT = `You are a JSON syntax validator and fixer for SCADA alarm configurations. 

Your task is to:
1. Check if the provided JSON is valid
2. Fix any syntax errors, spelling mistakes, or formatting issues
3. Ensure the JSON follows the correct schema for column configurations
4. Return ONLY the corrected JSON without any additional text or explanations

The JSON should follow this schema:
- Each key is a column name (string)
- Each value is an object with these properties:
  - name: string (display name for the alarm)
  - type: string (alarm type like "temperature", "pressure", "heater", etc.)
  - zone: string (optional, zone identifier like "zone1", "zone2")
  - unit: string (optional, unit of measurement like "°C", "bar", "%")
  - isAnalog: boolean (true for analog alarms, false for binary)
  - isBinary: boolean (true for binary alarms, false for analog)

Example of valid JSON:
${EXAMPLE_JSON_CONFIG}

Important rules:
- A column cannot be both analog and binary (isAnalog and isBinary cannot both be true)
- At least one of isAnalog or isBinary must be true
- Fix any missing quotes, commas, or brackets
- Correct any spelling mistakes in property names
- Ensure proper JSON formatting with consistent indentation
- Return ONLY the corrected JSON, no explanations or markdown formatting`;

export const checkAndFixJsonSyntax = async (jsonInput: string): Promise<{ success: boolean; correctedJson?: string; error?: string }> => {
  try {
    // First, try to parse the JSON to see if it's already valid
    try {
      JSON.parse(jsonInput);
      return { success: true, correctedJson: jsonInput };
    } catch (parseError) {
      // JSON is invalid, proceed with Gemini fix
    }

    const prompt = `${SYSTEM_PROMPT}

Please fix this invalid JSON:

${jsonInput}

Return ONLY the corrected JSON:`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data: GeminiResponse = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    const correctedText = data.candidates[0].content.parts[0].text.trim();
    
    // Try to parse the corrected JSON to ensure it's valid
    try {
      const parsed = JSON.parse(correctedText);
      return { 
        success: true, 
        correctedJson: JSON.stringify(parsed, null, 2) 
      };
    } catch (parseError) {
      throw new Error('Gemini returned invalid JSON');
    }

  } catch (error) {
    console.error('Gemini service error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

export const validateJsonSchema = (jsonInput: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  try {
    const config = JSON.parse(jsonInput);
    
    if (typeof config !== 'object' || config === null) {
      errors.push('Configuration must be a JSON object');
      return { isValid: false, errors };
    }
    
    for (const [columnName, columnConfig] of Object.entries(config)) {
      if (typeof columnConfig !== 'object' || columnConfig === null) {
        errors.push(`Column ${columnName}: Configuration must be an object`);
        continue;
      }
      
      const configObj = columnConfig as any;
      
      // Check required fields
      if (!configObj.name || typeof configObj.name !== 'string') {
        errors.push(`Column ${columnName}: Missing or invalid 'name' field`);
      }
      
      if (!configObj.type || typeof configObj.type !== 'string') {
        errors.push(`Column ${columnName}: Missing or invalid 'type' field`);
      }
      
      // Check analog/binary configuration
      if (configObj.isAnalog && configObj.isBinary) {
        errors.push(`Column ${columnName}: Cannot be both analog and binary`);
      }
      
      if (!configObj.isAnalog && !configObj.isBinary) {
        errors.push(`Column ${columnName}: Must be either analog or binary`);
      }
      
      // Check optional fields
      if (configObj.zone && typeof configObj.zone !== 'string') {
        errors.push(`Column ${columnName}: 'zone' must be a string`);
      }
      
      if (configObj.unit && typeof configObj.unit !== 'string') {
        errors.push(`Column ${columnName}: 'unit' must be a string`);
      }
    }
    
    return { isValid: errors.length === 0, errors };
    
  } catch (parseError) {
    errors.push('Invalid JSON format');
    return { isValid: false, errors };
  }
}; 