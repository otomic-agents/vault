import { ethers } from 'ethers';
import axios from 'axios';
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
            'The script will add the [evmWallets] tag to a terminus domain, Enter the terminus domain: ',
        );

        // Prompt user for domain owner private key
        const domainOwnerPrivateKey = await promptText('Enter the private key for the terminus domainn owner: ');

        // Create a wallet instance
        let domainOwner: ethers.Wallet;
        try {
            domainOwner = new ethers.Wallet(domainOwnerPrivateKey);
        } catch {
            throw new Error('Invalid private key');
        }

        // Prompt user for wallet address
        const vaultAddress = await promptText(`Enter the Evm wallet address (vault address) to be added: `);

        // Validate wallet address
        if (!ethers.isAddress(vaultAddress)) {
            throw new Error('Invalid vault address');
        }

        const chainId = 10;
        const rootTaggerAddr = '0x7e7961aB771cA942CE4DB6e79579e016a33Dc95B';

        const domain = {
            name: 'Terminus DID Root Tagger',
            version: '1',
            chainId: chainId,
            verifyingContract: rootTaggerAddr,
        };

        logger.info(`EIP712 Domain: ${JSON.stringify(domain)}`);

        const types = {
            EVMAuthAddressReq: [
                { name: 'addr', type: 'address' },
                { name: 'domain', type: 'string' },
                { name: 'signAt', type: 'uint256' },
                { name: 'action', type: 'uint8' },
            ],
        };

        const value = {
            addr: vaultAddress,
            domain: terminusName,
            signAt: getCurTimeStampInSecond(),
            action: Action.Add,
        };

        logger.info(`Signing data: ${JSON.stringify(value)}`);

        const domainOwnerSig = await domainOwner.signTypedData(domain, types, value);
        logger.info(`Domain owner signature: ${domainOwnerSig}`);

        // Prompt user for vault url
        const vaultUrl = await promptText('Enter the vault URL (e.g., http://127.0.0.1/lp/9006/signEIP712): ');

        // Send POST request to vault URL to get signature from vault wallet
        const response = await axios.post(vaultUrl, {
            domain,
            types,
            signData: value,
        });

        const vaultSig = response.data.signature;
        const vaultAddressRet = response.data.publicKey as string;
        if (vaultAddressRet.toLocaleLowerCase() !== vaultAddress.toLocaleLowerCase()) {
            throw new Error('The vault address returned by the vault is not the same as the address provided');
        }
        logger.info(`Vault Signature: ${vaultSig} from vault ${vaultAddressRet}`);

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
                    method: 'updateEVMWallet',
                    args: {
                        evmAuthAddressReq: value,
                        sigFromDomainOwnerPrivKey: domainOwnerSig,
                        sigFromAddressPrivKey: vaultSig,
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
