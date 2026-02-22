# IOProof Docker Image

Run IOProof as a Docker container for self-hosted deployments.

## Quick start

```bash
docker run -d \
  -p 3000:3000 \
  -v ioproof-data:/app/data \
  -e SOLANA_KEYPAIR_SECRET='[your,key,bytes]' \
  -e REQUIRE_API_KEY=false \
  -e BASE_URL=https://proof.yourdomain.com \
  alekblom/ioproof
```

## With docker-compose

```yaml
services:
  ioproof:
    image: alekblom/ioproof
    ports:
      - "3000:3000"
    volumes:
      - ioproof-data:/app/data
    environment:
      - SOLANA_KEYPAIR_SECRET=[your,key,bytes]
      - REQUIRE_API_KEY=false
      - BASE_URL=https://proof.yourdomain.com

volumes:
  ioproof-data:
```

## Build from source

```bash
git clone https://github.com/alekblom/ioproof.git
cd ioproof
docker build -t ioproof -f packages/docker/Dockerfile .
docker run -d -p 3000:3000 -v ioproof-data:/app/data ioproof
```

## Links

- [Website](https://ioproof.com)
- [GitHub](https://github.com/alekblom/ioproof)
