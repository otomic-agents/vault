import { Keypair, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';
import { promptText, getCurTimeStampInSecond, generateUUID } from '../utils';
import logger from '../logger';

const Action = {
    Add: 0,
    Remove: 1,
};

async function addEvmAuthAddress() {
    try {
        // Prompt user for domain
        const terminusName = await promptText(
            'The script will add the [solanaWallets] tag to a terminus domain, Enter the terminus domain: ',
        );

        // Prompt user for wallet address
        const walletAddress = await promptText(`Enter the Solana wallet address (bs58 format) to be added: `);

        // Validate wallet address
        let publicKey: PublicKey;
        try {
            publicKey = new PublicKey(walletAddress);
        } catch {
            throw new Error('Invalid Solana wallet address');
        }

        // Prompt user for private key
        const privateKey = await promptText('Enter the private key (bs58 format) for the Solana wallet address: ');

        // Create a keypair instance
        let keypair: Keypair;
        try {
            const secretKey = bs58.decode(privateKey);
            keypair = Keypair.fromSecretKey(secretKey);
        } catch {
            throw new Error('Invalid private key');
        }

        // Ensure the wallet address matches the provided address
        if (keypair.publicKey.toBase58() !== walletAddress) {
            throw new Error('The provided private key does not match the wallet address');
        }

        const chainId = 10;
        const rootTaggerAddr = '0x7e7961aB771cA942CE4DB6e79579e016a33Dc95B';

        const domain = {
            name: 'Terminus DID Root Tagger',
            version: '1',
            chainId: chainId,
            verifyingContract: rootTaggerAddr,
        };

        const types = {
            SolanaAuthAddressReq: [
                { name: 'addr', type: 'bytes32' },
                { name: 'domain', type: 'string' },
                { name: 'signAt', type: 'uint256' },
                { name: 'action', type: 'uint8' },
            ],
        };

        const value = {
            addr: '0x' + keypair.publicKey.toBuffer().toString('hex'),
            domain: terminusName,
            signAt: getCurTimeStampInSecond(),
            action: Action.Add,
        };

        const solanaMsg =
            'prove ownership of Solana wallet ' + keypair.publicKey.toBase58() + ' for Terminus DID ' + value.domain;
        logger.info(`solana msg: ${solanaMsg}`);
        const sigFromAuthAddr =
            '0x' + Buffer.from(nacl.sign.detached(decodeUTF8(solanaMsg), keypair.secretKey)).toString('hex');
        logger.info(`solana sig: ${sigFromAuthAddr}`);

        logger.info(`EIP712 Domain: ${JSON.stringify(domain)}`);
        logger.info(`Signing data: ${JSON.stringify(value)}`);

        // Prompt user for vault url
        const vaultUrl = await promptText('Enter the vault URL (e.g., http://127.0.0.1/lp/9006/signEIP712): ');

        // Send POST request to vault URL to get signature from vault wallet
        const response = await axios.post(vaultUrl, {
            domain,
            types,
            signData: value,
        });

        const vaultSig = response.data.signature;
        const vaultAddress = response.data.publicKey;
        logger.info(`Vault Signature: ${vaultSig} from vault ${vaultAddress}`);

        // Send to DID-HTTP server
        const didHttpUrl = await promptText(
            'Enter the did-http URL to submit request (e.g., http://127.0.0.1/sendTx/normal): ',
        );
        const uuid = generateUUID();
        logger.info(`DID-HTTP uuid: ${uuid}, it can be used to query the status of the request`);
        // Send POST request to DID-HTTP server
        const didResponse = await axios.post(didHttpUrl, {
            uuid,
            calls: [
                {
                    target: 'tag2',
                    method: 'updateSolanaWallet',
                    args: {
                        solanaAuthAddressReq: value,
                        sigFromDomainOwnerPrivKey: vaultSig,
                        sigFromAddressPrivKey: sigFromAuthAddr,
                    },
                },
            ],
        });

        logger.info(`DID-HTTP Response: ${JSON.stringify(didResponse.data)}`);
    } catch (error) {
        logger.error(`Error adding wallet address: ${(error as Error).message}`);
    }
}

addEvmAuthAddress().catch((error) => {
    logger.error(`Unexpected error: ${error.message}`);
});
