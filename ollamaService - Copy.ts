
import type { ExtractedData } from "../types";
import { extractTextFromFile } from './ocrService';

// Default to the backend proxy. This ensures that even if accessed from an external device,
// the request is routed through the server (where Ollama is running), avoiding CORS/Localhost issues.
export const DEFAULT_OLLAMA_BASE_URL = "/api/ollama";
export const DEFAULT_OLLAMA_MODEL = "all-minilm:latest";
export const DEFAULT_OLLAMA_TIMEOUT_SECONDS = 600; // 10 minutes

/**
 * Checks if the Ollama server is running and accessible.
 * @param baseUrl The base URL of the Ollama server (e.g., http://localhost:11434 or /api/ollama).
 * @returns A promise that resolves to an object with success status and a message.
 */
export const testOllamaConnection = async (baseUrl: string): Promise<{success: boolean, message: string}> => {
    let urlToTest: string;
    try {
        // If it's a relative path (proxy), keep it relative.
        if (baseUrl.startsWith('/')) {
            urlToTest = baseUrl;
        } else {
            // Ensure there's a protocol and remove any trailing slashes to get the origin.
            const trimmedUrl = baseUrl.trim().replace(/\/+$/, '');
            const urlObj = new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `http://${trimmedUrl}`);
            urlToTest = urlObj.origin;
        }
    } catch (e) {
        return { success: false, message: 'The provided URL is invalid.' };
    }

    try {
        // Add a 5-second timeout to the fetch request
        const response = await fetch(urlToTest, { method: 'GET', signal: AbortSignal.timeout(5000) });
        
        if (!response.ok) {
            return { success: false, message: `Server at ${urlToTest} responded with status ${response.status}.` };
        }

        const text = await response.text();
        if (text.trim() === "Ollama is running") {
            return { success: true, message: 'Connection successful!' };
        } else {
            return { success: false, message: `Connected to ${urlToTest}, but the response was unexpected.` };
        }

    } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            return { success: false, message: `Could not connect to ${urlToTest}. Check if the server is running and CORS is configured (e.g., OLLAMA_ORIGINS=*).` };
        }
        if (error instanceof Error && error.name === 'TimeoutError') {
             return { success: false, message: `Connection to ${urlToTest} timed out. The server may be slow or blocked by a firewall.` };
        }
        if (error instanceof Error) {
            return { success: false, message: `An unexpected error occurred: ${error.message}` };
        }
        return { success: false, message: 'An unknown error occurred during connection test.' };
    }
};


const getOllamaBaseUrl = (): string => {
    const saved = localStorage.getItem('ollamaBaseUrl');
    // Intelligent fallback: If the user is accessing from a remote device (not localhost),
    // and they still have the default "localhost" setting saved, we force the proxy.
    // This fixes the "outside of computer" issue instantly without user action.
    if (saved && saved.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.warn('Detected remote access with localhost config. Switching to Server Proxy.');
        return DEFAULT_OLLAMA_BASE_URL;
    }
    return saved || DEFAULT_OLLAMA_BASE_URL;
};

const getOllamaModel = (): string => {
    return localStorage.getItem('ollamaModel') || DEFAULT_OLLAMA_MODEL;
};

const getOllamaTimeout = (): number => {
    const savedTimeout = localStorage.getItem('ollamaTimeout');
    // Return milliseconds
    return (savedTimeout ? parseInt(savedTimeout, 10) : DEFAULT_OLLAMA_TIMEOUT_SECONDS) * 1000;
};


export const extractContractData = async (file: File, onProgress: (message: string) => void, companyName?: string): Promise<ExtractedData> => {
  
  onProgress('Reading file...');
  const text = await extractTextFromFile(file, (progress) => {
      // Provide detailed progress from Tesseract
      if (progress.status) {
          const progressPercent = progress.progress ? `(${Math.round(progress.progress * 100)}%)` : '';
          onProgress(`${progress.status} ${progressPercent}`);
      }
  });

  if (!text.trim()) {
      throw new Error("Document appears to be empty or text could not be extracted.");
  }

  onProgress('Analyzed with local AI (thinking)...');
  
  // Concise prompt to save token generation time
  let prompt = `
    You are an expert contract analyst and translator.
    Task: Extract data from the contract text below into valid JSON.
    
    IMPORTANT TRANSLATION RULE:
    If the contract is in a language other than English (e.g., Spanish, French, German), you MUST translate the extracted values into English. 
    For example, if "Zahlungsbedingungen" is "30 Tage", the output for "paymentTerms" must be "30 days".
    The keys in the JSON must remain exactly as specified below.
    
    Use "N/A" for missing values. Date format: YYYY-MM-DD.

    JSON Schema:
    {
      "contractNumber": "string", "amendmentNumber": "string", "partNumber": "string", "partDescription": "string", 
      "drawingNumber": "string", "lessFinishPartNumber": "string", "programName": "string", "issueDate": "string", "effectiveDate": "string", 
      "sampleRequiredBy": "string", "sellerNameAndAddress": "string", "dunsNumber": "string", "manufacturingDunsNumber": "string",
      "buyerNameAndAddress": "string", 
      "clientName": "string (The specific name of the Client/Buyer entity, exclude address)", 
      "purchasingContact": "string", "buyerCode": "string", "accountManager": "string",
      "mailingAddressInformation": "string", "manufacturingLocation": "string", "shippingTo": "string", 
      "freightTerms": "string", "deliveryTerms": "string", "deliveryDuns": "string", "shipFromDuns": "string", 
      "dailyCapacity": "string", "hoursPerDay": "string", "containerType": "string", "receivingPlants": "string", 
      "currency": "string", "basePrice": "string", "totalPrice": "string", "unitOfMeasure": "string", "paymentTerms": "string", 
      "reasonForIssuing": "string", "hazardousMaterialIndicator": "string", "language": "string (Detected Language)", "originalLanguage": "string"
    }
  `;

  if (companyName) {
    prompt += `\nNote: The Client Company Name is explicitly "${companyName}". Please use this exact spelling for 'clientName'.`;
  }

  prompt += `
    \nContract Text:
    ${text.substring(0, 15000)} 
    
    JSON:
  `;
  // Truncated text to 15000 chars to avoid blowing up context window on smaller local models, 
  // usually enough for key fields.

  const OLLAMA_BASE_URL = getOllamaBaseUrl();
  const OLLAMA_MODEL = getOllamaModel();
  // Handle relative proxy path logic for the API call
  let apiUrl = '';
  if (OLLAMA_BASE_URL.startsWith('/')) {
      apiUrl = `${OLLAMA_BASE_URL}/api/generate`; // e.g. /api/ollama/api/generate
  } else {
      apiUrl = `${OLLAMA_BASE_URL.replace(/\/+$/, '')}/api/generate`;
  }

  const OLLAMA_TIMEOUT_MS = getOllamaTimeout();

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        format: "json",
        stream: false,
        options: {
            temperature: 0.1, // Low temp for deterministic data extraction
            num_ctx: 4096, // Optimized for 8GB+ RAM: Enough for context but faster than 8192
            num_thread: 20 // TUNING: Utilize 12+ CPUs. Setting this forces high thread usage, helping utilization on high-core NUMA systems.
        }
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Ollama API response error:", errorBody);
        throw new Error(`Ollama API responded with status ${response.status}`);
    }

    const responseData = await response.json();
    const jsonString = responseData.response;
    
    // Find the JSON block within the response string
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Ollama response did not contain a valid JSON object:", jsonString);
      throw new Error("The local AI returned an invalid format that does not contain a JSON object.");
    }

    const cleanedJsonString = jsonMatch[0];
    const parsedData = JSON.parse(cleanedJsonString);

    const finalClientName = companyName || parsedData.clientName || parsedData.buyerNameAndAddress || 'N/A';

    return {
      contractNumber: parsedData.contractNumber || 'N/A',
      amendmentNumber: parsedData.amendmentNumber || 'N/A',
      partNumber: parsedData.partNumber || 'N/A',
      partDescription: parsedData.partDescription || 'N/A',
      drawingNumber: parsedData.drawingNumber || 'N/A',
      lessFinishPartNumber: parsedData.lessFinishPartNumber || 'N/A',
      programName: parsedData.programName || 'N/A',
      issueDate: parsedData.issueDate || 'N/A',
      effectiveDate: parsedData.effectiveDate || 'N/A',
      sampleRequiredBy: parsedData.sampleRequiredBy || 'N/A',
      sellerNameAndAddress: parsedData.sellerNameAndAddress || 'N/A',
      dunsNumber: parsedData.dunsNumber || 'N/A',
      manufacturingDunsNumber: parsedData.manufacturingDunsNumber || 'N/A',
      buyerNameAndAddress: parsedData.buyerNameAndAddress || 'N/A',
      clientName: finalClientName,
      purchasingContact: parsedData.purchasingContact || 'N/A',
      buyerCode: parsedData.buyerCode || 'N/A',
      accountManager: parsedData.accountManager || 'N/A',
      mailingAddressInformation: parsedData.mailingAddressInformation || 'N/A',
      manufacturingLocation: parsedData.manufacturingLocation || 'N/A',
      shippingTo: parsedData.shippingTo || 'N/A',
      freightTerms: parsedData.freightTerms || 'N/A',
      deliveryTerms: parsedData.deliveryTerms || 'N/A',
      deliveryDuns: parsedData.deliveryDuns || 'N/A',
      shipFromDuns: parsedData.shipFromDuns || 'N/A',
      dailyCapacity: parsedData.dailyCapacity || 'N/A',
      hoursPerDay: parsedData.hoursPerDay || 'N/A',
      containerType: parsedData.containerType || 'N/A',
      receivingPlants: parsedData.receivingPlants || 'N/A',
      currency: parsedData.currency || 'N/A',
      basePrice: parsedData.basePrice || 'N/A',
      totalPrice: parsedData.totalPrice || 'N/A',
      unitOfMeasure: parsedData.unitOfMeasure || 'N/A',
      paymentTerms: parsedData.paymentTerms || 'N/A',
      reasonForIssuing: parsedData.reasonForIssuing || 'N/A',
      hazardousMaterialIndicator: parsedData.hazardousMaterialIndicator || 'N/A',
      language: parsedData.language || 'English',
      originalLanguage: parsedData.originalLanguage || 'Unknown'
    };
  } catch (error) {
    console.error(`Error calling Ollama API at ${apiUrl}:`, error);
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`AI model request timed out after ${OLLAMA_TIMEOUT_MS / 1000} seconds. The model may be slow or the document is too large.`);
    }
    if (error instanceof SyntaxError) { 
      throw new Error("The local AI returned an invalid format.");
    }
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
        const baseUrl = getOllamaBaseUrl();
        throw new Error(`Could not connect to the Ollama server at ${baseUrl}. Check if it is running and CORS is configured.`);
    }
    const baseUrl = getOllamaBaseUrl();
    throw new Error(`Failed to extract data using model '${OLLAMA_MODEL}'. Check that your Ollama server is running at ${baseUrl}.`);
  }
};
