require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const procurementRoutes = require('./routes/procurement');
const cropsRoutes = require('./routes/crops');
const listingsRoutes = require('./routes/listings');
const bidsRoutes = require('./routes/bids');
const ordersRoutes = require('./routes/orders');
const mandiPricesRoutes = require('./routes/mandiPrices');
const notificationsRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const chatRoutes = require('./routes/chat');
const reviewsRoutes = require('./routes/reviews');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Krishi Setu Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/crops', cropsRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/bids', bidsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/mandi-prices', mandiPricesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Krishi Setu Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
