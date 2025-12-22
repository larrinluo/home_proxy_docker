#!/bin/bash

# 检查Docker构建状态
if [ -f /tmp/docker-build.log ]; then
    echo "=== Build Status ==="
    tail -5 /tmp/docker-build.log
    echo ""
    echo "=== Build Progress ==="
    grep -c "Step" /tmp/docker-build.log 2>/dev/null | awk '{print "Steps completed: " $1 "/44"}'
    echo ""
    echo "=== Docker Images ==="
    docker images | grep socks-proxy || echo "Image not built yet"
    echo ""
    echo "=== Build Process ==="
    ps aux | grep "docker build" | grep -v grep || echo "No build process running"
else
    echo "No build log found"
fi

