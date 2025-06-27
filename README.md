# 🛡️ Kavach - Privacy Protection Extension Landing Page

A modern landing page for the Kavach privacy protection browser extension, featuring real-time data breach monitoring powered by the XposedOrNot API.

## 🚀 Features

- **Real-time Data Breach Monitoring**: Check if email addresses have been compromised in known data breaches
- **AI-Powered Privacy Policy Analysis**: Summarize and analyze privacy policies
- **Data Trust Score**: Rate websites based on their privacy practices
- **Interactive Demo**: Live breach checking functionality
- **Modern Design**: Responsive and mobile-friendly interface
- **Privacy-First**: No tracking, secure data handling

## 🏗️ Architecture

- **Frontend**: Static HTML/CSS/JavaScript
- **Backend**: Node.js/Express proxy server
- **API Integration**: XposedOrNot API for breach data
- **Security**: Rate limiting, CORS protection, input validation

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Internet connection for API calls

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd kavach-landing
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your settings (if needed)
```

### 4. Start the Development Server
```bash
npm run dev
```

Or for production:
```bash
npm start
```

The server will start on `http://localhost:3001` by default.

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `NODE_ENV` | development | Environment mode |
| `XPOSEDORNOT_API_BASE_URL` | https://api.xposedornot.com/v1 | XposedOrNot API base URL |
| `ALLOWED_ORIGINS` | localhost URLs | CORS allowed origins (comma-separated) |
| `RATE_LIMIT_WINDOW_MS` | 900000 | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per window |

## 🛠️ API Endpoints

### Health Check
```
GET /api/health
```

### Breach Check (Email)
```
GET /api/check-email/:email
```

### Domain Check
```
GET /api/check-domain/:domain
```

### API Status
```
GET /api/status
```

## 🔒 Security Features

- **Rate Limiting**: Prevents API abuse with configurable limits
- **CORS Protection**: Restricts access to authorized origins
- **Input Validation**: Validates email formats and domain names
- **Security Headers**: Uses Helmet.js for security headers
- **Error Handling**: Graceful error handling with user-friendly messages

## 🚀 Quick Start

1. Install dependencies: `npm install`
2. Start the server: `npm start`
3. Open your browser to `http://localhost:3001`
4. Test the breach checking functionality

## 🧪 Testing

Test the API endpoints:
```bash
# Health check
curl http://localhost:3001/api/health

# Email breach check
curl http://localhost:3001/api/check-email/test@example.com
```

## 🐛 Troubleshooting

- **CORS Errors**: Add your frontend URL to `ALLOWED_ORIGINS` in `.env`
- **API Timeout**: Check internet connection and XposedOrNot API availability
- **Port Issues**: Change `PORT` in `.env` file or kill existing processes

## 📝 License

[MIT](https://choosealicense.com/licenses/mit/)
