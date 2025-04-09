#!/bin/bash
# 支持标准Linux/OpenWRT的安装脚本 (ARMv7/ARM64/AMD64)

# 配置变量
CDN_BASE="https://cdn.jsdelivr.net/gh/hostemail/cdn@main/litv"
BIN_NAME="litv-go"
LOG_DIR="/var/log/litv-go"

# 检测系统类型
detect_os() {
    if [ -f "/etc/openwrt_release" ]; then
        echo "openwrt"
    else
        echo "linux"
    fi
}
OS_TYPE=$(detect_os)

# 系统专用配置
case "$OS_TYPE" in
    "openwrt")
        INSTALL_DIR="/usr/bin"
        CONFIG_DIR="/etc/$BIN_NAME"
        SERVICE_CMD="/etc/init.d/$BIN_NAME restart"
        ;;
    *)
        INSTALL_DIR="/usr/local/bin"
        CONFIG_DIR="/etc/$BIN_NAME"
        SERVICE_CMD="systemctl restart $BIN_NAME"
        ;;
esac

# 安装依赖
install_deps() {
    case "$OS_TYPE" in
        "openwrt")
            opkg update && opkg install curl ca-certificates
            ;;
        *)
            if command -v apt-get &>/dev/null; then
                sudo apt-get install -y curl
            elif command -v yum &>/dev/null; then
                sudo yum install -y curl
            fi
            ;;
    esac
}

# 下载文件（带重试）
download_file() {
    local url="$1"
    local path="$2"
    for i in {1..3}; do
        if curl -L --fail "$url" -o "$path"; then
            return 0
        fi
        sleep 2
    done
    return 1
}

# 主安装流程
install_app() {
    # 创建目录
    sudo mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR"

    # 下载二进制（支持ARMv7/ARM64/AMD64）
    ARCH=$(uname -m)
    case "$ARCH" in
        "x86_64") BIN_SUFFIX="amd64" ;;
        "aarch64") BIN_SUFFIX="arm64" ;;
        "armv7l") BIN_SUFFIX="armv7" ;;
        *) echo "不支持的架构: $ARCH"; exit 1 ;;
    esac
    download_file "$CDN_BASE/litv-go-linux-$BIN_SUFFIX" "$INSTALL_DIR/$BIN_NAME" || exit 1
    chmod +x "$INSTALL_DIR/$BIN_NAME"

    # 下载配置
    download_file "$CDN_BASE/litv.conf" "$CONFIG_DIR/litv-go.conf" || {
        echo -e "PORT=8080\nSECRET_TOKEN=change_me" > "$CONFIG_DIR/litv-go.conf"
    }

    # 配置服务
    case "$OS_TYPE" in
        "openwrt")
            cat > /etc/init.d/$BIN_NAME <<EOF
#!/bin/sh /etc/rc.common
START=99
STOP=01

start() {
    $INSTALL_DIR/$BIN_NAME &
}

stop() {
    killall $BIN_NAME
}
EOF
            chmod +x /etc/init.d/$BIN_NAME
            /etc/init.d/$BIN_NAME enable
            ;;
        *)
            cat > /etc/systemd/system/$BIN_NAME.service <<EOF
[Unit]
Description=Litv Go Service
After=network.target

[Service]
ExecStart=$INSTALL_DIR/$BIN_NAME
Restart=always
EnvironmentFile=-$CONFIG_DIR/litv-go.conf
StandardOutput=file:$LOG_DIR/output.log
StandardError=file:$LOG_DIR/error.log

[Install]
WantedBy=multi-user.target
EOF
            systemctl enable $BIN_NAME
            ;;
    esac
}

# 执行安装
install_deps
install_app
echo "安装完成！执行以下命令管理服务："
echo "启动: $SERVICE_CMD"
echo "查看日志: journalctl -u $BIN_NAME -f"
