// Global type declarations for the LP Staking Frontend
declare global {
    interface Window {
        PermissionUtils: {
            getPermissionButtonText: (networkName: string) => string;
            getPermissionButtonAction: (networkName: string, context?: string) => string;
            getPermissionButtonTitle: (networkName: string) => string;
        };
    }
}

export {};
