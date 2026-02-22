# ARM64 架构 Docker 容器测试指南

## 概述

本文档说明如何构建和测试 arm64 架构的 Docker 容器。arm64 架构主要用于 ARM 处理器（如 Apple Silicon、树莓派、AWS Graviton 等）。

## 前置要求

1. **Docker 和 Docker Buildx**
   ```bash
   docker --version
   docker buildx version
   ```

2. **QEMU 模拟器**（在 x86 系统上运行 arm64 容器时需要）
   ```bash
   docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
   ```

3. **网络连接**（用于拉取基础镜像和依赖）

## 快速开始

### 方法一：使用构建脚本（推荐）

```bash
# 构建 arm64 镜像并运行容器
./build-arm64.sh --host 192.168.2.4 --port 8091 --run

# 仅构建镜像
./build-arm64.sh --host 192.168.2.4 --port 8091

# 查看帮助
./build-arm64.sh --help
```

### 方法二：手动构建

```bash
# 1. 创建支持 arm64 的构建器
docker buildx create --name multiarch-arm64 \
    --platform linux/amd64,linux/arm64 \
    --use --driver docker-container --bootstrap

# 2. 安装 QEMU 模拟器（如果在 x86 系统上）
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# 3. 构建 arm64 镜像
PROXY_HOST=$(hostname -I | awk '{print $1}')
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

docker buildx build \
    --platform linux/arm64 \
    --build-arg PROXY_HOST="$PROXY_HOST" \
    --build-arg PROXY_PORT=8091 \
    --build-arg APP_VERSION="1.0.0" \
    --build-arg USER_UID="$CURRENT_UID" \
    --build-arg USER_GID="$CURRENT_GID" \
    -t socks-proxy:arm64-latest \
    --load .

# 4. 运行容器
docker run -d \
    --name socks-proxy-arm64 \
    --platform linux/arm64 \
    -p 8091:8090 \
    -p 11081:11081 \
    -p 11082:11082 \
    -p 11083:11083 \
    -v "$(pwd)/data-arm64/database:/data/database" \
    -v "$(pwd)/data-arm64/ssh-keys:/data/ssh-keys" \
    -v "$(pwd)/data-arm64/logs:/data/logs" \
    -v "$(pwd)/data-arm64/pac:/data/pac" \
    -e PROXY_HOST="$PROXY_HOST" \
    -e PROXY_PORT=8091 \
    -e NODE_ENV=production \
    -e DB_PATH=/data/database/database.db \
    socks-proxy:arm64-latest
```

## 网络问题处理

**重要**：buildx 在容器中运行，无法直接使用宿主机的本地镜像。如果遇到网络超时，必须配置镜像加速或使用代理。

### 1. 配置 Docker 镜像加速（推荐）

使用提供的配置脚本（最简单）：

```bash
sudo ./configure-docker-mirrors.sh
```

或手动编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://dockerpull.org",
    "https://dockerhub.icu",
    "https://docker.1panel.live"
  ]
}
```

重启 Docker：
```bash
sudo systemctl restart docker
```

### 2. 使用代理

```bash
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1

./build-arm64.sh --host 192.168.2.4 --port 8091 --run
```

### 3. 使用本地镜像

如果本地已有 arm64 的 Ubuntu 镜像，可以修改 Dockerfile 临时使用：

```dockerfile
FROM ubuntu:latest AS builder
# 或指定具体标签
# FROM ubuntu:22.04 AS builder
```

## 验证 arm64 架构

### 检查镜像架构

```bash
docker inspect socks-proxy:arm64-latest --format '{{.Architecture}}'
# 应该输出: arm64
```

### 检查容器架构

```bash
docker exec socks-proxy-arm64 uname -m
# 应该输出: aarch64
```

### 检查容器平台

```bash
docker inspect socks-proxy-arm64 --format '{{.Platform}}'
# 应该输出: linux/arm64
```

## 测试功能

### 1. 健康检查

```bash
curl http://192.168.2.4:8091/health
curl http://192.168.2.4:8091/ready
```

### 2. Web 界面

在浏览器中访问：
```
http://192.168.2.4:8091
```

### 3. PAC 文件

```bash
curl http://192.168.2.4:8091/proxy.pac
```

### 4. 查看日志

```bash
docker logs -f socks-proxy-arm64
```

## 性能注意事项

在 x86 系统上通过 QEMU 运行 arm64 容器会有性能损失（约 2-10 倍）。建议：

1. **开发测试**：可以在 x86 上使用 QEMU 模拟
2. **生产部署**：应在真实的 ARM 硬件上运行

## ARM64 版本说明

### 版本特点

ARM64 版本的 Docker 容器与 x86_64 版本功能完全一致，主要区别：

1. **架构支持**：专为 ARM64/aarch64 架构设计
2. **适用场景**：
   - Apple Silicon (M1/M2/M3) Mac
   - 树莓派 4 及更新版本
   - AWS Graviton 实例
   - 其他 ARM64 服务器

3. **构建方式**：
   - 在 ARM64 硬件上：原生构建，性能最佳
   - 在 x86 硬件上：使用 QEMU 模拟器构建，性能有损失

### 镜像命名

- ARM64 版本镜像标签：`socks-proxy:arm64-latest`
- x86_64 版本镜像标签：`socks-proxy:latest`

## 当前遇到的问题及解决方案

### 问题 1: QEMU 模拟器镜像拉取失败

**问题描述**：
```
Unable to find image 'multiarch/qemu-user-static:latest' locally
docker: Error response from daemon: Get "https://registry-1.docker.io/v2/": read tcp ... connection reset by peer
```

**原因**：
- 网络连接不稳定
- 无法访问 Docker Hub

**解决方案**：
1. **配置 Docker 镜像加速**（推荐）：
   ```bash
   sudo ./configure-docker-mirrors.sh
   sudo systemctl restart docker
   ```

2. **检查 QEMU 是否已安装**：
   脚本会自动检测 QEMU 是否已注册，如果已安装会跳过拉取步骤：
   ```bash
   # 检查 QEMU 注册状态
   ls -la /proc/sys/fs/binfmt_misc/qemu-aarch64
   ```

3. **手动安装 QEMU**（如果网络恢复）：
   ```bash
   docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
   ```

**状态**：✅ 已修复 - 脚本现在会自动检测 QEMU 安装状态，避免重复拉取

---

### 问题 2: buildx 构建器无法启动

**问题描述**：
```
ERROR: Error response from daemon: Get "https://registry-1.docker.io/v2/": 
net/http: request canceled while waiting for connection (Client.Timeout exceeded while awaiting headers)
```

**原因**：
- buildx 构建器需要 `moby/buildkit:buildx-stable-1` 镜像
- 构建器在容器内运行，无法直接使用宿主机的本地镜像
- 网络连接问题导致无法拉取 buildkit 镜像

**解决方案**：

1. **确保 Docker 镜像加速已配置并生效**：
   ```bash
   # 检查镜像加速配置
   docker info | grep -A 5 "Registry Mirrors"
   
   # 如果未配置，运行配置脚本
   sudo ./configure-docker-mirrors.sh
   
   # 重启 Docker 服务让配置生效
   sudo systemctl restart docker
   ```

2. **手动拉取 buildkit 镜像**（如果网络可用）：
   ```bash
   docker pull moby/buildkit:buildx-stable-1
   ```

3. **删除并重新创建构建器**：
   ```bash
   docker buildx rm multiarch-arm64
   ./build-arm64.sh --host 192.168.2.4 --port 8091 --run
   ```

4. **使用 HTTP 代理**（如果镜像加速不可用）：
   ```bash
   export HTTP_PROXY=http://your-proxy:port
   export HTTPS_PROXY=http://your-proxy:port
   ./build-arm64.sh --host 192.168.2.4 --port 8091 --run
   ```

**状态**：✅ 已优化 - 脚本现在会：
- 自动检查 Docker 镜像加速配置
- 尝试预拉取 buildkit 镜像
- 提供详细的错误提示和故障排查建议

---

### 问题 3: buildkit 镜像拉取判断错误

**问题描述**：
脚本显示 "Buildkit 镜像拉取成功"，但实际拉取失败。

**原因**：
- 脚本判断逻辑有误，未正确验证镜像是否真的拉取成功

**解决方案**：
已修复 `pull_buildkit_image` 函数：
- 拉取前检查镜像是否已存在
- 拉取后再次验证镜像是否存在
- 改进错误日志输出和退出码处理

**状态**：✅ 已修复

---

### 问题 4: 网络连接不稳定

**问题描述**：
- 镜像拉取频繁超时
- 连接被重置
- DNS 解析失败

**解决方案**：

1. **配置 Docker 镜像加速**（最重要）：
   ```bash
   sudo ./configure-docker-mirrors.sh
   sudo systemctl restart docker
   ```

2. **检查网络连接**：
   ```bash
   # 测试 Docker Hub 连接
   curl -I https://registry-1.docker.io/v2/
   
   # 测试镜像源连接
   curl -I https://docker.mirrors.ustc.edu.cn/v2/
   ```

3. **使用代理**（如果可用）：
   ```bash
   export HTTP_PROXY=http://proxy.example.com:8080
   export HTTPS_PROXY=http://proxy.example.com:8080
   ```

4. **等待网络恢复后重试**

**状态**：⚠️ 持续监控 - 需要稳定的网络连接

---

## 常见问题

### Q: 构建时提示 "failed to resolve source metadata"
A: 网络连接问题。请配置镜像加速或使用代理。

### Q: 容器启动失败，提示架构不匹配
A: 确保使用 `--platform linux/arm64` 参数运行容器。

### Q: 容器运行很慢
A: 在 x86 系统上通过 QEMU 运行 arm64 容器会有性能损失，这是正常的。建议在真实的 ARM 硬件上测试。

### Q: 如何同时支持 amd64 和 arm64？
A: 使用 `docker buildx build --platform linux/amd64,linux/arm64` 构建多架构镜像，然后推送到镜像仓库。

### Q: buildx 构建器启动失败怎么办？
A: 
1. 检查 Docker 镜像加速是否配置并生效
2. 重启 Docker 服务：`sudo systemctl restart docker`
3. 手动拉取 buildkit 镜像：`docker pull moby/buildkit:buildx-stable-1`
4. 删除并重新创建构建器：`docker buildx rm multiarch-arm64`

### Q: 为什么配置了镜像加速还是拉取失败？
A: 
1. 确保已重启 Docker 服务让配置生效
2. 检查镜像加速配置是否正确：`docker info | grep -A 5 "Registry Mirrors"`
3. 某些镜像源可能不稳定，可以尝试其他镜像源
4. buildx 构建器在容器内运行，可能需要额外配置

## 清理

```bash
# 停止并删除容器
docker stop socks-proxy-arm64
docker rm socks-proxy-arm64

# 删除镜像
docker rmi socks-proxy:arm64-latest

# 删除数据目录（可选）
rm -rf ./data-arm64
```

## 故障排查流程

如果遇到构建问题，按以下步骤排查：

1. **检查 Docker 环境**：
   ```bash
   docker --version
   docker buildx version
   docker info | grep -A 5 "Registry Mirrors"
   ```

2. **检查 QEMU 状态**：
   ```bash
   ls -la /proc/sys/fs/binfmt_misc/qemu-aarch64
   ```

3. **检查 buildx 构建器**：
   ```bash
   docker buildx ls
   docker buildx inspect multiarch-arm64
   ```

4. **检查网络连接**：
   ```bash
   curl -I https://docker.mirrors.ustc.edu.cn/v2/
   docker pull hello-world:latest
   ```

5. **查看构建日志**：
   ```bash
   ./build-arm64.sh --host 192.168.2.4 --port 8091 --run 2>&1 | tee build.log
   ```

## 脚本改进记录

### 2024-12-23 更新

1. **QEMU 检测优化**：
   - 自动检测 QEMU 是否已安装
   - 如果已安装，跳过镜像拉取步骤
   - 避免重复拉取导致的网络问题

2. **buildkit 镜像拉取优化**：
   - 拉取前检查镜像是否已存在
   - 拉取后验证镜像是否真的存在
   - 改进错误判断逻辑，避免误报成功

3. **Docker 镜像加速检查**：
   - 自动检查镜像加速配置
   - 显示已配置的镜像源
   - 提供配置建议

4. **错误提示改进**：
   - 更详细的错误信息
   - 提供具体的故障排查步骤
   - 区分不同类型的网络错误

## 相关文件

- `build-arm64.sh`: ARM64 构建脚本（已优化）
- `configure-docker-mirrors.sh`: Docker 镜像加速配置脚本
- `Dockerfile`: 多阶段构建配置
- `docker/`: Docker 相关配置文件

## 更新日志

### 2024-12-23
- ✅ 修复 QEMU 检测逻辑，避免重复拉取
- ✅ 修复 buildkit 镜像拉取判断错误
- ✅ 添加 Docker 镜像加速自动检查
- ✅ 改进错误提示和故障排查建议
- ⚠️ 网络连接问题仍需持续监控

