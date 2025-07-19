# Interactive Brokers Integration Guide

This guide explains how to integrate your Interactive Brokers account with the portfolio web application for automatic holdings synchronization.

## Overview

The Interactive Brokers integration allows you to:
- Connect your existing accounts to Interactive Brokers
- Automatically sync holdings from your IBKR account
- Keep your portfolio data up-to-date without manual entry
- Maintain real-time portfolio tracking

## Authentication Options

### 1. Individual Use (Recommended for Personal Use)

**Client Portal Gateway Method:**
- Uses Interactive Brokers' Client Portal Gateway
- Requires daily re-authentication through browser
- No approval process needed
- Best for personal portfolio tracking

**Setup Steps:**
1. Download and install [Interactive Brokers Client Portal Gateway](https://www.interactivebrokers.com/en/trading/ib-api.php)
2. Run the gateway application on your local machine
3. Navigate to `https://localhost:5000` in your browser
4. Log in with your IBKR credentials
5. Use the integration feature in the portfolio app

### 2. Third-Party Application (For Serving Multiple Users)

**OAuth 1.0a Method:**
- True one-time authorization
- Requires IBKR compliance approval (6-12 weeks)
- Suitable for applications serving multiple users
- Professional/commercial use

**Requirements:**
- Established business entity
- Public website with product description
- Proof of concept demonstration
- Compliance approval process

## Setup Instructions

### Prerequisites

1. **Active IBKR Account**: Fully opened and funded account
2. **IBKR Pro Account**: Required for API access
3. **Market Data Subscriptions**: Required for real-time data
4. **Client Portal Gateway**: Download and install from IBKR

### Step-by-Step Setup

#### 1. Install Client Portal Gateway

```bash
# Download from: https://www.interactivebrokers.com/en/trading/ib-api.php
# Extract the downloaded file
# Navigate to the extracted directory

# Windows
bin\run.bat root\conf.yaml

# macOS/Linux  
bin/run.sh root/conf.yaml
```

#### 2. Configure Market Data Subscriptions

1. Log in to IBKR Client Portal
2. Go to Settings → Market Data Subscriptions
3. Subscribe to relevant data packages:
   - **US Securities Snapshot and Futures Value Bundle**
   - **US Equity and Options Add-On Streaming Bundle**
   - **OPRA (US Options Exchanges)** (for options)

#### 3. Create Secondary Username (Optional but Recommended)

To avoid 2FA interruptions and login conflicts:

1. Log in to IBKR Client Portal with your primary account
2. Go to Settings → Users & Access Rights
3. Click the **+** button to add a new user
4. Create username and password for API access
5. Configure permissions and notifications
6. Activate with the confirmation code sent via email

#### 4. Connect Your Account

1. In the portfolio app, go to an existing account
2. Click **Edit** on the account
3. In the "External Connections" section, click **Connect to IBKR**
4. Select your IBKR account from the dropdown
5. Optionally enter your secondary username
6. Click **Connect Account**

## Usage

### Manual Sync
- Click the **Sync** button next to connected accounts
- Holdings will be updated from your IBKR account
- New securities will be automatically added to your portfolio

### Automatic Features
- Connected accounts show sync status and last update time
- Holdings data includes additional metadata (market value, currency, etc.)
- Securities are automatically categorized by type

### Disconnecting
- Click **Disconnect** to remove the IBKR connection
- Account will revert to manual mode
- Existing holdings data is preserved

## API Endpoints

The integration provides several new API endpoints:

### Test Connection
```http
GET /ibkr/test-connection
```
Tests the connection to Interactive Brokers without linking accounts.

### Get Available Accounts
```http
GET /ibkr/accounts
```
Returns list of available IBKR accounts for the authenticated user.

### Connect Account
```http
POST /portfolio/{portfolio_id}/accounts/{account_name}/connect/ibkr
```
Links an existing account to Interactive Brokers.

### Sync Holdings
```http
POST /portfolio/{portfolio_id}/accounts/{account_name}/sync
```
Manually triggers synchronization of holdings from IBKR.

### Disconnect Account
```http
POST /portfolio/{portfolio_id}/accounts/{account_name}/disconnect
```
Removes the IBKR connection from an account.

## Troubleshooting

### Common Issues

**"Not authenticated with IBKR"**
- Ensure Client Portal Gateway is running
- Navigate to `https://localhost:5000` and log in
- Check that your session hasn't timed out

**"Failed to connect to Interactive Brokers API"**
- Verify Client Portal Gateway is installed and running
- Check that you're using the correct port (default: 5000)
- Ensure your firewall allows connections to localhost:5000

**"No market data available"**
- Check your market data subscriptions in IBKR Client Portal
- Ensure subscriptions are active and paid
- Verify you have permissions for the securities you're trading

**Two-Factor Authentication Issues**
- Consider creating a secondary username for API access
- Set up API-specific credentials without 2FA requirements
- Use IB Key mobile app for authentication when needed

### Port Configuration

If port 5000 is in use, modify the Client Portal Gateway configuration:

1. Navigate to your gateway directory
2. Edit `root/conf.yaml`
3. Change `listenPort` from `5000` to another port (e.g., `5001`)
4. Update your application configuration accordingly

### Session Management

**Daily Re-authentication**: Client Portal Gateway requires daily re-authentication
**Session Timeout**: Sessions timeout after ~6 minutes of inactivity
**Keep-alive**: Use the `/tickle` endpoint to maintain sessions

## Security Considerations

### Best Practices

1. **Use Secondary Username**: Create dedicated API credentials
2. **Secure Passwords**: Use strong, unique passwords for API accounts
3. **IP Restrictions**: Configure IP address restrictions in IBKR settings
4. **Regular Monitoring**: Monitor account activity and API usage
5. **Credential Storage**: Keep API credentials secure and encrypted

### Permissions

- API accounts should have minimal required permissions
- Limit trading permissions if only portfolio tracking is needed
- Regular review of account access and permissions

## Limitations

### Current Limitations

- **Manual Authentication**: Daily browser login required for CP Gateway
- **Single Session**: Only one active session per username
- **Market Data Costs**: Separate subscriptions required for each user
- **Timeout Handling**: Sessions require periodic keep-alive calls

### Rate Limits

- Global: 50 requests per second (OAuth) / 10 requests per second (CP Gateway)
- Specific endpoints have additional limits
- Violators may be temporarily blocked

## Support

### Resources

- [Interactive Brokers API Documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/)
- [Client Portal Gateway Download](https://www.interactivebrokers.com/en/trading/ib-api.php)
- [IBKR Customer Support](https://www.interactivebrokers.com/en/support/contact.php)

### Getting Help

1. Check IBKR API documentation for endpoint details
2. Verify your account permissions and subscriptions
3. Test connection using the built-in connection test feature
4. Contact IBKR support for account-specific issues

## Future Enhancements

### Planned Features

- **Automated Authentication**: OAuth 2.0 support when available
- **Real-time Updates**: WebSocket integration for live data
- **Multiple Brokers**: Support for additional brokerage integrations
- **Enhanced Security**: Improved credential management
- **Portfolio Analytics**: Advanced analysis using IBKR data

This integration provides a robust foundation for connecting your portfolio application with Interactive Brokers while maintaining security and compliance with IBKR's API requirements. 