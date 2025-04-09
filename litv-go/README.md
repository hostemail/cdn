### **README.md 使用说明**  
```markdown
# Litv Go 服务一键部署工具

## 📦 支持平台
| 系统       | 架构          | 管理方式      |
|------------|---------------|-------------|
| 群晖DSM    | x86/ARM       | synoservice |
| OpenWRT    | MIPS/ARM      | procd       |
| 玩客云     | ARMv7         | systemd     |
| 标准Linux  | x86/ARM64     | systemd     |

## 🚀 快速开始
### 一键安装（自动识别系统）
```bash
sudo curl -sSL https://cdn.jsdelivr.net/gh/hostemail/cdn@main/litv/install_litv.sh | bash
```

### 手动安装
```bash
wget https://cdn.jsdelivr.net/gh/hostemail/cdn@main/litv/install_litv.sh
chmod +x install_litv.sh
sudo ./install_litv.sh
```

## ⚙️ 服务管理
### 通用命令
```bash
# 启动
sudo /usr/local/bin/litv-go

# 系统服务管理（根据系统自动适配）
sudo systemctl start litv-go      # 标准Linux
synoservice --start pkg-litv-go   # 群晖DSM
/etc/init.d/litv-go start         # OpenWRT
```

### 日志查看
```bash
# 实时日志
journalctl -u litv-go -f          # systemd系统
tail -f /var/log/litv-go/output.log  # 其他系统
```

## 🔧 配置修改
配置文件路径: `/etc/litv-go/litv-go.conf`  
常用配置项:
```ini
PORT=8080                 # 监听端口
SECRET_TOKEN=your_token   # API密钥
CACHE_DIR=/tmp            # 缓存目录
```

## 🗑️ 卸载方法
```bash
sudo /usr/local/bin/uninstall_litv.sh
```

## 💡 常见问题
### Q1: 群晖提示权限不足？
A: 手动执行以下命令后重试:  
```bash
sudo synogroup --add litv-go
sudo chown sc-litv-go /var/packages/litv-go
```

### Q2: OpenWRT下载失败？
A: 先运行:  
```bash
opkg update && opkg install ca-certificates
```

## 📜 版本历史
| 版本   | 更新内容                 |
|--------|--------------------------|
| v1.0   | 支持群晖/OpenWRT/玩客云   |
| v1.1   | 增加ARM64架构支持         |
```