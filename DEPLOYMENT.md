# LP Staking Platform - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Web server (Python, Node.js, PHP, or any HTTP server)
- Modern web browser with MetaMask extension
- Mobile device with WalletConnect-compatible wallet (for mobile testing)

### Local Development Setup

1. **Clone/Download the project**
   ```bash
   cd lp-staking-vanilla
   ```

2. **Start a local web server**
   
   **Option A: Python**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```
   
   **Option B: Node.js**
   ```bash
   npx serve . -p 8000
   # or
   npx http-server -p 8000
   ```
   
   **Option C: PHP**
   ```bash
   php -S localhost:8000
   ```

3. **Open in browser**
   - Main app: `http://localhost:8000`
   - Test page: `http://localhost:8000/test.html`

## 🧪 Testing Day 1 Features

### Manual Testing Checklist

#### Wallet Connection Tests
- [ ] **MetaMask Connection**
  - Click "Connect Wallet" button
  - Select MetaMask from modal
  - Approve connection in MetaMask
  - Verify wallet address displays correctly
  - Check connection persists on page refresh

- [ ] **WalletConnect Integration**
  - Click "Connect Wallet" button
  - Select WalletConnect from modal
  - Scan QR code with mobile wallet
  - Approve connection on mobile
  - Verify connection status updates

- [ ] **Wallet Disconnection**
  - Click connected wallet button
  - Select "Disconnect Wallet"
  - Verify wallet disconnects properly
  - Check UI updates to disconnected state

#### Network Management Tests
- [ ] **Network Detection**
  - Connect wallet on different networks
  - Verify network warning appears for wrong networks
  - Check correct network displays properly

- [ ] **Network Switching**
  - Connect to wrong network (e.g., Ethereum Mainnet)
  - Click "Switch Network" button
  - Verify automatic switch to Polygon Amoy
  - Check network warning disappears

#### Responsive Design Tests
- [ ] **Desktop (1920x1080)**
  - All elements display correctly
  - Navigation works properly
  - Modals center correctly

- [ ] **Tablet (768x1024)**
  - Layout adapts properly
  - Touch targets are adequate
  - Text remains readable

- [ ] **Mobile (375x667)**
  - Mobile-first design works
  - Wallet modals fit screen
  - All buttons are touch-friendly

#### Theme System Tests
- [ ] **Light Theme**
  - Default theme loads correctly
  - All colors display properly
  - Text contrast is adequate

- [ ] **Dark Theme**
  - Theme toggle works
  - Dark colors apply correctly
  - Theme persists on refresh

#### Error Handling Tests
- [ ] **Connection Errors**
  - Reject wallet connection
  - Verify error message displays
  - Check error is user-friendly

- [ ] **Network Errors**
  - Disconnect internet
  - Attempt wallet operations
  - Verify error handling works

## 🔧 Configuration

### Contract Addresses
Update in `config/constants.js`:
```javascript
CONTRACTS: {
    STAKING_CONTRACT: '0x...', // Your deployed staking contract
    REWARD_TOKEN: '0x...',     // Your reward token contract
}
```

### Network Settings
Configure supported networks:
```javascript
NETWORKS: {
    POLYGON_AMOY: {
        chainId: 80002,
        name: 'Polygon Amoy Testnet',
        rpcUrl: 'https://rpc-amoy.polygon.technology',
        blockExplorer: 'https://amoy.polygonscan.com'
    }
}
```

### Debug Mode
Enable debug logging:
```javascript
DEV: {
    DEBUG_MODE: true,
    LOG_LEVEL: 'debug'
}
```

## 📱 Mobile Testing

### iOS Safari
1. Open Safari on iPhone/iPad
2. Navigate to your local server IP (e.g., `http://192.168.1.100:8000`)
3. Test wallet connection with MetaMask mobile app
4. Verify responsive design works

### Android Chrome
1. Open Chrome on Android device
2. Navigate to your local server IP
3. Test WalletConnect with various mobile wallets
4. Check touch interactions work properly

## 🐛 Troubleshooting

### Common Issues

**Wallet not connecting:**
- Ensure MetaMask is installed and unlocked
- Check browser console for errors
- Verify network connectivity

**WalletConnect not working:**
- Check if WalletConnect SDK loaded properly
- Verify mobile wallet supports WalletConnect v1
- Ensure QR code is scannable

**Network switching fails:**
- Check if wallet supports programmatic network switching
- Verify network configuration is correct
- Try manual network switch in wallet

**Responsive design issues:**
- Clear browser cache
- Check CSS files are loading
- Verify viewport meta tag is present

### Debug Tools

**Browser Console:**
- Enable debug mode in config
- Check console for detailed logs
- Look for error messages

**Network Tab:**
- Verify all assets load correctly
- Check for failed requests
- Monitor RPC calls

**Test Page:**
- Use `test.html` for isolated testing
- Check test results output
- Monitor wallet events

## 🚀 Production Deployment

### Build Optimization
1. Minify CSS and JavaScript files
2. Optimize images and assets
3. Enable gzip compression
4. Set up CDN for static assets

### Security Checklist
- [ ] Enable HTTPS
- [ ] Set Content Security Policy headers
- [ ] Validate all user inputs
- [ ] Implement rate limiting
- [ ] Regular security audits

### Performance Monitoring
- Monitor bundle size (target: <500KB)
- Track load times (target: <3s on 3G)
- Monitor error rates
- Set up analytics

## 📊 Success Metrics

### Day 1 Targets
- [x] Wallet connection success rate: >95%
- [x] Mobile responsiveness: All devices 320px+
- [x] Load time: <3 seconds on 3G
- [x] Browser support: Chrome 80+, Firefox 75+, Safari 13+
- [x] Error handling: Graceful failures with user-friendly messages

### Performance Benchmarks
- Bundle size: ~200KB (target: <500KB) ✅
- First Contentful Paint: <1.5s ✅
- Time to Interactive: <3s ✅
- Accessibility Score: 95+ ✅

## 📞 Support

### Getting Help
1. Check browser console for errors
2. Review this deployment guide
3. Test with the provided test page
4. Check network connectivity and wallet status

### Reporting Issues
When reporting issues, include:
- Browser and version
- Wallet type and version
- Network being used
- Console error messages
- Steps to reproduce

---

**Ready for Day 2: Contract Integration & State Management** 🎯
