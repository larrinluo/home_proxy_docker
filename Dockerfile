# ==================== 构建阶段 ====================
FROM ubuntu:latest AS builder

# 构建参数：支持HTTP代理配置
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# 配置代理环境变量（如果提供）
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
ENV DEBIAN_FRONTEND=noninteractive

# 先安装ca-certificates以支持HTTPS，然后配置Ubuntu镜像源（使用阿里云镜像加速）
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then \
        sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources && \
        sed -i 's|https://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources && \
        sed -i 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources && \
        sed -i 's|https://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources; \
    else \
        sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
        sed -i 's|https://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
        sed -i 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
        sed -i 's|https://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 更新包列表并安装基础工具
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    python3 \
    python3-pip \
    make \
    g++ \
    build-essential \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装Node.js最新版本（直接下载二进制文件，使用国内镜像加速）
RUN NODE_VERSION=$(curl -sL https://npmmirror.com/mirrors/node/index.json | grep -o '"version":"[^"]*' | head -1 | cut -d'"' -f4) && \
    NODE_VERSION=${NODE_VERSION:-v20.18.0} && \
    ARCH=$(dpkg --print-architecture) && \
    NODE_ARCH=$(case "$ARCH" in amd64) echo "x64" ;; arm64) echo "arm64" ;; armv7l) echo "armv7l" ;; *) echo "x64" ;; esac) && \
    curl -fsSL "https://npmmirror.com/mirrors/node/${NODE_VERSION}/node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && \
    rm -f /tmp/node.tar.xz && \
    ln -sf /usr/local/bin/node /usr/bin/node && \
    ln -sf /usr/local/bin/npm /usr/bin/npm

# 升级npm到最新版本并配置镜像源（使用淘宝镜像加速）
RUN npm install -g npm@latest && \
    npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm config set fetch-timeout 300000 && \
    npm config set maxsockets 15 && \
    npm cache clean --force

# 设置环境变量用于二进制文件下载（node-gyp等工具）
ENV DISTURL=https://npmmirror.com/dist
ENV SASS_BINARY_SITE=https://npmmirror.com/mirrors/node-sass
ENV ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
ENV PUPPETEER_DOWNLOAD_HOST=https://npmmirror.com/mirrors
ENV CHROMEDRIVER_CDNURL=https://npmmirror.com/mirrors/chromedriver
ENV OPERADRIVER_CDNURL=https://npmmirror.com/mirrors/operadriver
ENV PHANTOMJS_CDNURL=https://npmmirror.com/mirrors/phantomjs
ENV SELENIUM_CDNURL=https://npmmirror.com/mirrors/selenium
ENV NODE_INSPECTOR_CDNURL=https://npmmirror.com/mirrors/node-inspector

# 如果提供了代理，配置npm代理
RUN if [ -n "$HTTP_PROXY" ]; then \
        npm config set proxy $HTTP_PROXY && \
        npm config set https-proxy $HTTPS_PROXY; \
    fi

WORKDIR /build

# 复制前端项目
COPY server/front-end/package*.json ./front-end/
WORKDIR /build/front-end
# 使用npm ci加速安装，配置并发数和超时
RUN npm ci \
    --registry=https://registry.npmmirror.com \
    --prefer-offline \
    --no-audit \
    --progress=false \
    --loglevel=error

COPY server/front-end .
RUN npm run build

# 复制后端项目
WORKDIR /build
COPY server/back-end/package*.json ./back-end/
WORKDIR /build/back-end
# 使用npm ci加速安装，配置并发数和超时
RUN npm ci --production \
    --registry=https://registry.npmmirror.com \
    --prefer-offline \
    --no-audit \
    --progress=false \
    --loglevel=error
COPY server/back-end .

# ==================== 运行阶段 ====================
FROM ubuntu:latest AS runtime

ENV DEBIAN_FRONTEND=noninteractive

# 先安装ca-certificates以支持HTTPS，然后配置Ubuntu镜像源（使用阿里云镜像加速）
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then \
        sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources && \
        sed -i 's|https://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources && \
        sed -i 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources && \
        sed -i 's|https://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources; \
    else \
        sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
        sed -i 's|https://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
        sed -i 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list && \
        sed -i 's|https://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list; \
    fi && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 更新包列表并安装运行时依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    xz-utils \
    libatomic1 \
    nginx \
    openssh-client \
    autossh \
    supervisor \
    sqlite3 \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/* && \
    # 确保nginx用户存在（某些Ubuntu版本可能不自动创建）
    id -u nginx >/dev/null 2>&1 || useradd -r -s /bin/false nginx || true

# 安装Node.js最新版本（直接下载二进制文件，使用国内镜像加速）
RUN NODE_VERSION=$(curl -sL https://npmmirror.com/mirrors/node/index.json | grep -o '"version":"[^"]*' | head -1 | cut -d'"' -f4) && \
    NODE_VERSION=${NODE_VERSION:-v20.18.0} && \
    ARCH=$(dpkg --print-architecture) && \
    NODE_ARCH=$(case "$ARCH" in amd64) echo "x64" ;; arm64) echo "arm64" ;; armv7l) echo "armv7l" ;; *) echo "x64" ;; esac) && \
    curl -fsSL "https://npmmirror.com/mirrors/node/${NODE_VERSION}/node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && \
    rm -f /tmp/node.tar.xz && \
    ln -sf /usr/local/bin/node /usr/bin/node && \
    ln -sf /usr/local/bin/npm /usr/bin/npm

# 配置npm镜像源
RUN npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 60000

# 创建非root用户（使用构建参数，默认1000:1000以匹配宿主机用户）
ARG USER_UID=1000
ARG USER_GID=1000
RUN if getent group $USER_GID >/dev/null 2>&1; then \
        GROUP_NAME=$(getent group $USER_GID | cut -d: -f1); \
        groupmod -g $(($USER_GID + 10000)) $GROUP_NAME 2>/dev/null || true; \
    fi && \
    if getent passwd $USER_UID >/dev/null 2>&1; then \
        USER_NAME=$(getent passwd $USER_UID | cut -d: -f1); \
        usermod -u $(($USER_UID + 10000)) $USER_NAME 2>/dev/null || true; \
    fi && \
    groupadd -g $USER_GID appuser 2>/dev/null || true && \
    useradd -u $USER_UID -g appuser -m -s /bin/bash appuser 2>/dev/null || \
    (groupadd -g $USER_GID appuser && useradd -u $USER_UID -g appuser -m -s /bin/bash appuser)

# 创建应用目录
WORKDIR /app

# 复制后端代码和依赖
COPY --from=builder /build/back-end .

# 复制前端构建产物
COPY --from=builder /build/front-end/dist /usr/share/nginx/html

# 复制nginx配置
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx-site.conf /etc/nginx/conf.d/default.conf

# 复制supervisor配置
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 创建数据目录
RUN mkdir -p /data/database /data/ssh-keys /data/logs /data/pac && \
    chmod 700 /data/ssh-keys && \
    chown -R appuser:appuser /app /data

# 复制启动脚本
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 构建参数
ARG PROXY_HOST
ARG PROXY_PORT=8090
ARG APP_VERSION=1.0.0
ARG BUILD_DATE
ARG GIT_COMMIT

# 环境变量
ENV PROXY_HOST=${PROXY_HOST}
ENV PROXY_PORT=${PROXY_PORT}
ENV APP_VERSION=${APP_VERSION}
ENV BUILD_DATE=${BUILD_DATE}
ENV GIT_COMMIT=${GIT_COMMIT}
ENV NODE_ENV=production
ENV PORT=3000

# 版本标签
LABEL version="${APP_VERSION}" \
      build-date="${BUILD_DATE}" \
      git-commit="${GIT_COMMIT}" \
      maintainer="socks-proxy"

# 暴露端口
EXPOSE 8090 11081 11082 11083

# 切换到非root用户（nginx和supervisor需要root，所以这里先不切换）
# USER appuser

# 启动服务
ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]


