
// This ensures the backend and frontend agree on the data structure.
export interface PageExtraction {
  pageNumber: number;
  fields: Partial<ExtractedData>;
}

export interface ExtractedData {
  contractNumber: string;
  amendmentNumber: string;
  partNumber: string;
  partDescription: string;
  drawingNumber: string;
  lessFinishPartNumber?: string;
  programName?: string;
  issueDate: string;
  effectiveDate: string;
  sampleRequiredBy?: string;
  lbe?: string;
  sellerNameAndAddress: string;
  dunsNumber: string;
  manufacturingDunsNumber?: string;
  buyerNameAndAddress: string;
  clientName?: string;
  purchasingContact?: string;
  buyerCode?: string;
  accountManager?: string;
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
  currency?: string;
  basePrice?: string;
  totalPrice?: string;
  unitOfMeasure?: string;
  paymentTerms?: string;
  reasonForIssuing?: string;
  hazardousMaterialIndicator?: string;
  language?: string;
  rawMaterialCertAnalysis?: string;
  rawMaterialAnnualCert?: string;
  
  // Page-level breakdown
  pages?: PageExtraction[];
}

export interface Document {
  id: string;
  name:string;
  language: string;
  contractNo: string;
  processedBy: string;
  processedDate: string;
  data?: ExtractedData;
}
