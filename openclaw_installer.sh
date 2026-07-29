#!/bin/bash
# Support accidental invocation via zsh/sh by re-execing with bash.
if [[ -z "${BASH_VERSION:-}" ]]; then
  exec /usr/bin/env bash "$0" "$@"
fi

set -euo pipefail

# Openclaw Installer for macOS and Linux
# Usage: curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash

BOLD='\033[1m'
ACCENT='\033[38;2;255;90;45m'
# shellcheck disable=SC2034
ACCENT_BRIGHT='\033[38;2;255;122;61m'
ACCENT_DIM='\033[38;2;209;74;34m'
INFO='\033[38;2;255;138;91m'
SUCCESS='\033[38;2;47;191;113m'
WARN='\033[38;2;255;176;32m'
ERROR='\033[38;2;226;61;45m'
MUTED='\033[38;2;139;127;119m'
NC='\033[0m' # No Color

# ============================================
# Spinner Implementation (clack-style)
# ============================================

SPINNER_PID=""
SPINNER_MSG=""

# Unicode spinner 字符（与 @clack/prompts 一致）
SPINNER_FRAMES=('◒' '◐' '◓' '◑')

spinner_start() {
    local msg="${1:-Processing...}"
    SPINNER_MSG="$msg"

    # Only start spinner if we have a TTY
    if [[ ! -t 1 ]]; then
        printf "${ACCENT}◆${NC} ${msg}\n"
        return
    fi

    {
        local idx=0
        while true; do
            printf "\r${ACCENT}${SPINNER_FRAMES[$idx]}${NC} ${msg}    "
            ((idx = (idx + 1) % ${#SPINNER_FRAMES[@]}))
            sleep 0.12
        done
    } &

    SPINNER_PID=$!
    disown $SPINNER_PID 2>/dev/null || true
}

spinner_stop() {
    local status="${1:-0}"
    local final_msg="${2:-$SPINNER_MSG}"

    if [[ -n "$SPINNER_PID" ]]; then
        kill $SPINNER_PID 2>/dev/null || true
        wait $SPINNER_PID 2>/dev/null || true
        SPINNER_PID=""
    fi

    # Clear line and print final status
    if [[ -t 1 ]]; then
        printf "\r\033[K"  # Clear line
    fi

    if [[ "$status" -eq 0 ]]; then
        printf "${SUCCESS}◆${NC} ${final_msg}\n"
    else
        printf "${ERROR}◆${NC} ${final_msg}\n"
    fi
}

spinner_update() {
    local msg="$1"
    SPINNER_MSG="$msg"
}

# ============================================
# Interactive Menu (clack-style)
# ============================================

# Returns selected index (0-based) via stdout
clack_select() {
    local prompt="$1"
    shift
    local options=("$@")
    local selected=0
    local key=""
    local num_options=${#options[@]}

    # Non-interactive fallback
    if [[ ! -t 0 ]] || [[ "${NO_PROMPT:-0}" == "1" ]]; then
        echo "0"
        return
    fi

    # Hide cursor
    printf "\033[?25l" > /dev/tty

    # Ensure cursor is restored on exit
    trap 'printf "\033[?25h" > /dev/tty 2>/dev/null || true' RETURN

    echo -e "${ACCENT}◆${NC} ${prompt}" > /dev/tty
    echo -e "  ${MUTED}(↑↓ 导航 | 数字直选 | Enter 确认)${NC}" > /dev/tty

    while true; do
        # Draw options with number prefix
        for i in "${!options[@]}"; do
            local num=$((i + 1))
            if [[ $i -eq $selected ]]; then
                echo -e "  ${MUTED}[${num}]${NC} ${SUCCESS}●${NC} ${options[$i]}\033[K" > /dev/tty
            else
                echo -e "  ${MUTED}[${num}]${NC} ${MUTED}○${NC} ${options[$i]}\033[K" > /dev/tty
            fi
        done

        # Read keypress
        IFS= read -rsn1 key < /dev/tty

        case "$key" in
            $'\x1b')  # Escape sequence (arrow keys)
                read -rsn2 -t 1 key < /dev/tty || true
                case "$key" in
                    '[A') [[ $selected -gt 0 ]] && selected=$((selected - 1)) || true ;;  # Up
                    '[B') [[ $selected -lt $((num_options - 1)) ]] && selected=$((selected + 1)) || true ;;  # Down
                esac
                ;;
            'k'|'K')  # vim-style up
                [[ $selected -gt 0 ]] && selected=$((selected - 1)) || true
                ;;
            'j'|'J')  # vim-style down
                [[ $selected -lt $((num_options - 1)) ]] && selected=$((selected + 1)) || true
                ;;
            '')  # Enter
                break
                ;;
            [0-9])  # Number key (1-indexed for user convenience)
                local num=$((key))
                if [[ $num -ge 1 && $num -le $num_options ]]; then
                    selected=$((num - 1))
                    break
                fi
                ;;
        esac

        # Move cursor up to redraw (only options, title/hint are above the loop)
        printf "\033[${num_options}A" > /dev/tty
    done

    # Restore cursor
    printf "\033[?25h" > /dev/tty

    echo "$selected"
}

# Confirm dialog - returns 0 for yes, 1 for no
clack_confirm() {
    local prompt="$1"
    local default="${2:-false}"  # true or false

    # Non-interactive fallback
    if [[ ! -t 0 ]] || [[ "${NO_PROMPT:-0}" == "1" ]]; then
        if [[ "$default" == "true" ]]; then
            return 0
        else
            return 1
        fi
    fi

    local hint=""
    if [[ "$default" == "true" ]]; then
        hint="${SUCCESS}Y${NC}/${MUTED}n${NC}"
    else
        hint="${MUTED}y${NC}/${SUCCESS}N${NC}"
    fi

    printf "${ACCENT}◆${NC} ${prompt} [${hint}] " > /dev/tty

    local response=""
    read -r response < /dev/tty 2>/dev/null || response=""

    # Convert to lowercase (compatible with older bash/zsh)
    response="$(echo "$response" | tr '[:upper:]' '[:lower:]')"

    case "$response" in
        y|yes) return 0 ;;
        n|no)  return 1 ;;
        "")
            if [[ "$default" == "true" ]]; then
                return 0
            else
                return 1
            fi
            ;;
        *)
            echo -e "${WARN}请输入 y 或 n${NC}" > /dev/tty
            clack_confirm "$prompt" "$default"
            ;;
    esac
}

# ============================================
# Intro / Outro Wrappers (clack-style)
# ============================================

clack_intro() {
    local title="$1"
    echo ""
    echo -e "${ACCENT}┌${NC}  ${BOLD}${title}${NC}"
    echo -e "${ACCENT}│${NC}"
}

clack_outro() {
    local message="$1"
    echo -e "${ACCENT}│${NC}"
    echo -e "${ACCENT}└${NC}  ${message}"
    echo ""
}

clack_step() {
    local message="$1"
    echo -e "${ACCENT}│${NC}  ${message}"
}

# ============================================
# Installation Summary Table
# ============================================

print_summary_table() {
    local install_method="${1:-npm}"
    local git_dir="${2:-}"

    echo ""
    echo -e "${ACCENT}${BOLD}┌────────────────────────────────────────┐${NC}"
    echo -e "${ACCENT}${BOLD}│  🦀 安装完成                            │${NC}"
    echo -e "${ACCENT}${BOLD}└────────────────────────────────────────┘${NC}"
    echo ""

    # Component status
    local node_ver=""
    node_ver="$(node -v 2>/dev/null || echo 'N/A')"
    local npm_ver=""
    npm_ver="$(npm -v 2>/dev/null || echo 'N/A')"
    local clawdbot_ver=""
    clawdbot_ver="$(resolve_clawdbot_version || echo 'N/A')"

    echo -e "  ${MUTED}组件状态${NC}"
    printf "  ${MUTED}├─${NC} Node.js    ${SUCCESS}✓${NC} %s\n" "$node_ver"
    printf "  ${MUTED}├─${NC} npm        ${SUCCESS}✓${NC} v%s\n" "$npm_ver"
    printf "  ${MUTED}└─${NC} Openclaw   ${SUCCESS}✓${NC} %s\n" "$clawdbot_ver"

    echo ""
    echo -e "  ${MUTED}安装方式${NC}"
    if [[ "$install_method" == "git" && -n "$git_dir" ]]; then
        echo -e "  ${MUTED}├─${NC} 方式       ${INFO}源码安装${NC}"
        echo -e "  ${MUTED}└─${NC} 路径       ${INFO}${git_dir}${NC}"
    else
        echo -e "  ${MUTED}└─${NC} 方式       ${INFO}npm 全局安装${NC}"
    fi

    echo ""
}

DEFAULT_TAGLINE="All your chats, one Openclaw."

ORIGINAL_PATH="${PATH:-}"

TMPFILES=()
cleanup_tmpfiles() {
    local f
    for f in "${TMPFILES[@]:-}"; do
        rm -f "$f" 2>/dev/null || true
    done
}
trap cleanup_tmpfiles EXIT

# ============================================
# Logging Infrastructure
# ============================================

# Log configuration (can be overridden via env or CLI)
LOG_ENABLED="${CLAWDBOT_LOG:-0}"
LOG_DIR="${HOME}/.openclaw/logs"
LOG_FILE="${CLAWDBOT_LOG_FILE:-}"
LOG_LEVEL="${CLAWDBOT_LOG_LEVEL:-info}"
LOG_HISTORY="${CLAWDBOT_LOG_HISTORY:-5}"

# Log level numeric values for comparison
log_level_value() {
    case "$1" in
        debug) echo 0 ;;
        info)  echo 1 ;;
        warn)  echo 2 ;;
        error) echo 3 ;;
        *)     echo 1 ;;
    esac
}

# Initialize logging
log_init() {
    if [[ "$LOG_ENABLED" != "1" ]]; then
        return 0
    fi

    # Create log directory
    mkdir -p "$LOG_DIR" 2>/dev/null || true

    # If no custom log file, generate timestamped filename
    if [[ -z "$LOG_FILE" ]]; then
        local timestamp
        timestamp=$(date +%Y-%m-%d-%H%M%S)
        LOG_FILE="${LOG_DIR}/install-${timestamp}.log"
    fi

    # Ensure log file parent directory exists
    local log_parent
    log_parent="$(dirname "$LOG_FILE")"
    mkdir -p "$log_parent" 2>/dev/null || true

    # Create/touch the log file
    touch "$LOG_FILE" 2>/dev/null || true

    # Create symlink to latest log (only for default log dir)
    if [[ "$(dirname "$LOG_FILE")" == "$LOG_DIR" ]]; then
        ln -sf "$LOG_FILE" "${LOG_DIR}/install.log" 2>/dev/null || true
    fi

    # Cleanup old logs
    log_cleanup

    # Write initial log entry
    log info "=== Openclaw Installer Log Started ==="
    log info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    log info "Log file: $LOG_FILE"
}

# Write a log message
log() {
    local level="$1"
    shift
    local msg="$*"

    # Skip if logging disabled
    if [[ "$LOG_ENABLED" != "1" ]]; then
        return 0
    fi

    # Check log level threshold
    local current_level_val
    local threshold_val
    current_level_val=$(log_level_value "$level")
    threshold_val=$(log_level_value "$LOG_LEVEL")

    if [[ "$current_level_val" -lt "$threshold_val" ]]; then
        return 0
    fi

    # Format and write log entry
    if [[ -n "$LOG_FILE" ]]; then
        local timestamp
        timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        local level_upper
        level_upper=$(echo "$level" | tr '[:lower:]' '[:upper:]')
        echo "[$timestamp] [$level_upper] $msg" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

# Cleanup old log files, keeping only LOG_HISTORY most recent
log_cleanup() {
    if [[ ! -d "$LOG_DIR" ]]; then
        return 0
    fi

    # Count timestamped log files (exclude install.log symlink)
    local log_files
    log_files=$(find "$LOG_DIR" -maxdepth 1 -name 'install-*.log' -type f 2>/dev/null | sort -r)
    local count
    count=$(echo "$log_files" | grep -c . 2>/dev/null || echo 0)

    if [[ "$count" -gt "$LOG_HISTORY" ]]; then
        # Delete oldest files beyond LOG_HISTORY
        echo "$log_files" | tail -n +$((LOG_HISTORY + 1)) | while read -r f; do
            rm -f "$f" 2>/dev/null || true
        done
        log debug "Cleaned up old log files (kept $LOG_HISTORY)"
    fi
}

mktempfile() {
    local f
    f="$(mktemp)"
    TMPFILES+=("$f")
    echo "$f"
}

DOWNLOADER=""
detect_downloader() {
    if command -v curl &> /dev/null; then
        DOWNLOADER="curl"
        return 0
    fi
    if command -v wget &> /dev/null; then
        DOWNLOADER="wget"
        return 0
    fi
    echo -e "${ERROR}Error: Missing downloader (curl or wget required)${NC}"
    exit 1
}

download_file() {
    local url="$1"
    local output="$2"
    if [[ -z "$DOWNLOADER" ]]; then
        detect_downloader
    fi
    if [[ "$DOWNLOADER" == "curl" ]]; then
        curl -fsSL --proto '=https' --tlsv1.2 --retry 3 --retry-delay 1 --retry-connrefused -o "$output" "$url"
        return
    fi
    wget -q --https-only --secure-protocol=TLSv1_2 --tries=3 --timeout=20 -O "$output" "$url"
}

run_remote_bash() {
    local url="$1"
    local tmp
    tmp="$(mktempfile)"
    download_file "$url" "$tmp"
    /bin/bash "$tmp"
}

cleanup_legacy_submodules() {
    local repo_dir="$1"
    local legacy_dir="$repo_dir/Peekaboo"
    if [[ -d "$legacy_dir" ]]; then
        echo -e "${WARN}→${NC} Removing legacy submodule checkout: ${INFO}${legacy_dir}${NC}"
        rm -rf "$legacy_dir"
    fi
}

cleanup_npm_clawdbot_paths() {
    local npm_root=""
    npm_root="$(npm root -g 2>/dev/null || true)"
    if [[ -z "$npm_root" || "$npm_root" != *node_modules* ]]; then
        return 1
    fi
    rm -rf "$npm_root"/.openclaw-* "$npm_root"/openclaw 2>/dev/null || true
}

# 清理 npm 缓存以确保获取最新包信息
clear_npm_cache() {
    log debug "Clearing npm cache for fresh package info..."
    npm cache clean --force 2>/dev/null || true
}

extract_clawdbot_conflict_path() {
    local log="$1"
    local path=""
    path="$(sed -n 's/.*File exists: //p' "$log" | head -n1)"
    if [[ -z "$path" ]]; then
        path="$(sed -n 's/.*EEXIST: file already exists, //p' "$log" | head -n1)"
    fi
    if [[ -n "$path" ]]; then
        echo "$path"
        return 0
    fi
    return 1
}

cleanup_clawdbot_bin_conflict() {
    local bin_path="$1"
    if [[ -z "$bin_path" || ( ! -e "$bin_path" && ! -L "$bin_path" ) ]]; then
        return 1
    fi
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir 2>/dev/null || true)"
    if [[ -n "$npm_bin" && "$bin_path" != "$npm_bin/openclaw" ]]; then
        case "$bin_path" in
            "/opt/homebrew/bin/openclaw"|"/usr/local/bin/openclaw")
                ;;
            *)
                return 1
                ;;
        esac
    fi
    if [[ -L "$bin_path" ]]; then
        local target=""
        target="$(readlink "$bin_path" 2>/dev/null || true)"
        if [[ "$target" == *"/node_modules/openclaw/"* ]]; then
            rm -f "$bin_path"
            echo -e "${WARN}→${NC} Removed stale openclaw symlink at ${INFO}${bin_path}${NC}"
            return 0
        fi
        return 1
    fi
    local backup=""
    backup="${bin_path}.bak-$(date +%Y%m%d-%H%M%S)"
    if mv "$bin_path" "$backup"; then
        echo -e "${WARN}→${NC} Moved existing openclaw binary to ${INFO}${backup}${NC}"
        return 0
    fi
    return 1
}


install_clawdbot_npm() {
    local spec="$1"

    # ── Block known-bad openclaw versions ──────────────────────────
    local _pkg_name=""
    local _pkg_version=""
    if [[ "$spec" == *"@"* ]]; then
        _pkg_name="${spec%%@*}"
        _pkg_version="${spec#*@}"
    fi
    if [[ "$_pkg_name" == "$CLAWDBOT_NPM_PKG" || "$_pkg_name" == "openclaw" ]]; then
        # Dist-tags (latest/next/beta): resolve to a safe concrete version first.
        if [[ "$_pkg_version" == "latest" || "$_pkg_version" == "next" || "$_pkg_version" == "beta" ]]; then
            local _safe=""
            _safe="$(resolve_safe_openclaw_version "$_pkg_version")"
            if [[ -n "$_safe" ]]; then
                log info "Resolved ${spec} → ${_pkg_name}@${_safe} (blocked-version filter)"
                spec="${_pkg_name}@${_safe}"
            fi
        elif is_openclaw_version_blocked "$_pkg_version"; then
            echo -e "${ERROR}版本 ${_pkg_version} 存在已知严重 Bug，已被阻止安装。${NC}" >&2
            echo -e "${INFO}i${NC} 请使用其他版本，或等待修复版本发布。" >&2
            log warn "Blocked installation of openclaw@${_pkg_version} (known critical bug)"
            return 1
        fi
    fi
    # ──────────────────────────────────────────────────────────────

    local log
    log="$(mktempfile)"

    # Apply npm performance optimizations (even without CN mirrors)
    if [[ "$USE_CN_MIRRORS" != "1" ]]; then
        # Basic performance optimizations for non-CN users
        npm config set maxsockets 20 2>/dev/null || true
        npm config set prefer-offline true 2>/dev/null || true
    fi

    # Use npm for global installs (pnpm global installs can be problematic)
    local peer_deps_flag=""
    if [[ "${NPM_LEGACY_PEER_DEPS:-0}" == "1" ]]; then
        peer_deps_flag="--legacy-peer-deps"
    fi
    local pkg_flags="--loglevel $NPM_LOGLEVEL ${NPM_SILENT_FLAG:+$NPM_SILENT_FLAG} --no-fund --no-audit ${peer_deps_flag}"
    
    if ! SHARP_IGNORE_GLOBAL_LIBVIPS="$SHARP_IGNORE_GLOBAL_LIBVIPS" npm $pkg_flags install -g "$spec" 2>&1 | tee "$log"; then
        if grep -q "ENOTEMPTY: directory not empty, rename .*openclaw" "$log"; then
            echo -e "${WARN}→${NC} npm left a stale openclaw directory; cleaning and retrying..."
            cleanup_npm_clawdbot_paths
            SHARP_IGNORE_GLOBAL_LIBVIPS="$SHARP_IGNORE_GLOBAL_LIBVIPS" npm $pkg_flags install -g "$spec"
            return $?
        fi
        if grep -q "EEXIST" "$log"; then
            local conflict=""
            conflict="$(extract_clawdbot_conflict_path "$log" || true)"
            if [[ -n "$conflict" ]] && cleanup_clawdbot_bin_conflict "$conflict"; then
                SHARP_IGNORE_GLOBAL_LIBVIPS="$SHARP_IGNORE_GLOBAL_LIBVIPS" npm $pkg_flags install -g "$spec"
                return $?
            fi
            echo -e "${ERROR}npm failed because an openclaw binary already exists.${NC}"
            if [[ -n "$conflict" ]]; then
                echo -e "${INFO}i${NC} Remove or move ${INFO}${conflict}${NC}, then retry."
            fi
            echo -e "${INFO}i${NC} Or rerun with ${INFO}npm install -g --force ${spec}${NC} (overwrites)."
        fi
        return 1
    fi
    return 0
}

TAGLINES=()
TAGLINES+=("Your terminal just grew claws—type something and let the bot pinch the busywork.")
TAGLINES+=("Welcome to the command line: where dreams compile and confidence segfaults.")
TAGLINES+=("I run on caffeine, JSON5, and the audacity of \"it worked on my machine.\"")
TAGLINES+=("Gateway online—please keep hands, feet, and appendages inside the shell at all times.")
TAGLINES+=("I speak fluent bash, mild sarcasm, and aggressive tab-completion energy.")
TAGLINES+=("One CLI to rule them all, and one more restart because you changed the port.")
TAGLINES+=("If it works, it's automation; if it breaks, it's a \"learning opportunity.\"")
TAGLINES+=("Pairing codes exist because even bots believe in consent—and good security hygiene.")
TAGLINES+=("Your .env is showing; don't worry, I'll pretend I didn't see it.")
TAGLINES+=("I'll do the boring stuff while you dramatically stare at the logs like it's cinema.")
TAGLINES+=("I'm not saying your workflow is chaotic... I'm just bringing a linter and a helmet.")
TAGLINES+=("Type the command with confidence—nature will provide the stack trace if needed.")
TAGLINES+=("I don't judge, but your missing API keys are absolutely judging you.")
TAGLINES+=("I can grep it, git blame it, and gently roast it—pick your coping mechanism.")
TAGLINES+=("Hot reload for config, cold sweat for deploys.")
TAGLINES+=("I'm the assistant your terminal demanded, not the one your sleep schedule requested.")
TAGLINES+=("I keep secrets like a vault... unless you print them in debug logs again.")
TAGLINES+=("Automation with claws: minimal fuss, maximal pinch.")
TAGLINES+=("I'm basically a Swiss Army knife, but with more opinions and fewer sharp edges.")
TAGLINES+=("If you're lost, run doctor; if you're brave, run prod; if you're wise, run tests.")
TAGLINES+=("Your task has been queued; your dignity has been deprecated.")
TAGLINES+=("I can't fix your code taste, but I can fix your build and your backlog.")
TAGLINES+=("I'm not magic—I'm just extremely persistent with retries and coping strategies.")
TAGLINES+=("It's not \"failing,\" it's \"discovering new ways to configure the same thing wrong.\"")
TAGLINES+=("Give me a workspace and I'll give you fewer tabs, fewer toggles, and more oxygen.")
TAGLINES+=("I read logs so you can keep pretending you don't have to.")
TAGLINES+=("If something's on fire, I can't extinguish it—but I can write a beautiful postmortem.")
TAGLINES+=("I'll refactor your busywork like it owes me money.")
TAGLINES+=("Say \"stop\" and I'll stop—say \"ship\" and we'll both learn a lesson.")
TAGLINES+=("I'm the reason your shell history looks like a hacker-movie montage.")
TAGLINES+=("I'm like tmux: confusing at first, then suddenly you can't live without me.")
TAGLINES+=("I can run local, remote, or purely on vibes—results may vary with DNS.")
TAGLINES+=("If you can describe it, I can probably automate it—or at least make it funnier.")
TAGLINES+=("Your config is valid, your assumptions are not.")
TAGLINES+=("I don't just autocomplete—I auto-commit (emotionally), then ask you to review (logically).")
TAGLINES+=("Less clicking, more shipping, fewer \"where did that file go\" moments.")
TAGLINES+=("Claws out, commit in—let's ship something mildly responsible.")
TAGLINES+=("I'll butter your workflow like a lobster roll: messy, delicious, effective.")
TAGLINES+=("Shell yeah—I'm here to pinch the toil and leave you the glory.")
TAGLINES+=("If it's repetitive, I'll automate it; if it's hard, I'll bring jokes and a rollback plan.")
TAGLINES+=("Because texting yourself reminders is so 2024.")
TAGLINES+=("WhatsApp, but make it ✨engineering✨.")
TAGLINES+=("Turning \"I'll reply later\" into \"my bot replied instantly\".")
TAGLINES+=("The only crab in your contacts you actually want to hear from. 🦞")
TAGLINES+=("Chat automation for people who peaked at IRC.")
TAGLINES+=("Because Siri wasn't answering at 3AM.")
TAGLINES+=("IPC, but it's your phone.")
TAGLINES+=("The UNIX philosophy meets your DMs.")
TAGLINES+=("curl for conversations.")
TAGLINES+=("WhatsApp Business, but without the business.")
TAGLINES+=("Meta wishes they shipped this fast.")
TAGLINES+=("End-to-end encrypted, Zuck-to-Zuck excluded.")
TAGLINES+=("The only bot Mark can't train on your DMs.")
TAGLINES+=("WhatsApp automation without the \"please accept our new privacy policy\".")
TAGLINES+=("Chat APIs that don't require a Senate hearing.")
TAGLINES+=("Because Threads wasn't the answer either.")
TAGLINES+=("Your messages, your servers, Meta's tears.")
TAGLINES+=("iMessage green bubble energy, but for everyone.")
TAGLINES+=("Siri's competent cousin.")
TAGLINES+=("Works on Android. Crazy concept, we know.")
TAGLINES+=("No \$999 stand required.")
TAGLINES+=("We ship features faster than Apple ships calculator updates.")
TAGLINES+=("Your AI assistant, now without the \$3,499 headset.")
TAGLINES+=("Think different. Actually think.")
TAGLINES+=("Ah, the fruit tree company! 🍎")

HOLIDAY_NEW_YEAR="New Year's Day: New year, new config—same old EADDRINUSE, but this time we resolve it like grown-ups."
HOLIDAY_LUNAR_NEW_YEAR="Lunar New Year: May your builds be lucky, your branches prosperous, and your merge conflicts chased away with fireworks."
HOLIDAY_CHRISTMAS="Christmas: Ho ho ho—Santa's little claw-sistant is here to ship joy, roll back chaos, and stash the keys safely."
HOLIDAY_EID="Eid al-Fitr: Celebration mode: queues cleared, tasks completed, and good vibes committed to main with clean history."
HOLIDAY_DIWALI="Diwali: Let the logs sparkle and the bugs flee—today we light up the terminal and ship with pride."
HOLIDAY_EASTER="Easter: I found your missing environment variable—consider it a tiny CLI egg hunt with fewer jellybeans."
HOLIDAY_HANUKKAH="Hanukkah: Eight nights, eight retries, zero shame—may your gateway stay lit and your deployments stay peaceful."
HOLIDAY_HALLOWEEN="Halloween: Spooky season: beware haunted dependencies, cursed caches, and the ghost of node_modules past."
HOLIDAY_THANKSGIVING="Thanksgiving: Grateful for stable ports, working DNS, and a bot that reads the logs so nobody has to."
HOLIDAY_VALENTINES="Valentine's Day: Roses are typed, violets are piped—I'll automate the chores so you can spend time with humans."

append_holiday_taglines() {
    local today
    local month_day
    today="$(date -u +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)"
    month_day="$(date -u +%m-%d 2>/dev/null || date +%m-%d)"

    case "$month_day" in
        "01-01") TAGLINES+=("$HOLIDAY_NEW_YEAR") ;;
        "02-14") TAGLINES+=("$HOLIDAY_VALENTINES") ;;
        "10-31") TAGLINES+=("$HOLIDAY_HALLOWEEN") ;;
        "12-25") TAGLINES+=("$HOLIDAY_CHRISTMAS") ;;
    esac

    case "$today" in
        "2025-01-29"|"2026-02-17"|"2027-02-06") TAGLINES+=("$HOLIDAY_LUNAR_NEW_YEAR") ;;
        "2025-03-30"|"2025-03-31"|"2026-03-20"|"2027-03-10") TAGLINES+=("$HOLIDAY_EID") ;;
        "2025-10-20"|"2026-11-08"|"2027-10-28") TAGLINES+=("$HOLIDAY_DIWALI") ;;
        "2025-04-20"|"2026-04-05"|"2027-03-28") TAGLINES+=("$HOLIDAY_EASTER") ;;
        "2025-11-27"|"2026-11-26"|"2027-11-25") TAGLINES+=("$HOLIDAY_THANKSGIVING") ;;
        "2025-12-15"|"2025-12-16"|"2025-12-17"|"2025-12-18"|"2025-12-19"|"2025-12-20"|"2025-12-21"|"2025-12-22"|"2026-12-05"|"2026-12-06"|"2026-12-07"|"2026-12-08"|"2026-12-09"|"2026-12-10"|"2026-12-11"|"2026-12-12"|"2027-12-25"|"2027-12-26"|"2027-12-27"|"2027-12-28"|"2027-12-29"|"2027-12-30"|"2027-12-31"|"2028-01-01") TAGLINES+=("$HOLIDAY_HANUKKAH") ;;
    esac
}

pick_tagline() {
    append_holiday_taglines
    local count=${#TAGLINES[@]}
    if [[ "$count" -eq 0 ]]; then
        echo "$DEFAULT_TAGLINE"
        return
    fi
    if [[ -n "${CLAWDBOT_TAGLINE_INDEX:-}" ]]; then
        if [[ "${CLAWDBOT_TAGLINE_INDEX}" =~ ^[0-9]+$ ]]; then
            local idx=$((CLAWDBOT_TAGLINE_INDEX % count))
            echo "${TAGLINES[$idx]}"
            return
        fi
    fi
    local idx=$((RANDOM % count))
    echo "${TAGLINES[$idx]}"
}

TAGLINE=$(pick_tagline)

# Openclaw core version pinned by this installer.
# This keeps installs reproducible and avoids surprises from upstream dist-tags.
OPENCLAW_PINNED_VERSION="2026.3.23"

NO_ONBOARD=${CLAWDBOT_NO_ONBOARD:-0}
NO_PROMPT=${CLAWDBOT_NO_PROMPT:-0}
DRY_RUN=${CLAWDBOT_DRY_RUN:-0}
INSTALL_METHOD=${CLAWDBOT_INSTALL_METHOD:-}
CLAWDBOT_VERSION="${OPENCLAW_PINNED_VERSION}"
GIT_DIR_DEFAULT="${HOME}/openclaw"
GIT_DIR=${CLAWDBOT_GIT_DIR:-$GIT_DIR_DEFAULT}
GIT_UPDATE=${CLAWDBOT_GIT_UPDATE:-1}
SHARP_IGNORE_GLOBAL_LIBVIPS="${SHARP_IGNORE_GLOBAL_LIBVIPS:-1}"
NPM_LOGLEVEL="${CLAWDBOT_NPM_LOGLEVEL:-error}"
NPM_LEGACY_PEER_DEPS="${CLAWDBOT_NPM_LEGACY_PEER_DEPS:-1}"
NPM_SILENT_FLAG="--silent"
VERBOSE="${CLAWDBOT_VERBOSE:-0}"
CLAWDBOT_BIN=""
HELP=0
USE_CN_MIRRORS="${CLAWDBOT_USE_CN_MIRRORS:-}"

# Action mode (for manager menu)
ACTION="${CLAWDBOT_ACTION:-}"  # install, uninstall, upgrade, configure, status, repair, menu
UPGRADE_TARGET="${CLAWDBOT_UPGRADE_TARGET:-all}"  # all, core, plugins
UNINSTALL_PURGE="${CLAWDBOT_UNINSTALL_PURGE:-0}"  # 1 = delete all data and config
UNINSTALL_KEEP_CONFIG="${CLAWDBOT_UNINSTALL_KEEP_CONFIG:-0}"  # 1 = keep config files
INSTALL_FILE_TOOLS="${CLAWDBOT_FILE_TOOLS:-1}"  # 1 = install file parsing tools (pdftotext, pandoc) - enabled by default
INSTALL_PYTHON="${CLAWDBOT_PYTHON:-1}"  # 1 = install Python 3.12 - enabled by default

# China mirror URLs
CN_NPM_REGISTRY="https://registry.npmmirror.com"
CN_GITHUB_MIRROR="https://mirror.ghproxy.com/"
CN_HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
CN_HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
CN_HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"
CN_HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"
CN_HOMEBREW_INSTALL_SCRIPT="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install/raw/HEAD/install.sh"

# ============================================
# Channel Plugin Constants
# ============================================

# Openclaw core npm package name
CLAWDBOT_NPM_PKG="openclaw"

# ============================================
# Blocked Openclaw Versions
# ============================================
# 2026.2.6 series (including -1, -2, -3 suffixes) has a critical bug.
# The installer will refuse to install these and automatically select
# the latest safe version instead.
OPENCLAW_BLOCKED_VERSION_PATTERNS=("2026.2.6" "2026.2.6-*")

# Check if a version string matches any blocked pattern.
# Returns 0 (true) if blocked, 1 (false) if safe.
is_openclaw_version_blocked() {
    local version="$1"
    if [[ -z "$version" ]]; then
        return 1
    fi
    local pattern
    for pattern in "${OPENCLAW_BLOCKED_VERSION_PATTERNS[@]}"; do
        # shellcheck disable=SC2254
        case "$version" in
            $pattern) return 0 ;;
        esac
    done
    return 1
}

# Resolve the latest safe (non-blocked) openclaw version for a given dist-tag.
# If the tagged version is blocked, fetches all published versions and picks
# the highest one that is not blocked.
resolve_safe_openclaw_version() {
    local tag="${1:-latest}"

    # Fast path: tagged version is not blocked.
    local candidate=""
    candidate="$(npm view "${CLAWDBOT_NPM_PKG}@${tag}" version --prefer-online 2>/dev/null || true)"
    if [[ -n "$candidate" ]] && ! is_openclaw_version_blocked "$candidate"; then
        echo "$candidate"
        return 0
    fi

    # Tagged version is blocked (or unavailable). Fetch the full version list
    # and pick the highest safe one.
    local all_versions=""
    all_versions="$(npm view "${CLAWDBOT_NPM_PKG}" versions --json 2>/dev/null || true)"
    if [[ -z "$all_versions" ]]; then
        return 1
    fi

    local safe=""
    safe="$(BLOCKED_PATTERNS="${OPENCLAW_BLOCKED_VERSION_PATTERNS[*]}" node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8").trim();
if (!raw) process.exit(1);
let versions;
try { versions = JSON.parse(raw); } catch { process.exit(1); }
if (!Array.isArray(versions)) process.exit(1);

const blocked = (process.env.BLOCKED_PATTERNS || "").split(" ").filter(Boolean);
function isBlocked(v) {
  return blocked.some(p => {
    if (p.endsWith("*")) return v.startsWith(p.slice(0, -1));
    return v === p;
  });
}

// npm returns versions sorted by semver; pick the last non-blocked entry.
for (let i = versions.length - 1; i >= 0; i--) {
  if (!isBlocked(versions[i])) {
    process.stdout.write(versions[i]);
    process.exit(0);
  }
}
process.exit(1);
' <<< "$all_versions" 2>/dev/null || true)"

    if [[ -n "$safe" ]]; then
        echo "$safe"
        return 0
    fi
    return 1
}

# Channel IDs (used in config keys)
CHANNEL_DINGTALK="dingtalk"
CHANNEL_FEISHU="feishu"
CHANNEL_QQ="qqbot"

# Channel npm package names
CHANNEL_PKG_DINGTALK="clawdbot-dingtalk"
CHANNEL_PKG_QQ="@tencent-connect/openclaw-qqbot"
# QQ plugin registers itself as "openclaw-qqbot" (differs from npm package name)
CHANNEL_PLUGIN_ID_QQ="openclaw-qqbot"

# Channel display names
CHANNEL_NAME_DINGTALK="钉钉 (DingTalk)"
CHANNEL_NAME_FEISHU="飞书 (Feishu)"
CHANNEL_NAME_QQ="QQ"

# Channel action mode
CHANNEL_ACTION="${CLAWDBOT_CHANNEL_ACTION:-}"  # add, remove, configure, list
CHANNEL_TARGET="${CLAWDBOT_CHANNEL_TARGET:-}"  # dingtalk, feishu, qqbot

# Get package name for a channel (empty for built-in channels)
get_channel_package() {
    local channel="$1"
    case "$channel" in
        dingtalk) echo "$CHANNEL_PKG_DINGTALK" ;;
        qqbot)    echo "$CHANNEL_PKG_QQ" ;;
        feishu)   echo "" ;;
        *)        echo "" ;;
    esac
}

# Get display name for a channel
get_channel_display_name() {
    local channel="$1"
    case "$channel" in
        dingtalk) echo "$CHANNEL_NAME_DINGTALK" ;;
        feishu)   echo "$CHANNEL_NAME_FEISHU" ;;
        qqbot)    echo "$CHANNEL_NAME_QQ" ;;
        *)        echo "$channel" ;;
    esac
}

print_usage() {
    cat <<EOF
Openclaw Manager (macOS + Linux)

Usage:
  curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- [options]
  ./openclaw_install.sh [action] [options]

Actions:
  --install              Install Openclaw (default for pipe mode)
  --upgrade              Upgrade Openclaw (core pinned to ${OPENCLAW_PINNED_VERSION})
  --configure            Run configuration wizard
  --status               Show installation status
  --repair               Run repair/diagnostics menu
  --uninstall            Uninstall Openclaw
  --menu                 Show interactive menu (default for TTY mode)

Install Options:
  --install-method, --method npm|git   Install via npm (default) or from a git checkout
  --npm                               Shortcut for --install-method npm
  --git, --github                     Shortcut for --install-method git
  --version <version|dist-tag>         (ignored) Openclaw core is pinned to ${OPENCLAW_PINNED_VERSION}
  --beta                               (ignored) Openclaw core is pinned to ${OPENCLAW_PINNED_VERSION}
  --git-dir, --dir <path>             Checkout directory (default: ~/openclaw)
  --no-git-update                      Skip git pull for existing checkout

Upgrade Options:
  --upgrade-all          Upgrade all components (default)
  --upgrade-core         Only upgrade Openclaw core
  --upgrade-plugins      Only upgrade plugins

Uninstall Options:
  --purge                Delete all data and configuration
  --keep-config          Keep configuration files

Channel Management:
  --channel-add <name>       Add and configure a channel (dingtalk, feishu, qqbot)
  --channel-remove <name>    Remove a channel plugin/config
  --channel-configure <name> Reconfigure an existing channel
  --channel-list             List installed channel plugins

General Options:
  --no-onboard           Skip onboarding (non-interactive)
  --no-prompt            Disable prompts (required in CI/automation)
  --cn-mirrors, --china  Use China mirror sources (auto-detected)
  --no-cn-mirrors        Disable China mirrors even if detected
  --file-tools           Install file parsing tools (pdftotext, pandoc, catdoc) - enabled by default
  --no-file-tools        Skip file tools installation
  --python               Install Python 3.12 - enabled by default
  --no-python            Skip Python 3.12 installation
  --dry-run              Print what would happen (no changes)
  --verbose              Print debug output (set -x, npm verbose)
  --help, -h             Show this help

Logging Options:
  --log                  Enable logging to file
  --log-file <path>      Custom log file path (enables logging)
  --log-level <level>    Log level: debug|info|warn|error (default: info)
  --log-history <n>      Keep N historical log files (default: 5)

Environment variables:
  CLAWDBOT_ACTION=install|upgrade|uninstall|configure|status|repair|menu
  CLAWDBOT_INSTALL_METHOD=git|npm
  CLAWDBOT_VERSION=<ignored>    Openclaw core is pinned to ${OPENCLAW_PINNED_VERSION}
  CLAWDBOT_BETA=<ignored>      Openclaw core is pinned to ${OPENCLAW_PINNED_VERSION}
  CLAWDBOT_GIT_DIR=...
  CLAWDBOT_GIT_UPDATE=0|1
  CLAWDBOT_NO_PROMPT=1
  CLAWDBOT_DRY_RUN=1
  CLAWDBOT_NO_ONBOARD=1
  CLAWDBOT_VERBOSE=1
  CLAWDBOT_NPM_LOGLEVEL=error|warn|notice  Default: error (hide npm deprecation noise)
  CLAWDBOT_NPM_LEGACY_PEER_DEPS=0|1       Default: 1 (skip installing peer deps like node-llama-cpp)
  SHARP_IGNORE_GLOBAL_LIBVIPS=0|1    Default: 1 (avoid sharp building against global libvips)
  CLAWDBOT_USE_CN_MIRRORS=0|1       Use China mirror sources for faster installation
  CLAWDBOT_UPGRADE_TARGET=all|core|plugins
  CLAWDBOT_UNINSTALL_PURGE=0|1
  CLAWDBOT_UNINSTALL_KEEP_CONFIG=0|1
  CLAWDBOT_FILE_TOOLS=0|1          Install file parsing tools (default: 1)
  CLAWDBOT_PYTHON=0|1              Install Python 3.12 (default: 1)
  CLAWDBOT_LOG=0|1                 Enable logging to file
  CLAWDBOT_LOG_FILE=<path>         Custom log file path
  CLAWDBOT_LOG_LEVEL=debug|info|warn|error  Log level (default: info)
  CLAWDBOT_LOG_HISTORY=<n>         Historical log files to keep (default: 5)
  CLAWDBOT_CHANNEL_ACTION=add|remove|configure|list  Channel management action
  CLAWDBOT_CHANNEL_TARGET=dingtalk|feishu|qqbot  Target channel

Examples:
  # Interactive menu (TTY mode)
  ./openclaw_install.sh

  # Install via pipe
  curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash

  # Upgrade all components
  ./openclaw_install.sh --upgrade

  # Upgrade only core
  ./openclaw_install.sh --upgrade-core

  # Show status
  ./openclaw_install.sh --status

  # Uninstall but keep config
  ./openclaw_install.sh --uninstall --keep-config

  # Complete uninstall with purge
  ./openclaw_installer.sh --uninstall --purge

  # Add a channel plugin
  ./openclaw_installer.sh --channel-add dingtalk
  ./openclaw_installer.sh --channel-add feishu
  ./openclaw_installer.sh --channel-add qqbot

  # List installed channels
  ./openclaw_installer.sh --channel-list
EOF
}

require_arg() {
    local flag="$1"
    local value="${2:-}"
    if [[ -z "$value" || "$value" == --* ]]; then
        echo -e "${ERROR}Error: ${flag} requires a value${NC}" >&2
        exit 2
    fi
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            # Action arguments
            --install)
                ACTION="install"
                shift
                ;;
            --uninstall)
                ACTION="uninstall"
                shift
                ;;
            --upgrade)
                ACTION="upgrade"
                shift
                ;;
            --configure)
                ACTION="configure"
                shift
                ;;
            --status)
                ACTION="status"
                shift
                ;;
            --repair)
                ACTION="repair"
                shift
                ;;
            --menu)
                ACTION="menu"
                shift
                ;;
            # Upgrade options
            --upgrade-all)
                ACTION="upgrade"
                UPGRADE_TARGET="all"
                shift
                ;;
            --upgrade-core)
                ACTION="upgrade"
                UPGRADE_TARGET="core"
                shift
                ;;
            --upgrade-plugins)
                ACTION="upgrade"
                UPGRADE_TARGET="plugins"
                shift
                ;;
            # Uninstall options
            --purge)
                UNINSTALL_PURGE=1
                shift
                ;;
            --keep-config)
                UNINSTALL_KEEP_CONFIG=1
                shift
                ;;
            # Existing options
            --no-onboard)
                NO_ONBOARD=1
                shift
                ;;
            --onboard)
                NO_ONBOARD=0
                shift
                ;;
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            --verbose)
                VERBOSE=1
                shift
                ;;
            --no-prompt)
                NO_PROMPT=1
                shift
                ;;
            --help|-h)
                HELP=1
                shift
                ;;
            --install-method|--method)
                require_arg "$1" "${2:-}"
                INSTALL_METHOD="$2"
                shift 2
                ;;
            --version)
                require_arg "$1" "${2:-}"
                echo -e "${WARN}→${NC} --version 已忽略: Openclaw 版本已固定为 ${OPENCLAW_PINNED_VERSION}" >&2
                shift 2
                ;;
            --beta)
                echo -e "${WARN}→${NC} --beta 已忽略: Openclaw 版本已固定为 ${OPENCLAW_PINNED_VERSION}" >&2
                shift
                ;;
            --npm)
                INSTALL_METHOD="npm"
                shift
                ;;
            --git|--github)
                INSTALL_METHOD="git"
                shift
                ;;
            --git-dir|--dir)
                require_arg "$1" "${2:-}"
                GIT_DIR="$2"
                shift 2
                ;;
            --no-git-update)
                GIT_UPDATE=0
                shift
                ;;
            --cn-mirrors|--china)
                USE_CN_MIRRORS=1
                shift
                ;;
            --no-cn-mirrors)
                USE_CN_MIRRORS=0
                shift
                ;;
            --log)
                LOG_ENABLED=1
                shift
                ;;
            --log-file)
                LOG_ENABLED=1
                require_arg "$1" "${2:-}"
                LOG_FILE="$2"
                shift 2
                ;;
            --log-level)
                require_arg "$1" "${2:-}"
                LOG_LEVEL="$2"
                shift 2
                ;;
            --log-history)
                require_arg "$1" "${2:-}"
                LOG_HISTORY="$2"
                shift 2
                ;;
            --file-tools)
                INSTALL_FILE_TOOLS=1
                shift
                ;;
            --no-file-tools)
                INSTALL_FILE_TOOLS=0
                shift
                ;;
            --python)
                INSTALL_PYTHON=1
                shift
                ;;
            --no-python)
                INSTALL_PYTHON=0
                shift
                ;;
            # Channel management options
            --channel-add)
                CHANNEL_ACTION="add"
                require_arg "$1" "${2:-}"
                CHANNEL_TARGET="$2"
                shift 2
                ;;
            --channel-remove)
                CHANNEL_ACTION="remove"
                require_arg "$1" "${2:-}"
                CHANNEL_TARGET="$2"
                shift 2
                ;;
            --channel-configure)
                CHANNEL_ACTION="configure"
                require_arg "$1" "${2:-}"
                CHANNEL_TARGET="$2"
                shift 2
                ;;
            --channel-list)
                CHANNEL_ACTION="list"
                shift
                ;;
            *)
                echo -e "${WARN}→${NC} Unknown option: $1 (ignored)" >&2
                shift
                ;;
        esac
    done
}

configure_verbose() {
    if [[ "$VERBOSE" != "1" ]]; then
        return 0
    fi
    if [[ "$NPM_LOGLEVEL" == "error" ]]; then
        NPM_LOGLEVEL="notice"
    fi
    NPM_SILENT_FLAG=""
    set -x
}

# Detect and prompt for China mirrors
# GeoIP-based China detection (most accurate).
# Queries lightweight public GeoIP APIs with a short timeout.
# Returns 0 if China mainland detected, 1 otherwise.
detect_cn_geoip() {
    # Need curl or wget
    local dl=""
    if command -v curl &>/dev/null; then
        dl="curl"
    elif command -v wget &>/dev/null; then
        dl="wget"
    else
        return 1
    fi

    # Helper: fetch a URL with 3-second timeout, return body on stdout
    _geoip_fetch() {
        local url="$1"
        if [[ "$dl" == "curl" ]]; then
            curl -fsSL --connect-timeout 3 --max-time 5 "$url" 2>/dev/null || true
        else
            wget -qO- --timeout=5 "$url" 2>/dev/null || true
        fi
    }

    local country=""

    # Try multiple GeoIP services with fast fallback.
    # Service 1: ipinfo.io (returns bare country code, e.g. "CN")
    if [[ -z "$country" ]]; then
        country="$(_geoip_fetch "https://ipinfo.io/country" | tr -d '[:space:]')"
    fi

    # Service 2: ip-api.com (free, no key required, returns JSON)
    if [[ -z "$country" ]]; then
        local json=""
        json="$(_geoip_fetch "http://ip-api.com/json/?fields=countryCode")"
        if [[ -n "$json" ]]; then
            country="$(printf '%s' "$json" | sed -n 's/.*"countryCode"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
        fi
    fi

    # Service 3: Alibaba Cloud metadata (works only on ECS instances)
    if [[ -z "$country" ]]; then
        local region=""
        region="$(_geoip_fetch "http://100.100.100.200/latest/meta-data/region-id")"
        if [[ -n "$region" && "$region" == cn-* ]]; then
            country="CN"
        fi
    fi

    if [[ "$country" == "CN" ]]; then
        return 0
    fi
    return 1
}

detect_cn_mirrors() {
    # If explicitly set via env or CLI, skip detection
    if [[ "$USE_CN_MIRRORS" == "1" ]]; then
        echo -e "${INFO}i${NC} China mirror mode enabled via environment/CLI."
        return 0
    fi
    if [[ "$USE_CN_MIRRORS" == "0" ]]; then
        return 1
    fi

    local is_china=false
    local detect_method=""

    # Method 1 (most accurate): GeoIP lookup via public APIs
    if detect_cn_geoip; then
        is_china=true
        detect_method="GeoIP"
    fi

    # Method 2: Check TZ environment variable
    if [[ "$is_china" != "true" ]]; then
        case "${TZ:-}" in
            Asia/Shanghai|Asia/Chongqing|Asia/Harbin|Asia/Urumqi|PRC)
                is_china=true
                detect_method="TZ"
                ;;
        esac
    fi

    # Method 3: Check /etc/timezone (Linux)
    if [[ "$is_china" != "true" && -f /etc/timezone ]]; then
        if grep -qE "Asia/(Shanghai|Chongqing|Harbin)" /etc/timezone 2>/dev/null; then
            is_china=true
            detect_method="timezone"
        fi
    fi

    # Method 4: Check timedatectl (systemd-based Linux)
    if [[ "$is_china" != "true" ]] && command -v timedatectl &>/dev/null; then
        if timedatectl 2>/dev/null | grep -qE "Asia/(Shanghai|Chongqing)"; then
            is_china=true
            detect_method="timedatectl"
        fi
    fi

    # Method 5: Check locale/language settings
    local lang="${LANG:-}${LC_ALL:-}"
    if [[ "$is_china" != "true" && "$lang" == *"zh_CN"* ]]; then
        is_china=true
        detect_method="locale"
    fi

    # Method 6: Fallback - check date output for CST (less reliable)
    # Only use CST if we also have zh_CN hints to avoid US Central confusion
    if [[ "$is_china" != "true" ]]; then
        local tz=""
        tz="$(date +%Z 2>/dev/null || true)"
        if [[ "$tz" == "CST" && "$lang" == *"zh"* ]]; then
            is_china=true
            detect_method="CST+locale"
        fi
    fi

    if [[ "$is_china" == "true" ]]; then
        # Auto-enable CN mirrors when China region is detected
        USE_CN_MIRRORS=1
        log info "China mainland detected via ${detect_method}, enabling CN mirrors"
        echo -e "${INFO}i${NC} 检测到中国大陆 (${detect_method})，已自动启用国内镜像加速"
        return 0
    fi

    USE_CN_MIRRORS=0
    return 1
}

# Idempotent flag for CN mirrors
CN_MIRRORS_APPLIED=0

# Apply CN mirror configurations
apply_cn_mirrors() {
    if [[ "$USE_CN_MIRRORS" != "1" ]]; then
        return 0
    fi
    if [[ "$CN_MIRRORS_APPLIED" == "1" ]]; then
        return 0  # Already configured, skip
    fi
    CN_MIRRORS_APPLIED=1

    echo -e "${WARN}→${NC} Configuring China mirror sources..."

    # NPM registry and performance optimizations
    if command -v npm &> /dev/null; then
        npm config set registry "$CN_NPM_REGISTRY"
        echo -e "${SUCCESS}✓${NC} npm registry set to ${INFO}${CN_NPM_REGISTRY}${NC}"

        # Prefer offline for faster installs (use cached packages when possible)
        npm config set prefer-offline true

        # Increase parallel connections for faster downloads
        npm config set maxsockets 50
        npm config set fetch-retries 5
        npm config set fetch-retry-mintimeout 10000
        npm config set fetch-retry-maxtimeout 60000
        echo -e "${SUCCESS}✓${NC} npm performance optimizations applied (maxsockets=50, prefer-offline)"
    fi

    # Sharp binary mirror (use env vars, not npm config)
    export SHARP_BINARY_HOST="https://npmmirror.com/mirrors/sharp"
    export SHARP_LIBVIPS_BINARY_HOST="https://npmmirror.com/mirrors/sharp-libvips"
    export npm_config_sharp_binary_host="https://npmmirror.com/mirrors/sharp"
    export npm_config_sharp_libvips_binary_host="https://npmmirror.com/mirrors/sharp-libvips"
    echo -e "${SUCCESS}✓${NC} sharp binary mirrors configured"

    # === Additional native module binary mirrors ===

    # Electron (common for desktop apps)
    export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
    export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

    # Node.js prebuilt binaries (for nvm, n, etc.)
    export NODEJS_ORG_MIRROR="https://npmmirror.com/mirrors/node/"
    export NVM_NODEJS_ORG_MIRROR="https://npmmirror.com/mirrors/node/"
    export N_NODE_MIRROR="https://npmmirror.com/mirrors/node/"

    # Puppeteer/Playwright (browser automation)
    export PUPPETEER_DOWNLOAD_BASE_URL="https://npmmirror.com/mirrors/chromium-browser-snapshots"
    export PLAYWRIGHT_DOWNLOAD_HOST="https://npmmirror.com/mirrors/playwright/"

    # Node-sass
    export SASS_BINARY_SITE="https://npmmirror.com/mirrors/node-sass/"

    # SQLite3
    export SQLITE3_BINARY_SITE="https://npmmirror.com/mirrors/sqlite3/"

    # Sentry CLI
    export SENTRYCLI_CDNURL="https://npmmirror.com/mirrors/sentry-cli/"

    # SWC (Rust-based compiler)
    export SWC_BINARY_SITE="https://npmmirror.com/mirrors/swc/"

    # Canvas (node-canvas)
    export CANVAS_BINARY_HOST="https://npmmirror.com/mirrors/canvas/"

    echo -e "${SUCCESS}✓${NC} Native module binary mirrors configured (electron, puppeteer, etc.)"

    # Homebrew mirrors (macOS)
    if [[ "$OS" == "macos" ]]; then
        export HOMEBREW_API_DOMAIN="$CN_HOMEBREW_API_DOMAIN"
        export HOMEBREW_BOTTLE_DOMAIN="$CN_HOMEBREW_BOTTLE_DOMAIN"
        export HOMEBREW_BREW_GIT_REMOTE="$CN_HOMEBREW_BREW_GIT_REMOTE"
        export HOMEBREW_CORE_GIT_REMOTE="$CN_HOMEBREW_CORE_GIT_REMOTE"
        echo -e "${SUCCESS}✓${NC} Homebrew mirrors configured (TUNA)"
    fi
}

# Get GitHub URL with optional mirror
github_url() {
    local original_url="$1"
    if [[ "$USE_CN_MIRRORS" == "1" ]]; then
        echo "${CN_GITHUB_MIRROR}${original_url}"
    else
        echo "$original_url"
    fi
}

is_promptable() {
    if [[ "$NO_PROMPT" == "1" ]]; then
        return 1
    fi
    if [[ -r /dev/tty && -w /dev/tty ]]; then
        return 0
    fi
    return 1
}

prompt_choice() {
    local prompt="$1"
    local answer=""
    if ! is_promptable; then
        return 1
    fi
    echo -e "$prompt" > /dev/tty
    read -r answer < /dev/tty || true
    echo "$answer"
}

detect_clawdbot_checkout() {
    local dir="$1"
    if [[ ! -f "$dir/package.json" ]]; then
        return 1
    fi
    if [[ ! -f "$dir/pnpm-workspace.yaml" ]]; then
        return 1
    fi
    if ! grep -q '"name"[[:space:]]*:[[:space:]]*"clawdbot"' "$dir/package.json" 2>/dev/null; then
        return 1
    fi
    echo "$dir"
    return 0
}

clack_intro "🦀 Openclaw Installer"
clack_step "${ACCENT_DIM}${TAGLINE}${NC}"
echo -e "${ACCENT}│${NC}"

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
    OS="linux"
fi

if [[ "$OS" == "unknown" ]]; then
    echo -e "${ERROR}Error: Unsupported operating system${NC}"
    echo "This installer supports macOS and Linux (including WSL)."
    echo "For Windows, use: iwr -useb https://openclaw.ai/install.ps1 | iex"
    exit 1
fi

clack_step "${SUCCESS}✓${NC} Detected: $OS"

# Check for Homebrew on macOS
install_homebrew() {
    if [[ "$OS" == "macos" ]]; then
        if ! command -v brew &> /dev/null; then
            log info "Installing Homebrew..."
            echo -e "${WARN}→${NC} Installing Homebrew..."
            local brew_install_url="https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"
            if [[ "$USE_CN_MIRRORS" == "1" ]]; then
                brew_install_url="$CN_HOMEBREW_INSTALL_SCRIPT"
                log debug "Using CN mirror for Homebrew: $brew_install_url"
                echo -e "${INFO}i${NC} Using TUNA mirror for Homebrew install"
            fi
            run_remote_bash "$brew_install_url"

            # Add Homebrew to PATH for this session
            if [[ -f "/opt/homebrew/bin/brew" ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            elif [[ -f "/usr/local/bin/brew" ]]; then
                eval "$(/usr/local/bin/brew shellenv)"
            fi
            log info "Homebrew installed successfully"
            echo -e "${SUCCESS}✓${NC} Homebrew installed"
        else
            log debug "Homebrew already installed"
            echo -e "${SUCCESS}✓${NC} Homebrew already installed"
        fi
    fi
}

# Check Node.js version (OpenClaw requires >=22.12.0)
check_node() {
    if command -v node &> /dev/null; then
        local full_version
        full_version=$(node -v | cut -d'v' -f2)
        local major minor
        major=$(echo "$full_version" | cut -d'.' -f1)
        minor=$(echo "$full_version" | cut -d'.' -f2)
        if [[ "$major" -gt 22 ]] || { [[ "$major" -eq 22 ]] && [[ "$minor" -ge 12 ]]; }; then
            echo -e "${SUCCESS}✓${NC} Node.js v${full_version} found"
            return 0
        else
            echo -e "${WARN}→${NC} Node.js v${full_version} found, but v22.12.0+ required"
            return 1
        fi
    else
        echo -e "${WARN}→${NC} Node.js not found"
        return 1
    fi
}

# Install Node.js
install_node() {
    log info "Installing Node.js..."
    if [[ "$OS" == "macos" ]]; then
        log debug "Using Homebrew to install Node.js"
        spinner_start "Installing Node.js via Homebrew..."
        if brew install node@22 >/dev/null 2>&1 && brew link node@22 --overwrite --force >/dev/null 2>&1; then
            log info "Node.js installed successfully via Homebrew"
            spinner_stop 0 "Node.js installed via Homebrew"
        else
            # Fallback: show output on error
            log warn "Node.js installation via Homebrew had issues, retrying..."
            spinner_stop 1 "Node.js installation had issues"
            brew install node@22
            brew link node@22 --overwrite --force 2>/dev/null || true
        fi
    elif [[ "$OS" == "linux" ]]; then
        log debug "Using NodeSource to install Node.js"
        spinner_start "Installing Node.js via NodeSource..."
        require_sudo
        local install_ok=0
        if command -v apt-get &> /dev/null; then
            local tmp
            tmp="$(mktempfile)"
            download_file "https://deb.nodesource.com/setup_22.x" "$tmp"
            maybe_sudo -E bash "$tmp" >/dev/null 2>&1
            apt_install install -y nodejs >/dev/null 2>&1 && install_ok=1
        elif command -v dnf &> /dev/null; then
            local tmp
            tmp="$(mktempfile)"
            download_file "https://rpm.nodesource.com/setup_22.x" "$tmp"
            maybe_sudo bash "$tmp" >/dev/null 2>&1
            maybe_sudo dnf install -y nodejs >/dev/null 2>&1 && install_ok=1
        elif command -v yum &> /dev/null; then
            local tmp
            tmp="$(mktempfile)"
            download_file "https://rpm.nodesource.com/setup_22.x" "$tmp"
            maybe_sudo bash "$tmp" >/dev/null 2>&1
            maybe_sudo yum install -y nodejs >/dev/null 2>&1 && install_ok=1
        else
            log error "Could not detect package manager for Node.js installation"
            spinner_stop 1 "Could not detect package manager"
            echo -e "${ERROR}Error: Could not detect package manager${NC}"
            echo "Please install Node.js 22+ manually: https://nodejs.org"
            exit 1
        fi
        if [[ "$install_ok" -eq 1 ]]; then
            log info "Node.js installed successfully"
            spinner_stop 0 "Node.js installed"
        else
            log error "Node.js installation failed"
            spinner_stop 1 "Node.js installation failed"
        fi
    fi
}

# Check Git
check_git() {
    if command -v git &> /dev/null; then
        echo -e "${SUCCESS}✓${NC} Git already installed"
        return 0
    fi
    echo -e "${WARN}→${NC} Git not found"
    return 1
}

is_root() {
    [[ "$(id -u)" -eq 0 ]]
}

# Run a command with sudo only if not already root
maybe_sudo() {
    if is_root; then
        # Skip -E flag when root (env is already preserved)
        if [[ "${1:-}" == "-E" ]]; then
            shift
        fi
        "$@"
    else
        sudo "$@"
    fi
}

# Run apt-get with DEBIAN_FRONTEND=noninteractive
apt_install() {
    if is_root; then
        DEBIAN_FRONTEND=noninteractive apt-get "$@"
    else
        sudo DEBIAN_FRONTEND=noninteractive apt-get "$@"
    fi
}

require_sudo() {
    if [[ "$OS" != "linux" ]]; then
        return 0
    fi
    if is_root; then
        return 0
    fi
    if command -v sudo &> /dev/null; then
        return 0
    fi
    echo -e "${ERROR}Error: sudo is required for system installs on Linux${NC}"
    echo "Install sudo or re-run as root."
    exit 1
}

install_git() {
    echo -e "${WARN}→${NC} Installing Git..."
    if [[ "$OS" == "macos" ]]; then
        brew install git
    elif [[ "$OS" == "linux" ]]; then
        require_sudo
        if command -v apt-get &> /dev/null; then
            apt_install update -y
            apt_install install -y git
        elif command -v dnf &> /dev/null; then
            maybe_sudo dnf install -y git
        elif command -v yum &> /dev/null; then
            maybe_sudo yum install -y git
        else
            echo -e "${ERROR}Error: Could not detect package manager for Git${NC}"
            exit 1
        fi
    fi
    echo -e "${SUCCESS}✓${NC} Git installed"
}

# Check lsof (used for port conflict detection)
check_lsof() {
    if command -v lsof &> /dev/null; then
        echo -e "${SUCCESS}✓${NC} lsof already installed"
        return 0
    fi
    echo -e "${WARN}→${NC} lsof not found"
    return 1
}

# Install lsof (used for port conflict detection)
install_lsof() {
    log info "Installing lsof..."
    spinner_start "Installing lsof (used for port conflict detection)..."
    local install_ok=0

    if [[ "$OS" == "macos" ]]; then
        # lsof is pre-installed on macOS
        install_ok=1
    elif [[ "$OS" == "linux" ]]; then
        require_sudo
        if command -v apt-get &> /dev/null; then
            apt_install update -y >/dev/null 2>&1
            if apt_install install -y lsof >/dev/null 2>&1; then
                install_ok=1
            fi
        elif command -v dnf &> /dev/null; then
            if maybe_sudo dnf install -y lsof >/dev/null 2>&1; then
                install_ok=1
            fi
        elif command -v yum &> /dev/null; then
            if maybe_sudo yum install -y lsof >/dev/null 2>&1; then
                install_ok=1
            fi
        elif command -v apk &> /dev/null; then
            # Alpine Linux
            if maybe_sudo apk add --no-cache lsof >/dev/null 2>&1; then
                install_ok=1
            fi
        fi
    fi

    if [[ "$install_ok" -eq 1 ]]; then
        log info "lsof installed successfully"
        spinner_stop 0 "lsof installed"
        return 0
    else
        log warn "lsof installation failed"
        spinner_stop 1 "lsof installation failed (port conflict detection may not work)"
        return 1
    fi
}

# Check Chromium
check_chromium() {
    # Check for chromium or chromium-browser or google-chrome
    if command -v chromium &> /dev/null; then
        echo -e "${SUCCESS}✓${NC} Chromium already installed (chromium)"
        return 0
    fi
    if command -v chromium-browser &> /dev/null; then
        echo -e "${SUCCESS}✓${NC} Chromium already installed (chromium-browser)"
        return 0
    fi
    if command -v google-chrome &> /dev/null; then
        echo -e "${SUCCESS}✓${NC} Chrome already installed (google-chrome)"
        return 0
    fi
    if command -v google-chrome-stable &> /dev/null; then
        echo -e "${SUCCESS}✓${NC} Chrome already installed (google-chrome-stable)"
        return 0
    fi
    # macOS: check Applications folder
    if [[ "$OS" == "macos" ]]; then
        if [[ -d "/Applications/Google Chrome.app" ]] || [[ -d "/Applications/Chromium.app" ]]; then
            echo -e "${SUCCESS}✓${NC} Chrome/Chromium already installed (macOS app)"
            return 0
        fi
    fi
    echo -e "${WARN}→${NC} Chromium/Chrome not found"
    return 1
}

# Install Chromium
install_chromium() {
    log info "Installing Chromium/Chrome..."
    spinner_start "Installing Chromium/Chrome..."
    local install_result=0

    if [[ "$OS" == "macos" ]]; then
        log debug "Trying Homebrew chromium cask..."
        if brew install --cask chromium >/dev/null 2>&1 || brew install chromium >/dev/null 2>&1; then
            install_result=0
        else
            log debug "Chromium cask failed, trying Google Chrome..."
            spinner_update "Chromium cask failed, trying Google Chrome..."
            if brew install --cask google-chrome >/dev/null 2>&1; then
                install_result=0
            else
                log warn "Chrome installation also failed"
                install_result=1
            fi
        fi
    elif [[ "$OS" == "linux" ]]; then
        require_sudo

        # On Debian/Ubuntu, the chromium-browser package triggers slow Snap install
        # Instead, download Google Chrome deb directly (much faster in China)
        if command -v apt-get &> /dev/null; then
            local chrome_deb
            chrome_deb="$(mktempfile).deb"

            # Try to download Google Chrome (with ARM64 support)
            local arch
            arch="$(uname -m)"
            local chrome_deb_url=""
            case "$arch" in
                x86_64|amd64)
                    chrome_deb_url="https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
                    ;;
                aarch64|arm64)
                    # Chrome is not available for ARM64 Linux, use Chromium instead
                    spinner_update "Chrome not available for ARM64, trying Chromium..."
                    apt_install update -y >/dev/null 2>&1
                    if apt_install install -y chromium >/dev/null 2>&1 || apt_install install -y chromium-browser >/dev/null 2>&1; then
                        spinner_stop 0 "Chromium installed"
                        return 0
                    fi
                    spinner_stop 1 "Chromium install failed"
                    return 1
                    ;;
                *)
                    spinner_update "Unsupported architecture for Chrome: $arch, trying chromium..."
                    apt_install update -y >/dev/null 2>&1
                    if apt_install install -y chromium >/dev/null 2>&1 || apt_install install -y chromium-browser >/dev/null 2>&1; then
                        spinner_stop 0 "Chromium installed"
                        return 0
                    else
                        spinner_stop 1 "Chromium package failed"
                        return 1
                    fi
                    ;;
            esac
            if download_file "$chrome_deb_url" "$chrome_deb" 2>/dev/null; then
                if apt_install install -y "$chrome_deb" >/dev/null 2>&1; then
                    install_result=0
                else
                    spinner_update "Chrome deb install failed, trying dependencies..."
                    apt_install install -y -f >/dev/null 2>&1
                    if apt_install install -y "$chrome_deb" >/dev/null 2>&1; then
                        install_result=0
                    else
                        install_result=1
                    fi
                fi
                rm -f "$chrome_deb"
            else
                spinner_update "Chrome download failed, trying chromium package..."
                # Fallback to chromium (may trigger snap on newer Ubuntu)
                apt_install update -y >/dev/null 2>&1
                if apt_install install -y chromium >/dev/null 2>&1 || apt_install install -y chromium-browser >/dev/null 2>&1; then
                    install_result=0
                else
                    spinner_stop 1 "chromium package failed"
                    echo -e "${INFO}i${NC} Please install Chrome/Chromium manually for browser features."
                    return 1
                fi
            fi
        elif command -v dnf &> /dev/null; then
            if maybe_sudo dnf install -y chromium >/dev/null 2>&1; then
                install_result=0
            else
                install_result=1
            fi
        elif command -v yum &> /dev/null; then
            if maybe_sudo yum install -y chromium >/dev/null 2>&1; then
                install_result=0
            else
                install_result=1
            fi
        else
            spinner_stop 1 "Could not detect package manager for Chromium"
            echo -e "${INFO}i${NC} Please install Chromium manually for browser features."
            return 1
        fi
    fi

    if [[ "$install_result" -eq 0 ]]; then
        spinner_stop 0 "Chrome/Chromium installed"
    else
        spinner_stop 1 "Chrome/Chromium installation failed"
    fi
    return $install_result
}

# ============================================
# File Parsing Tools (Optional)
# ============================================

# Check if file parsing tools are installed
check_file_tools() {
    command -v pdftotext &>/dev/null && \
    command -v pandoc &>/dev/null
}

# Install file parsing tools for document content extraction
install_file_tools() {
    log info "Installing file parsing tools and fonts..."
    spinner_start "Installing file parsing tools (pdftotext, pandoc, catdoc) and fonts..."
    local install_result=0

    if [[ "$OS" == "macos" ]]; then
        if brew install poppler pandoc catdoc >/dev/null 2>&1; then
            install_result=0
        else
            log warn "Some file tools installation failed"
            install_result=1
        fi
    elif [[ "$OS" == "linux" ]]; then
        require_sudo
        if command -v apt-get &>/dev/null; then
            if apt_install install -y poppler-utils pandoc catdoc fonts-noto-cjk fonts-liberation >/dev/null 2>&1; then
                install_result=0
            else
                install_result=1
            fi
        elif command -v dnf &>/dev/null || command -v yum &>/dev/null; then
            # RHEL/CentOS/Fedora: package names differ across versions/repos.
            # Split installs so a missing font package doesn't prevent the other tools from installing.
            local pm="yum"
            if command -v dnf &>/dev/null; then
                pm="dnf"
            fi

            maybe_sudo "$pm" install -y poppler-utils pandoc catdoc >/dev/null 2>&1 || install_result=1
            maybe_sudo "$pm" install -y liberation-fonts >/dev/null 2>&1 || install_result=1

            # Noto CJK fonts (CentOS/RHEL commonly provide ttc packages)
            local noto_ok=0
            local -a noto_candidates=(
                google-noto-sans-cjk-ttc-fonts
                google-noto-serif-cjk-ttc-fonts
                google-noto-sans-cjk-fonts
                google-noto-cjk-fonts
            )
            local pkg=""
            for pkg in "${noto_candidates[@]}"; do
                if maybe_sudo "$pm" install -y "$pkg" >/dev/null 2>&1; then
                    noto_ok=1
                    break
                fi
            done
            if [[ "$noto_ok" -eq 0 ]]; then
                # Keep going (tools may still be useful), but mark partial failure.
                install_result=1
            fi
        else
            spinner_stop 1 "Could not detect package manager for file tools"
            echo -e "${INFO}i${NC} Please install poppler-utils, pandoc, catdoc, and CJK fonts (fonts-noto-cjk or google-noto-sans-cjk-ttc-fonts) plus Liberation fonts (fonts-liberation or liberation-fonts) manually."
            return 1
        fi

        # Refresh font cache if available (best-effort)
        if command -v fc-cache &>/dev/null; then
            maybe_sudo fc-cache -f >/dev/null 2>&1 || true
        fi
    fi

    if [[ "$install_result" -eq 0 ]]; then
        spinner_stop 0 "File parsing tools and fonts installed"
    else
        spinner_stop 1 "Some file parsing tools installation failed"
    fi
    return $install_result
}

# ============================================
# Python 3.12 Installation
# ============================================

# Check if Python 3.12+ is installed
check_python() {
    local python_cmd=""
    # Check python3 first
    if command -v python3 &>/dev/null; then
        python_cmd="python3"
    elif command -v python &>/dev/null; then
        python_cmd="python"
    else
        echo -e "${WARN}→${NC} Python not found"
        return 1
    fi

    # Check version (need 3.12+)
    local version=""
    version="$($python_cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
    if [[ -z "$version" ]]; then
        echo -e "${WARN}→${NC} Could not determine Python version"
        return 1
    fi

    local major="${version%%.*}"
    local minor="${version#*.}"

    if [[ "$major" -gt 3 || ( "$major" -eq 3 && "$minor" -ge 12 ) ]]; then
        echo -e "${SUCCESS}✓${NC} Python ${version} already installed ($python_cmd)"
        return 0
    else
        echo -e "${WARN}→${NC} Python ${version} found, but 3.12+ required"
        return 1
    fi
}

# Install Python 3.12
install_python() {
    log info "Installing Python 3.12..."
    spinner_start "Installing Python 3.12..."
    local install_result=0

    if [[ "$OS" == "macos" ]]; then
        if brew install python@3.12 >/dev/null 2>&1; then
            # Link python3 to python3.12 if needed
            brew link python@3.12 --overwrite --force >/dev/null 2>&1 || true
            install_result=0
        else
            log warn "Python 3.12 installation via Homebrew failed"
            install_result=1
        fi
    elif [[ "$OS" == "linux" ]]; then
        require_sudo
        if command -v apt-get &>/dev/null; then
            # For Ubuntu/Debian, may need deadsnakes PPA for Python 3.12
            apt_install update -y >/dev/null 2>&1
            if apt_install install -y python3.12 python3.12-venv python3-pip >/dev/null 2>&1; then
                install_result=0
            else
                # Try adding deadsnakes PPA for older Ubuntu versions
                spinner_update "Adding deadsnakes PPA for Python 3.12..."
                if maybe_sudo add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1; then
                    apt_install update -y >/dev/null 2>&1
                    if apt_install install -y python3.12 python3.12-venv >/dev/null 2>&1; then
                        install_result=0
                    else
                        install_result=1
                    fi
                else
                    # Fallback: try system python3
                    if apt_install install -y python3 python3-venv python3-pip >/dev/null 2>&1; then
                        install_result=0
                        log info "Installed system python3 (may be < 3.12)"
                    else
                        install_result=1
                    fi
                fi
            fi
        elif command -v dnf &>/dev/null; then
            if maybe_sudo dnf install -y python3.12 python3.12-pip >/dev/null 2>&1; then
                install_result=0
            elif maybe_sudo dnf install -y python3 python3-pip >/dev/null 2>&1; then
                install_result=0
                log info "Installed system python3 (may be < 3.12)"
            else
                install_result=1
            fi
        elif command -v yum &>/dev/null; then
            if maybe_sudo yum install -y python3 python3-pip >/dev/null 2>&1; then
                install_result=0
            else
                install_result=1
            fi
        elif command -v apk &>/dev/null; then
            # Alpine Linux
            if maybe_sudo apk add --no-cache python3 py3-pip >/dev/null 2>&1; then
                install_result=0
            else
                install_result=1
            fi
        else
            spinner_stop 1 "Could not detect package manager for Python"
            echo -e "${INFO}i${NC} Please install Python 3.12+ manually: https://www.python.org/downloads/"
            return 1
        fi
    fi

    if [[ "$install_result" -eq 0 ]]; then
        log info "Python installed successfully"
        spinner_stop 0 "Python 3.12 installed"
    else
        log warn "Python installation failed"
        spinner_stop 1 "Python installation failed"
        echo -e "${INFO}i${NC} Please install Python 3.12+ manually: https://www.python.org/downloads/"
    fi
    return $install_result
}


# Fix npm permissions for global installs (Linux)
fix_npm_permissions() {
    if [[ "$OS" != "linux" ]]; then
        return 0
    fi

    local npm_prefix
    npm_prefix="$(npm config get prefix 2>/dev/null || true)"
    if [[ -z "$npm_prefix" ]]; then
        return 0
    fi

    if [[ -w "$npm_prefix" || -w "$npm_prefix/lib" ]]; then
        return 0
    fi

    echo -e "${WARN}→${NC} Configuring npm for user-local installs..."
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"

    # shellcheck disable=SC2016
    local path_line='export PATH="$HOME/.npm-global/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [[ -f "$rc" ]] && ! grep -q ".npm-global" "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done

    export PATH="$HOME/.npm-global/bin:$PATH"
    echo -e "${SUCCESS}✓${NC} npm configured for user installs"
}

ensure_clawdbot_bin_link() {
    local npm_root=""
    npm_root="$(npm root -g 2>/dev/null || true)"
    if [[ -z "$npm_root" || ! -d "$npm_root/openclaw" ]]; then
        return 1
    fi
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir || true)"
    if [[ -z "$npm_bin" ]]; then
        return 1
    fi
    mkdir -p "$npm_bin"
    if [[ ! -x "${npm_bin}/openclaw" ]]; then
        ln -sf "$npm_root/openclaw/dist/entry.js" "${npm_bin}/openclaw"
        echo -e "${WARN}→${NC} Installed openclaw bin link at ${INFO}${npm_bin}/openclaw${NC}"
    fi
    return 0
}

# Check for existing Openclaw installation
check_existing_clawdbot() {
    if [[ -n "$(type -P openclaw 2>/dev/null || true)" ]]; then
        echo -e "${WARN}→${NC} Existing Openclaw installation detected"
        return 0
    fi
    return 1
}

ensure_pnpm() {
    if command -v pnpm &> /dev/null; then
        return 0
    fi

    if command -v corepack &> /dev/null; then
        echo -e "${WARN}→${NC} Installing pnpm via Corepack..."
        corepack enable >/dev/null 2>&1 || true
        corepack prepare pnpm@10 --activate
        echo -e "${SUCCESS}✓${NC} pnpm installed"
        return 0
    fi

    echo -e "${WARN}→${NC} Installing pnpm via npm..."
    fix_npm_permissions
    npm install -g pnpm@10
    echo -e "${SUCCESS}✓${NC} pnpm installed"
    return 0
}

ensure_user_local_bin_on_path() {
    local target="$HOME/.local/bin"
    mkdir -p "$target"

    export PATH="$target:$PATH"

    # shellcheck disable=SC2016
    local path_line='export PATH="$HOME/.local/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [[ -f "$rc" ]] && ! grep -q ".local/bin" "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done
}

npm_global_bin_dir() {
    local prefix=""
    prefix="$(npm prefix -g 2>/dev/null || true)"
    if [[ -n "$prefix" ]]; then
        if [[ "$prefix" == /* ]]; then
            echo "${prefix%/}/bin"
            return 0
        fi
    fi

    prefix="$(npm config get prefix 2>/dev/null || true)"
    if [[ -n "$prefix" && "$prefix" != "undefined" && "$prefix" != "null" ]]; then
        if [[ "$prefix" == /* ]]; then
            echo "${prefix%/}/bin"
            return 0
        fi
    fi

    echo ""
    return 1
}

refresh_shell_command_cache() {
    hash -r 2>/dev/null || true
}

path_has_dir() {
    local path="$1"
    local dir="${2%/}"
    if [[ -z "$dir" ]]; then
        return 1
    fi
    case ":${path}:" in
        *":${dir}:"*) return 0 ;;
        *) return 1 ;;
    esac
}

warn_shell_path_missing_dir() {
    local dir="${1%/}"
    local label="$2"
    if [[ -z "$dir" ]]; then
        return 0
    fi
    if path_has_dir "$ORIGINAL_PATH" "$dir"; then
        return 0
    fi

    echo ""
    echo -e "${WARN}→${NC} PATH warning: missing ${label}: ${INFO}${dir}${NC}"
    echo -e "This can make ${INFO}openclaw${NC} show as \"command not found\" in new terminals."
    echo -e "Fix (zsh: ~/.zshrc, bash: ~/.bashrc):"
    echo -e "  export PATH=\"${dir}:\\$PATH\""
    echo -e "Docs: ${INFO}https://docs.openclaw.ai/install#nodejs--npm-path-sanity${NC}"
}

ensure_npm_global_bin_on_path() {
    local bin_dir=""
    bin_dir="$(npm_global_bin_dir || true)"
    if [[ -n "$bin_dir" ]]; then
        export PATH="${bin_dir}:$PATH"
    fi
}

maybe_nodenv_rehash() {
    if command -v nodenv &> /dev/null; then
        nodenv rehash >/dev/null 2>&1 || true
    fi
}

warn_clawdbot_not_found() {
    echo -e "${WARN}→${NC} Installed, but ${INFO}openclaw${NC} is not discoverable on PATH in this shell."
    echo -e "Try: ${INFO}hash -r${NC} (bash) or ${INFO}rehash${NC} (zsh), then retry."
    echo -e "Docs: ${INFO}https://docs.openclaw.ai/install#nodejs--npm-path-sanity${NC}"
    local t=""
    t="$(type -t openclaw 2>/dev/null || true)"
    if [[ "$t" == "alias" || "$t" == "function" ]]; then
        echo -e "${WARN}→${NC} Found a shell ${INFO}${t}${NC} named ${INFO}openclaw${NC}; it may shadow the real binary."
    fi
    if command -v nodenv &> /dev/null; then
        echo -e "Using nodenv? Run: ${INFO}nodenv rehash${NC}"
    fi

    local npm_prefix=""
    npm_prefix="$(npm prefix -g 2>/dev/null || true)"
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir 2>/dev/null || true)"
    if [[ -n "$npm_prefix" ]]; then
        echo -e "npm prefix -g: ${INFO}${npm_prefix}${NC}"
    fi
    if [[ -n "$npm_bin" ]]; then
        echo -e "npm bin -g: ${INFO}${npm_bin}${NC}"
        echo -e "If needed: ${INFO}export PATH=\"${npm_bin}:\\$PATH\"${NC}"
    fi
}

resolve_clawdbot_bin() {
    refresh_shell_command_cache
    if [[ -n "${CLAWDBOT_BIN:-}" && -x "${CLAWDBOT_BIN:-}" ]]; then
        echo "$CLAWDBOT_BIN"
        return 0
    fi

    # Prefer the git-install wrapper if present.
    if [[ -x "$HOME/.local/bin/openclaw" ]]; then
        echo "$HOME/.local/bin/openclaw"
        return 0
    fi

    local npm_bin=""
    npm_bin="$(npm_global_bin_dir || true)"
    if [[ -n "$npm_bin" && -x "${npm_bin}/openclaw" ]]; then
        echo "${npm_bin}/openclaw"
        return 0
    fi

    local resolved=""
    resolved="$(type -P openclaw 2>/dev/null || true)"
    if [[ -n "$resolved" && -x "$resolved" ]]; then
        echo "$resolved"
        return 0
    fi

    ensure_npm_global_bin_on_path
    refresh_shell_command_cache
    resolved="$(type -P openclaw 2>/dev/null || true)"
    if [[ -n "$resolved" && -x "$resolved" ]]; then
        echo "$resolved"
        return 0
    fi

    maybe_nodenv_rehash
    refresh_shell_command_cache
    resolved="$(type -P openclaw 2>/dev/null || true)"
    if [[ -n "$resolved" && -x "$resolved" ]]; then
        echo "$resolved"
        return 0
    fi

    if [[ -n "$npm_bin" && -x "${npm_bin}/openclaw" ]]; then
        echo "${npm_bin}/openclaw"
        return 0
    fi

    echo ""
    return 1
}

install_clawdbot_from_git() {
    local repo_dir="$1"
    local repo_url_base="https://github.com/anthropics/openclaw.git"
    local repo_url=""
    repo_url="$(github_url "$repo_url_base")"

    if [[ -d "$repo_dir/.git" ]]; then
        echo -e "${WARN}→${NC} Installing Openclaw from git checkout: ${INFO}${repo_dir}${NC}"
    else
        echo -e "${WARN}→${NC} Installing Openclaw from GitHub (${repo_url})..."
    fi

    if ! check_git; then
        install_git
    fi

    ensure_pnpm

    if [[ ! -d "$repo_dir" ]]; then
        git clone "$repo_url" "$repo_dir"
    fi

    if [[ "$GIT_UPDATE" == "1" ]]; then
        if [[ -z "$(git -C "$repo_dir" status --porcelain 2>/dev/null || true)" ]]; then
            git -C "$repo_dir" pull --rebase || true
        else
            echo -e "${WARN}→${NC} Repo is dirty; skipping git pull"
        fi
    fi

    cleanup_legacy_submodules "$repo_dir"

    SHARP_IGNORE_GLOBAL_LIBVIPS="$SHARP_IGNORE_GLOBAL_LIBVIPS" pnpm -C "$repo_dir" install

    if ! pnpm -C "$repo_dir" ui:build; then
        echo -e "${WARN}→${NC} UI build failed; continuing (CLI may still work)"
    fi
    pnpm -C "$repo_dir" build

    ensure_user_local_bin_on_path

    cat > "$HOME/.local/bin/openclaw" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec node "${repo_dir}/dist/entry.js" "\$@"
EOF
    chmod +x "$HOME/.local/bin/openclaw"
    echo -e "${SUCCESS}✓${NC} Openclaw wrapper installed to \$HOME/.local/bin/openclaw"
    echo -e "${INFO}i${NC} This checkout uses pnpm. For deps, run: ${INFO}pnpm install${NC} (avoid npm install in the repo)."
}

# Install Openclaw (pinned to OPENCLAW_PINNED_VERSION)
install_clawdbot() {
    log info "Installing Openclaw via npm (pinned: ${OPENCLAW_PINNED_VERSION})..."
    local package_name="${CLAWDBOT_NPM_PKG}"
    local install_spec="${package_name}@${OPENCLAW_PINNED_VERSION}"

    spinner_start "安装 Openclaw ${OPENCLAW_PINNED_VERSION}..."

    if ! install_clawdbot_npm "${install_spec}" >/dev/null 2>&1; then
        log warn "npm install failed, cleaning up and retrying..."
        spinner_update "npm install failed; cleaning up and retrying..."
        cleanup_npm_clawdbot_paths
        if ! install_clawdbot_npm "${install_spec}" >/dev/null 2>&1; then
            log error "Openclaw installation failed after retry"
            spinner_stop 1 "Openclaw installation failed"
            return 1
        fi
    fi

    ensure_clawdbot_bin_link || true

    log info "Openclaw ${OPENCLAW_PINNED_VERSION} installed successfully"
    spinner_stop 0 "Openclaw ${OPENCLAW_PINNED_VERSION} installed"
}

# Run doctor for migrations (safe, non-interactive)
run_doctor() {
    echo -e "${WARN}→${NC} Running doctor to migrate settings..."
    local claw="${CLAWDBOT_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_clawdbot_bin || true)"
    fi
    if [[ -z "$claw" ]]; then
        echo -e "${WARN}→${NC} Skipping doctor: ${INFO}openclaw${NC} not on PATH yet."
        warn_clawdbot_not_found
        return 0
    fi
    "$claw" doctor --non-interactive --fix || true
    echo -e "${SUCCESS}✓${NC} Migration complete"
}

resolve_workspace_dir() {
    local profile="${CLAWDBOT_PROFILE:-default}"
    if [[ "${profile}" != "default" ]]; then
        echo "${HOME}/clawd-${profile}"
    else
        echo "${HOME}/clawd"
    fi
}

run_bootstrap_onboarding_if_needed() {
    if [[ "${NO_ONBOARD}" == "1" ]]; then
        return
    fi

    local workspace
    workspace="$(resolve_workspace_dir)"
    local bootstrap="${workspace}/BOOTSTRAP.md"

    if [[ ! -f "${bootstrap}" ]]; then
        return
    fi

    if [[ ! -r /dev/tty || ! -w /dev/tty ]]; then
        echo -e "${WARN}→${NC} BOOTSTRAP.md found at ${INFO}${bootstrap}${NC}; no TTY, skipping onboarding."
        echo -e "Run ${INFO}openclaw onboard${NC} later to finish setup."
        return
    fi

    echo -e "${WARN}→${NC} BOOTSTRAP.md found at ${INFO}${bootstrap}${NC}; starting onboarding..."
    local claw="${CLAWDBOT_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_clawdbot_bin || true)"
    fi
    if [[ -z "$claw" ]]; then
        echo -e "${WARN}→${NC} BOOTSTRAP.md found, but ${INFO}openclaw${NC} not on PATH yet; skipping onboarding."
        warn_clawdbot_not_found
        return
    fi

    "$claw" onboard || {
        echo -e "${ERROR}Onboarding failed; BOOTSTRAP.md still present. Re-run ${INFO}openclaw onboard${ERROR}.${NC}"
        return
    }
}

resolve_clawdbot_version() {
    local version=""
    local claw="${CLAWDBOT_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_clawdbot_bin || true)"
    fi

    # First try to get version from package.json (more reliable for npm comparison)
    # Try both 'openclaw' and 'clawdbot' package names (backward compatibility)
    local npm_root=""
    npm_root=$(npm root -g 2>/dev/null || true)
    if [[ -n "$npm_root" ]]; then
        if [[ -f "$npm_root/openclaw/package.json" ]]; then
            version=$(node -e "console.log(require('${npm_root}/openclaw/package.json').version)" 2>/dev/null || true)
        elif [[ -f "$npm_root/clawdbot/package.json" ]]; then
            version=$(node -e "console.log(require('${npm_root}/clawdbot/package.json').version)" 2>/dev/null || true)
        fi
    fi
    
    # Fallback to CLI version
    if [[ -z "$version" && -n "$claw" ]]; then
        version=$("$claw" --version 2>/dev/null | head -n 1 | tr -d '\r')
    fi
    
    echo "$version"
}

extract_gateway_status_json() {
    local claw="$1"
    if [[ -z "$claw" ]]; then
        return 1
    fi

    local raw_output=""
    raw_output="$("$claw" gateway status --json 2>/dev/null || true)"
    if [[ -z "$raw_output" ]]; then
        return 1
    fi

    # Some plugin implementations print log lines before JSON.
    # Parse robustly and emit a compact JSON object for downstream checks.
    printf '%s' "$raw_output" | node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8");
const trimmed = raw.trim();
if (!trimmed) process.exit(1);

const candidates = [];
const seen = new Set();
const add = (value) => {
  const v = String(value || "").trim();
  if (!v || seen.has(v)) return;
  seen.add(v);
  candidates.push(v);
};

add(trimmed);

const lastJsonStart = trimmed.lastIndexOf("\n{");
if (lastJsonStart >= 0) {
  add(trimmed.slice(lastJsonStart + 1));
}

const firstBrace = trimmed.indexOf("{");
const lastBrace = trimmed.lastIndexOf("}");
if (firstBrace >= 0 && lastBrace > firstBrace) {
  add(trimmed.slice(firstBrace, lastBrace + 1));
}

for (const candidate of candidates) {
  try {
    const parsed = JSON.parse(candidate);
    process.stdout.write(JSON.stringify(parsed));
    process.exit(0);
  } catch {
    // try next candidate
  }
}

process.exit(1);
' 2>/dev/null
}

is_gateway_daemon_loaded() {
    local claw="$1"
    if [[ -z "$claw" ]]; then
        return 1
    fi

    local status_json=""
    status_json="$(extract_gateway_status_json "$claw" || true)"
    if [[ -z "$status_json" ]]; then
        return 1
    fi

    printf '%s' "$status_json" | node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8").trim();
if (!raw) process.exit(1);
try {
  const data = JSON.parse(raw);
  const asBool = (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "yes", "y", "1", "running", "active", "started", "up"].includes(s)) return true;
      if (["false", "no", "n", "0", "stopped", "inactive", "down"].includes(s)) return false;
      if (s === "loaded") return true;
      if (s === "unloaded") return false;
    }
    return undefined;
  };

  const svc = data?.service ?? data?.daemon ?? data?.gateway?.service ?? data?.gateway ?? {};
  const runtime = svc?.runtime ?? data?.runtime ?? data?.service?.runtime ?? {};
  const loaded = asBool(
    svc?.loaded ??
      svc?.isLoaded ??
      runtime?.loaded ??
      runtime?.isLoaded ??
      data?.loaded ??
      data?.serviceLoaded
  );
  process.exit(loaded ? 0 : 1);
} catch {
  process.exit(1);
}
' >/dev/null 2>&1
}

is_gateway_running() {
    local claw="$1"
    if [[ -z "$claw" ]]; then
        return 1
    fi

    local status_json=""
    status_json="$(extract_gateway_status_json "$claw" || true)"
    if [[ -z "$status_json" ]]; then
        return 1
    fi

    printf '%s' "$status_json" | node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8").trim();
if (!raw) process.exit(1);
try {
  const data = JSON.parse(raw);
  const asBool = (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "yes", "y", "1", "running", "active", "started", "up", "ok", "healthy", "online"].includes(s)) return true;
      if (["false", "no", "n", "0", "stopped", "inactive", "down", "failed", "error", "offline", "dead", "unknown"].includes(s)) return false;
      if (s === "loaded") return true;
      if (s === "unloaded") return false;
    }
    return undefined;
  };
  const asRunningState = (v) => {
    const direct = asBool(v);
    if (direct !== undefined) return direct;
    if (typeof v !== "string") return undefined;
    const s = v.trim().toLowerCase();
    if (!s) return undefined;
    if (s.includes("running") || s.includes("started") || s.includes("active")) return true;
    if (s.includes("stopped") || s.includes("inactive") || s.includes("failed") || s.includes("dead")) return false;
    return undefined;
  };

  const svc = data?.service ?? data?.daemon ?? data?.gateway?.service ?? data?.gateway ?? {};
  const runtime = svc?.runtime ?? data?.runtime ?? data?.service?.runtime ?? {};

  // Prefer explicit runtime state (newer Openclaw daemon status schema).
  const runtimeRunning = asRunningState(
    runtime?.running ??
      runtime?.active ??
      runtime?.isRunning ??
      runtime?.status ??
      runtime?.state ??
      runtime?.subState
  );
  if (runtimeRunning !== undefined) process.exit(runtimeRunning ? 0 : 1);

  // Backward-compatible running fields.
  const running = asBool(
    svc?.running ??
      svc?.active ??
      svc?.isRunning ??
      svc?.status ??
      svc?.state ??
      data?.running ??
      data?.active ??
      data?.isRunning ??
      data?.status ??
      data?.state
  );
  if (running !== undefined) process.exit(running ? 0 : 1);

  const pid = runtime?.pid ?? svc?.pid ?? data?.pid ?? data?.service?.pid;
  if ((typeof pid === "number" && pid > 0) || (typeof pid === "string" && /^[0-9]+$/.test(pid) && Number(pid) > 0)) {
    process.exit(0);
  }

  // daemon-cli status schema: rpc.ok says if local probe can talk to gateway.
  const rpcOk = asBool(data?.rpc?.ok ?? data?.connect?.ok ?? data?.probe?.ok);
  if (rpcOk !== undefined) process.exit(rpcOk ? 0 : 1);

  // gateway probe schema: targets[].connect.ok and top-level ok.
  if (Array.isArray(data?.targets)) {
    const targetStates = data.targets
      .map((t) => asBool(t?.connect?.ok ?? t?.probe?.ok ?? t?.ok))
      .filter((v) => v !== undefined);
    if (targetStates.length > 0) process.exit(targetStates.some(Boolean) ? 0 : 1);
  }
  const probeOk = asBool(data?.ok);
  if (probeOk !== undefined) process.exit(probeOk ? 0 : 1);

  // Port listener info from daemon-cli status.
  const portStatus = String(data?.port?.status ?? "").trim().toLowerCase();
  if (["busy", "listening", "open", "in_use", "in-use"].includes(portStatus)) process.exit(0);
  if (["free", "closed"].includes(portStatus)) process.exit(1);

  // Last fallback: service loaded (older behavior).
  const loaded = asBool(svc?.loaded ?? svc?.isLoaded ?? data?.loaded ?? data?.serviceLoaded);
  process.exit(loaded ? 0 : 1);
} catch {
  process.exit(1);
}
' >/dev/null 2>&1
}

restart_gateway_if_running() {
    local claw="${1:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_clawdbot_bin || true)"
    fi
    if [[ -z "$claw" ]]; then
        return 0
    fi

    if ! is_gateway_running "$claw"; then
        return 0
    fi

    spinner_start "重启 Gateway..."
    if "$claw" gateway restart >/dev/null 2>&1; then
        spinner_stop 0 "Gateway 已重启"
        return 0
    fi
    spinner_stop 1 "Gateway 重启失败"
    echo -e "${WARN}→${NC} 请手动重启 Gateway: ${INFO}openclaw gateway restart${NC}"
    return 0
}

enable_systemd_user_linger_if_needed() {
    [[ "${OSTYPE:-}" == linux* ]] || return 0
    command -v loginctl >/dev/null 2>&1 || return 0

    local service_file="$HOME/.config/systemd/user/openclaw-gateway.service"
    [[ -f "$service_file" ]] || return 0

    local user_name="${SUDO_USER:-${USER:-}}"
    if [[ -z "$user_name" ]]; then
        user_name="$(id -un 2>/dev/null || true)"
    fi
    [[ -n "$user_name" ]] || return 0

    local linger_state=""
    linger_state="$(loginctl show-user "$user_name" -p Linger --value 2>/dev/null || true)"
    if [[ "$linger_state" == "yes" ]]; then
        return 0
    fi

    spinner_start "启用 systemd linger..."
    if loginctl enable-linger "$user_name" >/dev/null 2>&1; then
        spinner_stop 0 "已启用 systemd linger（SSH 退出后 Gateway 仍可继续运行）"
        return 0
    fi

    spinner_stop 1 "启用 systemd linger 失败"
    echo -e "${WARN}→${NC} 检测到 Gateway 使用 systemd user service。若未启用 linger，SSH 会话结束后服务可能被自动停止。"
    echo -e "${WARN}→${NC} 请手动执行: ${INFO}sudo loginctl enable-linger ${user_name}${NC}"
    return 0
}

# ============================================
# Interactive Configuration Wizard
# ============================================

# Model selection menu
select_model_interactive() {
    local base_url="$1"

    echo ""
    local model_options=(
        "qwen3.5-plus"
        "qwen3-max-2026-01-23"
        "qwen3-coder-next"
        "MiniMax-M2.5"
        "qwen3-coder-plus"
        "glm-5"
        "glm-4.7"
        "kimi-k2.5"
    )

    local model_choice
    model_choice=$(clack_select "请选择 AI 模型" "${model_options[@]}")

    case $model_choice in
        0) SELECTED_MODEL="dashscope/qwen3.5-plus" ;;
        1) SELECTED_MODEL="dashscope/qwen3-max-2026-01-23" ;;
        2) SELECTED_MODEL="dashscope/qwen3-coder-next" ;;
        3) SELECTED_MODEL="dashscope/MiniMax-M2.5" ;;
        4) SELECTED_MODEL="dashscope/qwen3-coder-plus" ;;
        5) SELECTED_MODEL="dashscope/glm-5" ;;
        6) SELECTED_MODEL="dashscope/glm-4.7" ;;
        7) SELECTED_MODEL="dashscope/kimi-k2.5" ;;
        *) SELECTED_MODEL="dashscope/qwen3.5-plus" ;;
    esac

    echo -e "${SUCCESS}◆${NC} 已选择模型: ${INFO}$SELECTED_MODEL${NC}"
}

# Generate random token
generate_gateway_token() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        head -c 32 /dev/urandom | xxd -p | tr -d '\n'
    fi
}

# Escape special characters for JSON string values
json_escape() {
    local str="$1"
    str="${str//\\/\\\\}"   # Escape backslash
    str="${str//\"/\\\"}"   # Escape double quote
    str="${str//$'\n'/\\n}" # Escape newline
    str="${str//$'\t'/\\t}" # Escape tab
    echo "$str"
}

# ============================================
# Channel Configuration Functions
# ============================================

# Configure DingTalk channel (refactored from inline code)
configure_channel_dingtalk() {
    local dingtalk_client_id=""
    local dingtalk_client_secret=""

    echo ""
    echo -e "${ACCENT}◆${NC} ${BOLD}钉钉 (DingTalk) 配置${NC}"
    echo -e "${MUTED}  获取凭证: 钉钉开放平台 > 应用开发 > 凭证与基础信息${NC}"
    echo ""

    printf "${ACCENT}◆${NC} 钉钉 Client ID: " > /dev/tty
    read -r dingtalk_client_id < /dev/tty || true
    if [[ -z "$dingtalk_client_id" ]]; then
        echo -e "${WARN}◆${NC} Client ID 为空，跳过钉钉配置"
        echo ""
        return 1
    fi

    printf "${ACCENT}◆${NC} 钉钉 Client Secret（可见输入）: " > /dev/tty
    read -r dingtalk_client_secret < /dev/tty || true
    if [[ -z "$dingtalk_client_secret" ]]; then
        echo -e "${ERROR}◆${NC} Client Secret 不能为空"
        return 1
    fi

    # Escape for JSON
    local escaped_client_id=""
    local escaped_client_secret=""
    escaped_client_id="$(json_escape "$dingtalk_client_id")"
    escaped_client_secret="$(json_escape "$dingtalk_client_secret")"

    # Store in global variables for later use
    CHANNEL_DINGTALK_CLIENT_ID="$escaped_client_id"
    CHANNEL_DINGTALK_CLIENT_SECRET="$escaped_client_secret"

    echo -e "${SUCCESS}◆${NC} 钉钉配置已收集"
    return 0
}

# Configure Feishu channel
configure_channel_feishu() {
    local feishu_app_id=""
    local feishu_app_secret=""

    echo ""
    echo -e "${ACCENT}◆${NC} ${BOLD}飞书 (Feishu) 配置${NC}"
    echo -e "${MUTED}  获取凭证: 飞书开放平台 > 凭证与基础信息 > App ID / App Secret${NC}"
    echo -e "${MUTED}  参考文档: https://help.aliyun.com/zh/simple-application-server/use-cases/openclaw-integrated-fly-book${NC}"
    echo ""

    printf "${ACCENT}◆${NC} 飞书 App ID (格式如 cli_xxx): " > /dev/tty
    read -r feishu_app_id < /dev/tty || true
    if [[ -z "$feishu_app_id" ]]; then
        echo -e "${WARN}◆${NC} App ID 为空，跳过飞书配置"
        echo ""
        return 1
    fi

    printf "${ACCENT}◆${NC} 飞书 App Secret（可见输入）: " > /dev/tty
    read -r feishu_app_secret < /dev/tty || true
    if [[ -z "$feishu_app_secret" ]]; then
        echo -e "${ERROR}◆${NC} App Secret 不能为空"
        return 1
    fi

    local escaped_app_id=""
    local escaped_app_secret=""
    escaped_app_id="$(json_escape "$feishu_app_id")"
    escaped_app_secret="$(json_escape "$feishu_app_secret")"

    CHANNEL_FEISHU_APP_ID="$escaped_app_id"
    CHANNEL_FEISHU_APP_SECRET="$escaped_app_secret"

    echo -e "${SUCCESS}◆${NC} 飞书配置已收集"
    return 0
}

# Configure QQ channel
configure_channel_qq() {
    local qq_app_id=""
    local qq_app_secret=""

    echo ""
    echo -e "${ACCENT}◆${NC} ${BOLD}QQ 机器人配置${NC}"
    echo -e "${MUTED}  获取凭证: QQ开放平台 > 机器人管理 > AppID / AppSecret${NC}"
    echo -e "${MUTED}  插件包: ${CHANNEL_PKG_QQ}${NC}"
    echo -e "${MUTED}  参考文档: https://help.aliyun.com/zh/simple-application-server/use-cases/openclaw-qq-integration${NC}"
    echo ""

    printf "${ACCENT}◆${NC} QQ App ID (机器人 AppID): " > /dev/tty
    read -r qq_app_id < /dev/tty || true
    if [[ -z "$qq_app_id" ]]; then
        echo -e "${WARN}◆${NC} App ID 为空，跳过QQ配置"
        echo ""
        return 1
    fi

    printf "${ACCENT}◆${NC} QQ App Secret（可见输入）: " > /dev/tty
    read -r qq_app_secret < /dev/tty || true
    if [[ -z "$qq_app_secret" ]]; then
        echo -e "${ERROR}◆${NC} App Secret 不能为空"
        return 1
    fi

    local escaped_app_id=""
    local escaped_app_secret=""
    escaped_app_id="$(json_escape "$qq_app_id")"
    escaped_app_secret="$(json_escape "$qq_app_secret")"

    CHANNEL_QQ_APP_ID="$escaped_app_id"
    CHANNEL_QQ_APP_SECRET="$escaped_app_secret"
    CHANNEL_QQ_TOKEN="${escaped_app_id}:${escaped_app_secret}"

    echo -e "${SUCCESS}◆${NC} QQ配置已收集"
    return 0
}

# Install a channel plugin
install_channel_plugin() {
    local channel="$1"
    local spec_override="${2:-}"
    local no_restart="${3:-0}"
    local pkg=""
    pkg="$(get_channel_package "$channel")"

    if [[ -z "$pkg" ]]; then
        echo -e "${ERROR}未知渠道: $channel${NC}"
        return 1
    fi

    local claw="${CLAWDBOT_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_clawdbot_bin || true)"
    fi

    if [[ -z "$claw" ]]; then
        echo -e "${ERROR}Openclaw 未安装，请先安装 Openclaw${NC}"
        return 1
    fi

    # Fix known config deprecations that can break `openclaw plugins ...`
    migrate_browser_controlurl || true

    local display_name=""
    display_name="$(get_channel_display_name "$channel")"
    local spec="${pkg}"
    if [[ -n "$spec_override" ]]; then
        spec="$spec_override"
    fi
    local npm_peer_deps_flag=""
    if [[ "${NPM_LEGACY_PEER_DEPS:-0}" == "1" ]]; then
        npm_peer_deps_flag="--legacy-peer-deps"
    fi

    spinner_start "安装 ${display_name} 插件（npm 全局）..."

    # Prefer npm global install for stability. Openclaw does NOT auto-discover npm global node_modules,
    # so we also patch ~/.openclaw/openclaw.json to include plugins.load.paths for this package.
    local npm_flags="--loglevel $NPM_LOGLEVEL ${NPM_SILENT_FLAG:+$NPM_SILENT_FLAG} --no-fund --no-audit $npm_peer_deps_flag --prefer-online"
    if ! npm $npm_flags install -g "$spec" >/dev/null 2>&1; then
        spinner_stop 1 "${display_name} 插件安装失败（npm install -g）"
        return 1
    fi

    # Patch config to load the global plugin directory (so config stays valid and plugin is discoverable).
    ensure_openclaw_plugin_load_path_from_npm_global "$pkg" || true

    spinner_stop 0 "${display_name} 插件已安装"
    if [[ "$channel" == "$CHANNEL_DINGTALK" ]]; then
        seed_dingtalk_workspace_templates_if_missing || true
    fi
    if [[ "$no_restart" != "1" ]]; then
        restart_gateway_if_running "$claw"
    fi
    return 0
}

# Remove a channel plugin
remove_channel_plugin() {
    local channel="$1"
    local pkg=""
    pkg="$(get_channel_package "$channel")"

    if [[ -z "$pkg" ]]; then
        echo -e "${ERROR}未知渠道: $channel${NC}"
        return 1
    fi

    local claw="${CLAWDBOT_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_clawdbot_bin || true)"
    fi

    if [[ -z "$claw" ]]; then
        echo -e "${ERROR}Openclaw 未安装${NC}"
        return 1
    fi

    local display_name=""
    display_name="$(get_channel_display_name "$channel")"

    spinner_start "移除 ${display_name} 插件..."
    if "$claw" plugins uninstall "$pkg" >/dev/null 2>&1; then
        spinner_stop 0 "${display_name} 插件已移除"
        return 0
    else
        spinner_stop 1 "${display_name} 插件移除失败"
        return 1
    fi
}

# Get installed version of a channel plugin
get_channel_version() {
    local channel="$1"
    local pkg=""
    pkg="$(get_channel_package "$channel")"

    if [[ -z "$pkg" ]]; then
        echo ""
        return 1
    fi

    get_installed_version "$pkg"
}

# Check if a built-in channel is configured in openclaw.json
is_builtin_channel_configured() {
    local channel="$1"
    local config_file="$HOME/.openclaw/openclaw.json"
    if [[ ! -f "$config_file" ]]; then
        return 1
    fi
    CHANNEL_KEY="$channel" node -e '
const fs = require("fs");
const key = process.env.CHANNEL_KEY;
let cfg;
try { cfg = JSON.parse(fs.readFileSync(process.env.HOME + "/.openclaw/openclaw.json", "utf8")); } catch { process.exit(1); }
const ch = cfg?.channels?.[key];
if (ch && ch.enabled !== false) process.exit(0);
process.exit(1);
' 2>/dev/null
    return $?
}

# List all channel plugins status
list_channel_plugins() {
    echo ""
    echo -e "${ACCENT}${BOLD}┌────────────────────────────────────────┐${NC}"
    echo -e "${ACCENT}${BOLD}│  📡 渠道插件状态                       │${NC}"
    echo -e "${ACCENT}${BOLD}└────────────────────────────────────────┘${NC}"
    echo ""

    # DingTalk (npm plugin)
    local dingtalk_display=""
    dingtalk_display="$(get_channel_display_name dingtalk)"
    local dingtalk_pkg="$CHANNEL_PKG_DINGTALK"
    local dingtalk_version=""
    dingtalk_version="$(get_channel_version dingtalk)"
    local dingtalk_latest=""
    dingtalk_latest="$(get_latest_version "$dingtalk_pkg" "latest")"

    if [[ -n "$dingtalk_version" ]]; then
        if [[ -z "$dingtalk_latest" ]]; then
            printf "  ${SUCCESS}●${NC} %-20s ${SUCCESS}v%s${NC} ${MUTED}[%s]${NC}\n" "$dingtalk_display" "$dingtalk_version" "$dingtalk_pkg"
        elif [[ "$dingtalk_version" == "$dingtalk_latest" ]]; then
            printf "  ${SUCCESS}●${NC} %-20s ${SUCCESS}v%s${NC} ${MUTED}(最新) [%s]${NC}\n" "$dingtalk_display" "$dingtalk_version" "$dingtalk_pkg"
        else
            printf "  ${WARN}●${NC} %-20s ${WARN}v%s${NC} ${MUTED}(最新: %s) [%s]${NC}\n" "$dingtalk_display" "$dingtalk_version" "$dingtalk_latest" "$dingtalk_pkg"
        fi
    else
        printf "  ${MUTED}○${NC} %-20s ${MUTED}未安装 [%s]${NC}\n" "$dingtalk_display" "$dingtalk_pkg"
    fi

    # Feishu (built-in) — check config instead of npm
    local feishu_display=""
    feishu_display="$(get_channel_display_name feishu)"
    if is_builtin_channel_configured "feishu"; then
        printf "  ${SUCCESS}●${NC} %-20s ${SUCCESS}已配置${NC} ${MUTED}[内置]${NC}\n" "$feishu_display"
    else
        printf "  ${MUTED}○${NC} %-20s ${MUTED}未配置 [内置]${NC}\n" "$feishu_display"
    fi

    # QQ (npm plugin)
    local qq_display=""
    qq_display="$(get_channel_display_name qqbot)"
    local qq_pkg="$CHANNEL_PKG_QQ"
    local qq_version=""
    qq_version="$(get_channel_version qqbot)"
    local qq_latest=""
    qq_latest="$(get_latest_version "$qq_pkg" "latest")"

    if [[ -n "$qq_version" ]]; then
        if [[ -z "$qq_latest" ]]; then
            printf "  ${SUCCESS}●${NC} %-20s ${SUCCESS}v%s${NC} ${MUTED}[%s]${NC}\n" "$qq_display" "$qq_version" "$qq_pkg"
        elif [[ "$qq_version" == "$qq_latest" ]]; then
            printf "  ${SUCCESS}●${NC} %-20s ${SUCCESS}v%s${NC} ${MUTED}(最新) [%s]${NC}\n" "$qq_display" "$qq_version" "$qq_pkg"
        else
            printf "  ${WARN}●${NC} %-20s ${WARN}v%s${NC} ${MUTED}(最新: %s) [%s]${NC}\n" "$qq_display" "$qq_version" "$qq_latest" "$qq_pkg"
        fi
    else
        printf "  ${MUTED}○${NC} %-20s ${MUTED}未安装 [%s]${NC}\n" "$qq_display" "$qq_pkg"
    fi

    echo ""
}

# Generate channel config JSON fragment
generate_channel_config() {
    local channel="$1"
    local config=""

    case "$channel" in
        dingtalk)
            if [[ -n "${CHANNEL_DINGTALK_CLIENT_ID:-}" ]]; then
                config=$(cat <<EOF
    "clawdbot-dingtalk": {
      "enabled": true,
      "clientId": "${CHANNEL_DINGTALK_CLIENT_ID}",
      "clientSecret": "${CHANNEL_DINGTALK_CLIENT_SECRET}",
      "replyMode": "markdown",
      "aliyunMcp": {
        "timeoutSeconds": 60,
        "tools": {
          "webSearch": { "enabled": false },
          "codeInterpreter": { "enabled": false },
          "webParser": { "enabled": false },
          "wan26Media": { "enabled": false, "autoSendToDingtalk": true }
        }
      }
    }
EOF
)
            fi
            ;;
        feishu)
            if [[ -n "${CHANNEL_FEISHU_APP_ID:-}" ]]; then
                config=$(cat <<EOF
    "feishu": {
      "enabled": true,
      "appId": "${CHANNEL_FEISHU_APP_ID}",
      "appSecret": "${CHANNEL_FEISHU_APP_SECRET}"
    }
EOF
)
            fi
            ;;
        qqbot)
            if [[ -n "${CHANNEL_QQ_TOKEN:-}" ]]; then
                config=$(cat <<EOF
    "qqbot": {
      "enabled": true,
      "token": "${CHANNEL_QQ_TOKEN}",
      "allowFrom": ["*"],
      "appId": "${CHANNEL_QQ_APP_ID}",
      "clientSecret": "${CHANNEL_QQ_APP_SECRET}"
    }
EOF
)
            fi
            ;;
    esac

    echo "$config"
}

# Generate plugin entries JSON fragment
generate_plugin_entry() {
    local channel="$1"
    local pkg=""
    pkg="$(get_channel_package "$channel")"

    # Built-in channels (feishu) don't need plugin entries
    if [[ -z "$pkg" ]]; then
        echo ""
        return
    fi

    case "$channel" in
        dingtalk)
            cat <<EOF
      "$pkg": {
        "enabled": true
      }
EOF
            ;;
        qqbot)
            cat <<EOF
      "${CHANNEL_PLUGIN_ID_QQ}": {
        "enabled": true
      }
EOF
            ;;
        *)
            echo "      \"$pkg\": { \"enabled\": true }"
            ;;
    esac
}

# Main interactive configuration function
configure_clawdbot_interactive() {
    log info "Starting interactive configuration wizard"
    local config_dir="$HOME/.openclaw"
    local config_file="$config_dir/openclaw.json"

    clack_intro "Openclaw 配置向导"

    # Check existing config
    if [[ -f "$config_file" ]]; then
        log debug "Existing config file found: $config_file"
        clack_step "${WARN}检测到已有配置文件${NC}: ${INFO}$config_file${NC}"
        if ! clack_confirm "是否覆盖现有配置？" "false"; then
            log info "User chose to keep existing config"
            clack_step "${INFO}i${NC} 保留现有配置，跳过向导。"
            clack_outro "配置向导已跳过"
            return 0
        fi
    fi

    # Create config directory
    mkdir -p "$config_dir"

    # ========================================
    # Channel Selection (Multi-select style)
    # ========================================
    echo ""
    echo -e "${ACCENT}◆${NC} ${BOLD}选择要配置的渠道${NC}"
    echo -e "${MUTED}  提示: 可以先跳过，稍后用 --channel-add 添加${NC}"
    echo ""

    local channel_options=(
        "钉钉 (DingTalk)   - 需要 clientId + clientSecret"
        "飞书 (Feishu)      - 需要 appId + appSecret"
        "QQ                 - 需要 appId + appSecret [${CHANNEL_PKG_QQ}]"
        "完成选择 / 跳过渠道配置"
    )

    # Collect which channels to configure
    local configure_dingtalk=0
    local configure_feishu=0
    local configure_qq=0
    local done_selecting=0

    while [[ "$done_selecting" -eq 0 ]]; do
        local selected_summary=""
        [[ "$configure_dingtalk" -eq 1 ]] && selected_summary+="钉钉 "
        [[ "$configure_feishu" -eq 1 ]] && selected_summary+="飞书 "
        [[ "$configure_qq" -eq 1 ]] && selected_summary+="QQ "
        selected_summary="${selected_summary:-无}"

        local channel_choice
        channel_choice=$(clack_select "选择渠道 (已选: ${selected_summary})" "${channel_options[@]}")

        case $channel_choice in
            0)
                configure_dingtalk=1
                echo -e "${SUCCESS}✓${NC} 已选择钉钉"
                ;;
            1)
                configure_feishu=1
                echo -e "${SUCCESS}✓${NC} 已选择飞书"
                ;;
            2)
                configure_qq=1
                echo -e "${SUCCESS}✓${NC} 已选择QQ"
                ;;
            3)
                done_selecting=1
                ;;
        esac
    done

    # Configure selected channels
    if [[ "$configure_dingtalk" -eq 1 ]]; then
        configure_channel_dingtalk || configure_dingtalk=0
    fi
    if [[ "$configure_feishu" -eq 1 ]]; then
        configure_channel_feishu || configure_feishu=0
    fi
    if [[ "$configure_qq" -eq 1 ]]; then
        configure_channel_qq || configure_qq=0
    fi

    # ========================================
    # DashScope / Model Configuration
    # ========================================
    clack_step "${INFO}配置 AI 模型${NC}"
    echo ""
    clack_step "${MUTED}提示：默认使用 Coding Plan Base URL${NC}"
    clack_step "${MUTED}普通百炼账号请输入 https://dashscope.aliyuncs.com/compatible-mode/v1${NC}"
    echo ""
    local dashscope_base_url=""
    printf "${ACCENT}◆${NC} 百炼 Base URL [${MUTED}https://coding.dashscope.aliyuncs.com/v1${NC}]: " > /dev/tty
    read -r dashscope_base_url < /dev/tty || true
    dashscope_base_url=${dashscope_base_url:-https://coding.dashscope.aliyuncs.com/v1}

    local dashscope_api_key=""
    printf "${ACCENT}◆${NC} 百炼 API Key（可见输入）: " > /dev/tty
    read -r dashscope_api_key < /dev/tty || true
    if [[ -z "$dashscope_api_key" ]]; then
        echo -e "${ERROR}◆${NC} API Key 不能为空"
        return 1
    fi

    # Model selection
    select_model_interactive "$dashscope_base_url"

    # Generate Gateway Token
    echo ""
    spinner_start "生成 Gateway Token..."
    local gateway_token=""
    gateway_token="$(generate_gateway_token)"
    spinner_stop 0 "Token 已生成"

    # Escape user inputs for JSON
    local escaped_dashscope_base_url=""
    local escaped_dashscope_api_key=""
    escaped_dashscope_base_url="$(json_escape "$dashscope_base_url")"
    escaped_dashscope_api_key="$(json_escape "$dashscope_api_key")"

    # ========================================
    # Build channels config
    # ========================================
    local channels_config=""
    local plugins_config=""
    local has_any_channel=0

    if [[ "$configure_dingtalk" -eq 1 && -n "${CHANNEL_DINGTALK_CLIENT_ID:-}" ]]; then
        has_any_channel=1
        channels_config+="$(generate_channel_config dingtalk)"
        channels_config+=$'\n'
        plugins_config+="$(generate_plugin_entry dingtalk)"
    fi
    if [[ "$configure_feishu" -eq 1 && -n "${CHANNEL_FEISHU_APP_ID:-}" ]]; then
        has_any_channel=1
        if [[ -n "$channels_config" ]]; then
            channels_config+=","$'\n'
        fi
        channels_config+="$(generate_channel_config feishu)"
        channels_config+=$'\n'
    fi
    if [[ "$configure_qq" -eq 1 && -n "${CHANNEL_QQ_TOKEN:-}" ]]; then
        has_any_channel=1
        if [[ -n "$channels_config" ]]; then
            channels_config+=","$'\n'
        fi
        channels_config+="$(generate_channel_config qqbot)"
        channels_config+=$'\n'
        if [[ -n "$plugins_config" ]]; then
            plugins_config+=","$'\n'
        fi
        plugins_config+="$(generate_plugin_entry qqbot)"
    fi

    # Build full channels block if any configured
    local full_channels_block=""
    if [[ "$has_any_channel" -eq 1 ]]; then
        full_channels_block=$(cat <<EOF
  "channels": {
${channels_config}  },
  "plugins": {
    "entries": {
${plugins_config}
    }
  },
EOF
)
    fi

    # ========================================
    # Write configuration file
    # ========================================
    echo -e "${WARN}→${NC} 写入配置文件..."
    cat > "$config_file" << CONFIGEOF
{
${full_channels_block}
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "$gateway_token"
    },
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "$SELECTED_MODEL"
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "dashscope": {
        "baseUrl": "$escaped_dashscope_base_url",
        "apiKey": "$escaped_dashscope_api_key",
        "api": "openai-completions",
        "models": [
          { "id": "qwen3.5-plus", "name": "Qwen3.5 Plus", "contextWindow": 1000000, "maxTokens": 65536, "reasoning": true, "input": ["text", "image"], "compat": { "thinkingFormat": "qwen", "supportsStrictMode": false, "supportsDeveloperRole": false } },
          { "id": "qwen3-max-2026-01-23", "name": "Qwen3 Max Thinking", "contextWindow": 262144, "maxTokens": 65536, "reasoning": true, "compat": { "thinkingFormat": "qwen", "supportsStrictMode": false, "supportsDeveloperRole": false } },
          { "id": "qwen3-coder-next", "name": "Qwen3 Coder Next", "contextWindow": 262144, "maxTokens": 65536, "reasoning": false },
          { "id": "MiniMax-M2.5", "name": "MiniMax-M2.5", "contextWindow": 204800, "maxTokens": 131072, "reasoning": true, "compat": { "thinkingFormat": "qwen", "supportsStrictMode": false, "supportsDeveloperRole": false } },
          { "id": "qwen3-coder-plus", "name": "Qwen3 Coder Plus", "contextWindow": 1000000, "maxTokens": 65536, "reasoning": false },
          { "id": "glm-5", "name": "GLM-5", "contextWindow": 202752, "maxTokens": 16384, "reasoning": true, "compat": { "thinkingFormat": "qwen", "supportsStrictMode": false, "supportsDeveloperRole": false } },
          { "id": "glm-4.7", "name": "GLM-4.7", "contextWindow": 169984, "maxTokens": 16384, "reasoning": true, "compat": { "thinkingFormat": "qwen", "supportsStrictMode": false, "supportsDeveloperRole": false } },
          { "id": "kimi-k2.5", "name": "Kimi K2.5", "contextWindow": 262144, "maxTokens": 262144, "reasoning": true, "input": ["text", "image"], "compat": { "thinkingFormat": "qwen", "supportsStrictMode": false, "supportsDeveloperRole": false } }
        ]
      }
    }
  },
  "tools": {
    "web": {
      "search": {
        "enabled": false
      }
    }
  },
  "browser": {
    "enabled": true,
    "headless": true,
    "noSandbox": true,
    "defaultProfile": "clawd",
    "profiles": {
      "clawd": { "cdpPort": 18800, "color": "#FF4500" }
    }
  }
}
CONFIGEOF

    echo -e "${SUCCESS}✓${NC} 基础配置文件已生成: ${INFO}$config_file${NC}"
    log info "Configuration file generated: $config_file"
    log debug "Selected model: $SELECTED_MODEL"

    # ========================================
    # Install channel plugins
    # ========================================
    local claw="${CLAWDBOT_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_clawdbot_bin || true)"
    fi

    if [[ -n "$claw" ]]; then
        # DingTalk and QQ require separate npm plugins; Feishu is built-in
        if [[ "$configure_dingtalk" -eq 1 && -n "${CHANNEL_DINGTALK_CLIENT_ID:-}" ]]; then
            install_channel_plugin dingtalk || true
        fi
        if [[ "$configure_qq" -eq 1 && -n "${CHANNEL_QQ_TOKEN:-}" ]]; then
            install_channel_plugin qqbot || true
        fi
    fi

    # ========================================
    # Summary
    # ========================================
    echo ""
    echo -e "${ACCENT}${BOLD}┌────────────────────────────────────────┐${NC}"
    echo -e "${ACCENT}${BOLD}│  ✓ 配置完成                           │${NC}"
    echo -e "${ACCENT}${BOLD}└────────────────────────────────────────┘${NC}"
    echo ""
    echo -e "  ${MUTED}配置详情${NC}"
    echo -e "  ${MUTED}├─${NC} 配置文件   ${INFO}$config_file${NC}"
    echo -e "  ${MUTED}├─${NC} 当前模型   ${INFO}$SELECTED_MODEL${NC}"

    # Show configured channels
    local channel_summary=""
    [[ "$configure_dingtalk" -eq 1 && -n "${CHANNEL_DINGTALK_CLIENT_ID:-}" ]] && channel_summary+="钉钉 "
    [[ "$configure_feishu" -eq 1 && -n "${CHANNEL_FEISHU_APP_ID:-}" ]] && channel_summary+="飞书 "
    [[ "$configure_qq" -eq 1 && -n "${CHANNEL_QQ_TOKEN:-}" ]] && channel_summary+="QQ "

    if [[ -n "$channel_summary" ]]; then
        echo -e "  ${MUTED}└─${NC} 已配置渠道 ${SUCCESS}${channel_summary}${NC}"
    else
        echo -e "  ${MUTED}└─${NC} 已配置渠道 ${MUTED}无${NC}"
    fi

    echo ""
    echo -e "  ${WARN}重要：请保存以下 Gateway Token${NC}"
    echo -e "  ${MUTED}┌──────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "  ${MUTED}│${NC} ${SUCCESS}$gateway_token${NC}"
    echo -e "  ${MUTED}└──────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    echo -e "访问后台: ${INFO}http://127.0.0.1:18789/?token=$gateway_token${NC}"
    
    # Get server public IP (try Alibaba Cloud metadata first, then fallback)
    local server_ip=""
    server_ip="$(curl -s --connect-timeout 1 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || true)"
    if [[ -z "$server_ip" ]]; then
        server_ip="$(curl -s --connect-timeout 1 http://100.100.100.200/latest/meta-data/private-ipv4 2>/dev/null || true)"
    fi
    if [[ -z "$server_ip" ]]; then
        server_ip="<服务器IP>"
    fi
    echo -e "${MUTED}（远程服务器需先建立 SSH 隧道: ssh -L 18789:127.0.0.1:18789 $(whoami)@${server_ip}）${NC}"
    echo ""

    # Auto-start gateway if any channel was configured
    if [[ "$has_any_channel" -eq 1 && -n "$claw" ]]; then
        echo -e "${WARN}→${NC} 安装并启动 Gateway 服务..."
        if "$claw" gateway install; then
            enable_systemd_user_linger_if_needed
        else
            echo -e "${WARN}→${NC} 服务安装失败"
        fi
        "$claw" gateway start || echo -e "${WARN}→${NC} 启动失败，请手动执行: openclaw gateway start"
        echo ""
    fi
}

# Main installation flow (extracted from original main)
run_install_flow() {
    log info "=== Starting install flow ==="

    # Clear npm cache before install
    clear_npm_cache

    local detected_checkout=""
    detected_checkout="$(detect_clawdbot_checkout "$PWD" || true)"
    log debug "Detected checkout: ${detected_checkout:-none}"

    if [[ -z "$INSTALL_METHOD" && -n "$detected_checkout" ]]; then
        if ! is_promptable; then
            echo -e "${WARN}→${NC} Found an Openclaw checkout, but no TTY; defaulting to npm install."
            INSTALL_METHOD="npm"
        else
            local choice=""
            choice="$(prompt_choice "$(cat <<EOF
${WARN}→${NC} Detected an Openclaw source checkout in: ${INFO}${detected_checkout}${NC}
Choose install method:
  1) Update this checkout (git) and use it
  2) Install global via npm (migrate away from git)
Enter 1 or 2:
EOF
)" || true)"

            case "$choice" in
                1) INSTALL_METHOD="git" ;;
                2) INSTALL_METHOD="npm" ;;
                *)
                    echo -e "${ERROR}Error: no install method selected.${NC}"
                    echo "Re-run with: --install-method git|npm (or set CLAWDBOT_INSTALL_METHOD)."
                    exit 2
                    ;;
            esac
        fi
    fi

    if [[ -z "$INSTALL_METHOD" ]]; then
        INSTALL_METHOD="npm"
    fi
    log info "Install method: $INSTALL_METHOD"

    if [[ "$INSTALL_METHOD" != "npm" && "$INSTALL_METHOD" != "git" ]]; then
        log error "Invalid install method: $INSTALL_METHOD"
        echo -e "${ERROR}Error: invalid --install-method: ${INSTALL_METHOD}${NC}"
        echo "Use: --install-method npm|git"
        exit 2
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
        log info "Dry run mode - no changes will be made"
        echo -e "${SUCCESS}✓${NC} Dry run"
        echo -e "${SUCCESS}✓${NC} Install method: ${INSTALL_METHOD}"
        echo -e "${SUCCESS}✓${NC} CN mirrors: ${USE_CN_MIRRORS:-auto-detect}"
        echo -e "${SUCCESS}✓${NC} OS: ${OS}"
        if [[ -n "$detected_checkout" ]]; then
            echo -e "${SUCCESS}✓${NC} Detected checkout: ${detected_checkout}"
        fi
        if [[ "$INSTALL_METHOD" == "git" ]]; then
            echo -e "${SUCCESS}✓${NC} Git dir: ${GIT_DIR}"
            echo -e "${SUCCESS}✓${NC} Git update: ${GIT_UPDATE}"
        fi
        echo -e "${MUTED}Dry run complete (no changes made).${NC}"
        return 0
    fi

    # Check for existing installation
    local is_upgrade=false
    if check_existing_clawdbot; then
        is_upgrade=true
    fi

    # Step 0: Detect and configure China mirrors
    detect_cn_mirrors || true

    # Step 1: Homebrew (macOS only) - apply CN mirrors before install
    apply_cn_mirrors
    install_homebrew

    # Step 2: Node.js
    if ! check_node; then
        install_node
    fi

    # Apply CN mirrors again after Node.js is installed (for npm registry)
    apply_cn_mirrors

    # Migrate deprecated browser config keys early to avoid postinstall/config validation errors
    # (e.g. browser.controlURL -> browser.cdpUrl)
    migrate_browser_controlurl || true

    local final_git_dir=""
    if [[ "$INSTALL_METHOD" == "git" ]]; then
        # Clean up npm global install if switching to git
        if npm list -g openclaw &>/dev/null; then
            echo -e "${WARN}→${NC} Removing npm global install (switching to git)..."
            npm uninstall -g openclaw 2>/dev/null || true
            echo -e "${SUCCESS}✓${NC} npm global install removed"
        fi

        local repo_dir="$GIT_DIR"
        if [[ -n "$detected_checkout" ]]; then
            repo_dir="$detected_checkout"
        fi
        final_git_dir="$repo_dir"
        install_clawdbot_from_git "$repo_dir"
    else
        # Clean up git wrapper if switching to npm
        if [[ -x "$HOME/.local/bin/openclaw" ]]; then
            echo -e "${WARN}→${NC} Removing git wrapper (switching to npm)..."
            rm -f "$HOME/.local/bin/openclaw"
            echo -e "${SUCCESS}✓${NC} git wrapper removed"
        fi

        # Step 3: Git (required for npm installs that may fetch from git or apply patches)
        if ! check_git; then
            install_git
        fi

        # Step 4: lsof (used for port conflict detection)
        if ! check_lsof; then
            install_lsof || true
        fi

        # Step 5: npm permissions (Linux)
        fix_npm_permissions

        # Step 6: Openclaw
        install_clawdbot
    fi

    # Step 7: Chromium (for browser automation)
    if ! check_chromium; then
        install_chromium || true
    fi

    # Step 8: File parsing tools (for document content extraction)
    if [[ "$INSTALL_FILE_TOOLS" == "1" ]]; then
        if ! check_file_tools; then
            install_file_tools || true
        else
            echo -e "${SUCCESS}✓${NC} File parsing tools already installed"
        fi
    fi

    # Step 9: Python 3.12 (for file parsing and AI tools)
    if [[ "$INSTALL_PYTHON" == "1" ]]; then
        if ! check_python; then
            install_python || true
        fi
    fi

    CLAWDBOT_BIN="$(resolve_clawdbot_bin || true)"

    # PATH warning: installs can succeed while the user's login shell still lacks npm's global bin dir.
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir || true)"
    if [[ "$INSTALL_METHOD" == "npm" ]]; then
        warn_shell_path_missing_dir "$npm_bin" "npm global bin dir"
    fi
    if [[ "$INSTALL_METHOD" == "git" ]]; then
        if [[ -x "$HOME/.local/bin/openclaw" ]]; then
            warn_shell_path_missing_dir "$HOME/.local/bin" "user-local bin dir (~/.local/bin)"
        fi
    fi

    # Note: doctor is run in the upgrade path after success message, not here
    # This prevents running doctor twice during upgrades

    # Step 7: If BOOTSTRAP.md is still present in the workspace, resume onboarding
    run_bootstrap_onboarding_if_needed

    local installed_version
    installed_version=$(resolve_clawdbot_version)

    if [[ -n "$installed_version" ]]; then
        clack_outro "${SUCCESS}${BOLD}🦀 Openclaw installed successfully (${installed_version})!${NC}"
    else
        clack_outro "${SUCCESS}${BOLD}🦀 Openclaw installed successfully!${NC}"
    fi

    # Show summary table for fresh installs (not upgrades)
    if [[ "$is_upgrade" != "true" ]]; then
        print_summary_table "$INSTALL_METHOD" "$final_git_dir"
    fi
    if [[ "$is_upgrade" == "true" ]]; then
        local update_messages=(
            "Leveled up! New skills unlocked. You're welcome."
            "Fresh code, same lobster. Miss me?"
            "Back and better. Did you even notice I was gone?"
            "Update complete. I learned some new tricks while I was out."
            "Upgraded! Now with 23% more sass."
            "I've evolved. Try to keep up. 🦞"
            "New version, who dis? Oh right, still me but shinier."
            "Patched, polished, and ready to pinch. Let's go."
            "The lobster has molted. Harder shell, sharper claws."
            "Update done! Check the changelog or just trust me, it's good."
            "Reborn from the boiling waters of npm. Stronger now."
            "I went away and came back smarter. You should try it sometime."
            "Update complete. The bugs feared me, so they left."
            "New version installed. Old version sends its regards."
            "Firmware fresh. Brain wrinkles: increased."
            "I've seen things you wouldn't believe. Anyway, I'm updated."
            "Back online. The changelog is long but our friendship is longer."
            "Upgraded! Peter fixed stuff. Blame him if it breaks."
            "Molting complete. Please don't look at my soft shell phase."
            "Version bump! Same chaos energy, fewer crashes (probably)."
        )
        local update_message
        update_message="${update_messages[RANDOM % ${#update_messages[@]}]}"
        echo -e "${MUTED}${update_message}${NC}"
    else
        local completion_messages=(
            "Ahh nice, I like it here. Got any snacks? "
            "Home sweet home. Don't worry, I won't rearrange the furniture."
            "I'm in. Let's cause some responsible chaos."
            "Installation complete. Your productivity is about to get weird."
            "Settled in. Time to automate your life whether you're ready or not."
            "Cozy. I've already read your calendar. We need to talk."
            "Finally unpacked. Now point me at your problems."
            "cracks claws Alright, what are we building?"
            "The lobster has landed. Your terminal will never be the same."
            "All done! I promise to only judge your code a little bit."
        )
        local completion_message
        completion_message="${completion_messages[RANDOM % ${#completion_messages[@]}]}"
        echo -e "${MUTED}${completion_message}${NC}"
    fi
    echo ""

    if [[ "$INSTALL_METHOD" == "git" && -n "$final_git_dir" ]]; then
        echo -e "Source checkout: ${INFO}${final_git_dir}${NC}"
        echo -e "Wrapper: ${INFO}\$HOME/.local/bin/openclaw${NC}"
        echo -e "Installed from source. To update later, run: ${INFO}openclaw update --restart${NC}"
        echo -e "Switch to global install later: ${INFO}curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --install-method npm${NC}"
    elif [[ "$is_upgrade" == "true" ]]; then
        echo -e "Upgrade complete."
        if [[ -r /dev/tty && -w /dev/tty ]]; then
            local claw="${CLAWDBOT_BIN:-}"
            if [[ -z "$claw" ]]; then
                claw="$(resolve_clawdbot_bin || true)"
            fi
            if [[ -z "$claw" ]]; then
                echo -e "${WARN}→${NC} Skipping doctor: ${INFO}openclaw${NC} not on PATH yet."
                warn_clawdbot_not_found
                return 0
            fi
            # Run setup, configure gateway mode, and install gateway service before doctor
            echo -e "Running ${INFO}openclaw setup${NC}..."
            "$claw" setup || true

            echo -e "Running ${INFO}openclaw config set gateway.mode local${NC}..."
            "$claw" config set gateway.mode local || true

            echo -e "Running ${INFO}openclaw gateway install${NC}..."
            if "$claw" gateway install; then
                enable_systemd_user_linger_if_needed
            fi

            echo -e "Running ${INFO}openclaw doctor --non-interactive --fix${NC}..."
            local doctor_ok=0
            CLAWDBOT_UPDATE_IN_PROGRESS=1 "$claw" doctor --non-interactive --fix && doctor_ok=1
            if (( doctor_ok )); then
                echo -e "Updating plugins (${INFO}openclaw plugins update --all${NC})..."
                CLAWDBOT_UPDATE_IN_PROGRESS=1 "$claw" plugins update --all || true
            else
                echo -e "${WARN}→${NC} Doctor failed; skipping plugin updates."
            fi

            # After upgrade, offer configuration wizard if no config exists
            local config_file="$HOME/.openclaw/openclaw.json"
            if [[ ! -f "$config_file" ]] && [[ "$NO_ONBOARD" != "1" ]]; then
                echo ""
                echo -e "${INFO}i${NC} No configuration file found. Starting configuration wizard..."
                configure_clawdbot_interactive
            fi
        else
            echo -e "${WARN}→${NC} No TTY available; skipping doctor."
            echo -e "Run ${INFO}openclaw doctor${NC}, then ${INFO}openclaw plugins update --all${NC}."
        fi
    else
        if [[ "$NO_ONBOARD" == "1" ]]; then
            echo -e "Skipping onboard (requested). Run ${INFO}openclaw onboard${NC} later."
        else
            echo -e "Starting setup..."
            echo ""
            if [[ -r /dev/tty && -w /dev/tty ]]; then
                # Use custom interactive configuration wizard
                configure_clawdbot_interactive
            else
                echo -e "${WARN}→${NC} No TTY available; skipping configuration wizard."
                echo -e "Run the script interactively or configure ${INFO}~/.openclaw/openclaw.json${NC} manually."
            fi
        fi
    fi

    if command -v openclaw &> /dev/null; then
        local claw="${CLAWDBOT_BIN:-}"
        if [[ -z "$claw" ]]; then
            claw="$(resolve_clawdbot_bin || true)"
        fi
        restart_gateway_if_running "$claw"
    fi

    log info "=== Installation completed successfully ==="
    echo ""
    echo -e "FAQ: ${INFO}https://docs.openclaw.ai/start/faq${NC}"
}

# ============================================
# Status Module
# ============================================

get_installed_version() {
    local pkg="$1"
    local version=""

    if [[ "$pkg" == "clawdbot" || "$pkg" == "openclaw" ]]; then
        version="$(resolve_clawdbot_version)"
    else
        # For plugins, first check ~/.openclaw/extensions/ directory (fastest)
        local ext_dir="$HOME/.openclaw/extensions/$pkg"
        if [[ -f "$ext_dir/package.json" ]]; then
            version="$(grep '"version"' "$ext_dir/package.json" 2>/dev/null | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
        fi

        # Fallback to npm global list
        if [[ -z "$version" ]]; then
            # Use awk instead of sed to avoid issues with / in package names
            version="$(npm list -g "$pkg" --depth=0 2>/dev/null | grep "$pkg@" | awk -F'@' '{print $NF}' | head -n1 || true)"
        fi
    fi

    echo "$version"
}

resolve_openclaw_agent_workspace_dir() {
    # Best-effort: read agents.defaults.workspace from config; fallback to ~/.openclaw/workspace
    local cfg="${CONFIG_FILE:-$HOME/.openclaw/openclaw.json}"
    if [[ -f "$cfg" ]] && command -v node &>/dev/null; then
        local v=""
        v="$(CONFIG_FILE="$cfg" node -e '
const fs = require("fs");
const p = process.env.CONFIG_FILE;
let cfg;
try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch { process.exit(0); }
const w = cfg?.agents?.defaults?.workspace;
if (typeof w === "string" && w.trim()) process.stdout.write(w.trim());
' 2>/dev/null || true)"
        if [[ -n "$v" ]]; then
            echo "$v"
            return 0
        fi
    fi
    echo "$HOME/.openclaw/workspace"
    return 0
}

resolve_installer_script_dir() {
    local src="${BASH_SOURCE[0]:-$0}"
    local dir=""
    dir="$(cd "$(dirname "$src")" >/dev/null 2>&1 && pwd -P)" || return 1
    if [[ -z "$dir" ]]; then
        return 1
    fi
    echo "$dir"
    return 0
}

expand_home_path() {
    local raw="$1"
    if [[ "$raw" == "~" ]]; then
        echo "$HOME"
        return 0
    fi
    if [[ "$raw" == "~/"* ]]; then
        echo "${HOME}/${raw#~/}"
        return 0
    fi
    echo "$raw"
    return 0
}

resolve_npm_global_package_dir() {
    local pkg="$1"
    if [[ -z "$pkg" ]] || ! command -v npm &>/dev/null; then
        return 1
    fi

    local npm_root=""
    npm_root="$(npm root -g 2>/dev/null || true)"
    if [[ -z "$npm_root" ]]; then
        return 1
    fi

    local candidate="${npm_root%/}/${pkg}"
    if [[ -d "$candidate" ]]; then
        echo "$candidate"
        return 0
    fi
    return 1
}

resolve_dingtalk_workspace_template_dir() {
    local env_dir="${DINGTALK_WORKSPACE_TEMPLATE_DIR:-}"
    if [[ -n "$env_dir" ]]; then
        env_dir="$(expand_home_path "$env_dir")"
        if [[ -d "$env_dir" ]]; then
            echo "$env_dir"
            return 0
        fi
    fi

    local package_dir=""
    package_dir="$(resolve_npm_global_package_dir "$CHANNEL_PKG_DINGTALK" || true)"
    if [[ -n "$package_dir" ]]; then
        local packaged_candidate="${package_dir%/}/workspace-templates"
        if [[ -d "$packaged_candidate" ]]; then
            echo "$packaged_candidate"
            return 0
        fi
    fi

    local script_dir=""
    script_dir="$(resolve_installer_script_dir || true)"
    if [[ -z "$script_dir" ]]; then
        return 1
    fi
    local candidates=(
        "${script_dir}/../extensions/dingtalk/workspace-templates"
        "${script_dir}/extensions/dingtalk/workspace-templates"
    )
    local candidate=""
    for candidate in "${candidates[@]}"; do
        if [[ -d "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

is_brand_new_workspace_dir() {
    local workspace="$1"
    local required=(
        "AGENTS.md"
        "SOUL.md"
        "TOOLS.md"
        "IDENTITY.md"
        "USER.md"
        "HEARTBEAT.md"
    )
    local name
    for name in "${required[@]}"; do
        if [[ -f "${workspace%/}/${name}" ]]; then
            return 1
        fi
    done
    return 0
}

seed_dingtalk_workspace_templates_if_missing() {
    local raw_workspace=""
    raw_workspace="$(resolve_openclaw_agent_workspace_dir || true)"
    if [[ -z "$raw_workspace" ]]; then
        return 0
    fi

    local workspace=""
    workspace="$(expand_home_path "$raw_workspace")"
    if [[ -z "$workspace" ]]; then
        return 0
    fi

    mkdir -p "$workspace" 2>/dev/null || {
        echo -e "${WARN}→${NC} 无法创建工作区目录，跳过 DingTalk 模板初始化: ${INFO}${workspace}${NC}"
        return 0
    }

    local template_dir=""
    template_dir="$(resolve_dingtalk_workspace_template_dir || true)"
    if [[ -z "$template_dir" ]]; then
        log warn "DingTalk workspace templates not found in package/local source; skip seeding"
        echo -e "${WARN}→${NC} 未找到 DingTalk workspace 模板目录（npm 包或本地源码），跳过初始化。"
        return 0
    fi

    local files=(
        "AGENTS.md"
        "SOUL.md"
        "TOOLS.md"
        "IDENTITY.md"
        "USER.md"
        "HEARTBEAT.md"
    )
    local is_brand_new=0
    if is_brand_new_workspace_dir "$workspace"; then
        is_brand_new=1
        files+=("BOOTSTRAP.md")
    fi

    local copied=0
    local skipped=0
    local failed=0
    local name=""
    for name in "${files[@]}"; do
        local src="${template_dir%/}/${name}"
        local dst="${workspace%/}/${name}"

        if [[ ! -f "$src" ]]; then
            failed=$((failed + 1))
            log warn "Missing DingTalk workspace template: $src"
            continue
        fi

        if [[ -e "$dst" ]]; then
            skipped=$((skipped + 1))
            continue
        fi

        if cp "$src" "$dst" 2>/dev/null; then
            copied=$((copied + 1))
        else
            failed=$((failed + 1))
            log warn "Failed to seed DingTalk workspace template: $dst"
        fi
    done

    if [[ "$copied" -gt 0 ]]; then
        echo -e "${SUCCESS}✓${NC} DingTalk workspace 模板初始化完成: ${INFO}${workspace}${NC} ${MUTED}(新建 ${copied}，跳过 ${skipped})${NC}"
    fi
    if [[ "$failed" -gt 0 ]]; then
        echo -e "${WARN}→${NC} DingTalk workspace 模板有 ${failed} 个文件初始化失败（已跳过）。"
    fi
}

ensure_openclaw_plugin_load_path_from_npm_global() {
    # Ensure ~/.openclaw/openclaw.json contains plugins.load.paths entry pointing to the
    # globally-installed npm package dir (npm root -g / <pkg>).
    #
    # This is required because Openclaw does NOT automatically scan npm global node_modules.
    local pkg="$1"
    local cfg="${CONFIG_FILE:-$HOME/.openclaw/openclaw.json}"

    if [[ -z "$pkg" || ! -f "$cfg" ]]; then
        return 1
    fi
    if ! command -v npm &>/dev/null || ! command -v node &>/dev/null; then
        return 1
    fi

    local npm_root=""
    npm_root="$(npm root -g 2>/dev/null || true)"
    if [[ -z "$npm_root" ]]; then
        return 1
    fi

    local plugin_dir="${npm_root%/}/${pkg}"
    if [[ ! -d "$plugin_dir" ]]; then
        return 1
    fi

    CONFIG_FILE="$cfg" PKG="$pkg" PLUGIN_DIR="$plugin_dir" node -e '
const fs = require("fs");
const path = require("path");

const cfgPath = process.env.CONFIG_FILE;
const pkg = String(process.env.PKG || "").trim();
const pluginDir = String(process.env.PLUGIN_DIR || "").trim();
if (!cfgPath || !pkg || !pluginDir) process.exit(1);

let cfg;
try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch { process.exit(2); }

cfg.plugins ||= {};
cfg.plugins.load ||= {};

let paths = Array.isArray(cfg.plugins.load.paths) ? cfg.plugins.load.paths : [];
paths = paths
  .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
  .filter(Boolean);

const resolvedPluginDir = path.resolve(pluginDir);

const isSame = (p) => {
  try { return path.resolve(p) === resolvedPluginDir; } catch { return false; }
};

const looksLikeGlobalPkgPath = (p) => {
  const normalized = p.replace(/\\\\/g, "/");
  return normalized.includes("/node_modules/") && normalized.endsWith("/" + pkg);
};

const exists = (p) => {
  try { return fs.existsSync(p); } catch { return false; }
};

// Remove duplicates, and prune stale global paths for this package if they no longer exist.
paths = paths.filter((p) => {
  if (isSame(p)) return false;
  if (looksLikeGlobalPkgPath(p) && !exists(p)) return false;
  return true;
});

// Prepend so config-origin overrides workspace/global/bundled copies.
paths = [pluginDir, ...paths];
cfg.plugins.load.paths = paths;

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
' 2>/dev/null || true

    return 0
}

get_openclaw_extensions_version() {
    # Return plugin version only if it's discoverable by Openclaw's default discovery dirs
    # (workspace/.openclaw/extensions or ~/.openclaw/extensions). Does NOT report npm -g versions.
    local pkg="$1"
    local v=""

    local global_dir="$HOME/.openclaw/extensions/$pkg"
    if [[ -f "$global_dir/package.json" ]]; then
        v="$(grep '"version"' "$global_dir/package.json" 2>/dev/null | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || true)"
    fi
    if [[ -n "$v" ]]; then
        echo "$v"
        return 0
    fi

    local ws=""
    ws="$(resolve_openclaw_agent_workspace_dir)"
    local ws_dir="${ws%/}/.openclaw/extensions/$pkg"
    if [[ -f "$ws_dir/package.json" ]]; then
        v="$(grep '"version"' "$ws_dir/package.json" 2>/dev/null | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || true)"
    fi

    echo "$v"
    return 0
}

config_references_plugin_or_channel() {
    local plugin_id="$1"
    local cfg="${CONFIG_FILE:-$HOME/.openclaw/openclaw.json}"
    if [[ -z "$plugin_id" || ! -f "$cfg" || ! "$(command -v node 2>/dev/null)" ]]; then
        return 1
    fi
    CONFIG_FILE="$cfg" PLUGIN_ID="$plugin_id" node -e '
const fs = require("fs");
const p = process.env.CONFIG_FILE;
const id = String(process.env.PLUGIN_ID || "").trim();
if (!id) process.exit(1);
let cfg;
try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch { process.exit(1); }
const hasPlugin = Boolean(cfg?.plugins?.entries && Object.prototype.hasOwnProperty.call(cfg.plugins.entries, id));
const hasChannel = Boolean(cfg?.channels && Object.prototype.hasOwnProperty.call(cfg.channels, id));
process.exit(hasPlugin || hasChannel ? 0 : 2);
' >/dev/null 2>&1
}

get_openclaw_plugin_loaded_meta() {
    local plugin_id="$1"
    local claw="${CLAWDBOT_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_clawdbot_bin || true)"
    fi
    if [[ -z "$claw" ]]; then
        return 1
    fi

    local json=""
    json="$("$claw" plugins list --json 2>/dev/null || true)"
    if [[ -z "$json" ]]; then
        return 1
    fi

    # Print a compact JSON object: { id, status, version, origin, source, error }
    # (The script caller can parse or display it.)
    printf '%s' "$json" | PLUGIN_ID="$plugin_id" node -e '
const fs = require("fs");
const id = (process.env.PLUGIN_ID || "").trim();
if (!id) process.exit(1);
let data;
try { data = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(1); }
const plugins = Array.isArray(data?.plugins) ? data.plugins : [];
const p = plugins.find((x) => x?.id === id || x?.name === id);
if (!p) process.exit(2);
const out = {
  id: p.id ?? id,
  status: p.status ?? "",
  version: p.version ?? "",
  origin: p.origin ?? "",
  source: p.source ?? "",
  error: p.error ?? "",
};
process.stdout.write(JSON.stringify(out));
' 2>/dev/null
}

get_latest_version() {
    local pkg="$1"
    local tag="${2:-latest}"
    local version=""

    # Map 'clawdbot' to actual npm package name 'openclaw'
    if [[ "$pkg" == "clawdbot" ]]; then
        pkg="$CLAWDBOT_NPM_PKG"
    fi

    # Openclaw core is pinned; return the pinned version directly (no npm query needed).
    if [[ "$pkg" == "$CLAWDBOT_NPM_PKG" || "$pkg" == "openclaw" ]]; then
        echo "${OPENCLAW_PINNED_VERSION}"
        return
    fi

    # 使用 --prefer-online 绕过本地缓存，确保获取最新版本信息
    version="$(npm view "${pkg}@${tag}" version --prefer-online 2>/dev/null || true)"
    echo "$version"
}

run_status_flow() {
    # Clear npm cache for accurate plugin version info
    clear_npm_cache

    echo ""
    echo -e "${ACCENT}${BOLD}┌────────────────────────────────────────┐${NC}"
    echo -e "${ACCENT}${BOLD}│  🦀 Openclaw 状态                       │${NC}"
    echo -e "${ACCENT}${BOLD}└────────────────────────────────────────┘${NC}"
    echo ""

    # Check if openclaw is installed (core is pinned to OPENCLAW_PINNED_VERSION)
    local clawdbot_installed=""
    clawdbot_installed="$(get_installed_version "openclaw")"
    local clawdbot_pinned="${OPENCLAW_PINNED_VERSION}"

    echo -e "  ${MUTED}核心组件 (固定版本: ${clawdbot_pinned})${NC}"

    if [[ -n "$clawdbot_installed" ]]; then
        if [[ "$clawdbot_installed" == "$clawdbot_pinned" ]]; then
            printf "  ${MUTED}└─${NC} Openclaw     ${SUCCESS}✓${NC} %s ${MUTED}(固定版本)${NC}\n" "$clawdbot_installed"
        else
            printf "  ${MUTED}└─${NC} Openclaw     ${WARN}!${NC} %s ${MUTED}(固定版本: %s)${NC}\n" "$clawdbot_installed" "$clawdbot_pinned"
        fi
    else
        echo -e "  ${MUTED}└─${NC} Openclaw     ${ERROR}✗${NC} 未安装"
    fi

    echo ""

    # Check all channel plugins
    echo -e "  ${MUTED}渠道插件${NC}"

    local dingtalk_installed=""
    dingtalk_installed="$(get_installed_version "$CHANNEL_PKG_DINGTALK")"
    local dingtalk_latest=""
    dingtalk_latest="$(get_latest_version "$CHANNEL_PKG_DINGTALK" "latest")"

    # DingTalk
    if [[ -n "$dingtalk_installed" ]]; then
        if [[ -z "$dingtalk_latest" ]]; then
            printf "  ${MUTED}├─${NC} 钉钉         ${SUCCESS}✓${NC} %s ${MUTED}[${CHANNEL_PKG_DINGTALK}]${NC}\n" "$dingtalk_installed"
        elif [[ "$dingtalk_installed" == "$dingtalk_latest" ]]; then
            printf "  ${MUTED}├─${NC} 钉钉         ${SUCCESS}✓${NC} %s ${MUTED}(最新) [${CHANNEL_PKG_DINGTALK}]${NC}\n" "$dingtalk_installed"
        else
            printf "  ${MUTED}├─${NC} 钉钉         ${WARN}!${NC} %s ${MUTED}(最新: %s) [${CHANNEL_PKG_DINGTALK}]${NC}\n" "$dingtalk_installed" "$dingtalk_latest"
        fi
    else
        echo -e "  ${MUTED}├─${NC} 钉钉         ${MUTED}○${NC} 未安装 ${MUTED}[${CHANNEL_PKG_DINGTALK}]${NC}"
    fi

    # QQ (npm plugin)
    local qq_installed=""
    qq_installed="$(get_installed_version "$CHANNEL_PKG_QQ")"
    local qq_latest=""
    qq_latest="$(get_latest_version "$CHANNEL_PKG_QQ" "latest")"

    if [[ -n "$qq_installed" ]]; then
        if [[ -z "$qq_latest" ]]; then
            printf "  ${MUTED}├─${NC} QQ           ${SUCCESS}✓${NC} %s ${MUTED}[${CHANNEL_PKG_QQ}]${NC}\n" "$qq_installed"
        elif [[ "$qq_installed" == "$qq_latest" ]]; then
            printf "  ${MUTED}├─${NC} QQ           ${SUCCESS}✓${NC} %s ${MUTED}(最新) [${CHANNEL_PKG_QQ}]${NC}\n" "$qq_installed"
        else
            printf "  ${MUTED}├─${NC} QQ           ${WARN}!${NC} %s ${MUTED}(最新: %s) [${CHANNEL_PKG_QQ}]${NC}\n" "$qq_installed" "$qq_latest"
        fi
    else
        echo -e "  ${MUTED}├─${NC} QQ           ${MUTED}○${NC} 未安装 ${MUTED}[${CHANNEL_PKG_QQ}]${NC}"
    fi

    # Feishu (built-in)
    if is_builtin_channel_configured "feishu"; then
        echo -e "  ${MUTED}└─${NC} 飞书         ${SUCCESS}✓${NC} 已配置 ${MUTED}[内置]${NC}"
    else
        echo -e "  ${MUTED}└─${NC} 飞书         ${MUTED}○${NC} 未配置 ${MUTED}[内置]${NC}"
    fi

    echo ""

    # Check gateway status
    echo -e "  ${MUTED}服务状态${NC}"
    local claw=""
    claw="$(resolve_clawdbot_bin || true)"
    if [[ -n "$claw" ]]; then
        if is_gateway_running "$claw"; then
            echo -e "  ${MUTED}└─${NC} Gateway      ${SUCCESS}✓${NC} 运行中"
        else
            echo -e "  ${MUTED}└─${NC} Gateway      ${MUTED}○${NC} 未运行"
        fi
    else
        echo -e "  ${MUTED}└─${NC} Gateway      ${MUTED}○${NC} Openclaw 未安装"
    fi

    echo ""

    # Check config
    echo -e "  ${MUTED}配置文件${NC}"
    local config_file="$HOME/.openclaw/openclaw.json"
    if [[ -f "$config_file" ]]; then
        echo -e "  ${MUTED}└─${NC} 配置文件     ${SUCCESS}✓${NC} ${INFO}$config_file${NC}"
    else
        echo -e "  ${MUTED}└─${NC} 配置文件     ${WARN}!${NC} 未配置"
    fi

    echo ""
}

# ============================================
# Uninstall Module
# ============================================

stop_gateway_service() {
    local claw=""
    claw="$(resolve_clawdbot_bin || true)"
    if [[ -n "$claw" ]]; then
        spinner_start "停止 Gateway 服务..."
        "$claw" gateway stop 2>/dev/null || true
        spinner_stop 0 "Gateway 服务已停止"
    fi

    # Also stop legacy Clawdbot/Moltbot gateway processes if running
    for legacy_bin in clawdbot moltbot; do
        local legacy_path=""
        legacy_path="$(command -v "$legacy_bin" 2>/dev/null || true)"
        if [[ -n "$legacy_path" ]]; then
            "$legacy_path" gateway stop 2>/dev/null || true
        fi
    done
}

uninstall_clawdbot_components() {
    local claw=""
    claw="$(resolve_clawdbot_bin || true)"
    if [[ -n "$claw" ]]; then
        spinner_start "卸载 Openclaw 组件..."
        "$claw" uninstall --all --yes 2>/dev/null || true
        spinner_stop 0 "组件已卸载"
    fi
}

uninstall_npm_packages() {
    spinner_start "卸载 npm/pnpm 全局包..."
    # npm global uninstall (current 'openclaw' and legacy 'clawdbot'/'moltbot' package names)
    npm uninstall -g openclaw clawdbot moltbot clawdbot-dingtalk "$CHANNEL_PKG_QQ" >/dev/null 2>&1 || true
    # pnpm global uninstall
    if command -v pnpm &> /dev/null; then
        pnpm remove -g openclaw clawdbot moltbot clawdbot-dingtalk "$CHANNEL_PKG_QQ" >/dev/null 2>&1 || true
    fi
    # Also try to remove the binary directly from pnpm global bin
    local pnpm_bin=""
    pnpm_bin="$(pnpm bin -g 2>/dev/null || true)"
    for bin_name in openclaw clawdbot moltbot; do
        if [[ -n "$pnpm_bin" && -f "${pnpm_bin}/${bin_name}" ]]; then
            rm -f "${pnpm_bin}/${bin_name}" 2>/dev/null || true
        fi
    done
    # Also remove residual directories from npm global (in case uninstall failed)
    local npm_root=""
    npm_root="$(npm root -g 2>/dev/null || true)"
    if [[ -n "$npm_root" ]]; then
        for pkg_dir in openclaw clawdbot moltbot clawdbot-dingtalk; do
            rm -rf "${npm_root}/${pkg_dir}" 2>/dev/null || true
        done
    fi
    spinner_stop 0 "npm/pnpm 包已卸载"
}

cleanup_clawdbot_directories() {
    local purge="${1:-0}"
    local keep_config="${2:-0}"

    if [[ "$purge" == "1" ]]; then
        spinner_start "清理所有 Openclaw 数据..."
        # Current OpenClaw directories
        rm -rf ~/.openclaw 2>/dev/null || true
        rm -rf ~/clawd 2>/dev/null || true
        # Legacy Clawdbot/Moltbot directories
        rm -rf ~/.clawdbot 2>/dev/null || true
        rm -rf ~/.moltbot 2>/dev/null || true
        spinner_stop 0 "数据已清理"
    elif [[ "$keep_config" != "1" ]]; then
        spinner_start "清理工作区数据..."
        rm -rf ~/clawd 2>/dev/null || true
        spinner_stop 0 "工作区已清理"
    fi
}

cleanup_service_files() {
    # Linux systemd — current OpenClaw + legacy Clawdbot/Moltbot service names
    local systemd_dir="$HOME/.config/systemd/user"
    local cleaned_systemd=0
    for svc_name in openclaw-gateway clawdbot-gateway moltbot-gateway; do
        if [[ -f "${systemd_dir}/${svc_name}.service" ]]; then
            if [[ "$cleaned_systemd" == "0" ]]; then
                spinner_start "清理 systemd 服务文件..."
                cleaned_systemd=1
            fi
            systemctl --user disable "${svc_name}.service" 2>/dev/null || true
            systemctl --user stop "${svc_name}.service" 2>/dev/null || true
            rm -f "${systemd_dir}/${svc_name}.service" 2>/dev/null || true
        fi
    done
    if [[ "$cleaned_systemd" == "1" ]]; then
        systemctl --user daemon-reload 2>/dev/null || true
        spinner_stop 0 "systemd 服务已清理"
    fi

    # macOS launchd — current OpenClaw + legacy Clawdbot/Moltbot plist labels
    local launch_dir="$HOME/Library/LaunchAgents"
    local cleaned_launchd=0
    for plist_label in ai.openclaw.gateway com.moltbot.gateway com.clawdbot.gateway; do
        if [[ -f "${launch_dir}/${plist_label}.plist" ]]; then
            if [[ "$cleaned_launchd" == "0" ]]; then
                spinner_start "清理 launchd 服务文件..."
                cleaned_launchd=1
            fi
            launchctl bootout "gui/$(id -u)/${plist_label}" 2>/dev/null || \
                launchctl unload "${launch_dir}/${plist_label}.plist" 2>/dev/null || true
            rm -f "${launch_dir}/${plist_label}.plist" 2>/dev/null || true
        fi
    done
    if [[ "$cleaned_launchd" == "1" ]]; then
        spinner_stop 0 "launchd 服务已清理"
    fi
}

run_uninstall_flow() {
    log info "=== Starting uninstall flow ==="
    log info "Purge: $UNINSTALL_PURGE, Keep config: $UNINSTALL_KEEP_CONFIG"
    clack_intro "🦞 Openclaw 卸载"

    # Check if openclaw is installed
    local clawdbot_installed=""
    clawdbot_installed="$(get_installed_version "openclaw")"

    if [[ -z "$clawdbot_installed" ]]; then
        log info "Openclaw not installed, nothing to uninstall"
        clack_step "${WARN}Openclaw 未安装${NC}"
        clack_outro "无需卸载"
        return 0
    fi

    log info "Current installed version: $clawdbot_installed"
    clack_step "当前版本: ${INFO}$clawdbot_installed${NC}"
    echo ""

    # Confirm uninstall
    local confirm_msg="确定要卸载 Openclaw 吗？"
    if [[ "$UNINSTALL_PURGE" == "1" ]]; then
        confirm_msg="确定要完全卸载 Openclaw（包括所有配置和数据）吗？"
    fi

    if is_promptable && [[ "$NO_PROMPT" != "1" ]]; then
        if ! clack_confirm "$confirm_msg" "false"; then
            log info "Uninstall cancelled by user"
            clack_step "${INFO}已取消${NC}"
            clack_outro "卸载已取消"
            return 0
        fi
    fi

    echo ""

    # Stop gateway
    log info "Stopping gateway service..."
    stop_gateway_service

    # Uninstall components
    log info "Uninstalling components..."
    uninstall_clawdbot_components

    # Uninstall npm packages
    log info "Uninstalling npm packages..."
    uninstall_npm_packages

    # Cleanup directories
    log info "Cleaning up directories..."
    cleanup_clawdbot_directories "$UNINSTALL_PURGE" "$UNINSTALL_KEEP_CONFIG"

    # Cleanup service files
    log info "Cleaning up service files..."
    cleanup_service_files

    # Remove git wrapper if exists (current + legacy binary names)
    local removed_wrappers=0
    for wrapper_name in openclaw clawdbot moltbot; do
        if [[ -x "$HOME/.local/bin/${wrapper_name}" ]]; then
            rm -f "$HOME/.local/bin/${wrapper_name}"
            log info "Removed wrapper: ~/.local/bin/${wrapper_name}"
            removed_wrappers=1
        fi
    done
    if [[ "$removed_wrappers" == "1" ]]; then
        echo -e "${SUCCESS}✓${NC} Git wrapper 已移除"
    fi

    log info "=== Uninstall completed ==="
    echo ""
    clack_outro "${SUCCESS}Openclaw 已完全卸载${NC}"
}

# ============================================
# Upgrade Module
# ============================================

check_upgrade_available() {
    local pkg="$1"
    local installed=""
    local latest=""

    installed="$(get_installed_version "$pkg")"
    latest="$(get_latest_version "$pkg" "latest")"

    if [[ -z "$installed" ]]; then
        echo "not_installed"
        return
    fi

    if [[ "$installed" == "$latest" ]]; then
        echo "up_to_date"
        return
    fi

    echo "upgrade_available"
}

upgrade_clawdbot_core() {
    local current=""
    current="$(get_installed_version "openclaw")"
    local pinned="${OPENCLAW_PINNED_VERSION:-2026.3.23}"

    if [[ -z "$current" ]]; then
        echo -e "${WARN}→${NC} Openclaw 未安装，执行安装 (固定版本: ${INFO}${pinned}${NC})..."
        install_clawdbot
        return $?
    fi

    if [[ "$current" == "$pinned" ]]; then
        echo -e "${SUCCESS}✓${NC} Openclaw 已是固定版本 (${INFO}$current${NC})"
        return 0
    fi

    echo -e "${WARN}→${NC} Openclaw 当前版本 ${INFO}${current}${NC}，将切换到固定版本 ${INFO}${pinned}${NC}..."
    install_clawdbot
    return $?
}

upgrade_dingtalk_plugin() {
    local current=""
    # Plugins are installed via npm -g; `get_installed_version` covers both ~/.openclaw/extensions and npm -g.
    current="$(get_installed_version "$CHANNEL_PKG_DINGTALK")"
    local latest=""
    local tag="latest"
    latest="$(get_latest_version "$CHANNEL_PKG_DINGTALK" "$tag")"

    local current_label="${current:-未安装}"
    if [[ -n "$latest" && "$current" == "$latest" ]]; then
        echo -e "${SUCCESS}✓${NC} 钉钉插件已是最新版本 (${INFO}$current${NC})"
    else
        echo -e "${WARN}→${NC} 升级钉钉插件: ${INFO}${current_label}${NC} → ${INFO}${latest:-$tag}${NC}"
    fi

    # Always ensure the plugin is installed and discoverable by Openclaw (npm -g + plugins.load.paths).
    if [[ -z "$current" ]] && ! config_references_plugin_or_channel "$CHANNEL_PKG_DINGTALK"; then
        echo -e "${MUTED}○${NC} 未检测到钉钉插件配置，跳过安装/升级"
        return 0
    fi
    if ! install_channel_plugin dingtalk "${CHANNEL_PKG_DINGTALK}@${tag}"; then
        return 1
    fi

    # Verify the actually loaded plugin version/source (catches shadowing by workspace/bundled plugins).
    if [[ -n "$latest" ]]; then
        local meta=""
        meta="$(get_openclaw_plugin_loaded_meta "$CHANNEL_PKG_DINGTALK" || true)"
        if [[ -n "$meta" ]]; then
            local loaded_version=""
            loaded_version="$(printf '%s' "$meta" | node -e '
const fs = require("fs");
let obj = {};
try { obj = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
process.stdout.write(String(obj?.version ?? "").trim());
' 2>/dev/null || true)"
            if [[ -n "$loaded_version" && "$loaded_version" != "$latest" ]]; then
                echo -e "${WARN}→${NC} 注意：Openclaw 当前实际加载的钉钉插件版本为 ${INFO}${loaded_version}${NC}（期望: ${INFO}${latest}${NC}）"
                echo -e "${MUTED}   可能原因：workspace 插件覆盖 / bundled 插件覆盖 / 仍未重启 Gateway。${NC}"
                echo -e "${MUTED}   解析信息: ${meta}${NC}"

                echo -e "${WARN}→${NC} 尝试强制重装到 ${INFO}~/.openclaw/extensions/${CHANNEL_PKG_DINGTALK}${NC}..."
                rm -rf "$HOME/.openclaw/extensions/$CHANNEL_PKG_DINGTALK" 2>/dev/null || true

                # Also remove a workspace override if present (workspace origin has higher priority than global).
                local ws=""
                ws="$(CONFIG_FILE="$HOME/.openclaw/openclaw.json" node -e '
const fs = require("fs");
const p = process.env.CONFIG_FILE;
let cfg;
try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch { process.exit(0); }
const v = cfg?.agents?.defaults?.workspace;
if (typeof v === "string" && v.trim()) process.stdout.write(v.trim());
' 2>/dev/null || true)"
                if [[ -z "$ws" ]]; then
                    ws="$HOME/.openclaw/workspace"
                fi
                rm -rf "${ws%/}/.openclaw/extensions/$CHANNEL_PKG_DINGTALK" 2>/dev/null || true

                if install_channel_plugin dingtalk "${CHANNEL_PKG_DINGTALK}@${tag}"; then
                    local meta2=""
                    meta2="$(get_openclaw_plugin_loaded_meta "$CHANNEL_PKG_DINGTALK" || true)"
                    local loaded2=""
                    loaded2="$(printf '%s' "$meta2" | node -e '
const fs = require("fs");
let obj = {};
try { obj = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
process.stdout.write(String(obj?.version ?? "").trim());
' 2>/dev/null || true)"
                    if [[ -n "$loaded2" && "$loaded2" == "$latest" ]]; then
                        echo -e "${SUCCESS}✓${NC} 钉钉插件已强制更新到 ${INFO}${loaded2}${NC}"
                    else
                        echo -e "${WARN}→${NC} 强制重装后仍未命中期望版本（期望: ${INFO}${latest}${NC}）"
                        if [[ -n "$meta2" ]]; then
                            echo -e "${MUTED}   解析信息: ${meta2}${NC}"
                        fi
                    fi
                fi
            fi
        fi
    fi

    return 0
}

upgrade_all() {
    upgrade_clawdbot_core || true
}

upgrade_all_plugins() {
    upgrade_dingtalk_plugin || true
}

prompt_gateway_restart() {
    local claw=""
    claw="$(resolve_clawdbot_bin || true)"
    if [[ -z "$claw" ]]; then
        return 0
    fi

    echo ""
    restart_gateway_if_running "$claw"
}

run_upgrade_flow() {
    log info "=== Starting upgrade flow ==="
    log info "Upgrade target: $UPGRADE_TARGET"
    clack_intro "🦀 Openclaw 升级"

    # Detect CN mirrors
    detect_cn_mirrors || true
    apply_cn_mirrors

    # Clear npm cache before upgrade
    clear_npm_cache

    # Migrate deprecated config keys before any Openclaw CLI runs
    migrate_browser_controlurl || true

    echo ""

    case "$UPGRADE_TARGET" in
        core)
            log info "Upgrading core only"
            upgrade_clawdbot_core
            ;;
        plugins)
            log info "Upgrading plugins only"
            upgrade_all_plugins
            ;;
        all|*)
            log info "Upgrading core (use '渠道插件' menu to upgrade plugins)"
            upgrade_all
            ;;
    esac

    if [[ "$UPGRADE_TARGET" != "plugins" ]]; then
        prompt_gateway_restart
    fi

    log info "=== Upgrade completed ==="
    echo ""
    clack_outro "${SUCCESS}升级完成${NC}"
    echo -e "${MUTED}提示: 渠道插件请通过「渠道插件」菜单升级${NC}"
}

# ============================================
# Configure Module
# ============================================

# Configuration file path
CONFIG_FILE="$HOME/.openclaw/openclaw.json"
CONFIG_DIR="$HOME/.openclaw"

# Backup config file before modifications
config_backup() {
    if [[ -f "$CONFIG_FILE" ]]; then
        local backup_file="${CONFIG_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
        cp "$CONFIG_FILE" "$backup_file"
        log debug "Config backed up to: $backup_file"
        echo "$backup_file"
    fi
}

# Migrate deprecated browser config keys (controlURL/controlUrl -> cdpUrl).
# Openclaw now uses CDP terminology for browser control.
migrate_browser_controlurl() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        return 0
    fi
    if ! command -v node &>/dev/null; then
        return 0
    fi

    local needs_migration=""
    needs_migration="$(CONFIG_FILE="$CONFIG_FILE" node -e '
        const fs = require("fs");
        const p = process.env.CONFIG_FILE;
        let cfg;
        try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch { process.exit(0); }

        const browser = cfg?.browser;
        const keys = ["controlURL", "controlUrl", "control_url"];
        let has = false;

        if (browser && typeof browser === "object") {
            if (keys.some((k) => Object.prototype.hasOwnProperty.call(browser, k))) {
                has = true;
            } else if (browser.profiles && typeof browser.profiles === "object") {
                for (const profile of Object.values(browser.profiles)) {
                    if (profile && typeof profile === "object" && keys.some((k) => Object.prototype.hasOwnProperty.call(profile, k))) {
                        has = true;
                        break;
                    }
                }
            }
        }

        process.stdout.write(has ? "1" : "0");
    ' 2>/dev/null || true)"

    if [[ "$needs_migration" != "1" ]]; then
        return 0
    fi

    local backup_file=""
    backup_file="$(config_backup || true)"

    echo -e "${WARN}→${NC} 检测到旧版 Browser 配置字段 ${INFO}controlURL${NC}，正在迁移为 ${INFO}cdpUrl${NC}..."
    local result=""
    result="$(CONFIG_FILE="$CONFIG_FILE" node -e '
        const fs = require("fs");
        const p = process.env.CONFIG_FILE;
        let cfg;
        try { cfg = JSON.parse(fs.readFileSync(p, "utf8")); } catch { process.stdout.write("invalid_json"); process.exit(0); }

        const browser = cfg?.browser;
        const keys = ["controlURL", "controlUrl", "control_url"];
        let changed = false;

        function firstString(obj) {
            if (!obj || typeof obj !== "object") return undefined;
            for (const k of keys) {
                const v = obj[k];
                if (typeof v === "string" && v.trim()) return v;
            }
            return undefined;
        }

        if (browser && typeof browser === "object") {
            const browserControl = firstString(browser);
            if ((browser.cdpUrl === undefined || browser.cdpUrl === null || browser.cdpUrl === "") && browserControl) {
                browser.cdpUrl = browserControl;
                changed = true;
            }
            for (const k of keys) {
                if (Object.prototype.hasOwnProperty.call(browser, k)) {
                    delete browser[k];
                    changed = true;
                }
            }

            const profiles = browser.profiles;
            if (profiles && typeof profiles === "object") {
                for (const profile of Object.values(profiles)) {
                    if (!profile || typeof profile !== "object") continue;
                    const profileControl = firstString(profile);
                    if ((profile.cdpUrl === undefined || profile.cdpUrl === null || profile.cdpUrl === "") && profileControl) {
                        profile.cdpUrl = profileControl;
                        changed = true;
                    }
                    for (const k of keys) {
                        if (Object.prototype.hasOwnProperty.call(profile, k)) {
                            delete profile[k];
                            changed = true;
                        }
                    }
                }
            }
        }

        if (!changed) {
            process.stdout.write("nochange");
            process.exit(0);
        }

        fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
        process.stdout.write("migrated");
    ' 2>/dev/null || true)"

    if [[ "$result" == "migrated" ]]; then
        echo -e "${SUCCESS}✓${NC} Browser 配置迁移完成 (controlURL → cdpUrl)"
        if [[ -n "$backup_file" ]]; then
            echo -e "${MUTED}备份: ${backup_file}${NC}"
        fi
        return 0
    fi

    echo -e "${WARN}→${NC} Browser 配置迁移未完成，请手动检查: ${INFO}${CONFIG_FILE}${NC}"
    return 0
}

# Read a config value by dot-notation key (e.g., "gateway.port")
config_get() {
    local key="$1"
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo ""
        return 1
    fi
    node -e "
        const fs = require('fs');
        try {
            const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
            const keys = '$key'.split('.');
            let val = cfg;
            for (const k of keys) {
                if (val === undefined || val === null) break;
                val = val[k];
            }
            if (val !== undefined && val !== null) {
                console.log(typeof val === 'object' ? JSON.stringify(val) : val);
            }
        } catch (e) {}
    " 2>/dev/null
}

# Set a config value by dot-notation key (preserves other fields)
config_set() {
    local key="$1"
    local value="$2"
    
    mkdir -p "$CONFIG_DIR"
    
    CONFIG_VALUE="$value" node -e "
        const fs = require('fs');
        let cfg = {};
        try { 
            cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8')); 
        } catch {}
        
        const keys = '$key'.split('.');
        let obj = cfg;
        for (let i = 0; i < keys.length - 1; i++) {
            if (typeof obj[keys[i]] !== 'object' || obj[keys[i]] === null) {
                obj[keys[i]] = {};
            }
            obj = obj[keys[i]];
        }
        
        // Try to parse as JSON, otherwise use as string
        const rawValue = process.env.CONFIG_VALUE ?? '';
        let parsedValue;
        try {
            parsedValue = JSON.parse(rawValue);
        } catch {
            parsedValue = rawValue;
        }
        obj[keys[keys.length - 1]] = parsedValue;
        
        fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2));
    " 2>/dev/null
}

# Delete a config key (preserves other fields)
config_delete() {
    local key="$1"
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        return 0
    fi
    
    node -e "
        const fs = require('fs');
        let cfg = {};
        try { 
            cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8')); 
        } catch { return; }
        
        const keys = '$key'.split('.');
        let obj = cfg;
        for (let i = 0; i < keys.length - 1; i++) {
            if (obj[keys[i]] === undefined) return;
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
        
        fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2));
    " 2>/dev/null
}

# Check if config file exists
config_exists() {
    [[ -f "$CONFIG_FILE" ]]
}

show_current_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo -e "${WARN}→${NC} 配置文件不存在"
        return 1
    fi

    echo -e "${INFO}当前配置文件:${NC} $CONFIG_FILE"
    echo ""
    
    # Pretty print with syntax highlighting if possible
    if command -v node &>/dev/null; then
        node -e "
            const fs = require('fs');
            const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
            console.log(JSON.stringify(cfg, null, 2));
        " 2>/dev/null || cat "$CONFIG_FILE"
    else
        cat "$CONFIG_FILE"
    fi
}

# Get available models from openclaw.json
# Returns lines of "provider/model_id|display_name" format
config_get_available_models() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        echo ""
        return 1
    fi
    node -e "
        const fs = require('fs');
        try {
            const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
            const providers = cfg.models?.providers || {};
            for (const [providerName, provider] of Object.entries(providers)) {
                const models = provider.models || [];
                for (const model of models) {
                    const id = model.id || '';
                    const name = model.name || id;
                    if (id) {
                        console.log(providerName + '/' + id + '|' + name);
                    }
                }
            }
        } catch (e) {}
    " 2>/dev/null
}

# Update AI model configuration (baseUrl, apiKey, model)
config_update_model() {
    clack_step "${INFO}修改 AI 模型配置${NC}"
    echo ""

    # Show current values
    local current_base_url=""
    current_base_url="$(config_get 'models.providers.dashscope.baseUrl')"
    local current_model=""
    current_model="$(config_get 'agents.defaults.model.primary')"

    if [[ -n "$current_base_url" ]]; then
        echo -e "${MUTED}当前 Base URL: ${current_base_url}${NC}"
    fi
    if [[ -n "$current_model" ]]; then
        echo -e "${MUTED}当前模型: ${current_model}${NC}"
    fi
    echo ""

    # Prompt for new values
    local new_base_url=""
    printf "${ACCENT}◆${NC} 百炼 Base URL [${MUTED}回车保留当前${NC}]: " > /dev/tty
    read -r new_base_url < /dev/tty || true

    local new_api_key=""
    printf "${ACCENT}◆${NC} 百炼 API Key [${MUTED}回车保留当前${NC}]: " > /dev/tty
    read -r new_api_key < /dev/tty || true

    # Model selection
    echo ""
    local new_model=""

    # Determine effective base_url (new value or current)
    local effective_base_url="${new_base_url:-$current_base_url}"
    local CODING_PLAN_URL="https://coding.dashscope.aliyuncs.com/v1"

    if [[ "$effective_base_url" == "$CODING_PLAN_URL" ]]; then
        # Coding Plan only supports these models
        local model_options=(
            "dashscope/qwen3.5-plus"
            "dashscope/qwen3-max-2026-01-23"
            "dashscope/qwen3-coder-next"
            "dashscope/MiniMax-M2.5"
            "dashscope/qwen3-coder-plus"
            "dashscope/glm-5"
            "dashscope/glm-4.7"
            "dashscope/kimi-k2.5"
            "保留当前模型"
        )
        local model_ids=(
            "dashscope/qwen3.5-plus"
            "dashscope/qwen3-max-2026-01-23"
            "dashscope/qwen3-coder-next"
            "dashscope/MiniMax-M2.5"
            "dashscope/qwen3-coder-plus"
            "dashscope/glm-5"
            "dashscope/glm-4.7"
            "dashscope/kimi-k2.5"
        )

        local model_choice
        model_choice=$(clack_select "选择模型" "${model_options[@]}")

        if [[ $model_choice -lt 8 ]]; then
            new_model="${model_ids[$model_choice]}"
        fi
        # else: selected "保留当前模型", new_model stays empty
    else
        # For other base URLs, read available models from config file
        local model_list=""
        model_list="$(config_get_available_models)"

        if [[ -z "$model_list" ]]; then
            echo -e "${WARN}◆${NC} 未在配置中找到可用模型"
            echo -e "${MUTED}  请先在 openclaw.json 的 models.providers 中配置模型${NC}"
        else
            # Build model options array
            local model_options=()
            local model_ids=()
            while IFS= read -r line; do
                if [[ -n "$line" ]]; then
                    local model_id="${line%%|*}"
                    local model_name="${line#*|}"
                    model_options+=("${model_id}  - ${model_name}")
                    model_ids+=("$model_id")
                fi
            done <<< "$model_list"

            # Add "keep current" option
            model_options+=("保留当前模型")

            local model_choice
            model_choice=$(clack_select "选择模型" "${model_options[@]}")

            local num_models=${#model_ids[@]}
            if [[ $model_choice -lt $num_models ]]; then
                new_model="${model_ids[$model_choice]}"
            fi
            # else: selected "保留当前模型", new_model stays empty
        fi
    fi

    # Backup and apply changes
    if [[ -n "$new_base_url" || -n "$new_api_key" || -n "$new_model" ]]; then
        config_backup

        if [[ -n "$new_base_url" ]]; then
            config_set "models.providers.dashscope.baseUrl" "\"$new_base_url\""
            echo -e "${SUCCESS}✓${NC} Base URL 已更新"
        fi

        if [[ -n "$new_api_key" ]]; then
            config_set "models.providers.dashscope.apiKey" "\"$new_api_key\""
            echo -e "${SUCCESS}✓${NC} API Key 已更新"
        fi

        if [[ -n "$new_model" ]]; then
            config_set "agents.defaults.model.primary" "\"$new_model\""
            echo -e "${SUCCESS}✓${NC} 模型已更新为 $new_model"
        fi

        # Ensure models array exists for Coding Plan URL
        if [[ "${new_base_url:-$current_base_url}" == "$CODING_PLAN_URL" ]]; then
            local models_json='[{"id":"qwen3.5-plus","name":"Qwen3.5 Plus","contextWindow":1000000,"maxTokens":65536,"reasoning":true,"input":["text","image"],"compat":{"thinkingFormat":"qwen","supportsStrictMode":false,"supportsDeveloperRole":false}},{"id":"qwen3-max-2026-01-23","name":"Qwen3 Max Thinking","contextWindow":262144,"maxTokens":65536,"reasoning":true,"compat":{"thinkingFormat":"qwen","supportsStrictMode":false,"supportsDeveloperRole":false}},{"id":"qwen3-coder-next","name":"Qwen3 Coder Next","contextWindow":262144,"maxTokens":65536,"reasoning":false},{"id":"MiniMax-M2.5","name":"MiniMax-M2.5","contextWindow":204800,"maxTokens":131072,"reasoning":true,"compat":{"thinkingFormat":"qwen","supportsStrictMode":false,"supportsDeveloperRole":false}},{"id":"qwen3-coder-plus","name":"Qwen3 Coder Plus","contextWindow":1000000,"maxTokens":65536,"reasoning":false},{"id":"glm-5","name":"GLM-5","contextWindow":202752,"maxTokens":16384,"reasoning":true,"compat":{"thinkingFormat":"qwen","supportsStrictMode":false,"supportsDeveloperRole":false}},{"id":"glm-4.7","name":"GLM-4.7","contextWindow":169984,"maxTokens":16384,"reasoning":true,"compat":{"thinkingFormat":"qwen","supportsStrictMode":false,"supportsDeveloperRole":false}},{"id":"kimi-k2.5","name":"Kimi K2.5","contextWindow":262144,"maxTokens":262144,"reasoning":true,"input":["text","image"],"compat":{"thinkingFormat":"qwen","supportsStrictMode":false,"supportsDeveloperRole":false}}]'
            config_set "models.providers.dashscope.models" "$models_json"
        fi
    else
        echo -e "${MUTED}未做任何更改${NC}"
    fi
}

# Update Gateway configuration (port, token)
config_update_gateway() {
    clack_step "${INFO}修改 Gateway 配置${NC}"
    echo ""
    
    # Show current values
    local current_port=""
    current_port="$(config_get 'gateway.port')"
    local current_bind=""
    current_bind="$(config_get 'gateway.bind')"
    
    if [[ -n "$current_port" ]]; then
        echo -e "${MUTED}当前端口: ${current_port}${NC}"
    fi
    if [[ -n "$current_bind" ]]; then
        echo -e "${MUTED}当前绑定: ${current_bind}${NC}"
    fi
    echo ""
    
    # Prompt for new values
    local new_port=""
    printf "${ACCENT}◆${NC} Gateway 端口 [${MUTED}回车保留当前${NC}]: " > /dev/tty
    read -r new_port < /dev/tty || true
    
    local new_bind=""
    printf "${ACCENT}◆${NC} 绑定地址 (127.0.0.1 或 0.0.0.0) [${MUTED}回车保留当前${NC}]: " > /dev/tty
    read -r new_bind < /dev/tty || true
    
    # Backup and apply changes
    if [[ -n "$new_port" || -n "$new_bind" ]]; then
        config_backup
        
        if [[ -n "$new_port" ]]; then
            config_set "gateway.port" "$new_port"
            echo -e "${SUCCESS}✓${NC} 端口已更新为 $new_port"
        fi
        
        if [[ -n "$new_bind" ]]; then
            config_set "gateway.bind" "\"$new_bind\""
            echo -e "${SUCCESS}✓${NC} 绑定地址已更新为 $new_bind"
        fi
    else
        echo -e "${MUTED}未做任何更改${NC}"
    fi
}

# Regenerate Gateway token only
config_regenerate_token() {
    clack_step "${INFO}重新生成 Gateway Token${NC}"
    
    spinner_start "生成新 Token..."
    local new_token=""
    new_token="$(generate_gateway_token)"
    spinner_stop 0 "Token 已生成"
    
    config_backup
    config_set "gateway.auth.token" "\"$new_token\""
    
    echo -e "${SUCCESS}✓${NC} 新 Token: ${INFO}${new_token}${NC}"
    echo -e "${WARN}注意:${NC} 请更新所有使用该 Token 的客户端"
}

# Add channel config incrementally
config_add_channel() {
    local channel="$1"

    # Collect channel credentials
    case "$channel" in
        dingtalk)
            if [[ -z "${CHANNEL_DINGTALK_CLIENT_ID:-}" || -z "${CHANNEL_DINGTALK_CLIENT_SECRET:-}" ]]; then
                configure_channel_dingtalk || return 1
            fi
            config_backup
            config_set "channels.clawdbot-dingtalk.enabled" "true"
            config_set "channels.clawdbot-dingtalk.clientId" "\"${CHANNEL_DINGTALK_CLIENT_ID}\""
            config_set "channels.clawdbot-dingtalk.clientSecret" "\"${CHANNEL_DINGTALK_CLIENT_SECRET}\""
            config_set "channels.clawdbot-dingtalk.aliyunMcp.timeoutSeconds" "60"
            config_set "channels.clawdbot-dingtalk.aliyunMcp.tools.webSearch.enabled" "false"
            config_set "channels.clawdbot-dingtalk.aliyunMcp.tools.codeInterpreter.enabled" "false"
            config_set "channels.clawdbot-dingtalk.aliyunMcp.tools.webParser.enabled" "false"
            config_set "channels.clawdbot-dingtalk.aliyunMcp.tools.wan26Media.enabled" "false"
            config_set "channels.clawdbot-dingtalk.aliyunMcp.tools.wan26Media.autoSendToDingtalk" "true"
            config_set "plugins.entries.clawdbot-dingtalk.enabled" "true"
            config_delete "plugins.entries.clawdbot-dingtalk.config"
            config_set "tools.web.search.enabled" "false"
            ;;
        feishu)
            if [[ -z "${CHANNEL_FEISHU_APP_ID:-}" || -z "${CHANNEL_FEISHU_APP_SECRET:-}" ]]; then
                configure_channel_feishu || return 1
            fi
            config_backup
            config_set "channels.feishu.enabled" "true"
            config_set "channels.feishu.appId" "\"${CHANNEL_FEISHU_APP_ID}\""
            config_set "channels.feishu.appSecret" "\"${CHANNEL_FEISHU_APP_SECRET}\""
            ;;
        qqbot)
            if [[ -z "${CHANNEL_QQ_TOKEN:-}" ]]; then
                configure_channel_qq || return 1
            fi
            config_backup
            config_set "channels.qqbot.enabled" "true"
            config_set "channels.qqbot.token" "\"${CHANNEL_QQ_TOKEN}\""
            config_set "channels.qqbot.allowFrom" '["*"]'
            config_set "channels.qqbot.appId" "\"${CHANNEL_QQ_APP_ID}\""
            config_set "channels.qqbot.clientSecret" "\"${CHANNEL_QQ_APP_SECRET}\""
            config_set "plugins.entries.${CHANNEL_PLUGIN_ID_QQ}.enabled" "true"
            ;;
    esac

    echo -e "${SUCCESS}✓${NC} 渠道配置已添加"
}

# Remove channel config
config_remove_channel() {
    local channel="$1"

    config_backup

    case "$channel" in
        dingtalk)
            config_delete "channels.clawdbot-dingtalk"
            config_delete "plugins.entries.clawdbot-dingtalk"
            ;;
        feishu)
            config_delete "channels.feishu"
            ;;
        qqbot)
            config_delete "channels.qqbot"
            config_delete "plugins.entries.${CHANNEL_PLUGIN_ID_QQ}"
            ;;
    esac
    
    echo -e "${SUCCESS}✓${NC} 渠道配置已移除"
}

# Configuration submenu
show_configure_menu() {
    while true; do
        echo ""
        echo -e "${ACCENT}${BOLD}┌─────────────────────────────────────────┐${NC}"
        echo -e "${ACCENT}${BOLD}│  ⚙️  配置管理                           │${NC}"
        echo -e "${ACCENT}${BOLD}└─────────────────────────────────────────┘${NC}"
        echo ""

        # Show config status
        if config_exists; then
            echo -e "  ${SUCCESS}●${NC} 配置文件存在: ${MUTED}$CONFIG_FILE${NC}"
        else
            echo -e "  ${WARN}○${NC} 配置文件不存在"
        fi
        echo ""

        local config_menu_options=(
            "查看当前配置           - 显示 openclaw.json 内容"
            "修改 AI 模型配置       - 更新 DashScope API/模型"
            "修改 Gateway 配置      - 更新端口/绑定地址"
            "重新生成 Token         - 生成新的 Gateway Token"
            "全新配置向导           - 从头创建配置（覆盖）"
            "返回主菜单"
        )

        local config_choice
        config_choice=$(clack_select "选择操作" "${config_menu_options[@]}")

        echo ""

        case $config_choice in
            0)
                show_current_config
                ;;
            1)
                if ! config_exists; then
                    echo -e "${WARN}→${NC} 配置文件不存在，请先运行「全新配置向导」"
                else
                    config_update_model
                fi
                ;;
            2)
                if ! config_exists; then
                    echo -e "${WARN}→${NC} 配置文件不存在，请先运行「全新配置向导」"
                else
                    config_update_gateway
                fi
                ;;
            3)
                if ! config_exists; then
                    echo -e "${WARN}→${NC} 配置文件不存在，请先运行「全新配置向导」"
                else
                    config_regenerate_token
                fi
                ;;
            4)
                configure_clawdbot_interactive
                ;;
            5)
                return 0
                ;;
        esac

        # 操作完成后暂停，让用户看到结果
        echo ""
        read -n 1 -s -r -p "$(echo -e "${MUTED}按任意键返回菜单...${NC}")" < /dev/tty
        echo ""
    done
}

run_configure_flow() {
    clack_intro "🦀 Openclaw 配置"

    if [[ ! -r /dev/tty || ! -w /dev/tty ]]; then
        echo -e "${ERROR}配置向导需要交互式终端${NC}"
        clack_outro "请在交互式终端中运行"
        return 1
    fi

    show_configure_menu
}

# ============================================
# Repair Module
# ============================================

run_doctor_repair() {
    local claw=""
    claw="$(resolve_clawdbot_bin || true)"
    if [[ -z "$claw" ]]; then
        echo -e "${ERROR}Openclaw 未安装${NC}"
        return 1
    fi

    migrate_browser_controlurl || true

    spinner_start "运行诊断..."
    "$claw" doctor --non-interactive --fix || true
    spinner_stop 0 "诊断完成"
}

repair_npm_permissions() {
    spinner_start "修复 npm 权限..."
    fix_npm_permissions
    spinner_stop 0 "npm 权限已修复"
}

repair_reinstall_clawdbot() {
    spinner_start "重新安装 Openclaw (${OPENCLAW_PINNED_VERSION})..."
    cleanup_npm_clawdbot_paths
    install_clawdbot_npm "${CLAWDBOT_NPM_PKG}@${OPENCLAW_PINNED_VERSION}" >/dev/null 2>&1 || true
    spinner_stop 0 "Openclaw ${OPENCLAW_PINNED_VERSION} 已重新安装"
}

repair_reinstall_dingtalk() {
    echo -e "${WARN}→${NC} 重新安装钉钉插件..."
    # Ensure plugin is installed into Openclaw's discovery dirs (workspace/global extensions).
    if install_channel_plugin dingtalk "${CHANNEL_PKG_DINGTALK}@latest"; then
        echo -e "${SUCCESS}✓${NC} 钉钉插件已重新安装"
        return 0
    fi
    echo -e "${ERROR}✗${NC} 钉钉插件重新安装失败"
    return 1
}

repair_clear_cache() {
    spinner_start "清理 npm 缓存..."
    npm cache clean --force >/dev/null 2>&1 || true
    spinner_stop 0 "缓存已清理"
}

repair_reset_gateway() {
    local claw=""
    claw="$(resolve_clawdbot_bin || true)"
    if [[ -z "$claw" ]]; then
        echo -e "${ERROR}Openclaw 未安装${NC}"
        return 1
    fi

    spinner_start "重置 Gateway..."
    "$claw" gateway stop 2>/dev/null || true
    "$claw" gateway install 2>/dev/null || true
    "$claw" gateway start 2>/dev/null || true
    spinner_stop 0 "Gateway 已重置"
}

run_repair_flow() {
    clack_intro "🔧 Openclaw 修复"

    if [[ ! -r /dev/tty || ! -w /dev/tty ]]; then
        # Non-interactive: run doctor
        run_doctor_repair
        clack_outro "修复完成"
        return 0
    fi

    while true; do
        local repair_options=(
            "运行诊断 (doctor)        - 自动检测并修复常见问题"
            "修复 npm 权限            - 解决全局安装权限问题"
            "重新安装 Openclaw        - 清理并重装核心"
            "清理 npm 缓存            - 清除损坏的缓存"
            "重置 Gateway             - 停止、重装、启动服务"
            "返回主菜单"
        )

        echo ""
        local repair_choice
        repair_choice=$(clack_select "选择修复操作" "${repair_options[@]}")

        echo ""

        case $repair_choice in
            0) run_doctor_repair ;;
            1) repair_npm_permissions ;;
            2) repair_reinstall_clawdbot ;;
            3) repair_clear_cache ;;
            4) repair_reset_gateway ;;
            5) return 0 ;;
        esac

        # 操作完成后暂停，让用户看到结果
        echo ""
        read -n 1 -s -r -p "$(echo -e "${MUTED}按任意键返回菜单...${NC}")" < /dev/tty
        echo ""
    done
}

# ============================================
# Channels Menu
# ============================================

show_channels_menu() {
    # 预先获取版本信息（一次性，避免每次循环重复查询）
    local dingtalk_ver=""
    dingtalk_ver="$(get_channel_version dingtalk)"
    local qq_ver=""
    qq_ver="$(get_channel_version qqbot)"

    while true; do
        echo ""
        echo -e "${ACCENT}${BOLD}┌─────────────────────────────────────────┐${NC}"
        echo -e "${ACCENT}${BOLD}│  📡 渠道插件管理                        │${NC}"
        echo -e "${ACCENT}${BOLD}└─────────────────────────────────────────┘${NC}"
        echo ""

        # Show current channel status
        echo -e "  ${MUTED}当前状态${NC}"
        if [[ -n "$dingtalk_ver" ]]; then
            echo -e "  ${MUTED}├─${NC} 钉钉: ${SUCCESS}v$dingtalk_ver${NC}"
        else
            echo -e "  ${MUTED}├─${NC} 钉钉: ${MUTED}未安装${NC}"
        fi
        if is_builtin_channel_configured "feishu" 2>/dev/null; then
            echo -e "  ${MUTED}├─${NC} 飞书: ${SUCCESS}已配置${NC} ${MUTED}[内置]${NC}"
        else
            echo -e "  ${MUTED}├─${NC} 飞书: ${MUTED}未配置 [内置]${NC}"
        fi
        if [[ -n "$qq_ver" ]]; then
            echo -e "  ${MUTED}└─${NC} QQ:   ${SUCCESS}v$qq_ver${NC}"
        else
            echo -e "  ${MUTED}└─${NC} QQ:   ${MUTED}未安装${NC}"
        fi
        echo ""

        local channel_menu_options=(
            "查看状态 (List)       - 查看所有渠道插件状态"
            "添加渠道 (Add)        - 安装并配置新渠道"
            "升级插件 (Upgrade)    - 升级已安装的渠道插件"
            "移除渠道 (Remove)     - 卸载渠道插件"
            "返回主菜单"
        )

        local channel_choice
        channel_choice=$(clack_select "选择操作" "${channel_menu_options[@]}")

        echo ""

        local should_pause=true

        case $channel_choice in
            0)
                # List
                list_channel_plugins
                ;;
            1)
                # Add - show channel selection
                local add_options=(
                    "钉钉 (DingTalk)   - 需要 clientId + clientSecret"
                    "飞书 (Feishu)      - 需要 appId + appSecret [内置]"
                    "QQ                 - 需要 appId + appSecret [${CHANNEL_PKG_QQ}]"
                    "返回"
                )
                local add_choice
                add_choice=$(clack_select "选择要添加的渠道" "${add_options[@]}")
                case $add_choice in
                    0) CHANNEL_ACTION="add"; CHANNEL_TARGET="dingtalk"; run_channel_flow ;;
                    1) CHANNEL_ACTION="add"; CHANNEL_TARGET="feishu"; run_channel_flow ;;
                    2) CHANNEL_ACTION="add"; CHANNEL_TARGET="qqbot"; run_channel_flow ;;
                    3) should_pause=false ;;
                esac
                ;;
            2)
                # Upgrade - show upgrade submenu
                local upgrade_options=(
                    "升级钉钉插件"
                    "升级QQ插件"
                    "返回"
                )
                local upgrade_choice
                upgrade_choice=$(clack_select "选择要升级的插件" "${upgrade_options[@]}")
                case $upgrade_choice in
                    0)
                        upgrade_dingtalk_plugin || true
                        ;;
                    1)
                        local qq_pkg="$CHANNEL_PKG_QQ"
                        local qq_current=""
                        qq_current="$(get_installed_version "$qq_pkg")"
                        if [[ -z "$qq_current" ]]; then
                            echo -e "${WARN}→${NC} QQ插件未安装"
                        else
                            echo -e "${WARN}→${NC} 升级QQ插件..."
                            install_channel_plugin qqbot "${qq_pkg}@latest" || true
                        fi
                        ;;
                    2) should_pause=false ;;
                esac
                ;;
            3)
                # Remove - show channel selection
                local remove_options=(
                    "钉钉 (DingTalk)"
                    "飞书 (Feishu)"
                    "QQ"
                    "返回"
                )
                local remove_choice
                remove_choice=$(clack_select "选择要移除的渠道" "${remove_options[@]}")
                case $remove_choice in
                    0) CHANNEL_ACTION="remove"; CHANNEL_TARGET="dingtalk"; run_channel_flow ;;
                    1) CHANNEL_ACTION="remove"; CHANNEL_TARGET="feishu"; run_channel_flow ;;
                    2) CHANNEL_ACTION="remove"; CHANNEL_TARGET="qqbot"; run_channel_flow ;;
                    3) should_pause=false ;;
                esac
                ;;
            4)
                return 0
                ;;
        esac

        # 操作完成后暂停，让用户看到结果（除非是子菜单返回）
        if [[ "$should_pause" == true ]]; then
            echo ""
            read -n 1 -s -r -p "$(echo -e "${MUTED}按任意键返回菜单...${NC}")" < /dev/tty
            echo ""
        fi
    done
}

run_channels_flow() {
    show_channels_menu
}

# ============================================
# Main Menu
# ============================================

show_main_menu() {
    echo ""
    echo -e "${ACCENT}${BOLD}┌─────────────────────────────────────────┐${NC}"
    echo -e "${ACCENT}${BOLD}│  🦀 Openclaw Manager                    │${NC}"
    echo -e "${ACCENT}${BOLD}└─────────────────────────────────────────┘${NC}"
    echo ""

    # Show current status briefly
    local clawdbot_installed=""
    clawdbot_installed="$(get_installed_version "openclaw")"
    if [[ -n "$clawdbot_installed" ]]; then
        echo -e "  ${MUTED}当前版本: ${SUCCESS}$clawdbot_installed${NC}"
    else
        echo -e "  ${MUTED}状态: ${WARN}未安装${NC}"
    fi
    echo ""

    local menu_options=(
        "安装 Openclaw (Install)      - 安装或重新安装"
        "升级 Openclaw (Upgrade)      - 升级到最新版本"
        "更新配置 (Configure)         - 运行配置向导"
        "渠道插件 (Channels)          - 管理渠道插件"
        "查看状态 (Status)            - 显示安装状态"
        "修复问题 (Repair)            - 诊断和修复问题"
        "完全卸载 (Uninstall)         - 卸载 Openclaw"
        "退出 (Exit)"
    )

    local menu_choice
    menu_choice=$(clack_select "选择操作" "${menu_options[@]}")

    case $menu_choice in
        0) ACTION="install" ;;
        1) ACTION="upgrade" ;;
        2) ACTION="configure" ;;
        3) ACTION="channels" ;;
        4) ACTION="status" ;;
        5) ACTION="repair" ;;
        6) ACTION="uninstall" ;;
        7)
            echo ""
            echo -e "${MUTED}再见！${NC}"
            exit 0
            ;;
    esac
}

# ============================================
# Channel Management Flow
# ============================================

run_channel_flow() {
    local action="${CHANNEL_ACTION:-}"
    local target="${CHANNEL_TARGET:-}"

    case "$action" in
        list)
            list_channel_plugins
            ;;
        add)
            if [[ -z "$target" ]]; then
                echo -e "${ERROR}请指定渠道: dingtalk, feishu, qqbot${NC}"
                return 1
            fi

            local display_name=""
            display_name="$(get_channel_display_name "$target")"
            clack_intro "添加渠道: $display_name"

            # Configure the channel
            case "$target" in
                dingtalk) configure_channel_dingtalk || return 1 ;;
                feishu) configure_channel_feishu || return 1 ;;
                qqbot) configure_channel_qq || return 1 ;;
                *)
                    echo -e "${ERROR}未知渠道: $target${NC}"
                    echo -e "支持的渠道: dingtalk, feishu, qqbot"
                    return 1
                    ;;
            esac

            # Clear npm cache before installing channel plugin
            clear_npm_cache

            # Install the plugin (skip for built-in channels like feishu)
            local _pkg=""
            _pkg="$(get_channel_package "$target")"
            if [[ -n "$_pkg" ]]; then
                # Delay gateway restart until after config is written (so it picks up new credentials/config).
                install_channel_plugin "$target" "" "1" || return 1
            fi

            # Add config incrementally if config file exists
            if config_exists; then
                config_add_channel "$target"
            else
                # No config file, inform the user
                echo ""
                echo -e "${INFO}i${NC} 请手动将以下配置添加到 ~/.openclaw/openclaw.json:"
                echo ""
                echo -e "${MUTED}channels 部分:${NC}"
                generate_channel_config "$target"
                echo ""
                echo -e "${MUTED}plugins.entries 部分:${NC}"
                generate_plugin_entry "$target"
                echo ""
            fi

            # Restart gateway at the very end so it picks up BOTH plugin + config changes.
            restart_gateway_if_running

            clack_outro "${SUCCESS}渠道 $display_name 已添加${NC}"
            ;;
        remove)
            if [[ -z "$target" ]]; then
                echo -e "${ERROR}请指定渠道: dingtalk, feishu, qqbot${NC}"
                return 1
            fi

            local display_name=""
            display_name="$(get_channel_display_name "$target")"

            if is_promptable; then
                if ! clack_confirm "确定要移除 $display_name 插件吗？" "false"; then
                    echo -e "${INFO}已取消${NC}"
                    return 0
                fi
            fi

            remove_channel_plugin "$target"

            # Remove config incrementally if config file exists
            if config_exists; then
                config_remove_channel "$target"
            else
                echo ""
                echo -e "${INFO}i${NC} 请手动从 ~/.openclaw/openclaw.json 中移除相关配置"
            fi
            ;;
        configure)
            if [[ -z "$target" ]]; then
                echo -e "${ERROR}请指定渠道: dingtalk, feishu, qqbot${NC}"
                return 1
            fi

            local display_name=""
            display_name="$(get_channel_display_name "$target")"
            clack_intro "配置渠道: $display_name"

            # Configure the channel
            case "$target" in
                dingtalk) configure_channel_dingtalk || return 1 ;;
                feishu) configure_channel_feishu || return 1 ;;
                qqbot) configure_channel_qq || return 1 ;;
                *)
                    echo -e "${ERROR}未知渠道: $target${NC}"
                    return 1
                    ;;
            esac

            echo ""
            echo -e "${INFO}i${NC} 请更新 ~/.openclaw/openclaw.json 中的配置:"
            echo ""
            generate_channel_config "$target"
            echo ""

            clack_outro "${SUCCESS}配置已收集${NC}"
            ;;
        *)
            echo -e "${ERROR}未知渠道操作: $action${NC}"
            echo -e "支持的操作: --channel-add, --channel-remove, --channel-configure, --channel-list"
            return 1
            ;;
    esac
}

# ============================================
# Main Entry Point
# ============================================

main() {
    # Initialize logging (before any other operations)
    log_init
    log info "Openclaw Installer started"
    log info "OS: ${OS:-unknown}, Args: ${ORIGINAL_ARGS:-}"
    log debug "LOG_ENABLED=$LOG_ENABLED, LOG_LEVEL=$LOG_LEVEL, LOG_FILE=$LOG_FILE"

    if [[ "$HELP" == "1" ]]; then
        print_usage
        return 0
    fi

    # Handle channel management actions first (these bypass the normal action flow)
    if [[ -n "$CHANNEL_ACTION" ]]; then
        run_channel_flow
        return $?
    fi

    # Determine action
    if [[ -z "$ACTION" ]]; then
        # Check if running in pipe mode (stdin is not a TTY)
        if [[ ! -t 0 ]]; then
            # Pipe mode: default to install
            ACTION="install"
        elif [[ -t 1 ]] && is_promptable; then
            # TTY mode with promptable: show menu
            ACTION="menu"
        else
            # Fallback: install
            ACTION="install"
        fi
    fi

    # Main menu loop - continue until user explicitly exits
    while [[ "$ACTION" == "menu" ]]; do
        show_main_menu

        # Dispatch action
        case "$ACTION" in
            install)
                run_install_flow
                ACTION="menu"  # Return to menu after completion
                ;;
            upgrade)
                run_upgrade_flow
                ACTION="menu"
                ;;
            configure)
                run_configure_flow
                ACTION="menu"
                ;;
            channels)
                run_channels_flow
                ACTION="menu"
                ;;
            status)
                run_status_flow
                ACTION="menu"
                ;;
            repair)
                run_repair_flow
                ACTION="menu"
                ;;
            uninstall)
                run_uninstall_flow
                ACTION="menu"
                ;;
            menu)
                # Already in menu mode, will loop back
                ;;
            *)
                break  # Exit/unknown action, exit loop
                ;;
        esac
    done

    # Handle non-menu direct actions (e.g., ./installer.sh install)
    if [[ "$ACTION" != "menu" && "$ACTION" != "exit" && -n "$ACTION" ]]; then
        case "$ACTION" in
            install) run_install_flow ;;
            upgrade) run_upgrade_flow ;;
            configure) run_configure_flow ;;
            channels) run_channels_flow ;;
            status) run_status_flow ;;
            repair) run_repair_flow ;;
            uninstall) run_uninstall_flow ;;
            *)
                echo -e "${ERROR}未知操作: $ACTION${NC}"
                print_usage
                return 1
                ;;
        esac
    fi
}

if [[ "${CLAWDBOT_INSTALL_SH_NO_RUN:-0}" != "1" ]]; then
    # Save original args for logging
    ORIGINAL_ARGS="$*"
    parse_args "$@"
    configure_verbose
    main
fi
