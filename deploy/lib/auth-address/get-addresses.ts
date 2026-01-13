#!/usr/bin/env node

import fs from "fs";
import path from "path";
// @ts-ignore - toml package doesn't have TypeScript types
import toml from "toml";
import { Web3 } from "web3";
import bs58 from "bs58";

// Configuration data interface
interface ConfigData {
  [key: string]: any;
}

// Private key info interface
interface PrivateKeyInfo {
  keyName: string;
  index: string;
  privateKey: string;
}

// Address info interface
interface AddressInfo {
  keyName: string;
  address: string;
  chainName: string;
}

class AddressGenerator {
  async readConfig(keysFile: string = "keys.toml"): Promise<ConfigData> {
    try {
      const configContent = await fs.promises.readFile(keysFile, "utf8");
      return toml.parse(configContent);
    } catch (error) {
      console.error(`❌ Failed to read keys.toml:`, error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  extractPrivateKeys(chainData: Record<string, any>): PrivateKeyInfo[] {
    return Object.entries(chainData)
      .filter(([key, value]) =>
        key.startsWith('private_key_') &&
        value &&
        value !== "0x" &&
        typeof value === 'string' &&
        value.trim() !== ""
      )
      .map(([key, privateKey]) => ({
        keyName: key,
        index: key.replace('private_key_', ''),
        privateKey: privateKey as string
      }));
  }

  async deriveAddress(privateKey: string, chainName: string): Promise<string> {
    try {
      if (chainName === 'solana') {
        const { Keypair } = await import("@solana/web3.js");
        const secretKeyUint8 = bs58.decode(privateKey);
        const keypair = Keypair.fromSecretKey(secretKeyUint8);
        return keypair.publicKey.toBase58();
      } else {
        const web3 = new Web3();
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        return account.address;
      }
    } catch (error) {
      console.error(`❌ Failed to derive address for ${chainName}:`, error instanceof Error ? error.message : String(error));
      return "";
    }
  }

  formatPrivateKey(privateKey: string, chainName: string): string {
    if (!privateKey || privateKey === "0x") return 'Not set';
    if (chainName === 'solana') {
      return privateKey.length > 10 ? `${privateKey.slice(0, 6)}...${privateKey.slice(-4)}` : privateKey;
    } else {
      return privateKey.length > 10 ? `${privateKey.slice(0, 6)}...${privateKey.slice(-4)}` : privateKey;
    }
  }

  async generateAddresses(chainName?: string): Promise<void> {
    const keysFile = path.join(__dirname, "../..", "keys.toml");
    const config = await this.readConfig(keysFile);

    // Skip global and owner fields
    const chains = Object.keys(config).filter(key =>
      !["global", "owner"].includes(key)
    );

    // If a specific chain is requested, only process that chain
    const chainsToProcess = chainName ? [chainName] : chains;

    for (const chain of chainsToProcess) {
      if (!chains.includes(chain)) {
        continue;
      }

      const chainData = config[chain];
      const privateKeys = this.extractPrivateKeys(chainData);

      if (privateKeys.length === 0) {
        continue;
      }

      // Output formatted information directly: chain keyName: masked_private_key (Address: address)
      for (const { keyName, privateKey } of privateKeys) {
        const address = await this.deriveAddress(privateKey, chain);
        if (address) {
          const maskedKey = this.formatPrivateKey(privateKey, chain);
          console.log(`  ${chain} ${keyName}: ${maskedKey} (Address: ${address})`);
        }
      }
    }
  }
}

async function main(): Promise<void> {
  try {
    const generator = new AddressGenerator();
    const chainName = process.argv[2]; // Optional chain name parameter
    await generator.generateAddresses(chainName);
  } catch (error) {
    console.error("❌ Failed to generate addresses:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();