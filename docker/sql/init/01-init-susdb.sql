-- Initialize SUSDB Database for WSUS
-- This script creates the SUSDB database structure that WSUS expects
-- Note: Full SUSDB schema is created by WSUS installation, but this provides a basic structure

USE master;
GO

-- Create SUSDB database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'SUSDB')
BEGIN
    CREATE DATABASE SUSDB
    ON (
        NAME = 'SUSDB',
        FILENAME = '/var/opt/mssql/data/SUSDB.mdf',
        SIZE = 500MB,
        MAXSIZE = UNLIMITED,
        FILEGROWTH = 100MB
    )
    LOG ON (
        NAME = 'SUSDB_Log',
        FILENAME = '/var/opt/mssql/data/SUSDB_Log.ldf',
        SIZE = 100MB,
        MAXSIZE = UNLIMITED,
        FILEGROWTH = 10MB
    );
    
    PRINT 'SUSDB database created successfully.';
END
ELSE
BEGIN
    PRINT 'SUSDB database already exists.';
END
GO

-- Set recovery model to SIMPLE (typical for WSUS)
ALTER DATABASE SUSDB SET RECOVERY SIMPLE;
GO

-- Set compatibility level (SQL Server 2022 = 160)
ALTER DATABASE SUSDB SET COMPATIBILITY_LEVEL = 160;
GO

-- Enable SQL Server authentication (if needed)
-- This is already enabled via MSSQL_SA_PASSWORD in docker-compose
GO

USE SUSDB;
GO

-- Create basic schema placeholder
-- Note: Full WSUS schema is created when WSUS server connects
-- This is just a placeholder to ensure database exists
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SchemaInfo]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SchemaInfo] (
        [SchemaVersion] [int] NOT NULL,
        [LastUpdated] [datetime] NOT NULL DEFAULT GETDATE()
    );
    
    INSERT INTO [dbo].[SchemaInfo] ([SchemaVersion], [LastUpdated])
    VALUES (1, GETDATE());
    
    PRINT 'SchemaInfo table created.';
END
GO

PRINT 'SUSDB initialization completed.';
PRINT 'Note: Full WSUS schema will be created when WSUS server connects to this database.';
GO
