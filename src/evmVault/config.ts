export const config = {
    port: parseInt(process.env.PORT || '3000', 10),

    keystoreFolder: process.env.KEYSTORE_FOLDER || './keystore',
    vaultName: process.env.VAULT_NAME || 'test-evm',
    vaultPassword: process.env.VAULT_PASSWORD || 'password',

    evmPrivateKeys: (() => {
        const privateKeyMap = process.env.PRIVATE_KEY_MAP || '';
        if (!privateKeyMap) return [];

        return privateKeyMap.split(',').map(item => {
            const [key, privateKey] = item.split('=');
            if (!key || !privateKey) return null;

            const [network, address] = key.split('-');
            return {
                network: network || '',
                address: address || '',
                privateKey: privateKey || ''
            };
        }).filter(item => item !== null && item.network !== 'solana');
    })(),

    signTxWhitelists: process.env.SIGN_TX_WHITELISTS
        ? process.env.SIGN_TX_WHITELISTS.split(',')
        : [
              '192.168.0.1-0x6F12FED6Cd5BeBFA3351c447f7873B76178B1b84-*-*',
              '192.168.0.1-*-approve-0x6F12FED6Cd5BeBFA3351c447f7873B76178B1b84',
          ],

    signMsgWhitelists: process.env.SIGN_MSG_WHITELISTS
        ? process.env.SIGN_MSG_WHITELISTS.split(',')
        : ['192.168.0.1-OtmoicSwap-Message', '192.168.0.1-Otmoic Reputation-Complaint', '192.168.0.1-*-*'],
};
