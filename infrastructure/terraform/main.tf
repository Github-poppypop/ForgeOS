terraform {
  required_version = ">= 1.3.0"

  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

variable "vps_host" {
  type        = string
  description = "ForgeOS VPS host"
}

variable "ssh_user" {
  type        = string
  description = "SSH user used to connect to the ForgeOS VPS"
  default     = "root"
}

variable "ssh_private_key_path" {
  type        = string
  description = "Path to the SSH private key used to authenticate against the VPS"
  default     = "~/.ssh/hostinger_vps"
}

resource "null_resource" "forgeos_deploy" {
  triggers = {
    vps_host            = var.vps_host
    ssh_user            = var.ssh_user
    deploy_command_sha  = sha256("cd /opt/forgeos && git pull && pm2 restart forgeos")
  }

  provisioner "remote-exec" {
    inline = [
      "cd /opt/forgeos && git pull && pm2 restart forgeos",
    ]

    connection {
      type        = "ssh"
      host        = var.vps_host
      user        = var.ssh_user
      port        = 2222
      private_key = file(var.ssh_private_key_path)
    }
  }
}

output "vps_host" {
  description = "The ForgeOS VPS host provisioned by this configuration"
  value       = var.vps_host
}
