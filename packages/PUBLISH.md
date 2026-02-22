# Publishing IOProof Packages

## Prerequisites

- Node.js + npm installed
- Python 3 + pip + build + twine installed
- Docker installed (for Docker Hub)

---

## 1. npm (3 packages)

### First time: login + create org

```bash
# Login to npm (use alekblom GitHub OAuth or create npm account)
npm login

# Create the @ioproof org (needed for scoped packages)
# Go to https://www.npmjs.com/org/create and create "ioproof" org
# Or: npm org create ioproof
```

### Publish packages

```bash
# Main package
cd packages/npm/ioproof
npm publish

# Scoped packages (--access public required for free orgs)
cd ../core
npm publish --access public

cd ../client
npm publish --access public
```

---

## 2. PyPI

### First time: create account

1. Go to https://pypi.org/account/register/
2. Register with your email
3. Enable 2FA (required for new accounts)
4. Create an API token at https://pypi.org/manage/account/token/

### Publish

```bash
cd packages/pypi

# Install build tools (if not already)
pip install build twine

# Build
python -m build

# Upload (will prompt for API token)
twine upload dist/*
```

---

## 3. Docker Hub

### First time: login

```bash
# Login (use alekblom GitHub OAuth or create Docker Hub account)
docker login
```

### Build and push

```bash
# From the ioproof.com root directory (not packages/docker)
cd /home/internetieruser/ioproof.com

docker build -t alekblom/ioproof:latest -f packages/docker/Dockerfile .
docker push alekblom/ioproof:latest
```

---

## Summary of names to register

| Registry | Name | URL |
|---|---|---|
| npm | `ioproof` | https://www.npmjs.com/package/ioproof |
| npm | `@ioproof/core` | https://www.npmjs.com/package/@ioproof/core |
| npm | `@ioproof/client` | https://www.npmjs.com/package/@ioproof/client |
| PyPI | `ioproof` | https://pypi.org/project/ioproof/ |
| Docker Hub | `alekblom/ioproof` | https://hub.docker.com/r/alekblom/ioproof |

## Accounts needed

- **npm**: Sign in with GitHub (alekblom) — no new account needed
- **PyPI**: New account at pypi.org — separate registration required
- **Docker Hub**: Sign in with GitHub (alekblom) — no new account needed
