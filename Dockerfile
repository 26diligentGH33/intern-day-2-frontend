# syntax=docker/dockerfile:1
# 练习项目用 Vite 开发服务器演示,所以这是"开发镜像"而不是生产静态托管镜像。
FROM node:22-bookworm-slim

# pnpm 版本写死,保证本地、容器、CI 装出来的依赖树一致
RUN npm install -g pnpm@11.25.0

WORKDIR /app

# 先装依赖:package.json / 锁文件没变就复用这层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173

# package.json 里的 dev 脚本已经带上 --host 0.0.0.0,容器外才访问得到
CMD ["pnpm", "dev"]
