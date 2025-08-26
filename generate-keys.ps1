# ReturnsX Security Key Generator
# PowerShell script to generate cryptographically secure keys

Write-Host "🔑 ReturnsX Security Key Generator" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Function to generate secure random string
function Generate-SecureKey {
    param([int]$Length = 32)
    
    # Use .NET RNGCryptoServiceProvider for cryptographically secure random
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    $rng.Dispose()
    
    # Convert to hex string
    return [System.BitConverter]::ToString($bytes) -replace '-', ''
}

try {
    Write-Host "`n🔐 Generating secure encryption keys..." -ForegroundColor Yellow
    
    # Generate the three required keys
    $encryptionKey = Generate-SecureKey -Length 32
    $hashSalt = Generate-SecureKey -Length 32  
    $sessionSecret = Generate-SecureKey -Length 32
    
    Write-Host "`n✅ Secure keys generated successfully!" -ForegroundColor Green
    Write-Host "`n📋 Copy these environment variables to your production environment:" -ForegroundColor Cyan
    
    # Output the environment variables
    Write-Host "`nRETURNSX_ENCRYPTION_KEY=`"$encryptionKey`"" -ForegroundColor Yellow
    Write-Host "RETURNSX_HASH_SALT=`"$hashSalt`"" -ForegroundColor Yellow
    Write-Host "SESSION_SECRET=`"$sessionSecret`"" -ForegroundColor Yellow
    Write-Host "SESSION_SECURE=`"true`"" -ForegroundColor Yellow
    Write-Host "NODE_ENV=`"production`"" -ForegroundColor Yellow
    Write-Host "DATABASE_SSL_MODE=`"require`"" -ForegroundColor Yellow
    
    # Save to file
    $envContent = @"
# ReturnsX Security Environment Variables
# Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

RETURNSX_ENCRYPTION_KEY="$encryptionKey"
RETURNSX_HASH_SALT="$hashSalt"
SESSION_SECRET="$sessionSecret"
SESSION_SECURE="true"
NODE_ENV="production"
DATABASE_SSL_MODE="require"

# Optional: WhatsApp Integration
# TWILIO_ACCOUNT_SID="your_twilio_sid"
# TWILIO_AUTH_TOKEN="your_twilio_token"
# WHATSAPP_WEBHOOK_SECRET="your_webhook_secret"

# Optional: Rate Limiting
# RATE_LIMIT_REDIS_URL="redis://your-redis-instance:6379"
"@

    $envContent | Out-File -FilePath ".env.generated" -Encoding UTF8
    
    Write-Host "`n💾 Keys saved to .env.generated file" -ForegroundColor Green
    
    Write-Host "`n⚠️  IMPORTANT SECURITY NOTES:" -ForegroundColor Red
    Write-Host "1. These keys are cryptographically secure and unique" -ForegroundColor White
    Write-Host "2. Copy them to your production environment variables" -ForegroundColor White
    Write-Host "3. Never commit these keys to version control" -ForegroundColor White
    Write-Host "4. Keep them secure and backed up" -ForegroundColor White
    Write-Host "5. Each key is 64 characters with 256-bit security" -ForegroundColor White
    
    Write-Host "`n🚀 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Copy the environment variables above to your deployment platform" -ForegroundColor White
    Write-Host "2. Deploy your application using your normal deployment process" -ForegroundColor White
    Write-Host "3. Verify deployment at https://your-app-url.com/api/health/security" -ForegroundColor White
    
    Write-Host "`n✅ Key generation completed successfully!" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ Error generating keys: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please run this script as Administrator or use the manual method below." -ForegroundColor Yellow
    
    Write-Host "`n📝 Manual Key Generation:" -ForegroundColor Cyan
    Write-Host "If this script fails, you can generate keys manually:" -ForegroundColor White
    Write-Host "1. Go to https://www.random.org/strings/" -ForegroundColor White
    Write-Host "2. Generate 3 strings: 64 characters, hex digits (0-9, a-f)" -ForegroundColor White
    Write-Host "3. Use them as RETURNSX_ENCRYPTION_KEY, RETURNSX_HASH_SALT, SESSION_SECRET" -ForegroundColor White
}
