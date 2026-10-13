#!/bin/bash
# ==============================================================================
# RexaCloud Panel — Production Upgrade Utility
# Authoritative update script for RexaCloud Game Server Management Panel.
# Preserves production environment (.env), SQLite database, and custom configurations.
# Builds production assets and cleanly restarts the systemd application service.
# ==============================================================================

set -Eeuo pipefail

# ANSI Terminal Formatting
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_PURPLE="\033[38;2;139;92;246m"
CLR_VIOLET="\033[38;2;168;85;247m"
CLR_GREEN="\033[32m"
CLR_CYAN="\033[36m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"

# Canonical Repository Configuration
CANONICAL_REPO_URL="https://github.com/jukgamer200-gif/Rexa-dash-test.git"
CANONICAL_DEFAULT_BRANCH="main"
CANONICAL_ARCHIVE_URL="https://github.com/jukgamer200-gif/Rexa-dash-test/archive/refs/heads/${CANONICAL_DEFAULT_BRANCH}.tar.gz"

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

echo -e "\n${CLR_PURPLE}${CLR_BOLD}RexaCloud Panel — Production Upgrade Utility${CLR_RESET}"
echo -e "${CLR_VIOLET}Official Repository: ${CANONICAL_REPO_URL}${CLR_RESET}"
echo "=============================================================================="

# 1. Root and Permission Verification
if [ "$EUID" -ne 0 ]; then
    log_error "Please run this upgrade script with sudo or as root: sudo bash upgrade.sh"
    exit 1
fi

INSTALL_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$INSTALL_DIR"

# Validate that we are running inside a valid RexaCloud directory
if [ ! -f "$INSTALL_DIR/package.json" ]; then
    log_error "Cannot locate package.json in current directory ($INSTALL_DIR)."
    log_error "Please run this script from the RexaCloud installation directory (e.g. /var/www/rexacloud)."
    exit 1
fi

# Load optional local repository configuration if present
if [ -f "$INSTALL_DIR/.repo-config" ]; then
    # shellcheck source=/dev/null
    . "$INSTALL_DIR/.repo-config"
fi

REPO_URL="${REPO_URL:-$CANONICAL_REPO_URL}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-$CANONICAL_DEFAULT_BRANCH}"
ARCHIVE_URL="${ARCHIVE_URL:-$CANONICAL_ARCHIVE_URL}"

# Detect existing service user/group to maintain proper ownership
SERVICE_USER="www-data"
SERVICE_GROUP="www-data"
if [ -f /etc/systemd/system/rexacloud.service ]; then
    DETECTED_USER=$(grep -E "^User=" /etc/systemd/system/rexacloud.service | cut -d= -f2 | xargs || echo "")
    if [ -n "$DETECTED_USER" ]; then
        SERVICE_USER="$DETECTED_USER"
        SERVICE_GROUP=$(id -gn "$SERVICE_USER" 2>/dev/null || echo "$SERVICE_USER")
    fi
else
    # Fallback to directory owner if not root
    DIR_OWNER=$(stat -c '%U:%G' "$INSTALL_DIR" 2>/dev/null || echo "")
    if [ -n "$DIR_OWNER" ] && [ "$DIR_OWNER" != "root:root" ]; then
        SERVICE_USER=$(echo "$DIR_OWNER" | cut -d: -f1)
        SERVICE_GROUP=$(echo "$DIR_OWNER" | cut -d: -f2)
    fi
fi

# 2. Production Backup (Configuration & Database)
echo -e "\n${CLR_CYAN}[1/5] Backing up production configuration and database...${CLR_RESET}"
BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$INSTALL_DIR/backups/upgrade_$BACKUP_TIME"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

ENV_BACKED_UP=false
if [ -f "$INSTALL_DIR/.env" ]; then
    cp -a "$INSTALL_DIR/.env" "$BACKUP_DIR/.env"
    chmod 600 "$BACKUP_DIR/.env"
    ENV_BACKED_UP=true
    log_success "Saved .env configuration backup to $BACKUP_DIR/.env"
fi

DB_BACKED_UP=false
if [ -d "$INSTALL_DIR/database" ]; then
    mkdir -p "$BACKUP_DIR/database"
    # Safely copy SQLite database, WAL, SHM, and schema files
    cp -a "$INSTALL_DIR/database"/* "$BACKUP_DIR/database/" 2>/dev/null || true
    DB_BACKED_UP=true
    log_success "Saved SQLite database backup to $BACKUP_DIR/database/"
fi

# Emergency restore trap in case an unrecoverable failure occurs during upgrade
handle_upgrade_failure() {
    local exit_code=$1
    local line_no=$2
    log_error "Upgrade failed at line $line_no with exit code $exit_code."
    log_warn "Restoring preserved production files from $BACKUP_DIR..."

    if [ "$ENV_BACKED_UP" = true ] && [ -f "$BACKUP_DIR/.env" ]; then
        cp -a "$BACKUP_DIR/.env" "$INSTALL_DIR/.env"
    fi
    if [ "$DB_BACKED_UP" = true ] && [ -d "$BACKUP_DIR/database" ]; then
        mkdir -p "$INSTALL_DIR/database"
        cp -a "$BACKUP_DIR/database"/* "$INSTALL_DIR/database/" 2>/dev/null || true
    fi

    # Restore ownership
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/database" 2>/dev/null || true
    [ -f "$INSTALL_DIR/.env" ] && chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/.env" 2>/dev/null || true

    log_warn "Production data and .env preserved. Service was NOT restarted with broken files."
    exit "$exit_code"
}
trap 'handle_upgrade_failure $? $LINENO' ERR

# 3. Source Code Update
echo -e "\n${CLR_CYAN}[2/5] Updating application source code from official repository...${CLR_RESET}"
log_info "Target repository: $REPO_URL"

# Detect remote default branch dynamically if reachable
if command -v git &>/dev/null; then
    DETECTED_BRANCH=$(GIT_TERMINAL_PROMPT=0 git ls-remote --symref "$REPO_URL" HEAD 2>/dev/null | awk '/^ref:/ { sub("refs/heads/", "", $2); print $2; exit }' || echo "")
    if [ -n "$DETECTED_BRANCH" ]; then
        DEFAULT_BRANCH="$DETECTED_BRANCH"
        ARCHIVE_URL="https://github.com/jukgamer200-gif/Rexa-dash-test/archive/refs/heads/${DEFAULT_BRANCH}.tar.gz"
        log_info "Verified canonical remote default branch: $DEFAULT_BRANCH"
    fi
fi

if [ -d "$INSTALL_DIR/.git" ]; then
    CURRENT_REMOTE=$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || echo "")

    if [ -z "$CURRENT_REMOTE" ]; then
        log_info "No Git remote origin configured. Setting origin to: $REPO_URL"
        git -C "$INSTALL_DIR" remote add origin "$REPO_URL"
    elif [[ "$CURRENT_REMOTE" == *"testdash.git"* || "$CURRENT_REMOTE" == *"testdash"* || "$CURRENT_REMOTE" == *"rexacloud/panel"* ]]; then
        log_warn "Legacy repository remote detected: $CURRENT_REMOTE"
        log_info "Updating Git remote origin to official repository: $REPO_URL"
        git -C "$INSTALL_DIR" remote set-url origin "$REPO_URL"
    elif [[ "$CURRENT_REMOTE" != *"$REPO_URL"* && "$CURRENT_REMOTE" != *"Rexa-dash-test"* ]]; then
        log_warn "Current remote origin ($CURRENT_REMOTE) does not match official canonical repository."
        log_info "Updating remote origin to canonical repository: $REPO_URL"
        git -C "$INSTALL_DIR" remote set-url origin "$REPO_URL"
    else
        log_success "Verified official Git remote origin: $CURRENT_REMOTE"
    fi

    # Fetch latest updates from official remote
    log_info "Fetching latest releases from origin/$DEFAULT_BRANCH..."
    GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" fetch origin "$DEFAULT_BRANCH"

    # Check for local branch divergence
    LOCAL_COMMIT=$(git -C "$INSTALL_DIR" rev-parse HEAD 2>/dev/null || echo "")
    REMOTE_COMMIT=$(git -C "$INSTALL_DIR" rev-parse "origin/$DEFAULT_BRANCH" 2>/dev/null || echo "")
    MERGE_BASE=$(git -C "$INSTALL_DIR" merge-base HEAD "origin/$DEFAULT_BRANCH" 2>/dev/null || echo "")

    if [ -n "$LOCAL_COMMIT" ] && [ -n "$REMOTE_COMMIT" ] && [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
        if [ "$LOCAL_COMMIT" != "$MERGE_BASE" ] && [ "$REMOTE_COMMIT" != "$MERGE_BASE" ]; then
            log_warn "Local commits differ from upstream. Preserving local commits on backup branch..."
            git -C "$INSTALL_DIR" branch -f "backup-local-$BACKUP_TIME" 2>/dev/null || true
            log_info "Preserved local commit history in branch: backup-local-$BACKUP_TIME"
        fi
    fi

    # Reset working tree cleanly to latest official release
    log_info "Checking out origin/$DEFAULT_BRANCH..."
    git -C "$INSTALL_DIR" checkout -B "$DEFAULT_BRANCH" "origin/$DEFAULT_BRANCH" 2>/dev/null || git -C "$INSTALL_DIR" reset --hard "origin/$DEFAULT_BRANCH"

else
    # Non-git installation fallback: use safe temporary staging directory
    log_info "Non-git directory detected. Using safe staging directory for update..."
    STAGING_DIR=$(mktemp -d /tmp/rexacloud_upgrade_stage_XXXXXX)
    ARCHIVE_FILE="/tmp/rexacloud_release_$$.tar.gz"

    CLONE_SUCCESS=false
    if command -v git &>/dev/null; then
        if GIT_TERMINAL_PROMPT=0 git clone --branch "$DEFAULT_BRANCH" --depth 1 "$REPO_URL" "$STAGING_DIR" 2>/dev/null; then
            CLONE_SUCCESS=true
            log_success "Cloned latest source into staging directory."
        fi
    fi

    if [ "$CLONE_SUCCESS" = false ]; then
        log_info "Downloading release archive from $ARCHIVE_URL..."
        curl -fsSL -o "$ARCHIVE_FILE" "$ARCHIVE_URL"
        tar -xzf "$ARCHIVE_FILE" -C "$STAGING_DIR" --strip-components=1
        rm -f "$ARCHIVE_FILE"
        log_success "Extracted release archive into staging directory."
    fi

    # Validate staging source before applying
    if [ ! -f "$STAGING_DIR/package.json" ]; then
        rm -rf "$STAGING_DIR"
        log_error "Staging validation failed: downloaded source is missing package.json."
        exit 1
    fi

    # Safely sync new application files while preserving production configuration & databases
    rsync -a --exclude='.env*' --exclude='database/*' --exclude='backups/*' "$STAGING_DIR"/ "$INSTALL_DIR"/ 2>/dev/null || {
        # Fallback if rsync is not available
        cp -a "$STAGING_DIR"/. "$INSTALL_DIR"/
    }
    rm -rf "$STAGING_DIR"
fi

# Ensure .repo-config is saved in project root
cat <<EOF > "$INSTALL_DIR/.repo-config"
# ==============================================================================
# RexaCloud Canonical Repository Configuration
# ==============================================================================
CANONICAL_REPO_URL="$REPO_URL"
CANONICAL_DEFAULT_BRANCH="$DEFAULT_BRANCH"
CANONICAL_ARCHIVE_URL="$ARCHIVE_URL"
EOF

# Restore preserved production configuration and SQLite database
if [ "$ENV_BACKED_UP" = true ] && [ -f "$BACKUP_DIR/.env" ]; then
    cp -a "$BACKUP_DIR/.env" "$INSTALL_DIR/.env"
    log_info "Restored production .env configuration."
fi
if [ "$DB_BACKED_UP" = true ] && [ -d "$BACKUP_DIR/database" ]; then
    mkdir -p "$INSTALL_DIR/database"
    cp -a "$BACKUP_DIR/database"/* "$INSTALL_DIR/database/" 2>/dev/null || true
    log_info "Restored production SQLite database files."
fi

# 4. Dependency Updates
echo -e "\n${CLR_CYAN}[3/5] Updating Node.js dependencies...${CLR_RESET}"
INSTALL_OK=false
if npm install; then
    INSTALL_OK=true
else
    log_warn "Standard npm install encountered peer conflicts. Retrying with --legacy-peer-deps..."
    if npm install --legacy-peer-deps; then
        INSTALL_OK=true
    fi
fi

if [ "$INSTALL_OK" = false ]; then
    log_error "Node.js dependency installation failed. Aborting upgrade."
    exit 1
fi
log_success "Dependencies installed successfully."

# 5. Production Build
echo -e "\n${CLR_CYAN}[4/5] Recompiling production frontend bundle...${CLR_RESET}"
if npm run build; then
    log_success "Production frontend compiled successfully."
else
    log_error "Production bundle compilation failed. Please inspect build logs."
    exit 1
fi

# 6. Service Ownership & Restart
echo -e "\n${CLR_CYAN}[5/5] Configuring permissions and restarting service...${CLR_RESET}"
# Ensure service user can read/write database and read .env
if id "$SERVICE_USER" &>/dev/null; then
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/database" 2>/dev/null || true
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/dist" 2>/dev/null || true
    [ -f "$INSTALL_DIR/.env" ] && chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/.env" 2>/dev/null || true
    [ -f "$INSTALL_DIR/.env" ] && chmod 600 "$INSTALL_DIR/.env" 2>/dev/null || true
    chmod 755 "$INSTALL_DIR/database" 2>/dev/null || true
fi

if command -v systemctl &>/dev/null && systemctl is-active --quiet rexacloud; then
    systemctl restart rexacloud
    log_success "RexaCloud application service restarted successfully."
elif command -v systemctl &>/dev/null && [ -f /etc/systemd/system/rexacloud.service ]; then
    log_info "Starting rexacloud systemd service..."
    systemctl start rexacloud || true
    log_success "RexaCloud service started."
else
    log_info "systemd service 'rexacloud' not active. Start it manually with: systemctl start rexacloud"
fi

# Remove ERR trap on successful finish
trap - ERR

echo -e "\n=============================================================================="
echo -e "${CLR_GREEN}${CLR_BOLD}✔ RexaCloud Panel upgraded successfully!${CLR_RESET}"
echo -e "Canonical Repository: ${CLR_VIOLET}$REPO_URL${CLR_RESET} (branch: ${CLR_CYAN}$DEFAULT_BRANCH${CLR_RESET})"
echo -e "Backup location:      ${CLR_CYAN}$BACKUP_DIR${CLR_RESET}"
echo "==============================================================================\n"
