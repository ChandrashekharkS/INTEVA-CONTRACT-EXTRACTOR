
export type View = 'dashboard' | 'grouped' | 'admin' | 'comparison' | 'today' | 'month' | 'database';

export type UserRole = 'Admin' | 'Editor' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string;
  assignedCompany?: string;
  password?: string;
}

export interface PageExtraction {
  pageNumber: number;
  text?: string; // Raw OCR text for this specific page
  fields: Partial<ExtractedData>;
}

export interface ExtractedData {
  // Key Identifiers
  contractNumber: string;
  amendmentNumber: string;
  partNumber: string;
  partDescription: string;
  drawingNumber: string;
  lessFinishPartNumber?: string;
  programName?: string;

  // Dates
  issueDate: string;
  effectiveDate: string; // From "This Contract is Effective from"
  sampleRequiredBy?: string;
  
  // Parties & Contacts
  lbe?: string; // Legal Business Entity
  sellerNameAndAddress: string;
  dunsNumber: string;
  manufacturingDunsNumber?: string;
  buyerNameAndAddress: string;
  clientName?: string; // Kept for consistency, can be same as buyer
  purchasingContact?: string;
  buyerCode?: string;
  accountManager?: string;

  // Logistics
  mailingAddressInformation?: string;
  manufacturingLocation: string;
  shippingTo: string;
  freightTerms?: string;
  deliveryTerms?: string;
  deliveryDuns?: string;
  shipFromDuns?: string;
  dailyCapacity?: string;
  hoursPerDay?: string;
  containerType?: string;
  receivingPlants?: string;

  // Pricing
  currency?: string; // from "All prices are expressed in"
  basePrice?: string;
  totalPrice?: string;
  unitOfMeasure?: string; // UOM
  paymentTerms?: string;

  // Metadata
  reasonForIssuing?: string;
  hazardousMaterialIndicator?: string;
  language?: string;
  originalLanguage?: string;
  
  // Compliance
  rawMaterialCertAnalysis?: string;
  rawMaterialAnnualCert?: string;
  
  // Page-wise breakdown
  pages?: PageExtraction[];
}


export interface Document {
  id: string;
  name:string;
  language: string;
  contractNo: string;
  processedBy: string;
  processedDate: string;
  data: ExtractedData; // The frontend will always work with the parsed data object.
  ExtractedDataJson?: string; // This reflects the raw JSON string from the DB.
  status?: 'processing' | 'completed' | 'error';
  errorMessage?: string;
  fileUrl?: string; // Blob URL to the original file (Session only)
}
