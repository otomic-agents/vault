import { ethers } from 'ethers';
import axios from 'axios';
import { promptText, getCurTimeStampInSecond, generateUUID, promptTextNoDefault } from '../utils';
import logger from '../logger';

const Action = {
    Add: 0,
    Remove: 1,
};

const SignatureAlogorithm = {
    ECDSA: 0,
    Ed25519: 1,
};

const Chain = {
    EVM: 'evm',
    Solana: 'solana',
};

async function addEvmAuthAddress() {
    try {
        // Prompt user for domain
        const terminusName = await promptTextNoDefault(
            'The script will add the [evmWallets] tag to a olares domain, Enter the olares domain: ',
        );

        // Prompt user for domain owner private key
        const domainOwnerPrivateKey = await promptTextNoDefault('Enter the private key for the olares domainn owner: ');

        // Create a wallet instance
        let domainOwner: ethers.Wallet;
        try {
            domainOwner = new ethers.Wallet(domainOwnerPrivateKey);
        } catch {
            throw new Error('Invalid private key');
        }

        // Prompt user for wallet address
        let vaultAddress = await promptTextNoDefault(`Enter the Evm wallet address (vault address) to be added: `);

        if (!vaultAddress.startsWith('0x')) {
            vaultAddress = `0x${vaultAddress}`
        }

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
        const vaultUrl = await promptText('Enter the vault URL', 'http://127.0.0.1:19000/lp/9006/signEIP712');

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

        const uuid = generateUUID();
        logger.info(`DID-HTTP uuid: ${uuid}, it can be used to query the status of the request`);
        // Send POST request to DID-HTTP server
        const didHttpServiceUrl = 'https://did-gate-v3.bttcdn.com/addAuthenticationAddressV2';
        const didResponse = await axios.post(didHttpServiceUrl, {
            sigFromAddressPrivKey: vaultSig,
            sigFromDomainOwnerPrivKey: domainOwnerSig,
            authAddressReq: {
                addr: value.addr,
                algorithm: SignatureAlogorithm.ECDSA,
                domain: value.domain,
                signAt: value.signAt,
                action: value.action,
                chain: Chain.EVM,
            },
            uuid: uuid,
            index: 0,
        });

        logger.info(`DID-HTTP Response: ${JSON.stringify(didResponse.data)}`);
    } catch (error) {
        logger.error(`Error adding wallet address: ${(error as Error).message}`);
    }
}

addEvmAuthAddress().catch((error) => {
    logger.error(`Unexpected error: ${error.message}`);
});
