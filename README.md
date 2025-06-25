#  GCP Infrastructure CLI with Terraform & Python

A DevOps automation tool to provision Google Cloud resources using Terraform through a terminal-based Python CLI.

> ✅ Enable GCP APIs  
> ✅ Create VPCs and Subnets  
> ⏳ GKE Clusters and GCS Buckets (coming soon)  
> 🧪 Easy to test with dummy credentials locally

---

## 🛠 Features

| Feature                  | Description                                   |
|--------------------------|-----------------------------------------------|
| 🔧 Create VPC + Subnets  | Define VPC name, subnets, region              |
| ⚙️ Enable GCP APIs       | Enable services like `compute.googleapis.com` |
| 📦 Infra as Code         | Managed using Terraform modules               |
| 🐍 CLI Powered by        | `click` Python package                        |
| 🔜 Coming Soon           | GKE clusters, GCS buckets, GitHub Actions     |

---

##  Project Structure

.
├── infracli.py # Main Python CLI script
├── terraform-gcp-creds.json # GCP service account (or dummy JSON)
├── infra/
│ ├── main.tf # VPC logic
│ ├── variables.tf
│ └── terraform.tfvars.json # auto-generated
│
└── infra/enable_service/
├── main.tf # API enabling logic
├── variables.tf
└── terraform.tfvars.json # auto-generated


