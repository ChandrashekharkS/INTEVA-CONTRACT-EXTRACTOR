
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import process from 'process';

//  Resolve .env paths relative to server folder
const envPathLocal = path.resolve(__dirname, '../.env.local'); // one level up from src
const envPathDefault = path.resolve(__dirname, '../.env');
const envPath = fs.existsSync(envPathLocal) ? envPathLocal : envPathDefault;

if (!fs.existsSync(envPath)) {
  console.error(`\nFATAL ERROR: Environment file not found.`);
  console.error(`Please create a .env or .env.local file in the /server directory with your MSSQL_CONNECTION_STRING.`);
  console.error(`Checked for: ${envPathLocal}`);
  console.error(`Checked for: ${envPathDefault}\n`);
  process.exit(1);
}

dotenv.config({ path: envPath });
console.log(` Loading environment variables from: ${path.basename(envPath)}`);
console.log(' MSSQL_CONNECTION_STRING found?', Boolean(process.env.MSSQL_CONNECTION_STRING));

//  Import after env is loaded
import express from 'express';
import cors from 'cors';
import { connectDB, getPool } from './db';
import type { Document } from './types';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use('/', express.json({ limit: '10mb' }));

// --- Your routes remain unchanged ---
app.get('/api/contracts', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT * FROM Contracts');
    const documents = result.recordset.map(record => ({
      id: record.Id,
      name: record.DocumentName,
      language: record.Language,
      contractNo: record.ContractNo,
      processedBy: record.ProcessedBy,
      processedDate: record.ProcessedDate,
      data: JSON.parse(record.ExtractedDataJson)
    }));
    res.json(documents);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).send('Server Error while fetching contracts');
  }
});

// POST /api/contracts - Saves a new contract
app.post('/api/contracts', async (req, res) => {
    const doc: Document = req.body;
    try {
        const pool = getPool();
        await pool.request()
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
    } catch (error) {
        console.error('Error saving contract:', error);
        res.status(500).send('Server Error while saving contract');
    }
});

// POST /api/contracts/batch - Saves or updates multiple contracts
app.post('/api/contracts/batch', async (req, res) => {
    const docs: Document[] = req.body;
    if (!Array.isArray(docs) || docs.length === 0) {
        return res.status(400).send('Request body must be a non-empty array of documents.');
    }

    const transaction = getPool().transaction();
    try {
        await transaction.begin();
        
        for (const doc of docs) {
            // Using a MERGE statement for "upsert" functionality
            await transaction.request()
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

        await transaction.commit();
        res.status(201).json({ message: `${docs.length} document(s) saved to the database successfully.` });

    } catch (error) {
        await transaction.rollback();
        console.error('Error saving batch of contracts:', error);
        res.status(500).send('Server Error while saving the batch of contracts');
    }
});

// DELETE /api/contracts/:id - Deletes a contract
app.delete('/api/contracts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = getPool();
        const result = await pool.request().input('Id', id).query('DELETE FROM Contracts WHERE Id = @Id');
        
        if (result.rowsAffected[0] > 0) {
            res.status(200).send('Document deleted successfully');
        } else {
            res.status(404).send('Document not found');
        }
    } catch (error) {
        console.error('Error deleting contract:', error);
        res.status(500).send('Server Error while deleting contract');
    }
});

// POST /api/comparisons - Saves a comparison report

app.post('/api/comparisons', async (req, res) => {
  const { comparisonId, comparisonDate, comparedDocumentIds, differences } = req.body;
  console.log('Incoming comparison payload:', req.body);

  const transaction = getPool().transaction();
  try {
    await transaction.begin();
    console.log('Transaction started.');

    await transaction.request()
      .input('ComparisonId', comparisonId)
      .input('ComparisonDate', new Date(comparisonDate))
      .input('DifferencesData', JSON.stringify(differences))
      .query(`
        INSERT INTO ContractComparisons (ComparisonId, ComparisonDate, DifferencesData)
        VALUES (@ComparisonId, @ComparisonDate, @DifferencesData)
      `);
    console.log('Inserted into ContractComparisons.');

    for (const contractId of comparedDocumentIds || []) {
      console.log('Inserting ContractComparisonItem for contractId:', contractId);
      await transaction.request()
        .input('ComparisonId', comparisonId)
        .input('ContractId', contractId)
        .query(`
          INSERT INTO ContractComparisonItems (ComparisonId, ContractId)
          VALUES (@ComparisonId, @ContractId)
        `);
    }

    await transaction.commit();
    console.log('Transaction committed.');
    res.status(201).json({ message: `Comparison report ${comparisonId} saved successfully.` });
  } catch (error) {
    await transaction.rollback();
    console.error('Error saving comparison:', error);
    res.status(500).send(`Failed to save comparison to database: {error.message}`);
  }
});

// --- Static File Serving (for Production) ---
// Note: __dirname is server/dist/, so we go up two levels to the project root.
const clientBuildPath = path.resolve(__dirname, '../../dist');
if (fs.existsSync(clientBuildPath)) {
    console.log(`Serving static files from: ${clientBuildPath}`);
    // Fix: Explicitly providing the '/' path to resolve a TypeScript overload ambiguity where the middleware was being misinterpreted as a path parameter.
    app.use('/', express.static(clientBuildPath));

    // For any request that doesn't match an API route or a static file,
    // serve the index.html file. This is for client-side routing.
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(clientBuildPath, 'index.html'));
    });
}

// Start server after DB connects
const startServer = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
  });
};

startServer();

