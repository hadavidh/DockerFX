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

variable "staging_domain" {
  description = "Nom de domaine du staging"
  type        = string
  default     = "staging.dockerfx.trade"
}

variable "ssl_dir" {
  description = "Dossier VPS contenant les certificats Cloudflare Origin CA"
  type        = string
  default     = "/home/ubuntu/dockerFX/ssl"
}

variable "prod_port" {
  description = "Port HTTP public du gateway"
  type        = number
  default     = 80
}

variable "prod_https_port" {
  description = "Port HTTPS public du gateway"
  type        = number
  default     = 443
}

variable "prod_origin_https_port" {
  description = "Port HTTPS interne de l'origin prod, derrière le gateway"
  type        = number
  default     = 8443
}

variable "staging_port" {
  description = "Port HTTP local du staging, consommé par le gateway"
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

# ════════════════════════════════════════════════════════════════
# VARIABLES MONITORING
# ════════════════════════════════════════════════════════════════

variable "project_dir" {
  description = "Chemin absolu du projet sur le VPS"
  type        = string
  default     = "/home/ubuntu/dockerFX"
}

variable "grafana_port" {
  description = "Port public Grafana"
  type        = number
  default     = 3000
}

variable "prometheus_port" {
  description = "Port interne Prometheus (non exposé public)"
  type        = number
  default     = 9090
}

variable "grafana_admin_user" {
  description = "Login admin Grafana"
  type        = string
  default     = "admin"
}

variable "grafana_admin_password" {
  description = "Mot de passe admin Grafana"
  type        = string
  default     = "ict-trading-2026"
  sensitive   = true
}

variable "grafana_datasource_uid" {
  description = "UID fixe de la datasource Prometheus dans Grafana"
  type        = string
  default     = "PBFA97CFB590B2093"
}

# ════════════════════════════════════════════════════════════════
# VARIABLES ALERTING TELEGRAM
# Fix chatid : type string pour éviter que Grafana lise un integer
# ════════════════════════════════════════════════════════════════

variable "telegram_token" {
  description = "Token du bot Telegram pour les alertes Grafana"
  type        = string
  sensitive   = true
  default     = ""
}

variable "telegram_chatid" {
  description = "Chat ID Telegram — string forcée pour Grafana (évite integer YAML)"
  type        = string
  default     = ""
}
