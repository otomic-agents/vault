# Deployment Steps

## 1. Download vault source code for the specific version
```bash
curl -sSL https://github.com/otmoic/vault/releases/latest/download/install.sh | bash -s v1.2.3
```

## 2. Generate configuration template
```bash
./panel.sh generate-config
```

## 3. Edit configuration files
```bash
vi keys.toml    # Fill in wallet information, can be deleted after first run
vi config.toml  # Mainly fill in lp ip, keep for future server configuration override
```

## 4. Start service
```bash
./panel.sh start
```