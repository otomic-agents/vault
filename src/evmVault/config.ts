export const config = {
    port: parseInt(process.env.PORT || '3000', 10),

    keystoreFolder: process.env.KEYSTORE_FOLDER || './keystore',
    vaultName: process.env.VAULT_NAME || 'test-evm',
    vaultPassword: process.env.VAULT_PASSWORD || 'password',

    signTxWhitelists: process.env.SIGN_TX_WHITELISTS
        ? process.env.SIGN_TX_WHITELISTS.split(',')
        : [
              '192.168.0.1-0x6F12FED6Cd5BeBFA3351c447f7873B76178B1b84-transferOut',
              '192.168.0.1-0x6F12FED6Cd5BeBFA3351c447f7873B76178B1b84-transferIn',
              '192.168.0.1-0x6F12FED6Cd5BeBFA3351c447f7873B76178B1b84-refundTransferOut',
              '192.168.0.1-0x6F12FED6Cd5BeBFA3351c447f7873B76178B1b84-refundTransferIn',
              '192.168.0.1-0x6F12FED6Cd5BeBFA3351c447f7873B76178B1b84-confirmTransferOut',
              '192.168.0.1-0x6F12FED6Cd5BeBFA3351c447f7873B76178B1b84-confirmTransferIn',
              '192.168.0.1-0x55d398326f99059fF775485246999027B3197955-*',
          ],

    signMsgWhitelists: process.env.SIGN_MSG_WHITELISTS
        ? process.env.SIGN_MSG_WHITELISTS.split(',')
        : ['192.168.0.1-OtmoicSwap-Message', '192.168.0.1-Otmoic Reputation-Complaint', '192.168.0.1-*-*'],
};
