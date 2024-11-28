export const config = {
    port: parseInt(process.env.EVM_PORT || '3000', 10),

    keystoreFolder: process.env.KEYSTORE_FOLDER || './keystore',
    vaultName: process.env.VAULT_NAME || 'test-solana',
    vaultPassword: process.env.VAULT_PASSWORD || 'password',
};
