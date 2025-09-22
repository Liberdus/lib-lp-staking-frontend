/**
 * Bootstrap Fix - Ensures basic functionality works
 * Run this to fix critical system issues
 */

console.log('🔧 Bootstrap Fix - Ensuring basic functionality...');

// Fix 1: Ensure ErrorHandler exists
if (!window.ErrorHandler) {
    console.log('Creating minimal ErrorHandler...');
    window.ErrorHandler = class ErrorHandler {
        constructor() {
            this.errors = [];
        }
        
        processError(error, context = {}) {
            console.error('Error:', error, context);
            this.errors.push({ error, context, timestamp: Date.now() });
            return { category: 'unknown', severity: 'medium', retryable: false };
        }
        
        handleNetworkError(error) {
            console.error('Network Error:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Network Error', 'Please check your connection');
            }
        }
        
        handleContractError(error) {
            console.error('Contract Error:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Contract Error', 'Transaction failed');
            }
        }
        
        handleWalletError(error) {
            console.error('Wallet Error:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Wallet Error', 'Wallet operation failed');
            }
        }
    };
    
    // Create instance
    window.errorHandler = new window.ErrorHandler();
    console.log('✅ Minimal ErrorHandler created');
}

// Fix 2: Ensure NotificationManager exists
if (!window.NotificationManager) {
    console.log('Creating minimal NotificationManager...');
    window.NotificationManager = class NotificationManager {
        constructor() {
            this.notifications = [];
        }
        
        show(message, type = 'info', options = {}) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            
            // Try to show browser notification
            if (Notification && Notification.permission === 'granted') {
                new Notification(message);
            }
            
            return { id: Date.now(), message, type };
        }
        
        success(title, message, options = {}) {
            return this.show(`${title}: ${message}`, 'success', options);
        }
        
        error(title, message, options = {}) {
            return this.show(`${title}: ${message}`, 'error', options);
        }
        
        warning(title, message, options = {}) {
            return this.show(`${title}: ${message}`, 'warning', options);
        }
        
        info(title, message, options = {}) {
            return this.show(`${title}: ${message}`, 'info', options);
        }
    };
    
    // Create instance
    window.notificationManager = new window.NotificationManager();
    console.log('✅ Minimal NotificationManager created');
}

// Fix 3: Ensure StateManager exists
if (!window.StateManager) {
    console.log('Creating minimal StateManager...');
    window.StateManager = class StateManager {
        constructor() {
            this.state = {};
            this.subscribers = new Map();
        }
        
        get(path) {
            return this.getNestedValue(this.state, path);
        }
        
        set(path, value) {
            this.setNestedValue(this.state, path, value);
            this.notifySubscribers(path, value);
        }
        
        subscribe(path, callback) {
            if (!this.subscribers.has(path)) {
                this.subscribers.set(path, new Set());
            }
            this.subscribers.get(path).add(callback);
            
            return () => {
                const pathSubscribers = this.subscribers.get(path);
                if (pathSubscribers) {
                    pathSubscribers.delete(callback);
                }
            };
        }
        
        getNestedValue(obj, path) {
            return path.split('.').reduce((current, key) => current && current[key], obj);
        }
        
        setNestedValue(obj, path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((current, key) => {
                if (!current[key]) current[key] = {};
                return current[key];
            }, obj);
            target[lastKey] = value;
        }
        
        notifySubscribers(path, value) {
            const pathSubscribers = this.subscribers.get(path);
            if (pathSubscribers) {
                pathSubscribers.forEach(callback => {
                    try {
                        callback(value);
                    } catch (error) {
                        console.error('Subscriber error:', error);
                    }
                });
            }
        }
    };
    
    // Create instance
    window.stateManager = new window.StateManager();
    console.log('✅ Minimal StateManager created');
}

// Fix 4: Ensure Router exists
if (!window.Router) {
    console.log('Creating minimal Router...');
    window.Router = class Router {
        constructor() {
            this.routes = new Map();
            this.currentComponent = null;
        }
        
        register(path, component, options = {}) {
            this.routes.set(path, { component, options });
            console.log(`Route registered: ${path}`);
        }
        
        navigate(path) {
            console.log(`Navigating to: ${path}`);
            window.location.hash = path;
            this.handleRoute(path);
        }
        
        getCurrentPath() {
            return window.location.hash.slice(1) || '/';
        }
        
        getCurrentRoute() {
            return this.getCurrentPath();
        }
        
        handleRoute(path) {
            const route = this.routes.get(path);
            if (route && route.component) {
                try {
                    if (this.currentComponent && typeof this.currentComponent.unmount === 'function') {
                        this.currentComponent.unmount();
                    }
                    
                    this.currentComponent = new route.component();
                    if (typeof this.currentComponent.mount === 'function') {
                        this.currentComponent.mount();
                    }
                } catch (error) {
                    console.error('Route handling error:', error);
                }
            }
        }
    };
    
    // Create instance
    window.router = new window.Router();
    
    // Set up hash change listener
    window.addEventListener('hashchange', () => {
        const path = window.router.getCurrentPath();
        window.router.handleRoute(path);
    });
    
    console.log('✅ Minimal Router created');
}

// Fix 5: Ensure StakingModal instance exists
if (window.StakingModal && !window.stakingModal) {
    try {
        window.stakingModal = new window.StakingModal();
        console.log('✅ StakingModal instance created');
    } catch (error) {
        console.error('Failed to create StakingModal:', error);
    }
}

// Fix 6: Set up basic button functionality
function setupBasicButtons() {
    setTimeout(() => {
        console.log('🔘 Setting up basic button functionality...');
        
        // Stake buttons
        document.querySelectorAll('.stake-btn').forEach(btn => {
            if (!btn.hasAttribute('data-bootstrap-fixed')) {
                btn.setAttribute('data-bootstrap-fixed', 'true');
                btn.onclick = function(e) {
                    e.preventDefault();
                    console.log('🎯 Stake butt;cButtonsasietupButtons = ssetupBasicB
window. manual use foronsetup functiort 
// Exp);
now'hould work lity sna functio- basicomplete  cp fixraotstle.log('✅ Boonso

c});rue
ubtree: t
    st: true,ildLis    ch, {
.bodyumentocerve(d.obserervobs;
});

ttons()pBasicBu {
    setu() =>nObserver(io Mutatew nerver =
const obsgeshanch for DOM c);

// Watons(ttsicBues
setupBa changon DOM and iately immednset up butto

// S000);
}   }, 1p');
 ty set uctionaliunbutton f'✅ Basic e.log(     consol   
   ;
     
        })     }};
                    
   Name}`);p for ${pairswag Unig', `Openinin('Redirecter?.infocationManagtifino     window.              ');
 eroreferrener,nank', 'nooprl, '_bldow.open(u   win             }`;
    oken1${t{token0}/#/add/v2/$org/pp.uniswap. `https://aconst url =                    
t('-');Name.spli] = pair0, token1[token  const                 B-USDT';
   || 'LIir')'data-paibute(is.getAttr= thName st pair  con                     
            ;
     tstrap)')clicked (boonk swap li🦄 Uni('e.log     consol           
    );fault(.preventDe  e                ion(e) {
  unctck = f  link.oncli            rue');
  xed', 'ttrap-fiotsute('data-bonk.setAttrib          li      ) {
p-fixed')bootstra'data-ibute(k.hasAttr if (!lin         
  => {ink forEach(l).p-link'l('.uniswarAltoSelecquery document.   ks
    wap lin     // Unis
            }
 };
          ;
        sfully')ed succes 'Data updatreshed',efcess('Rr?.sucgecationManadow.notifi        win);
        (bootstrap)'on clicked esh butt.log('🔄 Refrnsoleco              );
  ventDefault(      e.pre        ) {
   function(etn.onclick =refreshB    
        true'); 'fixed',p-tstra('data-booributetteshBtn.setAfr      re
      ')) {fixedrap-sta-boot('datributeasAttBtn.h !refreshreshBtn &&if (ref       resh');
 l-refById('manuat.getElement = documeneshBtn  const refr      n
esh butto  // Refr 
      );
       
        }     } };
                     }
                    
 here');will open ing modal takert('S al                       
 else {      }       );
       air, 0how(mockPakingModal.sdow.st     win            };
                             true
    isActive:                  
          0,apr:                      0',
      789901234569012345678234567801890x1234567lpToken: '                        T',
     'LIB-USDme:          na                r-1',
  id: 'pai                        ir = {
    st mockPa    con                  
  ngModal) {.staki  if (window                       
              );
 tstrap)' (booon clicked