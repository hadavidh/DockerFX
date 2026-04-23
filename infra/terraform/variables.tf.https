variable "vps_ip" {
  description = "IP publique du VPS OVH"
  type        = string
  default     = "135.125.196.204"
}

variable "vps_user" {
  description = "Utilisateur SSH du VPS"
  type        = string
  default     = "ubuntu"
}

variable "project_name" {
  description = "Nom du projet"
  type        = string
  default     = "ict-trading"
}

variable "backend_image" {
  description = "Image Docker backend (DockerHub)"
  type        = string
  default     = "dave67000/ict-trading-backend"
}

variable "frontend_image" {
  description = "Image Docker frontend (DockerHub)"
  type        = string
  default     = "dave67000/ict-trading-frontend"
}

variable "domain_name" {
  description = "Nom de domaine principal de la production"
  type        = string
  default     = "dockerfx.trade"
}

variable "domain_www" {
  description = "Sous-domaine WWW de la production"
  type        = string
  default     = "www.dockerfx.trade"
}

variable "ssl_dir" {
  description = "Dossier VPS contenant les certificats Cloudflare Origin CA"
  type        = string
  default     = "/home/ubuntu/dockerFX/ssl"
}

variable "prod_port" {
  description = "Port HTTP production"
  type        = number
  default     = 80
}

variable "prod_https_port" {
  description = "Port HTTPS production"
  type        = number
  default     = 443
}

variable "staging_port" {
  description = "Port HTTP staging"
  type        = number
  default     = 8080
}

variable "backend_prod_port" {
  description = "Port interne backend production"
  type        = number
  default     = 3001
}

variable "backend_staging_port" {
  description = "Port interne backend staging"
  type        = number
  default     = 3002
}