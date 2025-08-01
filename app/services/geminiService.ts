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

interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const EXAMPLE_JSON_CONFIG = `{
  "hz1sv": {
    "name": "HARDENING ZONE 1 SETPOINT",
    "type": "temperature",
    "zone": "zone1",
    "unit": "°C",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -30.0,
    "highDeviation": 10.0
  },
  "hz1pv": {
    "name": "HARDENING ZONE 1 TEMPERATURE",
    "type": "temperature", 
    "zone": "zone1",
    "unit": "°C",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -30.0,
    "highDeviation": 10.0
  },
  "oilpv": {
    "name": "OIL TEMPERATURE",
    "type": "temperature",
    "unit": "°C", 
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -10.0,
    "highDeviation": 20.0
  },
  "oiltemphigh": {
    "name": "OIL TEMPERATURE HIGH",
    "type": "temperature",
    "isAnalog": false,
    "isBinary": true
  },
  "hz1hfail": {
    "name": "HARDENING ZONE 1 HEATER FAILURE",
    "type": "heater",
    "zone": "zone1",
    "isAnalog": false,
    "isBinary": true
  },
  "cpsv": {
    "name": "CARBON POTENTIAL",
    "type": "carbon",
    "unit": "%",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -0.05,
    "highDeviation": 0.05
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
  - lowDeviation: number (optional, lower deviation threshold for analog alarms)
  - highDeviation: number (optional, upper deviation threshold for analog alarms)

Example of valid JSON:
${EXAMPLE_JSON_CONFIG}

Important rules:
- A column cannot be both analog and binary (isAnalog and isBinary cannot both be true)
- At least one of isAnalog or isBinary must be true
- lowDeviation and highDeviation are only applicable for analog alarms (isAnalog: true)
- lowDeviation should be a negative number or 0
- highDeviation should be a positive number or 0
- Fix any missing quotes, commas, or brackets
- Correct any spelling mistakes in property names
- Ensure proper JSON formatting with consistent indentation
- Return ONLY the corrected JSON, no explanations, no markdown formatting, no code blocks
- Do not wrap the JSON in \`\`\`json or \`\`\` blocks
- Return pure JSON only`;

export const checkAndFixJsonSyntax = async (jsonInput: string): Promise<{ success: boolean; correctedJson?: string; error?: string }> => {
  try {
    // Check if API key is properly configured
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'Your-Gemini-API-Key' || GEMINI_API_KEY.length < 10) {
      return { 
        success: false, 
        error: 'Gemini API key not configured. Please set the GEMINI_API_KEY environment variable.' 
      };
    }

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

    const requestBody = {
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
    };

    console.log('Sending request to Gemini API...');
    console.log('API URL:', GEMINI_API_URL);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Gemini API response status:', response.status);
    console.log('Gemini API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData: GeminiErrorResponse = await response.json();
        if (errorData.error) {
          errorMessage = `Gemini API error: ${errorData.error.status} - ${errorData.error.message}`;
        }
      } catch (parseError) {
        // If we can't parse the error response, use the default message
      }
      
      throw new Error(errorMessage);
    }

    const data: GeminiResponse = await response.json();
    console.log('Gemini API response data:', JSON.stringify(data, null, 2));
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    const correctedText = data.candidates[0].content.parts[0].text.trim();
    console.log('Corrected text from Gemini:', correctedText);
    
    // Clean the response text - remove markdown code blocks if present
    let cleanedText = correctedText;
    
    // Remove markdown code blocks (```json ... ```)
    if (cleanedText.startsWith('```json') && cleanedText.endsWith('```')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```') && cleanedText.endsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Remove any leading/trailing whitespace
    cleanedText = cleanedText.trim();
    
    console.log('Cleaned text from Gemini:', cleanedText);
    
    // Try to parse the corrected JSON to ensure it's valid
    try {
      const parsed = JSON.parse(cleanedText);
      return { 
        success: true, 
        correctedJson: JSON.stringify(parsed, null, 2) 
      };
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed to parse text:', cleanedText);
      throw new Error(`Gemini returned invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
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
      
      // Check deviation fields for analog alarms
      if (configObj.isAnalog) {
        if (configObj.lowDeviation !== undefined && typeof configObj.lowDeviation !== 'number') {
          errors.push(`Column ${columnName}: 'lowDeviation' must be a number`);
        }
        if (configObj.highDeviation !== undefined && typeof configObj.highDeviation !== 'number') {
          errors.push(`Column ${columnName}: 'highDeviation' must be a number`);
        }
        if (configObj.lowDeviation !== undefined && configObj.highDeviation !== undefined) {
          if (configObj.lowDeviation > configObj.highDeviation) {
            errors.push(`Column ${columnName}: 'lowDeviation' cannot be greater than 'highDeviation'`);
          }
        }
      }
    }
    
    return { isValid: errors.length === 0, errors };
    
  } catch (parseError) {
    errors.push('Invalid JSON format');
    return { isValid: false, errors };
  }
}; 