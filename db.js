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
exports.getPool = exports.connectDB = void 0;
const mssql_1 = __importDefault(require("mssql"));
// @non-local-fix: Import 'process' to provide correct types for process.exit() and resolve TypeScript errors.
const process_1 = __importDefault(require("process"));
// Environment variables are now loaded centrally in the main index.ts file.
const connectionString = process_1.default.env.MSSQL_CONNECTION_STRING;
// The server will exit on startup if the env file is missing,
// but this check remains as a final safeguard before connecting.
if (!connectionString) {
    console.error("\nFATAL ERROR: The 'MSSQL_CONNECTION_STRING' environment variable was not found.");
    console.error("Please ensure your .env or .env.local file in the /server directory contains a line like this:");
    console.error('MSSQL_CONNECTION_STRING="Server=your_server;Database=your_db;User Id=your_user;Password=your_pass;"\n');
    process_1.default.exit(1);
}
let pool;
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        pool = yield mssql_1.default.connect(connectionString);
        console.log("Database connection successful.");
    }
    catch (err) {
        console.error("Database connection failed:", err);
        // Exit process with failure if we can't connect
        process_1.default.exit(1);
    }
});
exports.connectDB = connectDB;
const getPool = () => {
    if (!pool) {
        throw new Error("Database is not connected. The application must call connectDB() before using the pool.");
    }
    return pool;
};
exports.getPool = getPool;
