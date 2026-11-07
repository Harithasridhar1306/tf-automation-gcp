# GCP Load Balancer Explorer

An interactive, browser-based learning lab for understanding the request path through a **global external Google Cloud Application Load Balancer**.

## What is included

- Clickable request-flow architecture: client, frontend IP, forwarding rule, target HTTPS proxy, URL map, backend service, health check, and backend workload.
- Component inspector with responsibilities, common failure modes, and first troubleshooting checks.
- Break & debug incident scenarios for timeouts, unhealthy backends, incorrect URL routing, and HTTPS certificate errors.
- A knowledge-check question with an explanation.
- No GCP project, credentials, or cloud resources are required. The lab is a conceptual simulator.

## Run locally

```bash
cd lb-explorer
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

The site is built from `lb-explorer/` and deployed to the repository's GitHub Pages root.

1. Merge the explorer into `main`.
2. In GitHub, open **Settings → Pages**.
3. Set **Build and deployment → Source** to **GitHub Actions**.
4. Run the **Deploy GCP Load Balancer Explorer** workflow (or push a later change under `lb-explorer/`).
5. The site will be published at:

   https://harithasridhar1306.github.io/tf-automation-gcp/

The existing Python CLI and Terraform infrastructure at the repository root are kept separate and unchanged.

## Important scope

This first version teaches the global external Application Load Balancer request path. Regional/internal Application Load Balancers and proxy or passthrough Network Load Balancers have different resource models, traffic paths, and firewall requirements; they should be added as separate learning modules rather than treated as identical.

## Tech stack

React · TypeScript · Vite · GitHub Actions · GitHub Pages
