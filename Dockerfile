FROM ubuntu:22.04

# 安装完整的工具集
RUN apt update && apt install -y \
    sudo \
    curl \
    git \
    wget \
    vim \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 创建用户
RUN useradd -m -s /bin/bash ubuntu && \
    echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# 切换到 ubuntu 用户
USER ubuntu

# 设置工作目录
WORKDIR /home/ubuntu

# 设置默认命令
CMD ["/bin/bash"]