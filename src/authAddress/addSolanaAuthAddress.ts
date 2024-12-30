import { PublicKey } from '@solana/web3.js';
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
            'The script will add the [solanaWallets] tag to a olares domain, Enter the olares domain: ',
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
        const vaultAddressStr = await promptTextNoDefault(
            `Enter the Solana wallet address ata the vault address (bs58 format) to be added: `,
        );

        // Validate wallet address
        let vaultAddress: PublicKey;
        try {
            vaultAddress = new PublicKey(vaultAddressStr);
        } catch {
            throw new Error('Invalid Solana wallet address');
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
            addr: '0x' + vaultAddress.toBuffer().toString('hex'),
            domain: terminusName,
            signAt: getCurTimeStampInSecond(),
            action: Action.Add,
        };

        logger.info(`Signing data: ${JSON.stringify(value)}`);

        const domainOwnerSig = await domainOwner.signTypedData(domain, types, value);
        logger.info(`Domain owner signature: ${domainOwnerSig}`);

        const solanaMsg =
            'prove ownership of Solana wallet ' + vaultAddress.toBase58() + ' for Terminus DID ' + value.domain;
        logger.info(`Vault solana signing msg: ${solanaMsg}`);

        // Prompt user for vault url
        const vaultUrl = await promptText('Enter the vault URL ', 'http://127.0.0.1:19000/lp/501/signEIP712');

        // Send POST request to vault URL to get signature from vault wallet
        const response = await axios.post(vaultUrl, {
            message: solanaMsg,
        });

        const vaultSig = '0x' + response.data.signature;
        const vaultAddressRet = response.data.publicKey as string;
        if (vaultAddressRet.toLocaleLowerCase() !== vaultAddress.toBase58().toLocaleLowerCase()) {
            throw new Error('The vault address returned by the vault is not the same as the address provided');
        }
        logger.info(`Vault Signature: ${vaultSig} from vault ${vaultAddress}`);

        const uuid = generateUUID();
        logger.info(`DID-HTTP uuid: ${uuid}, it can be used to query the status of the request`);
        // Send POST request to DID-HTTP server
        const didHttpServiceUrl = 'https://did-gate-v3.bttcdn.com/addAuthenticationAddressV2';
        const didResponse = await axios.post(didHttpServiceUrl, {
            sigFromAddressPrivKey: vaultSig,
            sigFromDomainOwnerPrivKey: domainOwnerSig,
            authAddressReq: {
                addr: value.addr,
                algorithm: SignatureAlogorithm.Ed25519,
                domain: value.domain,
                signAt: value.signAt,
                action: value.action,
                chain: Chain.Solana,
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
