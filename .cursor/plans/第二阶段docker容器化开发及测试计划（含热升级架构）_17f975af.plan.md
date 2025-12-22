---
name: 第二阶段Docker容器化开发及测试计划（含热升级架构）
overview: 根据详细方案设计文档，制定第二阶段Docker容器化开发及测试计划，包括Dockerfile编写、配置文件开发、build.sh脚本、多架构支持、数据持久化和完整的测试闭环。特别增加了热升级（零停机升级）的架构准备，包括优雅关闭、健康检查增强、版本管理、数据迁移、滚动更新和回滚机制。
todos:
  - id: dockerignore
    content: 创建.dockerignore文件，排除不必要文件，优化构建上下文
    status: completed
  - id: dockerfile
    content: 编写Dockerfile（多阶段构建），包括构建阶段和运行阶段，优化镜像体积，添加版本标签
    status: completed
    dependencies:
      - dockerignore
  - id: test-dockerfile
    content: 测试Dockerfile构建，验证构建成功、镜像大小和版本信息
    status: completed
    dependencies:
      - dockerfile
  - id: nginx-main
    content: 创建nginx主配置文件（docker/nginx.conf），添加优雅关闭支持
    status: completed
  - id: nginx-site
    content: 创建nginx站点配置文件（docker/nginx-site.conf），包括前端、API代理、PAC文件服务、就绪检查端点
    status: completed
    dependencies:
      - nginx-main
  - id: supervisor
    content: 创建supervisor配置文件（docker/supervisord.conf），管理nginx和nodejs服务，添加停止信号处理
    status: completed
  - id: entrypoint
    content: 创建容器启动脚本（docker/entrypoint.sh），包括数据库初始化、数据库迁移、权限设置
    status: completed
  - id: test-configs
    content: 测试配置文件集成，验证所有配置文件在容器中正常工作，测试数据库迁移
    status: completed
    dependencies:
      - nginx-main
      - nginx-site
      - supervisor
      - entrypoint
  - id: version-management
    content: 实现应用版本管理，创建版本API端点（/api/version），返回版本、构建信息、数据库版本
    status: completed
  - id: graceful-shutdown
    content: 实现优雅关闭（Graceful Shutdown），监听SIGTERM/SIGINT，等待请求完成，停止代理服务，关闭数据库连接
    status: completed
  - id: health-check
    content: 增强健康检查端点，添加存活检查（/health）和就绪检查（/ready），返回详细状态信息
    status: completed
  - id: db-migration
    content: 实现数据库迁移机制，创建migrate.js脚本，支持版本化迁移和迁移记录
    status: completed
  - id: migration-template
    content: 创建数据库迁移脚本模板和命名规范，创建初始迁移脚本
    status: completed
    dependencies:
      - db-migration
  - id: upgrade-script
    content: 创建升级脚本（scripts/upgrade.sh），实现滚动更新：备份数据、启动新容器、健康检查、停止旧容器
    status: completed
    dependencies:
      - version-management
      - health-check
  - id: rollback-script
    content: 创建回滚脚本（scripts/rollback.sh），支持快速回滚到指定版本，检查数据兼容性
    status: completed
    dependencies:
      - version-management
  - id: build-version
    content: 增强build.sh脚本，添加版本管理：版本参数、Git提交哈希、构建时间戳、镜像版本标签
    status: completed
    dependencies:
      - version-management
  - id: build-script
    content: 创建build.sh脚本（基础功能），实现参数解析、IP自动检测、镜像构建、容器启动
    status: completed
    dependencies:
      - dockerfile
  - id: test-build-script
    content: 测试build.sh脚本功能，包括各种参数组合和错误处理
    status: completed
    dependencies:
      - build-script
  - id: buildx-setup
    content: 配置Docker Buildx，创建multiarch builder实例
    status: completed
  - id: test-x86
    content: 测试x86架构构建，验证镜像构建成功和架构信息
    status: completed
    dependencies:
      - buildx-setup
      - dockerfile
  - id: test-arm64
    content: 测试arm64架构构建，验证镜像构建成功和架构信息
    status: completed
    dependencies:
      - buildx-setup
      - dockerfile
  - id: data-structure
    content: 设计数据目录结构，确认database、ssh-keys、logs、pac、backups目录和权限
    status: completed
  - id: volume-mount
    content: 配置Volume挂载，在build.sh和docker-compose中实现数据持久化
    status: completed
    dependencies:
      - data-structure
  - id: backup-script
    content: 创建数据备份脚本（scripts/backup.sh），实现数据库、SSH密钥、配置文件备份，集成到升级脚本
    status: completed
  - id: test-persistence
    content: 测试数据持久化，验证容器重启后数据保留
    status: completed
    dependencies:
      - volume-mount
  - id: docker-compose
    content: 创建docker-compose.yml配置文件，添加健康检查（liveness、readiness、startup probes）
    status: completed
    dependencies:
      - dockerfile
      - volume-mount
      - health-check
  - id: test-graceful-shutdown
    content: 优雅关闭测试：发送SIGTERM信号，验证请求完成、代理服务停止、数据库关闭
    status: completed
    dependencies:
      - graceful-shutdown
  - id: test-migration
    content: 数据库迁移测试：创建测试迁移脚本，执行迁移，验证迁移结果和记录
    status: completed
    dependencies:
      - db-migration
      - migration-template
  - id: test-rolling-update
    content: 滚动更新测试：使用upgrade.sh升级，验证新容器启动、健康检查、旧容器停止、数据保留、服务无中断
    status: completed
    dependencies:
      - upgrade-script
  - id: test-rollback
    content: 回滚测试：使用rollback.sh回滚，验证回滚成功、数据兼容性、服务正常
    status: completed
    dependencies:
      - rollback-script
  - id: test-version
    content: 版本信息测试：访问版本API，验证版本、构建信息、数据库版本信息
    status: completed
    dependencies:
      - version-management
  - id: doc-deployment
    content: 编写部署文档：环境要求、构建步骤、运行步骤、配置说明、热升级步骤、常见问题
    status: completed
    dependencies:
      - test-rolling-update
  - id: doc-usage
    content: 编写使用手册：build.sh使用、docker-compose使用、环境变量配置、数据备份恢复、升级和回滚操作
    status: completed
    dependencies:
      - test-rolling-update
  - id: doc-troubleshooting
    content: 编写故障排查文档：常见问题解决方案、日志查看方法、调试技巧、升级失败处理、回滚操作指南
    status: completed
    dependencies:
      - test-rolling-update
---

# 第二阶段Docker容器化开发及测试计划（含热升级架构）

## 一、计划概述

### 1.1 阶段目标

构建Docker容器，实现一键部署功能，包括：

- Dockerfile编写（多阶段构建优化）
- 配置文件开发（nginx、supervisor、entrypoint.sh）
- build.sh脚本开发
- 多架构支持（x86、arm64）
- 数据持久化配置
- **热升级架构准备（零停机升级）**
- 完整的测试闭环

### 1.2 执行策略

- **串行执行**：严格按照任务顺序执行，一个任务完成后标记成功，再进行下一个任务
- **开发-测试闭环**：每个开发任务完成后立即进行对应的测试验证
- **任务标记**：使用 `[ ]` 和 `[x]` 标记任务状态

## 二、热升级架构设计

### 2.1 热升级需求分析

**目标**：实现零停机时间的容器升级，确保：

- 服务在升级过程中持续可用
- 正在处理的请求能够完成
- 数据不丢失
- 升级失败可快速回滚

### 2.2 热升级架构组件

#### 2.2.1 版本管理

- **镜像版本标签**：语义化版本（v1.0.0）+ 构建标签（build-timestamp, git-commit）
- **应用版本标识**：在应用中暴露版本信息（/api/version）
- **数据库版本管理**：使用schema_migrations表跟踪数据库版本

#### 2.2.2 健康检查增强

- **存活检查（Liveness Probe）**：检测服务是否运行
- **就绪检查（Readiness Probe）**：检测服务是否准备好接收请求
- **启动检查（Startup Probe）**：检测服务是否启动完成

#### 2.2.3 优雅关闭（Graceful Shutdown）

- **SIGTERM信号处理**：接收停止信号后优雅关闭
- **请求完成等待**：等待正在处理的请求完成
- **代理服务优雅停止**：停止所有autossh进程
- **数据库连接关闭**：正确关闭数据库连接
- **超时保护**：设置最大等待时间，超时后强制退出

#### 2.2.4 数据迁移

- **数据库迁移脚本**：版本化的数据库迁移
- **迁移前检查**：检查当前版本和目标版本
- **向后兼容**：确保数据格式向后兼容
- **迁移回滚**：支持迁移失败时回滚

#### 2.2.5 滚动更新策略

- **新容器先启动**：新版本容器启动并健康检查通过后再停止旧容器
- **流量切换**：平滑切换流量到新容器
- **旧容器保留**：保留旧容器一段时间以便回滚

#### 2.2.6 回滚机制

- **镜像版本保留**：保留最近N个版本的镜像
- **快速回滚脚本**：一键回滚到指定版本
- **数据兼容性检查**：回滚前检查数据兼容性

## 三、开发任务清单

### 3.1 Dockerfile开发

#### 任务1：创建.dockerignore文件

- **文件路径**：`.dockerignore`
- **任务内容**：
- 排除node_modules、.git、docs等不必要文件
- 优化构建上下文大小
- **验收标准**：构建上下文大小合理，构建速度提升
- **测试**：验证构建时排除的文件不在构建上下文中

#### 任务2：编写Dockerfile（多阶段构建）

- **文件路径**：`Dockerfile`
- **任务内容**：
- 构建阶段：安装构建依赖，构建前端，安装后端依赖
- 运行阶段：安装运行时依赖（nginx、openssh-client、autossh、supervisor），复制构建产物
- 优化镜像体积（使用Alpine、合并RUN命令）
- 配置ARG和ENV（PROXY_HOST、PROXY_PORT、APP_VERSION）
- 添加版本标签（LABEL version、build-date）
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第10.1.3节
- **验收标准**：镜像成功构建，体积小于500MB，包含版本信息
- **测试**：执行 `docker build` 验证构建成功，检查镜像大小和标签

#### 任务3：测试Dockerfile构建

- **任务内容**：
- 执行构建命令：`docker build --build-arg PROXY_HOST=192.168.1.4 --build-arg PROXY_PORT=8090 -t socks-proxy:test .`
- 验证构建过程无错误
- 检查镜像层结构
- 验证环境变量设置
- 验证版本标签
- **验收标准**：构建成功，镜像可正常创建，版本信息正确
- **测试结果记录**：记录构建时间、镜像大小、构建日志

### 3.2 配置文件开发

#### 任务4：创建nginx主配置文件

- **文件路径**：`docker/nginx.conf`
- **任务内容**：
- 配置worker_processes、worker_connections
- 配置日志格式和路径
- 配置HTTP基础设置
- **添加优雅关闭支持**：配置worker_shutdown_timeout
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第11.5.1节
- **验收标准**：nginx配置语法正确，支持优雅关闭
- **测试**：使用 `nginx -t` 验证配置语法

#### 任务5：创建nginx站点配置文件

- **文件路径**：`docker/nginx-site.conf`
- **任务内容**：
- 配置前端静态文件服务（端口8090）
- 配置PAC文件服务（/proxy.pac）
- 配置后端API代理（/api/ -> localhost:3000）
- 配置健康检查端点（/health）
- **添加就绪检查端点**（/ready）：检查后端服务是否就绪
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第11.5.2节
- **验收标准**：nginx配置语法正确，路由规则正确，包含就绪检查
- **测试**：使用 `nginx -t` 验证配置语法，检查路由配置

#### 任务6：创建supervisor配置文件

- **文件路径**：`docker/supervisord.conf`
- **任务内容**：
- 配置supervisord主进程
- 配置nginx程序管理
- 配置nodejs程序管理
- 配置日志输出路径
- **添加停止信号处理**：配置stopsignal和stopwaitsecs
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第11.2.3节
- **验收标准**：supervisor配置语法正确，支持优雅停止
- **测试**：使用 `supervisord -c docker/supervisord.conf -n` 验证配置

#### 任务7：创建容器启动脚本

- **文件路径**：`docker/entrypoint.sh`
- **任务内容**：
- 初始化数据库（如果不存在）
- **执行数据库迁移**：检查并执行待执行的迁移脚本
- 设置SSH密钥目录权限（700）
- 设置SSH密钥文件权限（600）
- 启动supervisor
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第11.6节
- **验收标准**：脚本可执行，权限设置正确，支持数据库迁移
- **测试**：验证脚本语法，检查权限设置逻辑，测试数据库迁移

#### 任务8：测试配置文件集成

- **任务内容**：
- 在容器中测试nginx配置加载
- 测试supervisor配置加载
- 测试entrypoint.sh执行流程
- 测试数据库迁移执行
- **验收标准**：所有配置文件在容器中正常工作，数据库迁移正常执行
- **测试方法**：构建测试镜像，进入容器验证配置

### 3.3 热升级架构开发

#### 任务9：实现应用版本管理

- **文件路径**：`server/back-end/utils/version.js`（新建）
- **任务内容**：
- 从package.json读取版本号
- 从环境变量读取构建信息（构建时间、Git提交哈希）
- 创建版本API端点：`GET /api/version`
- 返回版本信息：`{ version, buildDate, gitCommit, databaseVersion }`
- **验收标准**：版本信息正确暴露，API端点正常工作
- **测试**：访问版本API，验证返回信息

#### 任务10：实现优雅关闭（Graceful Shutdown）

- **文件路径**：`server/back-end/server.js`（修改）
- **任务内容**：
- 监听SIGTERM和SIGINT信号
- 实现优雅关闭逻辑：

1. 停止接收新请求
2. 等待正在处理的请求完成（设置超时，如30秒）
3. 停止代理服务状态监控
4. 停止所有运行的代理服务（autossh进程）
5. 关闭数据库连接
6. 关闭HTTP服务器
7. 退出进程

- 添加关闭超时保护（最大等待时间）
- **参考**：现有代码已有代理服务优雅停止机制
- **验收标准**：服务能够优雅关闭，正在处理的请求能够完成
- **测试**：发送SIGTERM信号，验证关闭流程

#### 任务11：增强健康检查端点

- **文件路径**：`server/back-end/server.js`（修改）
- **任务内容**：
- **存活检查**：`GET /health` - 检查服务是否运行
- **就绪检查**：`GET /ready` - 检查服务是否准备好（数据库连接、代理服务状态）
- 返回详细状态信息：`{ status, database, services }`
- **验收标准**：健康检查端点正常工作，返回准确的状态信息
- **测试**：访问健康检查端点，验证状态信息

#### 任务12：实现数据库迁移机制

- **文件路径**：`server/back-end/scripts/migrate.js`（新建）
- **任务内容**：
- 读取migrations目录下的迁移脚本
- 检查schema_migrations表，确定已执行的迁移
- 按顺序执行未执行的迁移脚本
- 记录迁移执行结果
- 支持迁移回滚（可选）
- **参考**：已有schema_migrations表结构
- **验收标准**：数据库迁移机制正常工作，能够执行和记录迁移
- **测试**：创建测试迁移脚本，验证迁移执行

#### 任务13：创建数据库迁移脚本模板

- **文件路径**：`migrations/`（目录）
- **任务内容**：
- 创建迁移脚本命名规范：`YYYYMMDD_HHMMSS_description.sql`
- 创建迁移脚本模板
- 创建初始迁移脚本（如果不存在）
- **验收标准**：迁移脚本模板和规范清晰
- **测试**：按照模板创建测试迁移脚本

#### 任务14：创建升级脚本（upgrade.sh）

- **文件路径**：`scripts/upgrade.sh`（新建）
- **任务内容**：
- 检查当前版本和目标版本
- 备份数据（数据库、SSH密钥、配置）
- 拉取新版本镜像
- 执行滚动更新：

1. 启动新容器（使用临时名称）
2. 等待新容器健康检查通过
3. 停止旧容器
4. 重命名新容器为正式名称

- 验证升级结果
- 支持回滚选项
- **验收标准**：升级脚本功能完整，支持滚动更新
- **测试**：测试升级脚本的各种场景

#### 任务15：创建回滚脚本（rollback.sh）

- **文件路径**：`scripts/rollback.sh`（新建）
- **任务内容**：
- 列出可用的历史版本
- 检查数据兼容性
- 执行回滚：

1. 停止当前容器
2. 启动指定版本的容器
3. 验证回滚结果

- 支持数据回滚（如果需要）
- **验收标准**：回滚脚本功能完整，能够快速回滚
- **测试**：测试回滚脚本的各种场景

#### 任务16：增强build.sh脚本（版本管理）

- **文件路径**：`build.sh`（修改）
- **任务内容**：
- 添加版本参数：`--version`、`--build-date`、`--git-commit`
- 自动检测Git提交哈希
- 自动生成构建时间戳
- 在镜像标签中包含版本信息
- 保留历史版本镜像（可选）
- **验收标准**：build.sh支持版本管理，镜像标签包含版本信息
- **测试**：测试build.sh的版本管理功能

### 3.4 build.sh脚本开发

#### 任务17：创建build.sh脚本（基础功能）

- **文件路径**：`build.sh`
- **任务内容**：
- 实现参数解析（--host、--port、--image、--tag、--container、--data-dir、--run、--help）
- 实现Docker环境检查
- 实现IP自动检测功能
- 实现镜像构建功能
- 实现容器启动功能（可选）
- 添加错误处理和颜色输出
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第11.1.2节
- **验收标准**：脚本功能完整，错误处理完善
- **测试**：测试各种参数组合，验证错误处理

#### 任务18：测试build.sh脚本功能

- **任务内容**：
- 测试帮助信息显示：`./build.sh --help`
- 测试IP自动检测：`./build.sh`
- 测试指定参数构建：`./build.sh --host 192.168.1.4 --port 8090`
- 测试构建并运行：`./build.sh --host 192.168.1.4 --run`
- 测试错误处理（Docker未安装、参数错误等）
- **验收标准**：所有功能测试通过
- **测试结果记录**：记录每个测试场景的结果

### 3.5 多架构支持

#### 任务19：配置Docker Buildx

- **任务内容**：
- 创建multiarch builder实例
- 配置buildx环境
- 验证buildx可用性
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第10.4.2节
- **验收标准**：buildx环境配置成功
- **测试**：执行 `docker buildx ls` 验证builder实例

#### 任务20：测试x86架构构建

- **任务内容**：
- 使用buildx构建x86镜像：`docker buildx build --platform linux/amd64 -t socks-proxy:amd64 --load .`
- 验证镜像架构：`docker inspect socks-proxy:amd64 | grep Architecture`
- 测试镜像运行
- **验收标准**：x86镜像构建成功并可运行
- **测试结果记录**：记录构建时间和镜像信息

#### 任务21：测试arm64架构构建

- **任务内容**：
- 使用buildx构建arm64镜像：`docker buildx build --platform linux/arm64 -t socks-proxy:arm64 --load .`
- 验证镜像架构
- 如果环境支持，测试镜像运行
- **验收标准**：arm64镜像构建成功
- **测试结果记录**：记录构建时间和镜像信息

#### 任务22：创建多架构镜像清单（可选）

- **任务内容**：
- 创建manifest：`docker manifest create socks-proxy:latest --amend socks-proxy:amd64 --amend socks-proxy:arm64`
- 推送manifest到仓库（如果有仓库）
- **验收标准**：多架构manifest创建成功
- **测试**：验证manifest包含两个架构

### 3.6 数据持久化

#### 任务23：设计数据目录结构

- **任务内容**：
- 确认数据目录结构：database、ssh-keys、logs、pac、backups
- 确认权限要求
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第11.4.1节
- **验收标准**：目录结构清晰，权限设置合理
- **测试**：验证目录创建和权限设置

#### 任务24：配置Volume挂载

- **任务内容**：
- 在build.sh中实现Volume挂载配置
- 在docker-compose.yml中配置Volume（如果创建）
- 确保数据目录权限正确
- **验收标准**：Volume挂载配置正确
- **测试**：启动容器，验证数据持久化

#### 任务25：创建数据备份脚本

- **文件路径**：`scripts/backup.sh`
- **任务内容**：
- 实现数据库备份
- 实现SSH密钥备份
- 实现配置文件备份
- 添加时间戳和压缩
- **集成到升级脚本**：升级前自动备份
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第11.4.3节
- **验收标准**：备份脚本功能完整，支持自动备份
- **测试**：执行备份脚本，验证备份文件生成

#### 任务26：测试数据持久化

- **任务内容**：
- 启动容器，创建测试数据
- 停止并删除容器
- 重新启动容器，验证数据保留
- **验收标准**：数据在容器重启后保留
- **测试结果记录**：记录数据持久化测试结果

### 3.7 docker-compose配置（可选）

#### 任务27：创建docker-compose.yml

- **文件路径**：`docker-compose.yml`
- **任务内容**：
- 配置服务定义
- 配置端口映射
- 配置Volume挂载
- 配置环境变量
- 配置网络
- **添加健康检查**：配置liveness、readiness、startup probes
- **配置重启策略**：restart: unless-stopped
- **参考**：[详细方案设计.md](docs/设计文档/详细方案设计.md) 第11.2.2节
- **验收标准**：docker-compose配置正确，包含健康检查
- **测试**：使用 `docker-compose config` 验证配置，测试启动

## 四、测试任务清单

### 4.1 Docker构建测试

#### 测试1：基础构建测试

- **测试内容**：
- 执行完整构建流程
- 验证构建无错误
- 检查镜像大小
- 检查镜像层数
- 验证版本标签
- **验收标准**：构建成功，镜像大小<500MB，层数合理，版本信息正确
- **测试结果**：记录构建时间、镜像大小、层数、版本信息

#### 测试2：构建参数测试

- **测试内容**：
- 测试不同PROXY_HOST值
- 测试不同PROXY_PORT值
- 验证环境变量传递
- 验证版本信息传递
- **验收标准**：所有参数正确传递到容器
- **测试结果**：记录参数传递验证结果

### 4.2 容器启动测试

#### 测试3：容器启动测试

- **测试内容**：
- 使用build.sh启动容器
- 验证容器状态（running）
- 验证端口映射
- 验证Volume挂载
- **验收标准**：容器正常启动，所有服务运行正常
- **测试结果**：记录容器状态、端口、Volume信息

#### 测试4：服务健康检查

- **测试内容**：
- 访问健康检查端点：`http://localhost:8090/health`
- 访问就绪检查端点：`http://localhost:8090/ready`
- 验证nginx服务运行
- 验证Node.js服务运行
- 验证supervisor管理服务
- 验证数据库连接状态
- **验收标准**：所有服务健康检查通过，就绪检查正常
- **测试结果**：记录各服务健康状态

### 4.3 热升级功能测试

#### 测试5：优雅关闭测试

- **测试内容**：
- 启动容器并创建一些请求
- 发送SIGTERM信号给容器
- 验证正在处理的请求能够完成
- 验证代理服务优雅停止
- 验证数据库连接正确关闭
- 验证容器正常退出
- **验收标准**：优雅关闭流程正常，无数据丢失
- **测试结果**：记录关闭时间和流程

#### 测试6：数据库迁移测试

- **测试内容**：
- 创建测试迁移脚本
- 执行迁移
- 验证迁移结果
- 验证schema_migrations表记录
- 测试迁移回滚（如果支持）
- **验收标准**：数据库迁移正常执行，记录正确
- **测试结果**：记录迁移执行结果

#### 测试7：滚动更新测试

- **测试内容**：
- 启动v1.0.0版本容器
- 创建测试数据
- 使用upgrade.sh升级到v1.1.0
- 验证新容器启动
- 验证健康检查通过
- 验证旧容器停止
- 验证数据保留
- 验证服务持续可用
- **验收标准**：滚动更新成功，服务无中断，数据保留
- **测试结果**：记录更新时间和流程

#### 测试8：回滚测试

- **测试内容**：
- 升级到新版本
- 发现问题需要回滚
- 使用rollback.sh回滚到旧版本
- 验证回滚成功
- 验证数据兼容性
- 验证服务正常
- **验收标准**：回滚成功，服务正常，数据兼容
- **测试结果**：记录回滚时间和流程

#### 测试9：版本信息测试

- **测试内容**：
- 访问版本API：`GET /api/version`
- 验证版本信息正确
- 验证构建信息正确
- 验证数据库版本信息
- **验收标准**：版本信息准确完整
- **测试结果**：记录版本信息

### 4.4 功能验证测试

#### 测试10：前端访问测试

- **测试内容**：
- 访问前端页面：`http://localhost:8090`
- 验证页面加载正常
- 验证静态资源加载
- 验证SPA路由
- **验收标准**：前端页面正常显示和交互
- **测试结果**：记录前端访问测试结果

#### 测试11：API代理测试

- **测试内容**：
- 测试API请求：`http://localhost:8090/api/health`
- 验证API代理到Node.js服务
- 验证请求头传递
- 验证响应正常
- **验收标准**：API代理功能正常
- **测试结果**：记录API代理测试结果

#### 测试12：PAC文件服务测试

- **测试内容**：
- 访问PAC文件：`http://localhost:8090/proxy.pac`
- 验证Content-Type正确
- 验证CORS头设置
- 验证PAC文件内容
- **验收标准**：PAC文件服务正常
- **测试结果**：记录PAC文件服务测试结果

#### 测试13：核心功能测试

- **测试内容**：
- 用户注册/登录
- 代理服务创建和管理
- Host配置管理
- PAC配置生成
- **验收标准**：所有核心功能在容器中正常工作
- **测试结果**：记录功能测试结果

### 4.5 数据持久化测试

#### 测试14：数据持久化测试

- **测试内容**：
- 创建测试数据（用户、代理服务、Host配置）
- 停止容器
- 重新启动容器
- 验证数据保留
- **验收标准**：所有数据在容器重启后保留
- **测试结果**：记录数据持久化测试结果

#### 测试15：Volume权限测试

- **测试内容**：
- 验证SSH密钥目录权限（700）
- 验证SSH密钥文件权限（600）
- 验证其他目录权限
- **验收标准**：所有权限设置正确
- **测试结果**：记录权限测试结果

### 4.6 多架构测试

#### 测试16：多架构构建测试

- **测试内容**：
- 构建x86镜像并验证
- 构建arm64镜像并验证
- 验证镜像架构信息
- **验收标准**：两个架构镜像构建成功
- **测试结果**：记录多架构构建测试结果

### 4.7 性能测试

#### 测试17：容器性能测试

- **测试内容**：
- 测量容器启动时间
- 测量内存占用
- 测量CPU占用
- 测量镜像大小
- **验收标准**：性能指标在可接受范围内
- **测试结果**：记录性能指标

### 4.8 稳定性测试

#### 测试18：容器重启测试

- **测试内容**：
- 多次重启容器
- 验证服务自动恢复
- 验证数据不丢失
- **验收标准**：容器重启后服务正常
- **测试结果**：记录重启测试结果

#### 测试19：长时间运行测试

- **测试内容**：
- 容器运行24小时
- 监控服务状态
- 检查日志错误
- **验收标准**：长时间运行无异常
- **测试结果**：记录长时间运行测试结果

## 五、文档任务清单

### 5.1 部署文档

#### 任务28：编写部署文档

- **文件路径**：`docs/部署文档/Docker部署指南.md`
- **任务内容**：
- 环境要求
- 构建步骤
- 运行步骤
- 配置说明
- **热升级步骤**
- 常见问题
- **验收标准**：文档完整清晰，包含热升级说明
- **测试**：按照文档执行部署，验证文档准确性

### 5.2 使用手册

#### 任务29：编写使用手册

- **文件路径**：`docs/使用手册/Docker使用手册.md`
- **任务内容**：
- build.sh使用说明
- docker-compose使用说明
- 环境变量配置
- 数据备份和恢复
- **升级和回滚操作**
- **验收标准**：使用手册完整，包含升级回滚说明
- **测试**：按照手册操作，验证准确性

### 5.3 故障排查文档

#### 任务30：编写故障排查文档

- **文件路径**：`docs/故障排查/Docker故障排查.md`
- **任务内容**：
- 常见问题及解决方案
- 日志查看方法
- 调试技巧
- **升级失败处理**
- **回滚操作指南**
- **验收标准**：故障排查文档实用，包含升级相关问题
- **测试**：验证文档中的解决方案有效

## 六、任务执行顺序

### 6.1 开发阶段（串行执行）

**基础开发**：

1. **任务1**：创建.dockerignore文件 → **测试**：验证构建上下文
2. **任务2**：编写Dockerfile → **任务3**：测试Dockerfile构建
3. **任务4**：创建nginx主配置文件 → **测试**：验证nginx配置语法
4. **任务5**：创建nginx站点配置文件 → **测试**：验证nginx配置语法
5. **任务6**：创建supervisor配置文件 → **测试**：验证supervisor配置
6. **任务7**：创建容器启动脚本 → **任务8**：测试配置文件集成

**热升级架构开发**：

7. **任务9**：实现应用版本管理 → **测试**：验证版本API
8. **任务10**：实现优雅关闭 → **测试5**：优雅关闭测试
9. **任务11**：增强健康检查端点 → **测试4**：服务健康检查
10. **任务12**：实现数据库迁移机制 → **任务13**：创建数据库迁移脚本模板 → **测试6**：数据库迁移测试
11. **任务14**：创建升级脚本 → **测试7**：滚动更新测试
12. **任务15**：创建回滚脚本 → **测试8**：回滚测试
13. **任务16**：增强build.sh脚本（版本管理） → **测试9**：版本信息测试

**脚本开发**：

14. **任务17**：创建build.sh脚本（基础功能） → **任务18**：测试build.sh脚本功能

**多架构支持**：

15. **任务19**：配置Docker Buildx → **测试**：验证buildx环境
16. **任务20**：测试x86架构构建
17. **任务21**：测试arm64架构构建
18. **任务22**：创建多架构镜像清单（可选）

**数据持久化**：

19. **任务23**：设计数据目录结构 → **测试**：验证目录结构
20. **任务24**：配置Volume挂载 → **测试**：验证Volume挂载
21. **任务25**：创建数据备份脚本 → **测试**：验证备份功能
22. **任务26**：测试数据持久化

**Docker Compose**：

23. **任务27**：创建docker-compose.yml（可选） → **测试**：验证docker-compose

### 6.2 测试阶段（串行执行）

24. **测试1**：基础构建测试
25. **测试2**：构建参数测试
26. **测试3**：容器启动测试
27. **测试4**：服务健康检查
28. **测试5**：优雅关闭测试
29. **测试6**：数据库迁移测试
30. **测试7**：滚动更新测试
31. **测试8**：回滚测试
32. **测试9**：版本信息测试
33. **测试10**：前端访问测试
34. **测试11**：API代理测试
35. **测试12**：PAC文件服务测试
36. **测试13**：核心功能测试
37. **测试14**：数据持久化测试
38. **测试15**：Volume权限测试
39. **测试16**：多架构构建测试
40. **测试17**：容器性能测试
41. **测试18**：容器重启测试
42. **测试19**：长时间运行测试

### 6.3 文档阶段（串行执行）

43. **任务28**：编写部署文档
44. **任务29**：编写使用手册
45. **任务30**：编写故障排查文档

## 七、验收标准

### 7.1 开发验收标准

- 所有配置文件语法正确
- Docker镜像构建成功
- build.sh脚本功能完整
- 多架构支持正常
- 数据持久化配置正确
- **热升级架构完整**：优雅关闭、健康检查、版本管理、数据迁移、滚动更新、回滚机制

### 7.2 测试验收标准

- 所有测试用例通过
- 容器正常启动和运行
- 所有核心功能正常
- 数据持久化正常
- 性能指标满足要求
- **热升级功能正常**：优雅关闭、滚动更新、回滚机制正常工作

### 7.3 文档验收标准

- 文档完整清晰
- 文档准确性验证通过
- 文档易于理解和使用
- **包含热升级相关文档**

## 八、风险控制

### 8.1 技术风险

- **风险**：多架构构建可能失败
- **应对**：先完成单架构构建，再逐步支持多架构
- **风险**：热升级过程中服务中断
- **应对**：实现完善的健康检查和滚动更新机制，充分测试
- **风险**：数据库迁移失败导致数据丢失
- **应对**：升级前自动备份，支持迁移回滚，充分测试迁移脚本

### 8.2 测试风险

- **风险**：测试环境不一致
- **应对**：使用标准化的测试环境，记录测试结果

### 8.3 文档风险

- **风险**：文档与实际实现不一致
- **应对**：文档编写后立即验证，保持文档更新

## 九、时间估算

根据详细方案设计文档第12.4.2节，并增加热升级架构开发：

- Dockerfile开发：3-5天
- 配置文件开发：2-3天
- **热升级架构开发**：5-7天（新增）
- build.sh脚本开发：2-3天