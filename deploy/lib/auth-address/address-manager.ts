import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
// @ts-ignore - toml package doesn't have TypeScript types
import toml from "toml";
import { exec } from "child_process";
import { promisify } from "util";
import { to } from "await-to-js";
import bs58 from "bs58";
import { WalletUtils } from "./wallet-utils";

const execAsync = promisify(exec);

// Configuration data interface
interface ConfigData {
  owner?: {
    olares_id?: string;
    mnemonic?: string;
  };
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
  address: string;
  chainName: string;
  keyName: string;
  privateKey: string;
}

class AddressManager {
  private walletUtils: WalletUtils;

  constructor() {
    this.walletUtils = new WalletUtils();
  }

  async readConfig(keysFile: string): Promise<ConfigData> {
    const [readError, configContent] = await to(fs.promises.readFile(keysFile, "utf8"));
    if (readError) {
      throw new Error(`Failed to read keys.toml file: ${readError.message}`);
    }
    return toml.parse(configContent);
  }

  getAccountKeys(config: ConfigData): string[] {
    const skipKeys = ["global", "owner"];
    return Object.keys(config).filter(key => !skipKeys.includes(key));
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

  async deriveAddress(privateKey: string, chainName: string): Promise<string | null> {
    try {
      if (chainName === 'solana') {
        const { Keypair } = await import("@solana/web3.js");
        const secretKeyUint8 = bs58.decode(privateKey);
        const keypair = Keypair.fromSecretKey(secretKeyUint8);
        return keypair.publicKey.toBase58();
      } else {
        // Use WalletUtils for EVM address derivation
        return this.walletUtils.deriveAddressFromPrivateKey(privateKey);
      }
    } catch (error) {
      console.error(`❌ Failed to derive address for ${chainName}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Get address from owner mnemonic
   * @param mnemonic - The mnemonic phrase
   * @returns The derived address
   */
  async getOwnerAddressFromMnemonic(mnemonic: string): Promise<string> {
    try {
      await this.walletUtils.init();
      const { address } = await this.walletUtils.deriveAddressFromMnemonic(mnemonic);
      return address;
    } catch (error) {
      console.error(`❌ Failed to derive owner address from mnemonic:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async listRegisteredAddresses(domain: string, chainType: string): Promise<string[]> {
    const cmd = `npx did-cli wallet ${chainType} list ${domain} --network mainnet`;

    try {
      const { stdout, stderr } = await execAsync(cmd, { env: { ...process.env, NODE_NO_WARNINGS: '1' } });

      if (stderr && !stderr.includes('Warning')) {
        console.warn(`Warning from CLI: ${stderr}`);
      }

      const lines = stdout.split('\n');
      const addresses: string[] = [];

      for (const line of lines) {
        // Match addresses in numbered list format: "   1. 0x..."
        const match = line.match(/^\s*\d+\.\s+(0x[a-fA-F0-9]{40}|[a-zA-Z0-9]{32,44})/);
        if (match && match[1]) {
          addresses.push(match[1]);
        } else if (line.includes('No addresses found')) {
          return [];
        }
      }

      return addresses;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No addresses found')) {
        return [];
      }
      console.error(`❌ Failed to list ${chainType} addresses:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  async registerAddress(ownerMnemonic: string, registerPrivateKey: string, chainName: string, domain: string): Promise<boolean> {
    const env: { [key: string]: string | undefined } = { ...process.env, NODE_NO_WARNINGS: '1' };

    if (chainName === 'solana') {
      env.SOLANA_PRIVATE_KEY = registerPrivateKey;
    } else {
      env.EVM_PRIVATE_KEY = registerPrivateKey;
    }
    env.PRIVATE_KEY_OR_MNEMONIC = ownerMnemonic;

    const chainType = chainName === 'solana' ? 'solana' : 'evm';
    const cmd = `npx did-cli wallet ${chainType} add ${domain} --network mainnet`;

    try {
      const { stdout, stderr } = await execAsync(cmd, { env });

      if (stderr && !stderr.includes('Warning')) {
        console.warn(`Warning: ${stderr}`);
      }

      return stdout.includes('successfully') || stdout.includes('Successfully');
    } catch (error) {
      console.error(`❌ Failed to register ${chainName} address:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async run(): Promise<void> {
    try {
      console.log("[System] INFO: Starting address manager...");

      const keysFile = path.join(__dirname, "../../", "keys.toml");
      const config = await this.readConfig(keysFile);

      let domain = config.owner?.olares_id;
      if (!domain) {
        throw new Error("owner.olares_id not set in keys.toml");
      }
      
      // Normalize domain: trim spaces and replace @ with .
      domain = domain.trim().replace('@', '.');
      console.log(`[System] INFO: Domain: ${domain}`);

      const ownerMnemonic = config.owner?.mnemonic;
      if (!ownerMnemonic) {
        throw new Error("owner.mnemonic not set in keys.toml");
      }
      console.log("[System] INFO: Owner mnemonic configured");

      const accountKeys = this.getAccountKeys(config);
      console.log(`[Keys] Found ${accountKeys.length} chains: ${accountKeys.join(', ')}`);

      const allAddresses: AddressInfo[] = [];
      let totalKeyCount = 0;

      for (const chainName of accountKeys) {
        const chainData = config[chainName];
        const privateKeys = this.extractPrivateKeys(chainData);

        if (privateKeys.length === 0) {
          continue;
        }

        console.log(`[Keys] ${chainName}: Found ${privateKeys.length} private keys`);
        totalKeyCount += privateKeys.length;

        for (const { keyName, privateKey } of privateKeys) {
          const address = await this.deriveAddress(privateKey, chainName);
          if (address) {
            allAddresses.push({
              address,
              chainName,
              keyName,
              privateKey
            });
          }
        }
      }

      console.log(`[Keys] Total: ${totalKeyCount} private keys across all chains\n`);

      const evmAddresses = allAddresses.filter(item => item.chainName !== 'solana');
      const solanaAddresses = allAddresses.filter(item => item.chainName === 'solana');

      const registeredEVM = await this.listRegisteredAddresses(domain, 'evm');
      const registeredSolana = await this.listRegisteredAddresses(domain, 'solana');

      // Print registered addresses
      if (registeredEVM.length > 0) {
        console.log("[INFO] Already registered EVM addresses:");
        registeredEVM.forEach(addr => console.log(`  - ${addr}`));
        console.log("");
      } else {
        console.log("[INFO] No EVM addresses registered yet\n");
      }

      if (registeredSolana.length > 0) {
        console.log("[INFO] Already registered Solana addresses:");
        registeredSolana.forEach(addr => console.log(`  - ${addr}`));
        console.log("");
      } else {
        console.log("[INFO] No Solana addresses registered yet\n");
      }

      if (evmAddresses.length > 0) {
        console.log(`[EVM] Checking ${evmAddresses.length} EVM addresses...`);
        for (const item of evmAddresses) {
          const isRegistered = registeredEVM.some(reg =>
            reg.toLowerCase() === item.address.toLowerCase()
          );

          if (isRegistered) {
            console.log(`[EVM] ✓ ${item.chainName} ${item.keyName}: ${this.formatAddress(item.address)} → OK (registered)`);
          } else {
            console.log(`[EVM] • ${item.chainName} ${item.keyName}: ${this.formatAddress(item.address)} → Registering...`);
            const success = await this.registerAddress(ownerMnemonic, item.privateKey, item.chainName, domain);
            if (success) {
              console.log(`[EVM] ✓ ${item.chainName} ${item.keyName}: ${this.formatAddress(item.address)} → Registered (new)`);
            } else {
              console.log(`[EVM] ✗ ${item.chainName} ${item.keyName}: ${this.formatAddress(item.address)} → Failed`);
            }
          }
        }
        console.log("");
      }

      if (solanaAddresses.length > 0) {
        console.log(`[Solana] Checking ${solanaAddresses.length} Solana addresses...`);
        for (const item of solanaAddresses) {
          const isRegistered = registeredSolana.includes(item.address);

          if (isRegistered) {
            console.log(`[Solana] ✓ ${item.keyName}: ${this.formatAddress(item.address, 'solana')} → OK (registered)`);
          } else {
            console.log(`[Solana] • ${item.keyName}: ${this.formatAddress(item.address, 'solana')} → Registering...`);
            const success = await this.registerAddress(ownerMnemonic, item.privateKey, 'solana', domain);
            if (success) {
              console.log(`[Solana] ✓ ${item.keyName}: ${this.formatAddress(item.address, 'solana')} → Registered (new)`);
            } else {
              console.log(`[Solana] ✗ ${item.keyName}: ${this.formatAddress(item.address, 'solana')} → Failed`);
            }
          }
        }
        console.log("");
      }

      console.log(`[Complete] INFO: Processed ${allAddresses.length} addresses`);
    } finally {
      // Clean up WASM resources to prevent memory leaks
      this.walletUtils.cleanup();
    }
  }

  formatAddress(address: string, type: string = 'evm'): string {
    if (!address) return 'N/A';

    if (type === 'solana') {
      return address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-8)}` : address;
    } else {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
  }
}

async function main(): Promise<void> {
  try {
    const manager = new AddressManager();
    await manager.run();
  } catch (error) {
    console.error("[Error] Program failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

export { AddressManager };
export type { ConfigData, PrivateKeyInfo, AddressInfo };