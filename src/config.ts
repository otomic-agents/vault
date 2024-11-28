export const config = {
    evmVaultPort: parseInt(process.env.EVM_PORT || '3000', 10),
    solanaVaultPort: parseInt(process.env.SOLANA_PORT || '3001', 10),

    evmWalletPassword: process.env.EVM_WALLET_PASSWORD || 'password',
    solanaWalletPassword: process.env.SOLANA_WALLET_PASSWORD || 'password',

    keystorePath: process.env.KEYSTORE_PATH || './keystore',
};
