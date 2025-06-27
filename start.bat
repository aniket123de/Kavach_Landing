@echo off
echo.
echo =====================================
echo    🛡️  KAVACH BACKEND SETUP
echo =====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js is installed
echo.

REM Check if package.json exists
if not exist "package.json" (
    echo ❌ package.json not found
    echo Please make sure you're in the correct directory
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
    echo.
)

REM Check if .env file exists, if not copy from .env.example
if not exist ".env" (
    if exist ".env.example" (
        echo 📋 Creating .env file from .env.example...
        copy ".env.example" ".env" >nul
        echo ✅ .env file created
    ) else (
        echo ⚠️  .env file not found, using default settings
    )
    echo.
)

echo 🚀 Starting Kavach Backend Server...
echo.
echo The server will be available at: http://localhost:3001
echo Press Ctrl+C to stop the server
echo.

REM Start the server
call npm start

pause