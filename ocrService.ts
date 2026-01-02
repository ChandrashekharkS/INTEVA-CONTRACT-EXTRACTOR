
declare const pdfjsLib: any;
declare const mammoth: any;
declare const XLSX: any;
declare const Tesseract: any;

// Singleton Worker to prevent re-loading Tesseract core (~20MB) for every file
let tesseractWorkerPromise: Promise<any> | null = null;

const getTesseractWorker = async () => {
    if (!tesseractWorkerPromise) {
        tesseractWorkerPromise = (async () => {
            try {
                const worker = await Tesseract.createWorker('eng', 1, {
                    logger: () => {}, // Disable console logging for speed
                });
                await worker.setParameters({
                    tessedit_pageseg_mode: '1', 
                });
                return worker;
            } catch (e) {
                console.error("Failed to initialize Tesseract worker", e);
                tesseractWorkerPromise = null; // Reset promise to allow retry
                throw e;
            }
        })();
    }
    return tesseractWorkerPromise;
};

export const extractTextFromFile = async (file: File, onProgress: (progress: any) => void): Promise<{ fullText: string, pages: string[] }> => {
    const lowerName = file.name.toLowerCase();

    // 1. Digital Text Files (Instant)
    if (file.type === 'text/plain' || lowerName.endsWith('.txt') || lowerName.endsWith('.json') || lowerName.endsWith('.xml') || lowerName.endsWith('.csv')) {
        const text = await file.text();
        return { fullText: text, pages: [text] };
    }

    // 2. Excel (Fast)
    const isExcel = lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx');
    if (isExcel) {
        if (typeof XLSX === 'undefined') throw new Error('Excel parser not loaded.');
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            let fullText = '';
            const pages: string[] = [];
            workbook.SheetNames.forEach((sheetName: string) => {
                const sheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(sheet); 
                if (csv) {
                    fullText += `${csv} `;
                    pages.push(csv);
                }
            });
            return { fullText, pages };
        } catch (e) { return { fullText: "", pages: [] }; }
    }

    // 3. Word (Fast)
    const isDocx = lowerName.endsWith('.docx');
    if (isDocx) {
        if (typeof mammoth === 'undefined') throw new Error('Word parser not loaded.');
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            return { fullText: result.value, pages: [result.value] }; 
        } catch (e) { return { fullText: "", pages: [] }; }
    }

    // 4. PDF (Optimized for Speed)
    const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
    if (isPdf) {
        return handlePdfExtraction(file, onProgress);
    }
    
    // 5. Image (OCR)
    // Enhanced check for images to handle cases where mime-type might be missing or generic
    const isImage = file.type.startsWith('image/') || 
                    lowerName.endsWith('.png') || 
                    lowerName.endsWith('.jpg') || 
                    lowerName.endsWith('.jpeg') || 
                    lowerName.endsWith('.tiff') || 
                    lowerName.endsWith('.bmp') ||
                    lowerName.endsWith('.webp');

    if (isImage) {
        const text = await ocrImage(file, onProgress);
        return { fullText: text, pages: [text] };
    }

    return { fullText: "", pages: [] };
};

const handlePdfExtraction = async (file: File, onProgress: (progress: any) => void): Promise<{ fullText: string, pages: string[] }> => {
    const fileReader = new FileReader();

    return new Promise((resolve, reject) => {
        fileReader.onload = async (event) => {
            if (!event.target?.result) return reject(new Error('Failed to read PDF.'));

            try {
                const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                
                let fullText = '';
                const pages: string[] = [];
                const totalPages = pdf.numPages;
                
                // Process ALL pages for accuracy, but still optimized
                for (let i = 1; i <= totalPages; i++) {
                    onProgress({ status: `Reading text page ${i}/${totalPages}...` });
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    
                    let pageText = '';
                    if (textContent.items.length > 0) {
                        // Sort items: Top-down, then Left-to-Right
                        const items = textContent.items.map((item: any) => ({
                            str: item.str,
                            y: Math.round(item.transform[5]), 
                            x: Math.round(item.transform[4]),
                            width: item.width || 0
                        }));
                        
                        items.sort((a: any, b: any) => {
                            if (Math.abs(b.y - a.y) > 8) return b.y - a.y; 
                            return a.x - b.x;
                        });

                        let lastY = -999;
                        let lastX = -999;

                        items.forEach((item: any) => {
                            // New Line Detection
                            if (lastY !== -999 && Math.abs(item.y - lastY) > 8) {
                                pageText += '\n'; 
                                lastX = -999;
                            } 
                            // Column Detection (Reduced threshold to 12 for better density handling)
                            else if (lastX !== -999 && (item.x - lastX) > 12) {
                                pageText += '    '; // Insert 4 spaces to ensure regex \s{4,} catches it
                            }
                            else if (lastX !== -999) {
                                pageText += ' '; 
                            }
                            
                            pageText += item.str;
                            lastY = item.y;
                            lastX = item.x + item.width; // Update last X to end of current item
                        });
                    }
                    
                    if (pageText.trim()) {
                        pages.push(pageText);
                        fullText += pageText + '\n\n';
                    }
                }

                // If digital text found, return
                if (fullText.trim().length > 50) {
                    resolve({ fullText, pages });
                    return;
                }

                // Fallback to OCR for Scanned PDFs
                onProgress({ status: `Scanning PDF header (image mode)...` });
                const ocrText = await ocrPdfHeader(pdf, onProgress);
                resolve({ fullText: ocrText, pages: [ocrText] });

            } catch (error) {
                reject(error);
            }
        };
        fileReader.readAsArrayBuffer(file);
    });
};

const ocrImage = async (file: File, onProgress: (progress: any) => void): Promise<string> => {
    try {
        const worker = await getTesseractWorker();
        onProgress({ status: "OCR analyzing image (this might take a few seconds)..." });
        const { data: { text } } = await worker.recognize(file);
        return text;
    } catch (e) {
        console.error("OCR Error", e);
        tesseractWorkerPromise = null; // Reset promise to recover from worker crash
        return "";
    }
};

const ocrPdfHeader = async (pdf: any, onProgress: (progress: any) => void): Promise<string> => {
    let fullText = "";
    try {
        const worker = await getTesseractWorker();
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height * 0.6; 
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const imageBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.5)); 
        
        if (imageBlob) {
            const result = await worker.recognize(imageBlob);
            fullText += result.data.text + "\n";
        }
    } catch (e) {
        console.error("OCR Header Scan failed", e);
        tesseractWorkerPromise = null; // Reset promise
    }
    return fullText;
};
