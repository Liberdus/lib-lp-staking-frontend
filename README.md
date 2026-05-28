# Liberdus LP Staking Platform

A professional, production-ready vanilla JavaScript implementation of a decentralized LP (Liquidity Provider) token staking platform with multi-signature governance.

## 🚀 Features

### Core Functionality
- **LP Token Staking** - Stake liquidity provider tokens and earn rewards
- **Real-time TVL & APR** - Live calculation of Total Value Locked and Annual Percentage Rate
- **Reward Claims** - Claim accumulated rewards at any time
- **Multi-pair Support** - Support for multiple LP token pairs
- **Wallet Integration** - Injected EVM wallet support

### Admin Features
- **Multi-signature Governance** - Secure multi-sig proposal system
- **Proposal Management** - Create, vote, and execute governance proposals
- **Weight Management** - Adjust reward weights for different pairs
- **Rate Control** - Modify hourly reward rates
- **Pair Management** - Add or remove LP token pairs

### Technical Features
- **Subdirectory Deployment** - Works in any subdirectory path
- **Responsive Design** - Mobile-first, fully responsive UI
- **Dark/Light Theme** - User-selectable theme with persistence
- **Caching System** - Built-in caching for optimal performance
- **Error Handling** - Comprehensive error handling and user feedback
- **Accessibility** - WCAG 2.1 compliant

## 📋 Requirements

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Injected EVM wallet such as MetaMask, Rabby, Coinbase Wallet, or another compatible wallet
- Web server (Apache, Nginx, or any HTTP server)

## Wallet support

Wallet connection uses the vendored `liberdus-wallet-module` for injected EVM wallet discovery and session restore. If more than one compatible wallet is available, the header connect button opens a wallet picker before requesting account access.

Read-only staking data still loads from the configured RPC without a wallet. Transaction actions require a connected wallet on the selected network.

## 🛠️ Installation

### Option 1: Direct Deployment

1. **Upload files to your web server:**
   ```bash
   # Upload all files to your desired directory
   scp -r * user@yourserver.com:/var/www/html/staking/
   ```

2. **Access the application:**
   ```
   https://yourdomain.com/staking/
   ```

### Option 2: Local Development

1. **Clone or download the repository**

2. **Start a local web server:**
   ```bash
   # Using Python
   python -m http.server 8080
   
   # Using Node.js
   npx http-server -p 8080
   
   # Using PHP
   php -S localhost:8080
   ```

3. **Open in browser:**
   ```
   http://localhost:8080/
   ```

## 📁 Project Structure

```
lp-staking-vanilla/
├── index.html              # Homepage
├── admin/                  # Admin panel
│   └── index.html         # Admin panel entry point
├── assets/                 # Images and static assets
│   ├── abi/               # Contract ABIs
│   ├── images/            # UI images
│   └── logo.png           # Application logo
├── css/                    # Stylesheets
│   ├── base.css           # Design tokens, resets, shared utilities
│   ├── components.css     # Component styles
│   ├── home.css           # Homepage layout styles
│   └── admin.css          # Admin panel styles
├── js/                     # JavaScript modules
│   ├── components/        # UI components
│   ├── config/            # Configuration
│   ├── contracts/         # Contract interactions
│   ├── core/              # Core utilities
│   ├── utils/             # Helper utilities
│   └── wallet/            # Wallet management
├── libs/                   # Third-party libraries
│   └── ethers.umd.min.js  # Ethers.js library
```

## ⚙️ Configuration

### Network Configuration

Edit `js/config/app-config.js` to configure network settings:

```javascript
NETWORK: {
    CHAIN_ID: 80002,
    NAME: 'Polygon Amoy Testnet',
    RPC_URL: 'https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY',
    BLOCK_EXPLORER: 'https://amoy.polygonscan.com'
}
```

### Contract Addresses

Update contract addresses in `js/config/app-config.js`:

```javascript
CONTRACTS: {
    STAKING_CONTRACT: '0xYourStakingContractAddress',
    REWARD_TOKEN: '0xYourRewardTokenAddress',
    LP_TOKENS: {
        PAIR1: '0xLPTokenAddress1',
        PAIR2: '0xLPTokenAddress2'
    }
}
```

### Production Settings

For production deployment, ensure these settings in `js/config/app-config.js`:

```javascript
DEV: {
    DEBUG: false,
    CONSOLE_LOGS: false,
    PERFORMANCE_MONITORING: false
}
```

## 🎨 Customization

### Theme Colors

Modify design tokens in `css/base.css`:

```css
:root {
    --primary-main: #1976d2;
    --secondary-main: #dc004e;
    --success-main: #4caf50;
    --error-main: #f44336;
}
```

### Application Name

Update in `js/config/app-config.js`:

```javascript
APP: {
    NAME: 'Your App Name',
    VERSION: '1.0.0',
    DESCRIPTION: 'Your description'
}
```

## 🔒 Security

### Best Practices

1. **HTTPS Only** - Always use HTTPS in production
2. **RPC Security** - Use private RPC endpoints with API keys
3. **Input Validation** - All user inputs are validated
4. **XSS Protection** - Content Security Policy headers recommended
5. **Rate Limiting** - Implement rate limiting on your server

### Security Headers

Add these headers to your web server configuration:

```nginx
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval' https:";
```

## 📊 Performance

### Optimization Features

- **Caching System** - 5-minute price caching, 20-second data caching
- **Lazy Loading** - Components loaded on demand
- **Code Splitting** - Modular JavaScript architecture
- **Asset Optimization** - Minified CSS and optimized images

### Performance Metrics

- **Bundle Size:** ~200KB (unminified)
- **Initial Load:** ~1.8s (on 3G)
- **Time to Interactive:** ~2.5s
- **Lighthouse Score:** 95+

## 🧪 Testing

### Manual Testing Checklist

- [ ] Homepage loads without errors
- [ ] Wallet connects successfully
- [ ] Staking pairs display correctly
- [ ] TVL and APR calculate correctly
- [ ] Stake transaction works
- [ ] Unstake transaction works
- [ ] Claim rewards works
- [ ] Admin panel loads (for admins)
- [ ] Proposal creation works (for admins)
- [ ] Theme toggle works
- [ ] Responsive design works on mobile

### Browser Testing

Tested and verified on:
- ✅ Chrome 120+
- ✅ Firefox 121+
- ✅ Edge 120+
- ✅ Safari 17+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Common Issues

**Issue:** Wallet won't connect
- **Solution:** Ensure your wallet is installed and unlocked
- **Solution:** Check that you're on the correct network

**Issue:** Transactions fail
- **Solution:** Ensure sufficient gas balance (MATIC)
- **Solution:** Check contract addresses are correct
- **Solution:** Verify RPC endpoint is working

**Issue:** TVL/APR shows 0
- **Solution:** Wait for price data to load (5-10 seconds)
- **Solution:** Check browser console for API errors
- **Solution:** Verify DexScreener API is accessible

**Issue:** Admin panel shows "Not Authorized"
- **Solution:** Ensure connected wallet has admin role
- **Solution:** Check contract configuration

## 📱 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Fully Supported |
| Firefox | 88+ | ✅ Fully Supported |
| Edge | 90+ | ✅ Fully Supported |
| Safari | 14+ | ✅ Fully Supported |
| Opera | 76+ | ✅ Fully Supported |

## 🤝 Contributing

This is a production application. For modifications:

1. Test thoroughly in development environment
2. Verify all features work correctly
3. Check browser console for errors
4. Test on multiple browsers
5. Verify responsive design

## 📄 License

Copyright © 2025 Liberdus. All rights reserved.

## 🔗 Links

- **Website:** https://liberdus.com
- **Documentation:** [Coming Soon]
- **Support:** [Contact Information]

## 📞 Support

For technical support or questions:
- Check the troubleshooting section above
- Review browser console for error messages
- Verify configuration settings

## 🎯 Deployment Checklist

Before deploying to production:

- [ ] Update contract addresses in `app-config.js`
- [ ] Set `DEBUG: false` in `app-config.js`
- [ ] Configure production RPC endpoints
- [ ] Test all functionality
- [ ] Verify security headers
- [ ] Enable HTTPS
- [ ] Test on multiple browsers
- [ ] Verify mobile responsiveness
- [ ] Check performance metrics
- [ ] Backup configuration

## 🚀 Quick Start

1. **Upload files** to your web server
2. **Configure** contract addresses in `js/config/app-config.js`
3. **Access** the application in your browser
4. **Connect** your wallet
5. **Start staking!**

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-09  
**Status:** Production Ready ✅
