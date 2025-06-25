variable "vpc_name" {
  type = string
}

variable "subnets" {
  type = list(object({
    name   = string
    cidr   = string
    region = string
  }))
}

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "credentials_file" {
  type = string
}
