-- Create the database if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'contract')
BEGIN
    CREATE DATABASE contract;
END
GO

USE contract;
GO

-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS ContractComparisonItems;
DROP TABLE IF EXISTS ContractComparisons;
DROP TABLE IF EXISTS Contracts;
DROP TABLE IF EXISTS Users;
GO

-- Users Table (currently unused by backend, but good for future expansion)
CREATE TABLE Users (
    Id VARCHAR(255) PRIMARY KEY,
    Name VARCHAR(255) NOT NULL,
    Email VARCHAR(255) UNIQUE NOT NULL,
    Role VARCHAR(50)
);
GO

-- Main table for storing contract metadata and extracted data as a JSON string
CREATE TABLE Contracts (
    Id VARCHAR(255) PRIMARY KEY,
    DocumentName NVARCHAR(255) NOT NULL,
    Language VARCHAR(100),
    ContractNo VARCHAR(255),
    ProcessedBy VARCHAR(255),
    ProcessedDate DATE,
    -- Storing the full extracted data object as a JSON string
    ExtractedDataJson NVARCHAR(MAX)
);
GO

-- Table for storing comparison metadata
CREATE TABLE ContractComparisons (
    ComparisonId VARCHAR(255) PRIMARY KEY,
    ComparisonDate DATETIME NOT NULL,
    ComparedByUserId VARCHAR(255), -- For future use
    -- Stores the differing fields as a JSON string for flexibility
    DifferencesData NVARCHAR(MAX), 
    FOREIGN KEY (ComparedByUserId) REFERENCES Users(Id)
);
GO

-- Linking table to associate multiple contracts with a single comparison
CREATE TABLE ContractComparisonItems (
    ComparisonId VARCHAR(255),
    ContractId VARCHAR(255),
    PRIMARY KEY (ComparisonId, ContractId),
    FOREIGN KEY (ComparisonId) REFERENCES ContractComparisons(ComparisonId) ON DELETE CASCADE,
    FOREIGN KEY (ContractId) REFERENCES Contracts(Id) ON DELETE CASCADE
);
GO

-- Insert initial user data
INSERT INTO Users (Id, Name, Email, Role) VALUES
('user1', 'Admin', 'admin@domain.com', 'Admin'),
('user2', 'Alice (Editor)', 'alice@domain.com', 'Editor'),
('user3', 'Bob (Viewer)', 'bob@domain.com', 'Viewer');
GO

PRINT 'Database schema created successfully.';
GO