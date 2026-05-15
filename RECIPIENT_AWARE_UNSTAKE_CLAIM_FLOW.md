# Recipient-Aware Unstake and Claim Flow

## What Changed

This branch adds recipient-aware unstake and claim support in three layers:

1. Contract-manager transaction plumbing
   - `ContractManager.claimRewards(lpTokenAddress, recipientAddress = null)` keeps calling `claimRewards(lpTokenAddress)` by default.
   - When a recipient is provided, it validates/checksums the address and calls `claimRewardsTo(lpTokenAddress, receiver)`.
   - `ContractManager.unstake(lpTokenAddress, amount, claimRewards, recipientAddress = null)` keeps calling `unstake(lpTokenAddress, amountWei, claimRewards)` by default.
   - When a recipient is provided, it validates/checksums the address and calls `unstakeTo(lpTokenAddress, amountWei, claimRewards, receiver)`.

2. Modal rendering and local state
   - The Unstake and Claim tabs now render a hidden-by-default advanced recipient control.
   - Default state shows `Receiving wallet: Connected wallet`.
   - Clicking `Send to another wallet` reveals a recipient address field.
   - Clicking `Send to connected wallet` or `Clear` collapses the field and clears the override.
   - Recipient state is separate for Unstake and Claim:
     - `unstakeRecipientEnabled`
     - `unstakeRecipientAddress`
     - `unstakeRecipientError`
     - `claimRecipientEnabled`
     - `claimRecipientAddress`
     - `claimRecipientError`

3. Modal submission wiring
   - `executeUnstake()` and `executeClaim()` validate the custom recipient only when the override is enabled.
   - Malformed recipient addresses block submission before wallet approval.
   - Valid custom recipients are passed into `window.contractManager.unstake(...)` or `window.contractManager.claimRewards(...)`.
   - If no override is enabled, the original function signatures and default connected-wallet behavior remain unchanged.

## High-Level Flow

```mermaid
flowchart TD
    A["User opens Staking modal"] --> B{"Current tab"}
    B --> C["Unstake tab"]
    B --> D["Claim tab"]

    C --> E["renderUnstakeTab()"]
    D --> F["renderClaimTab()"]

    E --> G["renderRecipientOverride('unstake')"]
    F --> H["renderRecipientOverride('claim')"]

    G --> I{"Recipient override enabled?"}
    H --> J{"Recipient override enabled?"}

    I -- "No" --> K["Show receiving wallet as connected wallet"]
    J -- "No" --> K

    I -- "Yes" --> L["Show recipient address input"]
    J -- "Yes" --> L

    L --> M["setRecipientAddress(action, value)"]
    M --> N["getRecipientValidationError(action)"]
    N --> O["updateRecipientDestination(action)"]
    N --> P["updateRecipientError(action)"]
    N --> Q["updateUnstakeButton() or updateClaimButton()"]

    K --> R["User submits action"]
    Q --> R

    R --> S{"Action type"}
    S --> T["executeUnstake()"]
    S --> U["executeClaim()"]

    T --> V["getValidatedRecipient('unstake')"]
    U --> W["getValidatedRecipient('claim')"]

    V --> X{"Valid custom recipient?"}
    W --> X

    X -- "No" --> Y["Show error and stop before transaction"]
    X -- "No override" --> Z["Call default contract-manager path"]
    X -- "Yes" --> AA["Call recipient-aware contract-manager path"]

    Z --> AB["Contract sends funds to msg.sender"]
    AA --> AC["Contract sends funds to receiver"]
```

## Unstake Sequence

```mermaid
sequenceDiagram
    actor User
    participant Modal as StakingModalNew
    participant CM as window.contractManager
    participant Ethers as ethers Contract With Signer
    participant Contract as LPStaking Contract

    User->>Modal: Click "Send to another wallet"
    Modal->>Modal: toggleRecipientOverride('unstake')
    Modal->>Modal: renderTabContent()
    Modal->>Modal: renderUnstakeTab()
    Modal->>Modal: renderRecipientOverride('unstake')

    User->>Modal: Type recipient address
    Modal->>Modal: setRecipientAddress('unstake', value)
    Modal->>Modal: getRecipientValidationError('unstake')
    Modal->>Modal: updateRecipientDestination('unstake')
    Modal->>Modal: updateRecipientError('unstake')
    Modal->>Modal: updateUnstakeButton()

    User->>Modal: Click "Unstake LP Tokens"
    Modal->>Modal: executeUnstake()
    Modal->>CM: isReady()
    Modal->>Modal: getValidatedRecipient('unstake')
    Modal->>CM: validateAndChecksumAddress(address, 'Recipient Address')

    alt Invalid recipient
        Modal->>Modal: setRecipientError('unstake', error)
        Modal->>Modal: renderTabContent()
        Modal-->>User: Show validation error
    else No custom recipient
        Modal->>CM: unstake(lpTokenAddress, unstakeAmount, claimRewardsOnUnstake)
        CM->>CM: ensureSigner()
        CM->>CM: ethers.utils.parseEther(amount.toString())
        CM->>Ethers: stakingContract.connect(signer)
        Ethers->>Contract: unstake(lpTokenAddress, amountWei, claimRewardsOnUnstake)
        Contract->>Contract: _unstake(lpToken, amount, shouldClaimRewards, msg.sender)
    else Valid custom recipient
        Modal->>CM: unstake(lpTokenAddress, unstakeAmount, claimRewardsOnUnstake, receiver)
        CM->>CM: ensureSigner()
        CM->>CM: validateAndChecksumAddress(receiver, 'Recipient Address')
        CM->>CM: ethers.utils.parseEther(amount.toString())
        CM->>Ethers: stakingContract.connect(signer)
        Ethers->>Contract: unstakeTo(lpTokenAddress, amountWei, claimRewardsOnUnstake, receiver)
        Contract->>Contract: _unstake(lpToken, amount, shouldClaimRewards, receiver)
    end

    Contract-->>Ethers: Transaction response
    Ethers-->>CM: tx
    CM->>CM: executeTransactionOnce(..., 'unstake')
    CM-->>Modal: { success, hash }
    Modal-->>User: Success notification
    Modal->>Modal: clearInputs()
    Modal->>Modal: close()
```

## Claim Sequence

```mermaid
sequenceDiagram
    actor User
    participant Modal as StakingModalNew
    participant CM as window.contractManager
    participant Ethers as ethers Contract With Signer
    participant Contract as LPStaking Contract

    User->>Modal: Click "Send to another wallet"
    Modal->>Modal: toggleRecipientOverride('claim')
    Modal->>Modal: renderTabContent()
    Modal->>Modal: renderClaimTab()
    Modal->>Modal: renderRecipientOverride('claim')

    User->>Modal: Type recipient address
    Modal->>Modal: setRecipientAddress('claim', value)
    Modal->>Modal: getRecipientValidationError('claim')
    Modal->>Modal: updateRecipientDestination('claim')
    Modal->>Modal: updateRecipientError('claim')
    Modal->>Modal: updateClaimButton()

    User->>Modal: Click "Claim Rewards"
    Modal->>Modal: executeClaim()
    Modal->>CM: isReady()
    Modal->>Modal: getValidatedRecipient('claim')
    Modal->>CM: validateAndChecksumAddress(address, 'Recipient Address')

    alt Invalid recipient
        Modal->>Modal: setRecipientError('claim', error)
        Modal->>Modal: renderTabContent()
        Modal-->>User: Show validation error
    else No custom recipient
        Modal->>CM: claimRewards(lpTokenAddress)
        CM->>CM: ensureSigner()
        CM->>Ethers: stakingContract.connect(signer)
        Ethers->>Contract: claimRewards(lpTokenAddress)
        Contract->>Contract: _claimRewards(lpToken, msg.sender)
    else Valid custom recipient
        Modal->>CM: claimRewards(lpTokenAddress, receiver)
        CM->>CM: ensureSigner()
        CM->>CM: validateAndChecksumAddress(receiver, 'Recipient Address')
        CM->>Ethers: stakingContract.connect(signer)
        Ethers->>Contract: claimRewardsTo(lpTokenAddress, receiver)
        Contract->>Contract: _claimRewards(lpToken, receiver)
    end

    Contract-->>Ethers: Transaction response
    Ethers-->>CM: tx
    CM->>CM: executeTransactionOnce(..., 'claimRewards')
    CM-->>Modal: { success, hash }
    Modal-->>User: Success notification
    Modal->>Modal: clearInputs()
    Modal->>Modal: close()
```

## Default Versus Custom Recipient Behavior

| User choice | Modal call | Contract-manager call | Contract call | Receiver |
| --- | --- | --- | --- | --- |
| Unstake without override | `executeUnstake()` | `unstake(lpToken, amount, shouldClaimRewards)` | `unstake(lpToken, amountWei, shouldClaimRewards)` | Connected wallet / `msg.sender` |
| Unstake with override | `executeUnstake()` | `unstake(lpToken, amount, shouldClaimRewards, receiver)` | `unstakeTo(lpToken, amountWei, shouldClaimRewards, receiver)` | Custom receiver |
| Claim without override | `executeClaim()` | `claimRewards(lpToken)` | `claimRewards(lpToken)` | Connected wallet / `msg.sender` |
| Claim with override | `executeClaim()` | `claimRewards(lpToken, receiver)` | `claimRewardsTo(lpToken, receiver)` | Custom receiver |

## Important Contract Detail

The recipient-aware methods do not move stake ownership. The connected wallet remains the staker because the contract uses `msg.sender` for accounting. The custom `receiver` only changes where the returned LP tokens and/or claimed LIB rewards are transferred.
