import { ethers } from 'ethers';
import axios from 'axios';
import { promptText, getCurTimeStampInSecond, generateUUID } from '../utils';
import logger from '../logger';

const SignatureAlogorithm = {
    ECDSA: 0,
};
const Action = {
    Add: 0,
    Remove: 1,
};

async function addAuthAddress() {
    try {
        // Prompt user for domain
        const terminusName = await promptText(
            'The script will add the [authAddresses] tag to a terminus domain, Enter the terminus domain: ',
        );

        // Prompt user for wallet address
        const walletAddress = await promptText(`Enter the wallet address to be added: `);

        // Validate wallet address
        if (!ethers.isAddress(walletAddress)) {
            throw new Error('Invalid wallet address');
        }

        // Prompt user for private key
        const privateKey = await promptText('Enter the private key for the wallet address: ');

        // Create a wallet instance
        let wallet: ethers.Wallet;
        try {
            wallet = new ethers.Wallet(privateKey);
        } catch {
            throw new Error('Invalid private key');
        }

        // Ensure the wallet address matches the provided address
        if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error('The provided private key does not match the wallet address');
        }

        const chainId = 10;
        const rootTaggerAddr = '0xE2EABA0979277A90511F8873ae1e8cA26B54E740';
        const domain = {
            name: 'Terminus DID Root Tagger',
            version: '1',
            chainId: chainId,
            verifyingContract: rootTaggerAddr,
        };

        logger.info(`EIP712 Domain: ${JSON.stringify(domain)}`);

        const types = {
            AuthAddressReq: [
                { name: 'addr', type: 'address' },
                { name: 'algorithm', type: 'uint8' },
                { name: 'domain', type: 'string' },
                { name: 'signAt', type: 'uint256' },
                { name: 'action', type: 'uint8' },
            ],
        };

        const value = {
            addr: wallet.address,
            algorithm: SignatureAlogorithm.ECDSA,
            domain: terminusName,
            signAt: getCurTimeStampInSecond(),
            action: Action.Add,
        };

        logger.info(`Signing data: ${JSON.stringify(value)}`);

        const walletSig = await wallet.signTypedData(domain, types, value);
        logger.info(`Wallet Signature: ${walletSig}`);

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

        // Send POST request to DID-HTTP server
        const didResponse = await axios.post(didHttpUrl, {
            uuid,
            calls: [
                {
                    target: 'tag',
                    method: 'addAuthenticationAddress',
                    args: {
                        authAddressReq: value,
                        sigFromAddressPrivKey: walletSig,
                        sigFromDomainOwnerPrivKey: vaultSig,
                    },
                },
            ],
        });

        logger.info(`DID-HTTP Response: ${JSON.stringify(didResponse.data)}`);
    } catch (error) {
        logger.error(`Error adding wallet address: ${(error as Error).message}`);
    }
}

addAuthAddress().catch((error) => {
    logger.error(`Unexpected error: ${error.message}`);
});
