# Litv Go 服务部署指南

## 📦 支持平台
| 部署方式       | 支持系统                 | 管理方式          |
|----------------|--------------------------|-------------------|
| 原生二进制      |通用Linux AMD64/ARM64/ARMV7，群晖DSM/OpenWRT/玩客云   | systemd/synoservice |
| Docker 容器    | 所有支持Docker的系统     | docker命令        |

## 🚀 快速开始

### 方法一：原生二进制安装
#### 一键安装（自动识别系统）
```bash
sudo curl -sSL https://cdn.jsdelivr.net/gh/hostemail/cdn@main/litv/install_litv.sh | bash
```

#### 手动安装
```bash
wget https://cdn.jsdelivr.net/gh/hostemail/cdn@main/litv/install_litv.sh
chmod +x install_litv.sh
sudo ./install_litv.sh
```

### 方法二：Docker 容器部署
```bash
docker run -d \
  --restart=always \
  --name litv-go \
  -p 8080:8080 \
  -e SECRET_TOKEN=your_token_here \
  vipsir/litv-go:latest
```

## ⚙️ 服务管理

### 原生安装管理
```bash
# 启动服务
sudo systemctl start litv-go      # 标准Linux
synoservice --start pkg-litv-go   # 群晖DSM
/etc/init.d/litv-go start         # OpenWRT

# 查看日志
journalctl -u litv-go -f          # systemd系统
tail -f /var/log/litv-go/output.log  # 其他系统
```

### Docker 容器管理
```bash
# 启动/停止
docker start/stop litv-go

# 查看日志
docker logs -f litv-go

# 进入容器
docker exec -it litv-go sh

# 更新容器
docker pull vipsir/litv-go:latest
docker stop litv-go && docker rm litv-go
# 重新运行run命令
```

## 🔧 配置说明

### 配置文件路径
- 原生安装：`/etc/litv-go/litv-go.conf`

### 常用环境变量
| 变量名           | 默认值   | 说明                 |
|------------------|---------|----------------------|
| PORT             | 8080    | 服务监听端口         |
| SECRET_TOKEN     | -       | API访问令牌          |
| CACHE_DIR        | /tmp    | 缓存目录             |
| LOG_LEVEL        | info    | 日志级别(debug/info) |

## 🗑️ 卸载方法

### 原生安装卸载
```bash
sudo /usr/local/bin/uninstall_litv.sh
```

### Docker 容器卸载
```bash
docker stop litv-go
docker rm litv-go
docker rmi vipsir/litv-go:latest
```

## 💡 常见问题

### Q1: 群晖提示权限不足？
```bash
sudo synogroup --add litv-go
sudo chown sc-litv-go /var/packages/litv-go
```

### Q2: OpenWRT下载失败？
```bash
opkg update && opkg install ca-certificates
```

### Q3: Docker 端口冲突？
修改运行命令中的端口映射：
```bash
-p 8081:8080  # 将宿主机8081映射到容器8080
```

### Q4: 如何备份数据？
#### 原生安装
```bash
tar -czvf litv-backup.tar.gz /etc/litv-go /var/log/litv-go
```

#### Docker 容器
```bash
# 确保数据卷已挂载
docker run ... -v /host/path:/container/path ...
```

## 📜 版本历史
| 版本   | 更新内容                     |
|--------|------------------------------|
| v1.0   | 支持原生/Docker部署          |
| v1.1   | 增加ARM64、ARMV7架构支持     |
```
