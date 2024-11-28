export const config = {
    evmVaultPort: parseInt(process.env.EVM_PORT || '3000', 10),
    evmWalletPassword: process.env.EVM_WALLET_PASSWORD || 'password',
    solanaVaultPort: parseInt(process.env.SOLANA_PORT || '3001', 10),
    solanaWalletPassword: process.env.SOLANA_WALLET_PASSWORD || 'password',

    keystorePath: './keystore',
};
