#!/usr/bin/env python3

import json
import subprocess
import sys
import click

def run_terraform(cmd_args, cwd="infra"):
    subprocess.run(["terraform"] + cmd_args, cwd=cwd, check=True)

@click.group()
def cli():
    """DevOps CLI for GCP infra provisioning."""
    pass

@cli.command()
@click.option("--name", prompt="VPC name", help="Name of the VPC to create")
@click.option("--subnets", default=1, help="Number of /16 subnets to create")
@click.option("--project", prompt="GCP project ID", help="Your GCP project ID")
@click.option("--region", default="us-central1", help="GCP region")
def create_vpc(name, subnets, project, region):
    """Create a custom VPC and subnets."""
    subs = [
        {
            "name": f"{name}-subnet-{i+1}",
            "cidr": f"10.{10+i}.0.0/16",
            "region": region
        }
        for i in range(subnets)
    ]

    tfvars = {
        "vpc_name": name,
        "subnets": subs,
        "project_id": project,
        "region": region,
        "credentials_file": "terraform-gcp-creds.json"
    }

    with open("infra/terraform.tfvars.json", "w") as f:
        json.dump(tfvars, f, indent=2)

    click.echo("terraform.tfvars.json written.")
    run_terraform(["init"])
    run_terraform(["plan", "-var-file=terraform.tfvars.json"])
    click.confirm("Apply these changes?", abort=True)
    run_terraform(["apply", "-auto-approve", "-var-file=terraform.tfvars.json"])
    click.echo("VPC and subnets created!")

@cli.command()
@click.option("--name", prompt="GCP service name", help="The API service name (e.g., compute.googleapis.com)")
@click.option("--project", prompt="GCP project ID", help="Your GCP project ID")
def enable_service(name, project):
    """Enable a GCP API (like compute.googleapis.com)."""
    tfvars = {
        "project_id": project,
        "service_name": name,
        "credentials_file": "../../terraform-gcp-creds.json"  # Adjust path if needed
    }

    module_dir = "infra/enable_service"
    tfvars_path = f"{module_dir}/terraform.tfvars.json"

    with open(tfvars_path, "w") as f:
        json.dump(tfvars, f, indent=2)

    click.echo("Service tfvars written.")
    run_terraform(["init"], cwd=module_dir)
    run_terraform(["plan", "-var-file=terraform.tfvars.json"], cwd=module_dir)
    click.confirm("Apply this service?", abort=True)
    run_terraform(["apply", "-auto-approve", "-var-file=terraform.tfvars.json"], cwd=module_dir)
    click.echo("GCP service enabled!")

# === Entry point: menu + CLI ===
if __name__ == "__main__":
    if len(sys.argv) > 1:
        # CLI mode with arguments
        cli()
    else:
        # Interactive menu mode
        print(" Welcome to GCP Infra CLI\n")
        print("What would you like to do?")
        print("1. Enable a GCP API")
        print("2. Create a VPC and Subnets")
        print("3. Create a GKE Cluster (coming soon)")
        print("4. Create a GCS Bucket (coming soon)")
        print("5. Exit")

        choice = click.prompt("Enter your choice", type=int)

        if choice == 1:
            name = click.prompt("GCP service name (e.g., compute.googleapis.com)")
            project = click.prompt("GCP project ID")
            enable_service.callback(name=name, project=project)

        elif choice == 2:
            name = click.prompt("VPC name")
            subnets = click.prompt("Number of /16 subnets", type=int)
            project = click.prompt("GCP project ID")
            region = click.prompt("GCP region", default="us-central1")
            create_vpc.callback(name=name, subnets=subnets, project=project, region=region)

        elif choice == 3:
            print(" GKE Cluster creation coming soon!")

        elif choice == 4:
            print(" GCS Bucket creation coming soon!")

        elif choice == 5:
            print("Goodbye!")
            sys.exit(0)

        else:
            print("Invalid choice")
