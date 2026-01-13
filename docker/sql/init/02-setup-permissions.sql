-- Setup SQL Server permissions for WSUS
-- This script configures SQL Server authentication and permissions needed for WSUS

USE master;
GO

-- Create login for WSUS service account (if using SQL authentication)
-- For lab environment, using SA account is acceptable
-- For production, create dedicated WSUS service account

-- Ensure SA account is enabled (should be enabled by default)
ALTER LOGIN sa ENABLE;
GO

-- Grant necessary permissions to SA (should already have sysadmin)
-- This is redundant but ensures permissions are set
ALTER SERVER ROLE sysadmin ADD MEMBER sa;
GO

USE SUSDB;
GO

-- Grant db_owner to SA on SUSDB
-- WSUS requires db_owner role on SUSDB database
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'sa' AND type = 'S')
BEGIN
    CREATE USER sa FOR LOGIN sa;
END

ALTER ROLE db_owner ADD MEMBER sa;
GO

PRINT 'Permissions configured for WSUS database access.';
GO
