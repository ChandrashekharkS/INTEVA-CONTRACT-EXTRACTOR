"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
// @non-local-fix: Import 'process' to provide correct types for process.cwd() and process.exit() and resolve TypeScript errors.
const process_1 = __importDefault(require("process"));
// --- Environment Variable Loading ---
// Smartly load .env file: check for .env.local first, then fall back to .env
const envPathLocal = path_1.default.resolve(process_1.default.cwd(), '.env.local');
const envPathDefault = path_1.default.resolve(process_1.default.cwd(), '.env');
const envPath = fs_1.default.existsSync(envPathLocal) ? envPathLocal : envPathDefault;
// Exit if no .env file is found
if (!fs_1.default.existsSync(envPath)) {
    console.error(`\nFATAL ERROR: Environment file not found.`);
    console.error(`Please create a .env or .env.local file in the /server directory with your MSSQL_CONNECTION_STRING.`);
    console.error(`Checked for: ${envPathLocal}`);
    console.error(`Checked for: ${envPathDefault}\n`);
    process_1.default.exit(1);
}
// Load the found environment file
dotenv_1.default.config({ path: envPath });
console.log(`Loading environment variables from: ${path_1.default.basename(envPath)}`);
const app = (0, express_1.default)();
const port = process_1.default.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
// FIX: Reverting to the standard path-less usage for express.json(). This resolves the TypeScript overload ambiguity without needing the previous path-based workaround which was causing deeper type compatibility errors.
app.use(express_1.default.json({ limit: '10mb' }));
// --- API Routes ---
// GET /api/contracts - Fetches all contracts
app.get('/api/contracts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pool = (0, db_1.getPool)();
        const result = yield pool.request().query('SELECT * FROM Contracts');
        // The data is stored as a JSON string, so we need to parse it back into an object
        const documents = result.recordset.map(record => ({
            id: record.Id,
            name: record.DocumentName,
            language: record.Language,
            contractNo: record.ContractNo,
            processedBy: record.ProcessedBy,
            processedDate: record.ProcessedDate,
            data: JSON.parse(record.ExtractedDataJson) // Parse the JSON string
        }));
        res.json(documents);
    }
    catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).send('Server Error while fetching contracts');
    }
}));
// POST /api/contracts - Saves a new contract
app.post('/api/contracts', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = req.body;
    try {
        const pool = (0, db_1.getPool)();
        yield pool.request()
            .input('Id', doc.id)
            .input('DocumentName', doc.name)
            .input('Language', doc.language)
            .input('ContractNo', doc.contractNo)
            .input('ProcessedBy', doc.processedBy)
            .input('ProcessedDate', new Date(doc.processedDate))
            .input('ExtractedDataJson', JSON.stringify(doc.data || {})) // Store data as a JSON string
            .query(`
                INSERT INTO Contracts (Id, DocumentName, Language, ContractNo, ProcessedBy, ProcessedDate, ExtractedDataJson)
                VALUES (@Id, @DocumentName, @Language, @ContractNo, @ProcessedBy, @ProcessedDate, @ExtractedDataJson)
            `);
        res.status(201).json(doc);
    }
    catch (error) {
        console.error('Error saving contract:', error);
        res.status(500).send('Server Error while saving contract');
    }
}));
// POST /api/contracts/batch - Saves or updates multiple contracts
app.post('/api/contracts/batch', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const docs = req.body;
    if (!Array.isArray(docs) || docs.length === 0) {
        return res.status(400).send('Request body must be a non-empty array of documents.');
    }
    const transaction = (0, db_1.getPool)().transaction();
    try {
        yield transaction.begin();
        for (const doc of docs) {
            // Using a MERGE statement for "upsert" functionality
            yield transaction.request()
                .input('Id', doc.id)
                .input('DocumentName', doc.name)
                .input('Language', doc.language)
                .input('ContractNo', doc.contractNo)
                .input('ProcessedBy', doc.processedBy)
                .input('ProcessedDate', new Date(doc.processedDate))
                .input('ExtractedDataJson', JSON.stringify(doc.data || {}))
                .query(`
                    MERGE Contracts AS target
                    USING (SELECT @Id AS Id) AS source
                    ON (target.Id = source.Id)
                    WHEN MATCHED THEN
                        UPDATE SET
                            DocumentName = @DocumentName,
                            Language = @Language,
                            ContractNo = @ContractNo,
                            ProcessedBy = @ProcessedBy,
                            ProcessedDate = @ProcessedDate,
                            ExtractedDataJson = @ExtractedDataJson
                    WHEN NOT MATCHED BY TARGET THEN
                        INSERT (Id, DocumentName, Language, ContractNo, ProcessedBy, ProcessedDate, ExtractedDataJson)
                        VALUES (@Id, @DocumentName, @Language, @ContractNo, @ProcessedBy, @ProcessedDate, @ExtractedDataJson);
                `);
        }
        yield transaction.commit();
        res.status(201).json({ message: `${docs.length} document(s) saved to the database successfully.` });
    }
    catch (error) {
        yield transaction.rollback();
        console.error('Error saving batch of contracts:', error);
        res.status(500).send('Server Error while saving the batch of contracts');
    }
}));
// DELETE /api/contracts/:id - Deletes a contract
app.delete('/api/contracts/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const pool = (0, db_1.getPool)();
        const result = yield pool.request().input('Id', id).query('DELETE FROM Contracts WHERE Id = @Id');
        if (result.rowsAffected[0] > 0) {
            res.status(200).send('Document deleted successfully');
        }
        else {
            res.status(404).send('Document not found');
        }
    }
    catch (error) {
        console.error('Error deleting contract:', error);
        res.status(500).send('Server Error while deleting contract');
    }
}));
// POST /api/comparisons - Saves a comparison report
app.post('/api/comparisons', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { comparisonId, comparisonDate, comparedDocumentIds, differences } = req.body;
    const transaction = (0, db_1.getPool)().transaction();
    try {
        yield transaction.begin();
        yield transaction.request()
            .input('ComparisonId', comparisonId)
            .input('ComparisonDate', new Date(comparisonDate))
            .input('DifferencesData', JSON.stringify(differences))
            .query(`
                INSERT INTO ContractComparisons (ComparisonId, ComparisonDate, DifferencesData)
                VALUES (@ComparisonId, @ComparisonDate, @DifferencesData)
            `);
        for (const contractId of comparedDocumentIds) {
            yield transaction.request()
                .input('ComparisonId', comparisonId)
                .input('ContractId', contractId)
                .query(`
                    INSERT INTO ContractComparisonItems (ComparisonId, ContractId)
                    VALUES (@ComparisonId, @ContractId)
                `);
        }
        yield transaction.commit();
        res.status(201).json({ message: `Comparison report ${comparisonId} saved successfully.` });
    }
    catch (error) {
        yield transaction.rollback();
        console.error('Error saving comparison:', error);
        res.status(500).send('Server Error while saving comparison');
    }
}));
// --- Static File Serving (for Production) ---
// Note: __dirname is server/dist/, so we go up two levels to the project root.
const clientBuildPath = path_1.default.resolve(__dirname, '../../dist');
if (fs_1.default.existsSync(clientBuildPath)) {
    console.log(`Serving static files from: ${clientBuildPath}`);
    // FIX: Using a path-less call for express.static is standard for serving from the root and helps avoid TypeScript overload resolution issues where the handler is misinterpreted as a path parameter.
    app.use(express_1.default.static(clientBuildPath));
    // For any request that doesn't match an API route or a static file,
    // serve the index.html file. This is for client-side routing.
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.resolve(clientBuildPath, 'index.html'));
    });
}
// --- Server Startup ---
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, db_1.connectDB)(); // Connect to the database first
    app.listen(port, () => {
        console.log(`Backend server is running on http://localhost:${port}`);
    });
});
startServer();
