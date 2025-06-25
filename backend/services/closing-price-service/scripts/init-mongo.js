// MongoDB initialization script for closing-price-service

// Switch to the closing price service database
db = db.getSiblingDB('closing_price_service');

// Create collections with validators
db.createCollection('stock_prices', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['symbol', 'price', 'currency', 'market', 'fetched_at', 'date'],
      properties: {
        symbol: {
          bsonType: 'string',
          description: 'Stock symbol is required and must be a string'
        },
        price: {
          bsonType: 'double',
          minimum: 0,
          description: 'Price must be a positive number'
        },
        currency: {
          bsonType: 'string',
          enum: ['USD', 'ILS'],
          description: 'Currency must be USD or ILS'
        },
        market: {
          bsonType: 'string',
          enum: ['US', 'TASE'],
          description: 'Market must be US or TASE'
        },
        fetched_at: {
          bsonType: 'date',
          description: 'Fetched timestamp is required'
        },
        date: {
          bsonType: 'string',
          pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
          description: 'Date must be in YYYY-MM-DD format'
        }
      }
    }
  }
});

db.createCollection('tracked_symbols', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['symbol', 'market', 'added_at', 'last_queried_at'],
      properties: {
        symbol: {
          bsonType: 'string',
          description: 'Symbol is required and must be a string'
        },
        market: {
          bsonType: 'string',
          enum: ['US', 'TASE'],
          description: 'Market must be US or TASE'
        },
        added_at: {
          bsonType: 'date',
          description: 'Added timestamp is required'
        },
        last_queried_at: {
          bsonType: 'date',
          description: 'Last queried timestamp is required'
        }
      }
    }
  }
});

// Create indexes for better performance
db.stock_prices.createIndex({ 'symbol': 1, 'date': -1 });
db.stock_prices.createIndex({ 'fetched_at': -1 });
db.stock_prices.createIndex({ 'market': 1 });

db.tracked_symbols.createIndex({ 'symbol': 1 }, { unique: true });
db.tracked_symbols.createIndex({ 'last_queried_at': 1 });
db.tracked_symbols.createIndex({ 'market': 1 });

print('MongoDB initialization completed successfully');
print('Collections created: stock_prices, tracked_symbols');
print('Indexes created for optimal performance'); 