/**
 * Modal Component System
 * Handles modal creation, display, and management
 */
class ModalManager {
    constructor() {
        this.activeModals = new Map();
        this.modalContainer = null;
        this.isInitialized = false;
        
        this.log('ModalManager initialized');
    }

    /**
     * Initialize modal manager
     */
    initialize() {
        try {
            this.modalContainer = document.getElementById('modal-container');
            if (!this.modalContainer) {
                throw new Error('Modal container not found');
            }
            
            this.isInitialized = true;
            this.log('ModalManager initialized successfully');
            
            return true;
        } catch (error) {
            this.logError('Failed to initialize ModalManager:', error);
            throw error;
        }
    }

    /**
     * Show a modal
     */
    show(modalId, content, options = {}) {
        try {
            if (!this.isInitialized) {
                this.initialize();
            }

            const modal = this.createModal(modalId, content, options);
            this.activeModals.set(modalId, modal);
            
            this.modalContainer.appendChild(modal);
            this.modalContainer.style.display = 'block';
            
            // Add event listeners
            this.setupModalEventListeners(modalId, modal, options);
            
            this.log('Modal shown:', modalId);
            
            return modal;
        } catch (error) {
            this.logError('Failed to show modal:', error);
            throw error;
        }
    }

    /**
     * Hide a modal
     */
    hide(modalId) {
        try {
            const modal = this.activeModals.get(modalId);
            if (!modal) {
                this.log('Modal not found:', modalId);
                return;
            }

            modal.remove();
            this.activeModals.delete(modalId);
            
            // Hide container if no active modals
            if (this.activeModals.size === 0) {
                this.modalContainer.style.display = 'none';
            }
            
            this.log('Modal hidden:', modalId);
        } catch (error) {
            this.logError('Failed to hide modal:', error);
        }
    }

    /**
     * Create modal element
     */
    createModal(modalId, content, options) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = `${modalId}-backdrop`;
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        if (typeof content === 'string') {
            modalContent.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            modalContent.appendChild(content);
        }
        
        modal.appendChild(modalContent);
        
        return modal;
    }

    /**
     * Setup modal event listeners
     */
    setupModalEventListeners(modalId, modal, options) {
        // Close on backdrop click
        if (options.closeOnBackdrop !== false) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hide(modalId);
                }
            });
        }

        // Close on escape key
        if (options.closeOnEscape !== false) {
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hide(modalId);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }

        // Close button
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide(modalId);
            });
        }
    }

    /**
     * Hide all modals
     */
    hideAll() {
        const modalIds = Array.from(this.activeModals.keys());
        modalIds.forEach(modalId => this.hide(modalId));
    }

    /**
     * Check if modal is active
     */
    isActive(modalId) {
        return this.activeModals.has(modalId);
    }

    /**
     * Get active modal count
     */
    getActiveCount() {
        return this.activeModals.size;
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (window.CONFIG?.DEV?.DEBUG_MODE) {
            console.log('[ModalManager]', ...args);
        }
    }

    /**
     * Error logging utility
     */
    logError(...args) {
        console.error('[ModalManager]', ...args);
    }
}

// Create global instance
window.modalManager = new ModalManager();
