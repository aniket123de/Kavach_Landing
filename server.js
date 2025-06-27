const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting configuration
const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'breach_check',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Number of requests
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900, // Per 15 minutes (900 seconds)
});

// Security middleware
if (process.env.ENABLE_HELMET === 'true') {
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false // Disable CSP for development
  }));
}

// Trust proxy if specified
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// CORS configuration - More permissive for development
const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : 
  [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      // Allow localhost and 127.0.0.1 on any port
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow all origins in development for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to get client IP
function getClientIP(req) {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         'unknown';
}

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    const clientIP = getClientIP(req);
    await rateLimiter.consume(clientIP);
    next();
  } catch (rejRes) {
    const totalHits = rejRes.totalHits;
    const remainingPoints = rejRes.remainingPoints;
    const msBeforeNext = rejRes.msBeforeNext;
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.round(msBeforeNext / 1000),
      details: {
        totalRequests: totalHits,
        remainingRequests: remainingPoints,
        resetTime: new Date(Date.now() + msBeforeNext).toISOString()
      }
    });
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    corsOrigin: req.headers.origin || 'no-origin'
  });
});

// Test endpoint for quick verification
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });
});

// Breach check endpoint
app.get('/api/check-email/:email', rateLimitMiddleware, async (req, res) => {
  try {
    const email = req.params.email;
    
    // Validate email format
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid Email',
        message: 'Please provide a valid email address'
      });
    }

    console.log(`Checking breaches for email: ${email}`);

    // Make request to XposedOrNot API
    const apiUrl = `${process.env.XPOSEDORNOT_API_BASE_URL}/check-email/${encodeURIComponent(email)}`;
    console.log(`Making request to: ${apiUrl}`);
    
    const response = await axios.get(apiUrl, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Kavach-Privacy-Extension/1.0',
        'Accept': 'application/json'
      },
      validateStatus: function (status) {
        // Accept 200-299 and 404 (not found is valid response)
        return (status >= 200 && status < 300) || status === 404;
      }
    });

    // Log the response for debugging
    console.log(`API Response Status: ${response.status}`);
    console.log(`API Response Data:`, JSON.stringify(response.data, null, 2));
    
    // Return the response from XposedOrNot API
    res.json(response.data);

  } catch (error) {
    console.error('Error checking breaches:', error.message);
    
    if (error.response) {
      // API responded with error status
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      
      if (status === 404) {
        // Email not found in breaches (this is actually good news)
        return res.json({
          Error: "Not found",
          message: "Email not found in any known breaches"
        });
      }
      
      return res.status(status).json({
        error: 'API Error',
        message: message,
        status: status
      });
    } else if (error.code === 'ECONNABORTED') {
      // Request timeout
      return res.status(408).json({
        error: 'Request Timeout',
        message: 'The request to check breaches timed out. Please try again.'
      });
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      // Network error
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Unable to connect to breach checking service. Please try again later.'
      });
    } else {
      // Other errors
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while checking breaches.'
      });
    }
  }
});

// Domain breach check endpoint
app.get('/api/check-domain/:domain', rateLimitMiddleware, async (req, res) => {
  try {
    const domain = req.params.domain;
    
    // Basic domain validation
    if (!domain || domain.length < 3) {
      return res.status(400).json({
        error: 'Invalid Domain',
        message: 'Please provide a valid domain name'
      });
    }

    console.log(`Checking domain breaches for: ${domain}`);

    // Make request to XposedOrNot API for domain check
    const apiUrl = `${process.env.XPOSEDORNOT_API_BASE_URL}/domain/${encodeURIComponent(domain)}`;
    
    const response = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Kavach-Privacy-Extension/1.0',
        'Accept': 'application/json'
      }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error checking domain breaches:', error.message);
    
    if (error.response?.status === 404) {
      return res.json({
        Error: "Not found",
        message: "Domain not found in any known breaches"
      });
    }
    
    // Handle other errors similar to email check
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while checking domain breaches.'
    });
  }
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    service: 'Kavach Backend Proxy',
    version: '1.0.0',
    apiEndpoint: process.env.XPOSEDORNOT_API_BASE_URL,
    timestamp: new Date().toISOString(),
    endpoints: {
      emailCheck: '/api/check-email/:email',
      domainCheck: '/api/check-domain/:domain',
      health: '/api/health',
      status: '/api/status'
    }
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the test page
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-backend.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/status',
      'GET /api/check-email/:email',
      'GET /api/check-domain/:domain'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🛡️  KAVACH BACKEND PROXY                   ║
╠══════════════════════════════════════════════════════════════╣
║  Server Status: ONLINE                                       ║
║  Port: ${PORT}                                                    ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                    ║
║  API Endpoint: ${process.env.XPOSEDORNOT_API_BASE_URL}      ║
║                                                              ║
║  Available Endpoints:                                        ║
║  • GET  /api/health                                          ║
║  • GET  /api/status                                          ║
║  • GET  /api/check-email/:email                              ║
║  • GET  /api/check-domain/:domain                            ║
║                                                              ║
║  Frontend: http://localhost:${PORT}                              ║
║  API Base: http://localhost:${PORT}/api                          ║
╚══════════════════════════════════════════════════════════════╝
  `);
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;