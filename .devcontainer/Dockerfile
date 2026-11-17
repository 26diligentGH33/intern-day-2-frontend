# 开发容器镜像:Node 22 + 固定版本 pnpm
# 用 Docker Hub 的 node 镜像,国内加速器能覆盖(不依赖 ghcr.io / mcr.microsoft.com)
FROM node:22-bookworm-slim

# 走国内镜像源,装依赖快很多
RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm@11.25.0 \
    && pnpm config set registry https://registry.npmmirror.com

ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /workspaces/intern-day-2-frontend

EXPOSE 5173

CMD ["sleep", "infinity"]
