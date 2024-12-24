export const config = {
    port: parseInt(process.env.PORT || '3000', 10),

    keystoreFolder: process.env.KEYSTORE_FOLDER || './keystore',
    vaultName: process.env.VAULT_NAME || 'test-solana',
    vaultPassword: process.env.VAULT_PASSWORD || 'password',

    signTxWhitelists: process.env.SIGN_TX_WHITELISTS
        ? process.env.SIGN_TX_WHITELISTS.split(',')
        : [
              '192.168.0.1-FAqaHQHgBFFX8fJB6fQUqNdc8zABV5pGVRdCt7fLLYVo-*',
              '192.168.0.1-TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA-Transfer',
              '192.168.0.1-11111111111111111111111111111111-Transfer',
          ],

    signMsgWhitelists: process.env.SIGN_MSG_WHITELISTS
        ? process.env.SIGN_MSG_WHITELISTS.split(',')
        : ['192.168.0.1-src_chain_id', '192.168.0.1-*', '*-src_chain_id'],
};
