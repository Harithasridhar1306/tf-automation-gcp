provider "google" {
  credentials = file(var.credentials_file)
  project     = var.project_id
  region      = "us-central1"
}

resource "google_project_service" "this" {
  project = var.project_id
  service = var.service_name
}
