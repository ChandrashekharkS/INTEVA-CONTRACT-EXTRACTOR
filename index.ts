
import fs from 'fs';
import path from 'path';
import * as http from 'http';
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

// Middleware
app.use(cors() as any);
app.use(express.json({ limit: '10mb' }) as any);

 
// --- Ollama Proxy Middleware ---
// Replaced 'fetch' with native 'http.request' to avoid UND_ERR_HEADERS_TIMEOUT errors
// and provide better control over socket timeouts for long-running AI tasks.
app.use('/api/ollama', (req, res) => {
    try {
        // Explicitly use 127.0.0.1 to avoid Node preferring IPv6 ::1 which Ollama might not listen on
        const ollamaBase = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
        let targetUrl: URL;
        try {
            targetUrl = new URL(ollamaBase);
        } catch (e) {
            console.error('Invalid OLLAMA_HOST:', ollamaBase);
            res.status(500).json({ message: 'Invalid server configuration for OLLAMA_HOST' });
            return;
        }

        const proxyPath = req.url || '/'; // Ensure path is never empty
        console.log(`Proxying ${req.method} ${proxyPath} -> ${ollamaBase}${proxyPath}`);

        // Prepare headers: Remove headers that interfere with the proxy request
        const headers = { ...req.headers };
        delete headers['content-length'];
        delete headers['connection'];
        delete headers['host']; // We will set this explicitly to the target host

        const options: http.RequestOptions = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || 80,
            path: proxyPath, // Forwards /api/generate or /api/tags etc.
            method: req.method,
            headers: {
                ...headers,
                // Override Host to match target
                host: targetUrl.host, 
            },
            timeout: 600000, // 10 Minutes Socket Timeout
        };

        const proxyReq = http.request(options, (proxyRes) => {
            console.log(`Proxy response status: ${proxyRes.statusCode}`);
            // Forward status code and headers
            // Explicitly cast headers to any to avoid TypeScript Incoming/Outgoing mismatch
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers as any);
            // Pipe the response stream directly to the client
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (e) => {
            console.error('Ollama Proxy Connection Error:', e);
            if (!res.headersSent) {
                // Return 502 Bad Gateway if we can't reach Ollama
                res.status(502).json({ 
                    success: false, 
                    message: `Failed to connect to Ollama at ${ollamaBase}. Error: ${(e as any).code || e.message}. Is Ollama running?` 
                });
            }
        });

        proxyReq.on('timeout', () => {
            console.error('Ollama Proxy Timeout');
            proxyReq.destroy();
            if (!res.headersSent) {
                res.status(504).json({ success: false, message: 'Ollama request timed out on the server.' });
            }
        });

        // Write body if it exists (e.g. POST requests)
        // Check content-length header or body presence
        if (req.body && Object.keys(req.body).length > 0) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.write(bodyData);
        }
        
        proxyReq.end();

    } catch (err) {
        console.error('Ollama Proxy Middleware Critical Error:', err);
        if (!res.headersSent) {
             res.status(500).json({ success: false, message: `Internal Proxy Error: ${(err as any).message}` });
        }
    }
});



// Helper to parse contracts from DB records
const parseContracts = (recordset: any[]) => {
    return recordset.map(record => {
        let data = {};
        try {
            const parsed = JSON.parse(record.ExtractedDataJson);
            if (parsed && typeof parsed === 'object') {
                data = parsed;
            }
        } catch (e) {
            console.error('Failed to parse JSON for doc:', record.Id);
        }
        // Explicitly map DocumentName and ContractNo from the database columns
        return {
            id: record.Id,
            name: record.DocumentName || 'Untitled Document', 
            language: record.Language || 'Unknown',
            contractNo: record.ContractNo || 'N/A', // Fetched as a distinct field
            processedBy: record.ProcessedBy || 'System',
            processedDate: record.ProcessedDate,
            data: data
        };
    });
};

// --- Initialization Logic ---
const initDatabaseTables = async () => {
    try {
        const pool = getPool();
        
        // 1. Create Users Table if not exists
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
            CREATE TABLE Users (
                Id NVARCHAR(50) PRIMARY KEY,
                Name NVARCHAR(100),
                Email NVARCHAR(100) UNIQUE,
                Password NVARCHAR(100),
                Role NVARCHAR(50),
                Permissions NVARCHAR(100),
                AssignedCompany NVARCHAR(255)
            )
        `);

        // 2. Create Contracts Table if not exists
        // Ensures Schema has DocumentName and ContractNo as separate fields
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Contracts' AND xtype='U')
            CREATE TABLE Contracts (
                Id NVARCHAR(50) PRIMARY KEY,
                DocumentName NVARCHAR(255),
                Language NVARCHAR(50),
                ContractNo NVARCHAR(100),
                ProcessedBy NVARCHAR(100),
                ProcessedDate DATETIME,
                ExtractedDataJson NVARCHAR(MAX)
            )
        `);

        // 3. Create Comparisons Tables
        await pool.request().query(`
             IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ContractComparisons' AND xtype='U')
             CREATE TABLE ContractComparisons (
                 ComparisonId NVARCHAR(50) PRIMARY KEY,
                 ComparisonDate DATETIME,
                 DifferencesData NVARCHAR(MAX)
             )
        `);

        await pool.request().query(`
             IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ContractComparisonItems' AND xtype='U')
             CREATE TABLE ContractComparisonItems (
                 ComparisonId NVARCHAR(50),
                 ContractId NVARCHAR(50)
             )
        `);

        // 4. Check if Admin exists, if not create it (Safer seeding)
        const result = await pool.request().query("SELECT COUNT(*) as count FROM Users WHERE Email = 'admin@domain.com'");
        if (result.recordset[0].count === 0) {
            await pool.request().query(`
                INSERT INTO Users (Id, Name, Email, Password, Role, Permissions)
                VALUES ('user-admin', 'Admin', 'admin@domain.com', 'Admin', 'Admin', 'All Access')
            `);
            console.log("Default Admin user created.");
        }
    } catch (err) {
        console.error("Error initializing database tables:", err);
    }
};

// --- API Routes ---

// Login Endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`Login attempt for: ${email}`);
    
    try {
        const pool = getPool();
        const result = await pool.request()
            .input('Email', email)
            .input('Password', password)
            .query('SELECT * FROM Users WHERE Email = @Email AND Password = @Password');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            // Don't send password back
            const { Password, ...userWithoutPassword } = user;
            res.json({ success: true, user: {
                id: user.Id,
                name: user.Name,
                email: user.Email,
                role: user.Role,
                permissions: user.Permissions,
                assignedCompany: user.AssignedCompany
            }});
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during login' });
    }
});

// GET /api/users
app.get('/api/users', async (req, res) => {
    try {
        const pool = getPool();
        const result = await pool.request().query('SELECT Id, Name, Email, Role, Permissions, AssignedCompany FROM Users');
        const users = result.recordset.map(u => ({
            id: u.Id,
            name: u.Name,
            email: u.Email,
            role: u.Role,
            permissions: u.Permissions,
            assignedCompany: u.AssignedCompany
        }));
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Server Error');
    }
});

// POST /api/users (Add User)
app.post('/api/users', async (req, res) => {
    const { name, email, role, password, assignedCompany } = req.body;
    try {
        const pool = getPool();
        const id = `user-${Date.now()}`;
        const permissions = role === 'Admin' ? 'All Access' : role === 'Editor' ? '3 contracts' : '1 contract';
        
        await pool.request()
            .input('Id', id)
            .input('Name', name)
            .input('Email', email)
            .input('Password', password || '123456') // Default password if missing
            .input('Role', role)
            .input('Permissions', permissions)
            .input('AssignedCompany', assignedCompany || null)
            .query(`
                INSERT INTO Users (Id, Name, Email, Password, Role, Permissions, AssignedCompany)
                VALUES (@Id, @Name, @Email, @Password, @Role, @Permissions, @AssignedCompany)
            `);
        
        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Server Error');
    }
});

// PUT /api/users/:id (Update User)
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { role, assignedCompany } = req.body;
    try {
        const pool = getPool();
        await pool.request()
            .input('Id', id)
            .input('Role', role)
            .input('AssignedCompany', assignedCompany)
            .query(`UPDATE Users SET Role = @Role, AssignedCompany = @AssignedCompany WHERE Id = @Id`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).send('Server Error');
    }
});


// GET /api/companies - Fetches distinct company names
app.get('/api/companies', async (req, res) => {
    try {
        const pool = getPool();
        // Robust query: checks if JSON is valid and filters out nulls/empty strings
        const result = await pool.request().query(`
            SELECT DISTINCT JSON_VALUE(ExtractedDataJson, '$.clientName') AS ClientName 
            FROM Contracts 
            WHERE ISJSON(ExtractedDataJson) > 0
              AND JSON_VALUE(ExtractedDataJson, '$.clientName') IS NOT NULL 
              AND JSON_VALUE(ExtractedDataJson, '$.clientName') <> 'N/A'
              AND LEN(JSON_VALUE(ExtractedDataJson, '$.clientName')) > 0
            ORDER BY ClientName ASC
        `);
        
        const companies = result.recordset.map(r => r.ClientName);
        res.json(companies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).send('Server Error while fetching companies');
    }
});

// GET /api/contracts - Fetches contracts, optionally filtered by company, months, or days
app.get('/api/contracts', async (req, res) => {
    try {
        const pool = getPool();
        const company = req.query.company as string;
        const months = req.query.months ? parseInt(req.query.months as string) : null;
        const days = req.query.days ? parseInt(req.query.days as string) : null;
        
        let query = 'SELECT * FROM Contracts';
        const conditions: string[] = [];
        const request = pool.request();

        // 1. Filter by Company
        if (company) {
            conditions.push("JSON_VALUE(ExtractedDataJson, '$.clientName') = @Company");
            request.input('Company', company);
        }

        // 2. Filter by Time (Months)
        if (months) {
            conditions.push("ProcessedDate >= DATEADD(month, -@Months, GETDATE())");
            request.input('Months', months);
        }

        // 3. Filter by Time (Days)
        if (days) {
            conditions.push("ProcessedDate >= DATEADD(day, -@Days, GETDATE())");
            request.input('Days', days);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY ProcessedDate DESC';

        const result = await request.query(query);

        const documents = parseContracts(result.recordset);
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
            .input('DocumentName', doc.name) // Save file Name
            .input('Language', doc.language)
            .input('ContractNo', doc.contractNo) // Save Contract Number explicitly
            .input('ProcessedBy', doc.processedBy)
            .input('ProcessedDate', new Date(doc.processedDate))
            .input('ExtractedDataJson', JSON.stringify(doc.data || {}))
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
            await transaction.request()
                .input('Id', doc.id)
                .input('DocumentName', doc.name) // Explicitly map Name
                .input('Language', doc.language)
                .input('ContractNo', doc.contractNo) // Explicitly map ContractNo
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

// POST /api/comparisons
app.post('/api/comparisons', async (req, res) => {
    const { comparisonId, comparisonDate, comparedDocumentIds, differences } = req.body;
    const transaction = getPool().transaction();
    try {
        await transaction.begin();
        
        await transaction.request()
            .input('ComparisonId', comparisonId)
            .input('ComparisonDate', new Date(comparisonDate))
            .input('DifferencesData', JSON.stringify(differences))
            .query(`
                INSERT INTO ContractComparisons (ComparisonId, ComparisonDate, DifferencesData)
                VALUES (@ComparisonId, @ComparisonDate, @DifferencesData)
            `);
            
        for (const contractId of comparedDocumentIds) {
            await transaction.request()
                .input('ComparisonId', comparisonId)
                .input('ContractId', contractId)
                .query(`
                    INSERT INTO ContractComparisonItems (ComparisonId, ContractId)
                    VALUES (@ComparisonId, @ContractId)
                `);
        }

        await transaction.commit();
        res.status(201).json({ message: `Comparison report ${comparisonId} saved successfully.` });

    } catch (error) {
        await transaction.rollback();
        console.error('Error saving comparison:', error);
        res.status(500).send('Server Error while saving comparison');
    }
});

// --- Static File Serving ---
const clientBuildPath = path.resolve((process as any).cwd(), '../dist');
if (fs.existsSync(clientBuildPath)) {
    console.log(`Serving static files from: ${clientBuildPath}`);
    app.use(express.static(clientBuildPath) as any);
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(clientBuildPath, 'index.html'));
    });
}

const startServer = async () => {
    await connectDB();
    await initDatabaseTables(); // Initialize all tables (Users, Contracts, Comparisons)
    
      const server = app.listen(Number(port), '0.0.0.0', () => {
        console.log(`Backend server is running on http://0.0.0.0:${port}`);
    });
};

startServer();
