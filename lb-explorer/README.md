# GCP Load Balancer Explorer

An interactive learning lab for Google Cloud Load Balancing, hosted with GitHub Pages.

## Experiences

- **Load Balancer simulator** — compare Application, proxy Network and passthrough Network Load Balancers; simulate request traffic, backend policies, session affinity and failure scenarios.
- **Application Load Balancer Explorer** — a guided, step-by-step ALB learning experience with a clickable resource chain, component inspector, global-vs-regional proxy architecture, request simulator, backend failure toggles, incident workbench and knowledge checks.

## Open the learning experiences

- Main multi-load-balancer simulator: https://harithasridhar1306.github.io/tf-automation-gcp/
- Guided Application Load Balancer Explorer: https://harithasridhar1306.github.io/tf-automation-gcp/alb.html

## ALB Explorer topics

- Client/DNS → forwarding rule → target proxy → URL map → backend service → NEG → endpoint.
- Global external ALB (GFE) versus regional external ALB (Envoy and proxy-only subnet).
- Separate client-to-proxy and proxy-to-backend connections.
- Backend firewall source versus frontend VIP.
- Health checks as a separate probe path, not a user-request hop.
- Host/path routing, backend selection, endpoint health and troubleshooting.

## Run locally

```bash
cd lb-explorer
npm install
npm run dev
```

The default Vite dev server opens the main simulator. Visit `/alb.html` for the guided ALB experience.

## Build and test

```bash
npm run build
npm run preview
```

The GitHub Actions workflow builds both pages and deploys the generated `dist/` directory to GitHub Pages. The build is also run for pull requests touching `lb-explorer/**`.

## Scope and accuracy

This is a conceptual browser simulator. It does not provision GCP resources, make requests to a live GCP project, or require cloud credentials. The traffic generator and incident scenarios are teaching simulations.

The global and regional external ALB modes are intentionally shown separately. For regional external ALBs, Envoy proxies use addresses from the proxy-only subnet for backend connections. That subnet is not a router and is not an intermediate hop traversed by the client's original packet. Health checks are separate probes. Always verify firewall source ranges and feature support against the exact load-balancer product and backend type in the official Google Cloud documentation.

## Stack

React · TypeScript · Vite · Lucide · GitHub Actions · GitHub Pages
