@echo off
echo.
echo 🔑 ReturnsX Security Key Generator
echo =================================
echo.

echo 🔐 Generating secure encryption keys...
echo.

REM Check if PowerShell is available
powershell -Command "& {Write-Host 'PowerShell detected' -ForegroundColor Green}" >nul 2>&1
if errorlevel 1 (
    echo ❌ PowerShell not available. Please use manual method.
    echo.
    echo 📝 Manual Key Generation:
    echo 1. Go to https://www.random.org/strings/
    echo 2. Generate 3 strings: 64 characters, hex digits (0-9, a-f)
    echo 3. Use them as RETURNSX_ENCRYPTION_KEY, RETURNSX_HASH_SALT, SESSION_SECRET
    pause
    exit /b 1
)

echo ✅ Generating keys with PowerShell...
echo.

REM Generate keys using PowerShell
powershell -Command "& { $key1 = -join ((1..64) | ForEach {'{0:X}' -f (Get-Random -Max 16)}); $key2 = -join ((1..64) | ForEach {'{0:X}' -f (Get-Random -Max 16)}); $key3 = -join ((1..64) | ForEach {'{0:X}' -f (Get-Random -Max 16)}); Write-Host '📋 Copy these environment variables:' -ForegroundColor Cyan; Write-Host ''; Write-Host 'RETURNSX_ENCRYPTION_KEY=\"'$key1'\"' -ForegroundColor Yellow; Write-Host 'RETURNSX_HASH_SALT=\"'$key2'\"' -ForegroundColor Yellow; Write-Host 'SESSION_SECRET=\"'$key3'\"' -ForegroundColor Yellow; Write-Host 'SESSION_SECURE=\"true\"' -ForegroundColor Yellow; Write-Host 'NODE_ENV=\"production\"' -ForegroundColor Yellow; Write-Host 'DATABASE_SSL_MODE=\"require\"' -ForegroundColor Yellow; Write-Host ''; $content = '# ReturnsX Security Environment Variables' + \"`n\" + '# Generated on ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + \"`n`n\" + 'RETURNSX_ENCRYPTION_KEY=\"' + $key1 + '\"' + \"`n\" + 'RETURNSX_HASH_SALT=\"' + $key2 + '\"' + \"`n\" + 'SESSION_SECRET=\"' + $key3 + '\"' + \"`n\" + 'SESSION_SECURE=\"true\"' + \"`n\" + 'NODE_ENV=\"production\"' + \"`n\" + 'DATABASE_SSL_MODE=\"require\"' + \"`n`n\" + '# Your existing variables' + \"`n\" + '# DATABASE_URL=\"your-existing-database-url\"' + \"`n\" + '# SHOPIFY_API_KEY=\"your-existing-shopify-key\"' + \"`n\" + '# SHOPIFY_API_SECRET=\"your-existing-shopify-secret\"'; $content | Out-File -FilePath '.env.generated' -Encoding UTF8; Write-Host '💾 Keys saved to .env.generated file' -ForegroundColor Green; }"

echo.
echo ⚠️  IMPORTANT SECURITY NOTES:
echo 1. These keys are cryptographically secure and unique
echo 2. Copy them to your production environment variables
echo 3. Never commit these keys to version control
echo 4. Keep them secure and backed up
echo.
echo 🚀 Next Steps:
echo 1. Copy the environment variables above to your deployment platform
echo 2. Deploy your application using: npm run build, then your deploy command
echo 3. Verify deployment at https://your-app-url.com/api/health/security
echo.
echo ✅ Key generation completed!
echo.
pause
