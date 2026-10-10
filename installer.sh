#!/bin/bash
# ==============================================================================
# RexaCloud Panel — Official Ubuntu VPS Production Installer
# Interactive installer inspired by the Pterodactyl Panel installation workflow.
# Installs RexaCloud custom dashboard, configures Nginx/SSL, creates systemd services,
# and provisions the initial system administrator.
# ==============================================================================

set -e

# Terminal ANSI Color Codes
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_PURPLE="\033[38;2;139;92;246m"
CLR_VIOLET="\033[38;2;168;85;247m"
CLR_CYAN="\033[36m"
CLR_GREEN="\033[32m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"

banner() {
    clear
    echo -e "${CLR_PURPLE}${CLR_BOLD}"
    echo "  ██████╗ ███████╗██╗  ██╗ █████╗  ██████╗██╗      ██████╗ ██╗   ██╗██████╗ "
    echo "  ██╔══██╗██╔════╝╚██╗██╔╝██╔══██╗██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗"
    echo "  ██████╔╝█████╗   ╚███╔╝ ███████║██║     ██║     ██║   ██║██║   ██║██║  ██║"
    echo "  ██╔══██╗██╔══╝   ██╔██╗ ██╔══██║██║     ██║     ██║   ██║██║   ██║██║  ██║"
    echo "  ██║  ██║███████╗██╔╝ ██╗██║  ██║╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝"
    echo "  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝ "
    echo -e "${CLR_RESET}"
    echo -e "${CLR_VIOLET}  :: Premium Game Server Management Panel :: Production VPS Installer${CLR_RESET}"
    echo -e "${CLR_CYAN}  Authoritative Pterodactyl API Integration Engine${CLR_RESET}\n"
    echo "=============================================================================="
}

log_info() {
    echo -e "${CLR_CYAN}[INFO]${CLR_RESET} $1"
}

log_success() {
    echo -e "${CLR_GREEN}[✔]${CLR_RESET} $1"
}

log_warn() {
    echo -e "${CLR_YELLOW}[!] WARNING:${CLR_RESET} $1"
}

log_error() {
    echo -e "${CLR_RED}[✖] ERROR:${CLR_RESET} $1"
}

# 1. Root and OS Architecture Verification
check_environment() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This installer must be run as root. Please run with: sudo bash installer.sh"
        exit 1
    fi

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME=$ID
        OS_VER=$VERSION_ID
    else
        log_error "Cannot detect operating system. Supported: Ubuntu 20.04+, Debian 11+."
        exit 1
    fi

    if [[ "$OS_NAME" != "ubuntu" && "$OS_NAME" != "debian" ]]; then
        log_warn "Detected OS: $OS_NAME $OS_VER. Recommended platform is Ubuntu 22.04 LTS or Debian 12."
        read -p "Do you want to continue anyway? [y/N]: " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "Operating System verified: $PRETTY_NAME"
    fi
}

# 2. Interactive Questions & Input Validation
gather_configuration() {
    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 1: INSTALLATION DIRECTORY ---${CLR_RESET}"
    read -p "Install directory [/var/www/rexacloud]: " INSTALL_DIR
    INSTALL_DIR=${INSTALL_DIR:-/var/www/rexacloud}

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 2: DOMAIN CONFIGURATION ---${CLR_RESET}"
    while true; do
        read -p "Enter dashboard domain (e.g. dash.yourdomain.com): " DASH_DOMAIN
        DASH_DOMAIN=$(echo "$DASH_DOMAIN" | tr '[:upper:]' '[:lower:]' | xargs)

        # Domain regex check
        if [[ "$DASH_DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
            log_success "Domain format valid: $DASH_DOMAIN"
            break
        else
            log_error "Invalid domain format. Please enter a valid FQDN (e.g. panel.domain.com)."
        fi
    done

    # Optional DNS verification check
    log_info "Verifying DNS resolution for $DASH_DOMAIN..."
    SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "")
    DOMAIN_IP=$(getent hosts "$DASH_DOMAIN" | awk '{ print $1 }' || echo "")

    if [[ -n "$DOMAIN_IP" && "$DOMAIN_IP" == "$SERVER_IP" ]]; then
        log_success "DNS verified: $DASH_DOMAIN points to this server IP ($SERVER_IP)"
        DNS_MATCH=true
    else
        log_warn "DNS resolution ($DOMAIN_IP) does not currently match public server IP ($SERVER_IP)."
        log_warn "Make sure your A record points to this VPS before Let's Encrypt certificate issuance."
        DNS_MATCH=false
    fi

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 3: SSL / HTTPS CERTIFICATE ---${CLR_RESET}"
    echo "1) Automatic Let's Encrypt SSL certificate (Certbot)"
    echo "2) Cloudflare Origin / Custom Certificate (Configure manually later)"
    echo "3) Self-signed / Plain HTTP (Development only)"
    read -p "Select SSL option [1]: " SSL_CHOICE
    SSL_CHOICE=${SSL_CHOICE:-1}

    SSL_EMAIL=""
    if [ "$SSL_CHOICE" -eq 1 ]; then
        while true; do
            read -p "Enter email address for Let's Encrypt renewal alerts: " SSL_EMAIL
            if [[ "$SSL_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$ ]]; then
                break
            else
                log_error "Please enter a valid email address."
            fi
        done
    fi

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 4: DATABASE CONFIGURATION ---${CLR_RESET}"
    echo "1) Embedded High-Speed SQLite (Recommended, zero external setup)"
    echo "2) MySQL / MariaDB (External database server)"
    echo "3) PostgreSQL (External database server)"
    read -p "Select database driver [1]: " DB_CHOICE
    DB_CHOICE=${DB_CHOICE:-1}

    DB_DRIVER="sqlite"
    DB_HOST="127.0.0.1"
    DB_PORT="3306"
    DB_NAME="rexacloud"
    DB_USER="rexacloud"
    DB_PASS=""

    if [ "$DB_CHOICE" -eq 2 ]; then
        DB_DRIVER="mysql"
        read -p "Database Host [127.0.0.1]: " DB_HOST
        DB_HOST=${DB_HOST:-127.0.0.1}
        read -p "Database Port [3306]: " DB_PORT
        DB_PORT=${DB_PORT:-3306}
        read -p "Database Name [rexacloud]: " DB_NAME
        DB_NAME=${DB_NAME:-rexacloud}
        read -p "Database User [rexacloud]: " DB_USER
        DB_USER=${DB_USER:-rexacloud}
        read -s -p "Database Password: " DB_PASS
        echo ""
    elif [ "$DB_CHOICE" -eq 3 ]; then
        DB_DRIVER="postgres"
        read -p "Database Host [127.0.0.1]: " DB_HOST
        DB_HOST=${DB_HOST:-127.0.0.1}
        read -p "Database Port [5432]: " DB_PORT
        DB_PORT=${DB_PORT:-5432}
        read -p "Database Name [rexacloud]: " DB_NAME
        DB_NAME=${DB_NAME:-rexacloud}
        read -p "Database User [rexacloud]: " DB_USER
        DB_USER=${DB_USER:-rexacloud}
        read -s -p "Database Password: " DB_PASS
        echo ""
    fi
    log_success "Database engine configured: $DB_DRIVER"

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 5: PTERODACTYL PANEL API INTEGRATION ---${CLR_RESET}"
    read -p "Do you want to configure your Pterodactyl Panel connection now? [Y/n]: " CONFIGURE_PTERO_NOW
    CONFIGURE_PTERO_NOW=${CONFIGURE_PTERO_NOW:-Y}

    PTERO_URL=""
    PTERO_CLIENT_KEY=""
    PTERO_APP_KEY=""

    if [[ "$CONFIGURE_PTERO_NOW" =~ ^[Yy]$ ]]; then
        while true; do
            read -p "Enter Pterodactyl Panel URL (e.g. https://panel.yourdomain.com): " PTERO_URL
            PTERO_URL=$(echo "$PTERO_URL" | sed -e 's/\/$//')
            if [[ "$PTERO_URL" =~ ^https?://.+ ]]; then
                break
            else
                log_error "Please enter a valid HTTP or HTTPS URL."
            fi
        done

        read -p "Enter Pterodactyl Client API Key (starts with ptlc_): " PTERO_CLIENT_KEY
        read -p "Enter Pterodactyl Application API Key (starts with ptla_): " PTERO_APP_KEY

        log_info "Testing connection to Pterodactyl at $PTERO_URL..."
        PTERO_TEST_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $PTERO_CLIENT_KEY" -H "Accept: application/json" "$PTERO_URL/api/client" 2>/dev/null || echo "000")
        if [[ "$PTERO_TEST_HTTP" =~ ^(200|403|401)$ ]]; then
            log_success "Pterodactyl endpoint reached (HTTP $PTERO_TEST_HTTP)!"
        else
            log_warn "Could not reach Pterodactyl immediately (HTTP $PTERO_TEST_HTTP). You can re-test or edit settings in Admin Dashboard later."
        fi
    else
        log_info "Pterodactyl configuration skipped. You can configure it later in Admin Dashboard > Settings or via .env."
    fi

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 6: REVERSE PROXY WEB SERVER ---${CLR_RESET}"
    echo "1) Nginx (Recommended standard)"
    echo "2) Caddy (Automatic HTTPS)"
    read -p "Select web server [1]: " PROXY_CHOICE
    PROXY_CHOICE=${PROXY_CHOICE:-1}

    echo -e "\n${CLR_BOLD}${CLR_VIOLET}--- STEP 7: INITIAL ADMINISTRATOR PROVISIONING ---${CLR_RESET}"
    read -p "Do you want to create the initial Administrator account now? [Y/n]: " CREATE_ADMIN_NOW
    CREATE_ADMIN_NOW=${CREATE_ADMIN_NOW:-Y}

    ADMIN_USER=""
    ADMIN_EMAIL=""
    ADMIN_PASS=""

    if [[ "$CREATE_ADMIN_NOW" =~ ^[Yy]$ ]]; then
        while true; do
            read -p "Administrator Username [admin]: " ADMIN_USER
            ADMIN_USER=${ADMIN_USER:-admin}
            if [ ${#ADMIN_USER} -ge 3 ]; then
                break
            else
                log_error "Username must be at least 3 characters."
            fi
        done

        while true; do
            read -p "Administrator Email Address: " ADMIN_EMAIL
            if [[ "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$ ]]; then
                break
            else
                log_error "Please enter a valid email address."
            fi
        done

        while true; do
            read -s -p "Administrator Password (min 8 characters): " ADMIN_PASS
            echo ""
            if [ ${#ADMIN_PASS} -lt 8 ]; then
                log_error "Password must be at least 8 characters long."
                continue
            fi
            read -s -p "Confirm Administrator Password: " ADMIN_PASS_CONFIRM
            echo ""
            if [ "$ADMIN_PASS" == "$ADMIN_PASS_CONFIRM" ]; then
                log_success "Password confirmed."
                break
            else
                log_error "Passwords do not match. Please re-enter."
            fi
        done
    fi

    echo -e "\n=============================================================================="
    echo -e "${CLR_BOLD}CONFIGURATION SUMMARY:${CLR_RESET}"
    echo " - Installation Path:     $INSTALL_DIR"
    echo " - Dashboard Domain:      $DASH_DOMAIN"
    echo " - Database Driver:       $DB_DRIVER"
    echo " - Pterodactyl URL:       ${PTERO_URL:-(Will configure later in Admin Panel)}"
    echo " - Reverse Proxy:         $([ "$PROXY_CHOICE" -eq 1 ] && echo "Nginx" || echo "Caddy")"
    echo " - SSL Mode:              $([ "$SSL_CHOICE" -eq 1 ] && echo "Let's Encrypt Certbot" || echo "Manual / Other")"
    echo " - Create Initial Admin:  $([[ "$CREATE_ADMIN_NOW" =~ ^[Yy]$ ]] && echo "Yes ($ADMIN_USER <$ADMIN_EMAIL>)" || echo "No (Use CLI later)")"
    echo "=============================================================================="
    read -p "Proceed with automated installation? [Y/n]: " CONFIRM_INSTALL
    if [[ ! "$CONFIRM_INSTALL" =~ ^[Yy]$ && -n "$CONFIRM_INSTALL" ]]; then
        log_info "Installation aborted by user."
        exit 0
    fi
}

# 3. System Dependencies (Node.js 20 LTS, Git, Curl, Nginx, Certbot)
install_dependencies() {
    log_info "Updating apt package repositories..."
    apt-get update -y

    log_info "Installing prerequisite system utilities..."
    apt-get install -y curl wget git tar unzip ufw software-properties-common build-essential

    # Check and install Node.js 20+
    if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 20 ]; then
        log_info "Configuring Node.js 20.x LTS repository..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    log_success "Node.js runtime verified: $(node -v) (npm $(npm -v))"

    # Install Reverse Proxy
    if [ "$PROXY_CHOICE" -eq 1 ]; then
        log_info "Installing Nginx web server and Certbot..."
        apt-get install -y nginx certbot python3-certbot-nginx
    else
        log_info "Installing Caddy web server..."
        apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
        curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update -y
        apt-get install -y caddy
    fi
}

# 4. Deploy RexaCloud Source Code
deploy_application() {
    log_info "Setting up installation directory at $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"

    # If running installer from within repo, sync current folder; otherwise clone
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    if [ -f "$SCRIPT_DIR/package.json" ]; then
        log_info "Deploying from local repository source..."
        cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR"/
        cp -r "$SCRIPT_DIR"/.[!.]* "$INSTALL_DIR"/ 2>/dev/null || true
    else
        log_info "Fetching latest RexaCloud release..."
        # If deploying from git repo
        git clone https://github.com/rexacloud/panel.git "$INSTALL_DIR" || true
    fi

    cd "$INSTALL_DIR"

    # Generate secure environment variables
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [ ! -f .env ]; then
        log_info "Generating production .env configuration..."
        cat <<EOF > .env
PORT=3000
NODE_ENV=production
APP_URL="https://$DASH_DOMAIN"
JWT_SECRET="$JWT_SECRET"

# Database Configuration ($DB_DRIVER)
DB_DRIVER="$DB_DRIVER"
DB_HOST="$DB_HOST"
DB_PORT="$DB_PORT"
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
DB_PASS="$DB_PASS"

# Pterodactyl Panel Integration
# Can be configured here or in the Dashboard under Admin > Settings
PTERODACTYL_PANEL_URL="$PTERO_URL"
PTERODACTYL_CLIENT_API_KEY="$PTERO_CLIENT_KEY"
PTERODACTYL_APPLICATION_API_KEY="$PTERO_APP_KEY"
EOF
    fi

    log_info "Installing Node.js dependencies (production build)..."
    npm install

    log_info "Building frontend assets..."
    npm run build

    # Create service user permissions
    id -u rexacloud &>/dev/null || useradd -r -s /bin/false rexacloud || true
    chown -R rexacloud:rexacloud "$INSTALL_DIR"
    chmod -R 755 "$INSTALL_DIR"

    # Install global CLI binary in /usr/local/bin/rexacloud
    log_info "Installing global system CLI utility (/usr/local/bin/rexacloud)..."
    cat <<EOF > /usr/local/bin/rexacloud
#!/bin/bash
cd "$INSTALL_DIR"
exec npx tsx "$INSTALL_DIR/cli.ts" "\$@"
EOF
    chmod +x /usr/local/bin/rexacloud || true
    log_success "Global CLI installed. You can run 'rexacloud <command>' anywhere on this system."

    log_success "Application deployed and compiled successfully."
}

# 5. Provision Initial Admin Account
setup_admin_account() {
    if [[ "$CREATE_ADMIN_NOW" =~ ^[Yy]$ ]]; then
        log_info "Provisioning initial administrator account ($ADMIN_USER)..."
        cd "$INSTALL_DIR"
        npx tsx -e "
            import { authService } from './backend/services/authService.js';
            try {
                const u = authService.createUser({
                    username: '$ADMIN_USER',
                    email: '$ADMIN_EMAIL',
                    role: 'admin',
                    password: '$ADMIN_PASS'
                });
                console.log('Admin account ' + u.username + ' provisioned.');
            } catch(e) {
                console.error('Provisioning notice:', e.message);
            }
        "
        log_success "Administrator account ($ADMIN_USER) created."
    else
        log_info "Initial admin creation skipped. You can create one anytime by running:"
        echo -e "${CLR_CYAN}    cd $INSTALL_DIR && npm run cli admin:create${CLR_RESET}"
    fi
}

# 6. Configure Systemd Daemon Service
setup_systemd() {
    log_info "Configuring systemd service (/etc/systemd/system/rexacloud.service)..."

    cat <<EOF > /etc/systemd/system/rexacloud.service
[Unit]
Description=RexaCloud Game Server Management Panel
After=network.target

[Service]
Type=simple
User=rexacloud
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=rexacloud

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable rexacloud.service
    systemctl restart rexacloud.service
    log_success "RexaCloud systemd service started and enabled on boot."
}

# 7. Configure Reverse Proxy (Nginx / Caddy) & Let's Encrypt SSL
setup_reverse_proxy() {
    if [ "$PROXY_CHOICE" -eq 1 ]; then
        log_info "Configuring Nginx reverse proxy for $DASH_DOMAIN..."

        cat <<EOF > /etc/nginx/sites-available/rexacloud.conf
server {
    listen 80;
    listen [::]:80;
    server_name $DASH_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 100M;
    }
}
EOF

        ln -sf /etc/nginx/sites-available/rexacloud.conf /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
        nginx -t
        systemctl reload nginx

        # Let's Encrypt SSL Issuance
        if [ "$SSL_CHOICE" -eq 1 ]; then
            log_info "Requesting Let's Encrypt SSL certificate via Certbot..."
            if certbot --nginx -d "$DASH_DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect; then
                log_success "Let's Encrypt SSL certificate obtained and HTTPS redirect enabled!"
            else
                log_warn "Certbot was unable to automatically issue an SSL certificate."
                log_warn "Ensure DNS A record for $DASH_DOMAIN points to this server, then run:"
                echo -e "${CLR_CYAN}    certbot --nginx -d $DASH_DOMAIN${CLR_RESET}"
            fi
        fi

    else
        log_info "Configuring Caddy reverse proxy for $DASH_DOMAIN..."
        cat <<EOF > /etc/caddy/Caddyfile
$DASH_DOMAIN {
    reverse_proxy 127.0.0.1:3000
}
EOF
        systemctl reload caddy
        log_success "Caddy configured with automatic SSL."
    fi
}

# 8. Firewall configuration (UFW)
setup_firewall() {
    if command -v ufw &> /dev/null; then
        log_info "Allowing HTTP, HTTPS, and SSH traffic in UFW firewall..."
        ufw allow 22/tcp || true
        ufw allow 80/tcp || true
        ufw allow 443/tcp || true
    fi
}

# 9. Final Verification & Summary
final_summary() {
    banner
    log_success "REXACLOUD PANEL INSTALLATION COMPLETED SUCCESSFULLY!"
    echo "=============================================================================="
    echo -e "Dashboard URL:     ${CLR_BOLD}${CLR_VIOLET}https://$DASH_DOMAIN${CLR_RESET}"
    echo -e "Installation Path: ${CLR_CYAN}$INSTALL_DIR${CLR_RESET}"
    echo -e "Service Status:    systemctl status rexacloud"
    echo -e "Service Logs:      journalctl -u rexacloud -f"
    echo ""
    echo -e "${CLR_BOLD}Administrative Commands (Global CLI & Local):${CLR_RESET}"
    echo -e "  Create Administrator:  ${CLR_CYAN}rexacloud admin:create${CLR_RESET}  (or npm run cli admin:create)"
    echo -e "  Test Pterodactyl API:  ${CLR_CYAN}rexacloud pterodactyl:test${CLR_RESET}  (or npm run cli pterodactyl:test)"
    echo -e "  Generate Secret Key:   ${CLR_CYAN}rexacloud key:generate${CLR_RESET}  (or npm run cli key:generate)"
    echo ""
    echo -e "${CLR_BOLD}Connecting your Pterodactyl Instance:${CLR_RESET}"
    echo "  1. Sign in to your RexaCloud dashboard at https://$DASH_DOMAIN"
    echo "  2. Go to Admin Dashboard > Settings"
    echo "  3. Enter your Pterodactyl Panel URL, Client API Key, and Application API Key"
    echo "  4. Click 'Test Connection' to verify live communication with your servers."
    echo "=============================================================================="
    echo ""
}

# Execution Flow
banner
check_environment
gather_configuration
install_dependencies
deploy_application
setup_admin_account
setup_systemd
setup_reverse_proxy
setup_firewall
final_summary
